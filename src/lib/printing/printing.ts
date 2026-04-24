"use client";

import { isDesktopPrintingAvailable, printHtmlWithDesktopApp } from "@/lib/printing/desktop-print";
import { renderReceiptHtml, type ReceiptPrintData } from "@/lib/printing/receipt-printing";

type PrintReceiptResult = {
    channel: "desktop";
    printerName: string;
};

/**
 * Renderiza el HTML en el DOM para asegurar que todos los recursos estén
 * cargados correctamente. Ahora que el CSS usa "size: 80mm 300mm", este
 * paso es principalmente para validar que se renderiza bien.
 */
async function ensureReceiptRendered(html: string): Promise<string> {
    return new Promise((resolve) => {
        try {
            // Crear un iframe temporal para renderizar el HTML de forma aislada
            const iframe = document.createElement("iframe");
            iframe.style.position = "fixed";
            iframe.style.left = "-9999px";
            iframe.style.top = "-9999px";
            iframe.style.visibility = "hidden";
            iframe.style.width = "80mm";
            iframe.style.height = "auto";
            iframe.style.border = "none";
            iframe.frameBorder = "0";
            iframe.scrolling = "no";

            document.body.appendChild(iframe);

            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (!iframeDoc) {
                console.warn("[Print] No se pudo acceder al documento del iframe");
                document.body.removeChild(iframe);
                resolve(html);
                return;
            }

            // Escribir el HTML en el iframe
            iframeDoc.open();
            iframeDoc.write(html);
            iframeDoc.close();

            // Variables para el control de timeout
            let attempts = 0;
            const maxAttempts = 100; // 10 segundos máximo
            let lastHeight = 0;
            let stabilityAttempts = 0;

            const checkMeasurements = () => {
                attempts++;

                const bodyEl = iframeDoc?.body;
                if (!bodyEl) {
                    if (attempts < maxAttempts) {
                        setTimeout(checkMeasurements, 100);
                    } else {
                        console.warn("[Print] Timeout: no se pudo acceder al body del iframe");
                        document.body.removeChild(iframe);
                        resolve(html);
                    }
                    return;
                }

                const currentHeight = bodyEl.scrollHeight;

                // Si la altura es 0, seguir intentando
                if (currentHeight === 0) {
                    if (attempts < maxAttempts) {
                        setTimeout(checkMeasurements, 100);
                    } else {
                        console.warn("[Print] Timeout: iframe no se renderizó (altura = 0)");
                        document.body.removeChild(iframe);
                        resolve(html);
                    }
                    return;
                }

                // Verificar estabilidad de la altura (que no cambie entre mediciones)
                if (currentHeight === lastHeight) {
                    stabilityAttempts++;
                    if (stabilityAttempts >= 2) {
                        // La altura es estable, proceder
                        // El HTML ya tiene size: 80mm 300mm en CSS, así que no reemplazamos
                        // Electron se encargará de ajustar el pageSize basado en la medición real
                        document.body.removeChild(iframe);
                        resolve(html);
                        return;
                    }
                } else {
                    // La altura cambió, resetear contador de estabilidad
                    stabilityAttempts = 0;
                    lastHeight = currentHeight;
                }

                // Si no llegamos a máximo de intentos, seguir esperando
                if (attempts < maxAttempts) {
                    setTimeout(checkMeasurements, 100);
                } else {
                    console.warn(
                        `[Print] Timeout: altura no se estabilizó después de ${attempts * 100}ms (último valor: ${currentHeight}px)`
                    );
                    document.body.removeChild(iframe);
                    resolve(html);
                }
            };

            // Empezar a verificar después de que el frame se renderice
            setTimeout(checkMeasurements, 500);
        } catch (error) {
            console.error("[Print] Error en ensureReceiptRendered:", error);
            resolve(html);
        }
    });
}

async function printReceiptCopy(
    receipt: ReceiptPrintData,
    jobName: string,
    isGift: boolean
): Promise<PrintReceiptResult> {
    let html = renderReceiptHtml(receipt, isGift);

    // Renderizar en el DOM para asegurar que está completo y obtener altura real
    html = await ensureReceiptRendered(html);

    if (isDesktopPrintingAvailable()) {
        const printerName = await printHtmlWithDesktopApp(html, jobName);
        return { channel: "desktop", printerName };
    }

    throw new Error("La app de escritorio no está disponible");
}

export async function printSaleReceipt(
    receipt: ReceiptPrintData
): Promise<PrintReceiptResult> {
    const ticketLabel = receipt.ticketNumber.toString().padStart(5, "0");
    const firstCopy = await printReceiptCopy(receipt, `Boleta ${ticketLabel}`, false);

    if (receipt.giftItems && receipt.giftItems.length > 0) {
        await printReceiptCopy(receipt, `Ticket cambio ${ticketLabel}`, true);
    }

    return firstCopy;
}
