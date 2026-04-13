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
        console.log("[QZ] Cargando módulo qz-tray...");
        qzPromise = import("qz-tray").then((module) => {
            const qz = (module.default ?? module) as QzTrayModule;
            console.log("[QZ] Módulo cargado OK. Configurando seguridad...");

            // Load the digital certificate (public file served from /public/qz/)
            qz.security.setCertificatePromise((resolve, reject) => {
                console.log("[QZ] Fetching certificado desde /qz/digital-certificate.txt ...");
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
                    .then((cert) => {
                        console.log("[QZ] Certificado cargado OK. Primeros 80 chars:", cert.substring(0, 80));
                        resolve(cert);
                    })
                    .catch((err) => {
                        console.error("[QZ] ERROR al cargar certificado:", err);
                        reject(err);
                    });
            });

            // Sign each request via the server-side API route (keeps private key secure)
            // IMPORTANT: Algorithm must match what the server uses (SHA512 with RSA key → SHA512withRSA)
            qz.security.setSignatureAlgorithm("SHA512");
            qz.security.setSignaturePromise((toSign) => {
                return (resolve, reject) => {
                    console.log("[QZ] Firmando request. Longitud del mensaje:", toSign.length);
                    void fetch(`/api/qz-sign?request=${encodeURIComponent(toSign)}`, {
                        cache: "no-store",
                        headers: { "Content-Type": "text/plain" },
                    })
                        .then((res) => {
                            console.log("[QZ] Respuesta del servidor de firma:", res.status, res.statusText);
                            return readTextResponse(
                                res,
                                "No se pudo firmar la solicitud para QZ Tray"
                            );
                        })
                        .then((signature) => {
                            console.log("[QZ] Firma obtenida OK. Longitud:", signature.length);
                            resolve(signature);
                        })
                        .catch((err) => {
                            console.error("[QZ] ERROR al firmar:", err);
                            reject(err);
                        });
                };
            });

            return qz;
        }).catch((error) => {
            console.error("[QZ] ERROR al cargar módulo qz-tray:", error);
            qzPromise = null;
            throw error;
        });
    }

    return qzPromise;
}

async function getConnectedQzTray(): Promise<QzTrayModule> {
    const qz = await loadQzTray();
    if (qz.websocket.isActive()) {
        console.log("[QZ] WebSocket ya está activo, reutilizando conexión.");
        return qz;
    }

    console.log("[QZ] Conectando a QZ Tray...");

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

        // Poll every 500 ms — give the certificate handshake time to complete
        // before declaring the connection active
        const pollId = setInterval(() => {
            if (qz.websocket.isActive()) {
                console.log("[QZ] isActive() = true (via polling)");
                settle(resolve);
            }
        }, 500);

        // Also resolve if the connect Promise itself resolves
        qz.websocket.connect().then(
            () => {
                console.log("[QZ] connect() Promise resolvió OK");
                settle(resolve);
            },
            (err: unknown) => {
                console.error("[QZ] connect() Promise rechazó:", err);
                settle(() => reject(err as Error));
            }
        );

        // Give up after 20 s
        const timeoutId = setTimeout(() => {
            settle(() =>
                reject(
                    new Error(
                        "QZ Tray no respondió en 20 s. Verificá que esté corriendo."
                    )
                )
            );
        }, 20_000);
    });

    console.log("[QZ] Conexión establecida exitosamente.");
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
    console.log(`[QZ] Iniciando impresión: "${jobName}"`);
    const qz = await getConnectedQzTray();
    const printerName = await resolvePrinterName(qz);
    console.log(`[QZ] Imprimiendo en: "${printerName}"`);

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

    console.log(`[QZ] Impresión enviada correctamente a "${printerName}"`);
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

// Exponer función de diagnóstico en la consola del navegador
if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).debugQzTray = async () => {
        console.group("[QZ] === DIAGNÓSTICO QZ TRAY ===");
        try {
            console.log("1. Testeando endpoint /api/qz-sign...");
            const signRes = await fetch("/api/qz-sign?request=test_diagnostico", { cache: "no-store" });
            console.log("   Status:", signRes.status);
            const signText = await signRes.text();
            console.log("   Respuesta (primeros 80 chars):", signText.substring(0, 80));

            console.log("2. Testeando carga del certificado...");
            const certRes = await fetch("/qz/digital-certificate.txt", { cache: "no-store" });
            const certText = await certRes.text();
            console.log("   Status:", certRes.status, "| Longitud:", certText.length);
            console.log("   Primeros 60 chars:", certText.substring(0, 60));

            console.log("3. Conectando a QZ Tray...");
            const qz = await getConnectedQzTray();
            console.log("   Conexión OK. isActive:", qz.websocket.isActive());

            console.log("4. Buscando impresoras...");
            const printers = await qz.printers.find();
            console.log("   Impresoras encontradas:", printers);

            const defaultPrinter = await qz.printers.getDefault();
            console.log("   Impresora por defecto:", defaultPrinter);
        } catch (err) {
            console.error("[QZ] Error en diagnóstico:", err);
        }
        console.groupEnd();
    };
    console.log("[QZ] Función de diagnóstico disponible. Ejecutá: window.debugQzTray()");
}
