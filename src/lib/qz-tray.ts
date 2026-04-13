"use client";

const QZ_PRINTER_STORAGE_KEY = "pos_qz_printer_name";
const QZ_OPERATION_TIMEOUT_MS = 20000;

type QzTrayModule = {
    websocket: {
        isActive: () => boolean;
        connect: (options?: {
            host?: string | string[];
            usingSecure?: boolean;
            retries?: number;
        }) => Promise<void>;
    };
    printers: {
        find: (query?: string) => Promise<string[]>;
        getDefault: () => Promise<string | null>;
    };
    configs: {
        create: (printer: string, options?: Record<string, unknown>) => unknown;
    };
    security: {
        // QZ Tray's resolve/reject accept string or Promise<string>
        setCertificatePromise: (handler: (resolve: (v: string | Promise<string>) => void, reject: (e: unknown) => void) => void) => void;
        setSignaturePromise: (factory: (dataToSign: string) => (resolve: (v: string | Promise<string>) => void, reject: (e: unknown) => void) => void) => void;
        setSignatureAlgorithm: (algorithm: string) => void;
    };
    print: (config: unknown, data: Array<Record<string, unknown>>) => Promise<void>;
};

let qzPromise: Promise<QzTrayModule> | null = null;

async function readTextResponse(
    response: Response,
    fallbackMessage: string
): Promise<string> {
    const text = (await response.text()).trim();
    if (!response.ok) {
        throw new Error(text || fallbackMessage);
    }
    return text;
}

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
            reject(new Error(message));
        }, QZ_OPERATION_TIMEOUT_MS);

        promise.then(
            (value) => {
                window.clearTimeout(timeoutId);
                resolve(value);
            },
            (error) => {
                window.clearTimeout(timeoutId);
                reject(error);
            }
        );
    });
}

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

            // Load the digital certificate (public file served from /public/qz/)
            qz.security.setCertificatePromise((resolve, reject) => {
                void fetch("/qz/digital-certificate.txt", {
                    cache: "no-store",
                    headers: { "Content-Type": "text/plain" },
                })
                    .then((res) =>
                        readTextResponse(
                            res,
                            "No se pudo cargar el certificado público de QZ Tray"
                        )
                    )
                    .then(resolve)
                    .catch(reject);
            });

            // Sign each request via the server-side API route (keeps private key secure)
            qz.security.setSignatureAlgorithm("SHA512");
            qz.security.setSignaturePromise((toSign) => {
                return (resolve, reject) => {
                    void fetch(`/api/qz-sign?request=${encodeURIComponent(toSign)}`, {
                        cache: "no-store",
                        headers: { "Content-Type": "text/plain" },
                    })
                        .then((res) =>
                            readTextResponse(
                                res,
                                "No se pudo firmar la solicitud para QZ Tray"
                            )
                        )
                        .then(resolve)
                        .catch(reject);
                };
            });

            return qz;
        }).catch((error) => {
            qzPromise = null;
            throw error;
        });
    }

    return qzPromise;
}

async function getConnectedQzTray(): Promise<QzTrayModule> {
    const qz = await loadQzTray();
    if (qz.websocket.isActive()) {
        return qz;
    }

    // QZ Tray's connect() Promise may stall even when the WebSocket is
    // established (blocked on certificate handshake with empty certs).
    // We fire connect() and poll isActive() in parallel — whichever resolves
    // first wins. This avoids both the race-condition timeout and infinite hang.
    await new Promise<void>((resolve, reject) => {
        let settled = false;

        const settle = (fn: () => void) => {
            if (settled) return;
            settled = true;
            clearInterval(pollId);
            clearTimeout(timeoutId);
            fn();
        };

        // Poll every 100 ms — resolves as soon as socket is active
        const pollId = setInterval(() => {
            if (qz.websocket.isActive()) {
                settle(resolve);
            }
        }, 100);

        // Also resolve if the connect Promise itself resolves
        qz.websocket.connect().then(
            () => settle(resolve),
            (err: unknown) => settle(() => reject(err as Error))
        );

        // Give up after 15 s
        const timeoutId = setTimeout(() => {
            settle(() =>
                reject(
                    new Error(
                        "QZ Tray no respondió en 15 s. Verificá que esté corriendo."
                    )
                )
            );
        }, 15_000);
    });

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

    await withTimeout(
        qz.print(config, [
            {
                type: "pixel",
                format: "html",
                flavor: "plain",
                data: html,
            },
        ]),
        "QZ Tray no confirmó la impresión"
    );

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
