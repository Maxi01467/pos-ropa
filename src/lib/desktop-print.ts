"use client";

const DESKTOP_PRINTER_STORAGE_KEY = "pos_desktop_printer_name";

export function isDesktopPrintingAvailable(): boolean {
    return typeof window !== "undefined" && typeof window.posDesktop?.printHtml === "function";
}

export function getStoredDesktopPrinterName(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(DESKTOP_PRINTER_STORAGE_KEY);
}

export function storeDesktopPrinterName(printerName: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DESKTOP_PRINTER_STORAGE_KEY, printerName);
}

export async function printHtmlWithDesktopApp(
    html: string,
    jobName: string
): Promise<string> {
    if (!window.posDesktop?.printHtml) {
        throw new Error("La app de escritorio no está disponible");
    }

    const result = await window.posDesktop.printHtml({
        html,
        jobName,
        printerName: null,
    });

    storeDesktopPrinterName(result.printerName);
    return result.printerName;
}
