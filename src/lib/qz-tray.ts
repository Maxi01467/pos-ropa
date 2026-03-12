"use client";

const QZ_PRINTER_STORAGE_KEY = "pos_qz_printer_name";

type QzTrayModule = {
    websocket: {
        isActive: () => boolean;
        connect: () => Promise<void>;
    };
    printers: {
        find: (query?: string) => Promise<string[]>;
        getDefault: () => Promise<string | null>;
    };
    configs: {
        create: (printer: string, options?: Record<string, unknown>) => unknown;
    };
    security: {
        setCertificatePromise: (promiseHandler: () => Promise<string> | string) => void;
        setSignaturePromise: (promiseFactory: (dataToSign: string) => Promise<string> | string) => void;
        setSignatureAlgorithm: (algorithm: string) => void;
    };
    print: (config: unknown, data: Array<Record<string, unknown>>) => Promise<void>;
};

let qzPromise: Promise<QzTrayModule> | null = null;

function getStoredPrinterName(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(QZ_PRINTER_STORAGE_KEY);
}

function storePrinterName(printerName: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(QZ_PRINTER_STORAGE_KEY, printerName);
}

async function loadQzTray(): Promise<QzTrayModule> {
    if (!qzPromise) {
        qzPromise = import("qz-tray").then((module) => {
            const qz = (module.default ?? module) as QzTrayModule;
            qz.security.setCertificatePromise(() => Promise.resolve(""));
            qz.security.setSignaturePromise(() => Promise.resolve(""));
            qz.security.setSignatureAlgorithm("SHA256");
            return qz;
        });
    }

    return qzPromise;
}

async function getConnectedQzTray(): Promise<QzTrayModule> {
    const qz = await loadQzTray();
    if (!qz.websocket.isActive()) {
        await qz.websocket.connect();
    }

    return qz;
}

async function resolvePrinterName(qz: QzTrayModule): Promise<string> {
    const storedPrinter = getStoredPrinterName();
    if (storedPrinter) {
        const matchingPrinter = await qz.printers.find(storedPrinter);
        if (matchingPrinter.length > 0) {
            return matchingPrinter[0];
        }
    }

    const defaultPrinter = await qz.printers.getDefault();
    if (defaultPrinter) {
        storePrinterName(defaultPrinter);
        return defaultPrinter;
    }

    const printers = await qz.printers.find();
    if (printers.length > 0) {
        storePrinterName(printers[0]);
        return printers[0];
    }

    throw new Error("QZ Tray no encontró ninguna impresora disponible");
}

export async function printHtmlWithQzTray(html: string, jobName: string): Promise<string> {
    const qz = await getConnectedQzTray();
    const printerName = await resolvePrinterName(qz);
    const config = qz.configs.create(printerName, {
        jobName,
    });

    await qz.print(config, [
        {
            type: "pixel",
            format: "html",
            flavor: "plain",
            data: html,
        },
    ]);

    return printerName;
}

export async function canUseQzTray(): Promise<boolean> {
    try {
        await getConnectedQzTray();
        return true;
    } catch {
        return false;
    }
}
