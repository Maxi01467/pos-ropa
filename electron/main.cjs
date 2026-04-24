/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, dialog, ipcMain, safeStorage, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const { randomUUID } = require("crypto");
const fs = require("fs");
const net = require("net");
const path = require("path");
const http = require("http");

const DEV_URL = process.env.ELECTRON_RENDERER_URL || "http://localhost:3000";
const PROD_HOST = "127.0.0.1";
const PROD_PORT_START = 3210;
const PROD_PORT_MAX_ATTEMPTS = 5;
const CREDENTIALS_FILENAME = "credentials.bin";
const LOG_FILENAME = "desktop.log";
const TERMINAL_CONFIG_FILENAME = "terminal-config.json";

let localServerPromise;
let updateReadyDialogShown = false;
let updateCheckScheduled = false;

function getLogPath() {
    return path.join(app.getPath("userData"), LOG_FILENAME);
}

function appendDesktopLog(message) {
    try {
        fs.mkdirSync(path.dirname(getLogPath()), { recursive: true });
        fs.appendFileSync(
            getLogPath(),
            `[${new Date().toISOString()}] ${message}\n`,
            "utf8"
        );
    } catch {
        // Ignore logging failures.
    }
}

function getTerminalConfigPath() {
    return path.join(app.getPath("userData"), TERMINAL_CONFIG_FILENAME);
}

function readTerminalConfigFile() {
    try {
        if (!fs.existsSync(getTerminalConfigPath())) {
            return null;
        }

        return JSON.parse(fs.readFileSync(getTerminalConfigPath(), "utf8"));
    } catch (error) {
        appendDesktopLog(
            `terminal-config: read error ${error instanceof Error ? error.message : String(error)}`
        );
        return null;
    }
}

function writeTerminalConfigFile(payload) {
    fs.mkdirSync(path.dirname(getTerminalConfigPath()), { recursive: true });
    fs.writeFileSync(getTerminalConfigPath(), JSON.stringify(payload, null, 2), "utf8");
    return payload;
}

function getTerminalConfig() {
    const existing = readTerminalConfigFile() || {};
    const deviceId =
        typeof existing.deviceId === "string" && existing.deviceId.trim()
            ? existing.deviceId.trim()
            : randomUUID();

    const normalized = {
        deviceId,
        terminalId:
            typeof existing.terminalId === "string" && existing.terminalId.trim()
                ? existing.terminalId.trim()
                : null,
        terminalPrefix:
            typeof existing.terminalPrefix === "string" && existing.terminalPrefix.trim()
                ? existing.terminalPrefix.trim().toUpperCase()
                : null,
        terminalName:
            typeof existing.terminalName === "string" && existing.terminalName.trim()
                ? existing.terminalName.trim()
                : null,
    };

    writeTerminalConfigFile(normalized);
    return normalized;
}

function saveTerminalConfig(input) {
    const current = getTerminalConfig();
    const next = {
        deviceId: current.deviceId,
        terminalId:
            typeof input?.terminalId === "string" && input.terminalId.trim()
                ? input.terminalId.trim()
                : current.terminalId,
        terminalPrefix:
            typeof input?.terminalPrefix === "string" && input.terminalPrefix.trim()
                ? input.terminalPrefix.trim().toUpperCase()
                : current.terminalPrefix,
        terminalName:
            typeof input?.terminalName === "string" && input.terminalName.trim()
                ? input.terminalName.trim()
                : current.terminalName,
    };

    return writeTerminalConfigFile(next);
}

// ---------------------------------------------------------------------------
// Auto-updates
// ---------------------------------------------------------------------------

function scheduleAutoUpdateCheck(mainWindow) {
    if (!app.isPackaged || updateCheckScheduled) return;

    updateCheckScheduled = true;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on("checking-for-update", () => {
        appendDesktopLog("auto-update: checking for updates");
    });

    autoUpdater.on("update-available", (info) => {
        appendDesktopLog(`auto-update: update available version=${info?.version || "unknown"}`);
    });

    autoUpdater.on("update-not-available", (info) => {
        appendDesktopLog(`auto-update: no updates available current=${app.getVersion()} latest=${info?.version || "unknown"}`);
    });

    autoUpdater.on("download-progress", (progress) => {
        appendDesktopLog(
            `auto-update: download progress percent=${progress.percent?.toFixed?.(1) || "0.0"} transferred=${progress.transferred} total=${progress.total}`
        );
    });

    autoUpdater.on("error", (error) => {
        appendDesktopLog(
            `auto-update: error ${error instanceof Error ? error.stack || error.message : String(error)}`
        );
    });

    autoUpdater.on("update-downloaded", async (info) => {
        appendDesktopLog(`auto-update: update downloaded version=${info?.version || "unknown"}`);

        if (updateReadyDialogShown) return;
        updateReadyDialogShown = true;

        try {
            const targetWindow =
                mainWindow && !mainWindow.isDestroyed()
                    ? mainWindow
                    : BrowserWindow.getAllWindows()[0];

            const { response } = await dialog.showMessageBox(targetWindow, {
                type: "info",
                buttons: ["Reiniciar ahora", "Más tarde"],
                defaultId: 0,
                cancelId: 1,
                title: "Actualización lista",
                message: "Hay una nueva versión de POS Ropa lista para instalar.",
                detail: `Versión descargada: ${info?.version || "nueva versión"}. La aplicación se reiniciará para completar la instalación.`,
            });

            if (response === 0) {
                appendDesktopLog("auto-update: user accepted restart");
                setImmediate(() => autoUpdater.quitAndInstall());
                return;
            }

            appendDesktopLog("auto-update: user postponed installation");
        } catch (error) {
            appendDesktopLog(
                `auto-update: failed to show update dialog ${error instanceof Error ? error.stack || error.message : String(error)}`
            );
        }
    });

    setTimeout(() => {
        appendDesktopLog("auto-update: starting initial check");
        void autoUpdater.checkForUpdatesAndNotify().catch((error) => {
            appendDesktopLog(
                `auto-update: check failed ${error instanceof Error ? error.stack || error.message : String(error)}`
            );
        });
    }, 10000);
}

// ---------------------------------------------------------------------------
// Env file parsing
// ---------------------------------------------------------------------------

function parseEnvLine(rawLine) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return null;
    const sep = line.indexOf("=");
    if (sep === -1) return null;
    const key = line.slice(0, sep).trim();
    let value = line.slice(sep + 1).trim();
    // Strip surrounding quotes ("value" or 'value')
    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        value = value.slice(1, -1);
    }
    return { key, value };
}

function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    const contents = fs.readFileSync(filePath, "utf8");
    for (const rawLine of contents.split(/\r?\n/u)) {
        const parsed = parseEnvLine(rawLine);
        if (parsed && parsed.key && !(parsed.key in process.env)) {
            process.env[parsed.key] = parsed.value;
        }
    }
}

// ---------------------------------------------------------------------------
// safeStorage – OS keychain credential migration
// ---------------------------------------------------------------------------

// These vars are encrypted into the OS keychain on first run so they are not
// left readable in the app's installation directory long-term.
const SENSITIVE_KEYS = ["DATABASE_URL"];

function getCredentialsPath() {
    return path.join(app.getPath("userData"), CREDENTIALS_FILENAME);
}

function readSensitiveEnvFromFile(envFilePath) {
    if (!fs.existsSync(envFilePath)) return {};

    const contents = fs.readFileSync(envFilePath, "utf8");
    const credentials = {};
    for (const rawLine of contents.split(/\r?\n/u)) {
        const parsed = parseEnvLine(rawLine);
        if (parsed && SENSITIVE_KEYS.includes(parsed.key) && parsed.value) {
            credentials[parsed.key] = parsed.value;
        }
    }

    return credentials;
}

function writeCredentialsToSafeStorage(credentials) {
    if (!safeStorage.isEncryptionAvailable()) return false;
    if (!credentials || Object.keys(credentials).length === 0) return false;

    try {
        const encrypted = safeStorage.encryptString(JSON.stringify(credentials));
        fs.mkdirSync(path.dirname(getCredentialsPath()), { recursive: true });
        fs.writeFileSync(getCredentialsPath(), encrypted);
        return true;
    } catch {
        return false;
    }
}

function readCredentialsFromSafeStorage() {
    if (!safeStorage.isEncryptionAvailable()) return null;
    const credPath = getCredentialsPath();
    if (!fs.existsSync(credPath)) return null;

    try {
        const encrypted = fs.readFileSync(credPath);
        return JSON.parse(safeStorage.decryptString(encrypted));
    } catch {
        return null;
    }
}

/**
 * On the very first launch, reads sensitive env vars from the bundled .env
 * and encrypts them into the OS keychain (DPAPI on Windows, Keychain on
 * macOS, libsecret on Linux).
 *
 * The plaintext .env is intentionally left intact as a fallback for OS
 * reinstall / user-profile-wipe scenarios (subsequent runs will re-migrate).
 */
function migrateCredentialsToSafeStorage(envFilePath) {
    if (!safeStorage.isEncryptionAvailable()) return;
    const credPath = getCredentialsPath();
    if (fs.existsSync(credPath)) return; // Already migrated on a previous run

    const credentials = readSensitiveEnvFromFile(envFilePath);

    if (Object.keys(credentials).length === 0) return;

    if (!writeCredentialsToSafeStorage(credentials)) {
        // Non-fatal – the plaintext .env serves as a fallback
        return;
    }

    appendDesktopLog("safeStorage: credentials migrated from bundled env");
}

function syncCredentialsFromBundledEnv(envFilePath) {
    const fileCredentials = readSensitiveEnvFromFile(envFilePath);
    if (Object.keys(fileCredentials).length === 0) return false;

    const storedCredentials = readCredentialsFromSafeStorage();
    const nextSerialized = JSON.stringify(fileCredentials);
    const currentSerialized = storedCredentials ? JSON.stringify(storedCredentials) : null;

    if (nextSerialized === currentSerialized) {
        return false;
    }

    const wrote = writeCredentialsToSafeStorage(fileCredentials);
    if (wrote) {
        appendDesktopLog("safeStorage: credentials refreshed from bundled env");
    }

    return wrote;
}

/**
 * Loads previously-migrated credentials from the OS keychain and injects them
 * into process.env, overriding whatever was loaded from the .env file.
 * Returns true if credentials were loaded successfully.
 */
function loadCredentialsFromSafeStorage() {
    const credentials = readCredentialsFromSafeStorage();
    if (!credentials) return false;

    try {
        for (const [key, value] of Object.entries(credentials)) {
            process.env[key] = value; // Prefer keychain value over .env
        }
        appendDesktopLog("safeStorage: credentials loaded");
        return true;
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Networking
// ---------------------------------------------------------------------------

function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once("error", () => resolve(false));
        server.once("listening", () => server.close(() => resolve(true)));
        server.listen(port, PROD_HOST);
    });
}

/**
 * Tries ports PROD_PORT_START … PROD_PORT_START + PROD_PORT_MAX_ATTEMPTS - 1.
 * This allows multiple POS Ropa instances (e.g. dev + prod) to run side by side.
 */
async function findAvailablePort() {
    for (let i = 0; i < PROD_PORT_MAX_ATTEMPTS; i++) {
        const port = PROD_PORT_START + i;
        if (await isPortAvailable(port)) return port;
    }
    const last = PROD_PORT_START + PROD_PORT_MAX_ATTEMPTS - 1;
    throw new Error(
        `No se encontró un puerto disponible entre ${PROD_PORT_START} y ${last}. ` +
        "Cerrá otras instancias de POS Ropa e intentá de nuevo."
    );
}

function waitForHttpServer(url, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
        const startedAt = Date.now();

        const attempt = () => {
            const request = http.get(url, (response) => {
                response.resume();
                resolve();
            });

            request.on("error", () => {
                if (Date.now() - startedAt >= timeoutMs) {
                    reject(new Error(`No se pudo iniciar el servidor local en ${url}`));
                    return;
                }
                setTimeout(attempt, 300);
            });
        };

        attempt();
    });
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

/**
 * Returns the path to .next/standalone in both dev and packaged modes.
 *
 * When packaged with asar: true + asarUnpack, electron-builder places
 * asarUnpack files at <resources>/app.asar.unpacked/<original-path>.
 * We resolve directly from process.resourcesPath instead of app.getAppPath()
 * so the path is always a real filesystem path (not an asar:// virtual path).
 */
function getStandaloneRoot() {
    if (!app.isPackaged) {
        return path.join(app.getAppPath(), ".next", "standalone");
    }
    return path.join(
        process.resourcesPath,
        "app.asar.unpacked",
        ".next",
        "standalone"
    );
}

// ---------------------------------------------------------------------------
// Local Next.js server startup
// ---------------------------------------------------------------------------

async function getAppUrl() {
    if (!app.isPackaged) return DEV_URL;

    if (!localServerPromise) {
        localServerPromise = (async () => {
            const standaloneRoot = getStandaloneRoot();
            const serverPath = path.join(standaloneRoot, "server.js");
            const envFilePath = path.join(standaloneRoot, ".env");

            if (!fs.existsSync(serverPath)) {
                throw new Error(
                    "Falta .next/standalone/server.js dentro del paquete. " +
                    "Reconstrui el instalador con `npm run build:desktop`."
                );
            }

            // 1. Load all vars from the bundled .env (DATABASE_URL included as fallback)
            loadEnvFile(envFilePath);

            // 2. On first run: encrypt sensitive vars and save them to the OS keychain
            migrateCredentialsToSafeStorage(envFilePath);

            // 2.5. If a newer build ships a different DATABASE_URL, refresh the cached
            // credential so the desktop app does not keep using an outdated database.
            syncCredentialsFromBundledEnv(envFilePath);

            // 3. Override env vars with keychain values when available (more secure)
            //    Falls back silently to the .env values loaded in step 1.
            loadCredentialsFromSafeStorage();

            const port = await findAvailablePort();

            process.env.NODE_ENV = "production";
            process.env.HOSTNAME = PROD_HOST;
            process.env.PORT = String(port);
            process.env.POS_DESKTOP = "1";

            require(serverPath);

            const serverUrl = `http://${PROD_HOST}:${port}`;
            await waitForHttpServer(serverUrl);
            return serverUrl;
        })();
    }

    return localServerPromise;
}

// ---------------------------------------------------------------------------
// Error page
// ---------------------------------------------------------------------------

function buildErrorPage(message) {
    const safeMessage = message
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");

    return `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>POS Ropa - Error de inicio</title>
    <style>
      body {
        margin: 0;
        font-family: system-ui, sans-serif;
        background: #f5efe4;
        color: #1f2937;
      }
      main {
        max-width: 720px;
        margin: 48px auto;
        padding: 24px;
      }
      section {
        background: white;
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 20px 40px rgba(15, 23, 42, 0.08);
      }
      h1 {
        margin-top: 0;
      }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
        background: #f8fafc;
        border-radius: 12px;
        padding: 16px;
      }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>No se pudo abrir POS Ropa</h1>
        <p>La app de escritorio no logró iniciar el servidor local.</p>
        <pre>${safeMessage}</pre>
      </section>
    </main>
  </body>
</html>`)}`;
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

async function createMainWindow() {
    const window = new BrowserWindow({
        width: 1440,
        height: 960,
        minWidth: 1024,
        minHeight: 720,
        backgroundColor: "#f5efe4",
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    window.webContents.setWindowOpenHandler(({ url }) => {
        void shell.openExternal(url);
        return { action: "deny" };
    });

    window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl) => {
        const message = `No se pudo cargar ${validatedUrl || "la aplicacion"} (${errorCode}): ${errorDescription}`;
        appendDesktopLog(`did-fail-load: ${message}`);
        void window.loadURL(buildErrorPage(message));
    });

    try {
        const appUrl = await getAppUrl();
        await window.loadURL(appUrl);
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Error desconocido al iniciar la app";
        appendDesktopLog(`startup error: ${message}`);
        void dialog.showErrorBox("POS Ropa - Error de inicio", message);
        void window.loadURL(buildErrorPage(message));
    }

    return window;
}

// ---------------------------------------------------------------------------
// Silent printing
// ---------------------------------------------------------------------------

async function printHtmlSilently({ html, jobName, printerName }) {
    const printWindow = new BrowserWindow({
        show: false,
        backgroundColor: "#ffffff",
        webPreferences: {
            sandbox: true,
            backgroundThrottling: false,
        },
    });

    // Crear archivo temporal para guardar el HTML
    // Esto funciona mejor que data: URL para el renderizado en Electron
    const tempDir = path.join(app.getPath("temp"), "pos-print");
    try {
        fs.mkdirSync(tempDir, { recursive: true });
    } catch {
        // Ignore
    }
    
    const tempHtmlFile = path.join(tempDir, `receipt-${Date.now()}.html`);
    
    try {
        // Guardar HTML a archivo
        fs.writeFileSync(tempHtmlFile, html, "utf-8");
        const fileUrl = `file://${tempHtmlFile}`;
        
        await printWindow.loadURL(fileUrl);
        
        // Esperar a que se renderice correctamente y medir la altura real del contenido
        const contentHeight = await printWindow.webContents.executeJavaScript(`
            new Promise((resolve) => {
                // Esperar a que las fuentes estén listas
                const waitForFonts = document.fonts?.ready 
                    ? document.fonts.ready 
                    : Promise.resolve();

                waitForFonts.then(() => {
                    // Usar requestAnimationFrame para asegurar que el layout está completo
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            // Medir la altura real del documento
                            const bodyHeight = document.body.scrollHeight || document.body.offsetHeight;
                            const documentHeight = document.documentElement.scrollHeight || document.documentElement.offsetHeight;
                            const contentHeight = Math.max(bodyHeight, documentHeight);
                            
                            resolve(contentHeight);
                        });
                    });
                }).catch((err) => {
                    // Si falla fonts.ready, intentar de todas formas
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            const bodyHeight = document.body.scrollHeight || document.body.offsetHeight;
                            const documentHeight = document.documentElement.scrollHeight || document.documentElement.offsetHeight;
                            const contentHeight = Math.max(bodyHeight, documentHeight);
                            resolve(contentHeight);
                        });
                    });
                });
            });
        `);
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Convertir píxeles a milímetros (1mm ≈ 3.78px en pantalla)
        // Para valores de impresión, usamos 96 DPI = 3.78px/mm
        const contentHeightMm = Math.ceil(contentHeight / 3.78);
        // Usar altura real medida + margen de seguridad generoso pero no excesivo
        // Mínimo 120mm para asegurar que las térmicas procesen correctamente
        const finalHeightMicrons = Math.max((contentHeightMm + 30) * 1000, 120000);

        const availablePrinters = await printWindow.webContents.getPrintersAsync();

        // Detectar automáticamente impresoras térmicas conocidas si no se especifica una
        let thermalPrinterName = null;
        if (!printerName) {
            const thermalKeywords = [
                "pos",
                "thermal",
                "ticket",
                "receipt",
                "hprt",
                "sunmi",
                "zebra",
                "epson",
            ];
            for (const printer of availablePrinters) {
                const lowerName = printer.name.toLowerCase();
                if (thermalKeywords.some((keyword) => lowerName.includes(keyword))) {
                    thermalPrinterName = printer.name;
                    break;
                }
            }
        }

        const attemptPrint = (deviceName) =>
            new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(
                        new Error(
                            `La impresión silenciosa no respondió a tiempo (${deviceName || "predeterminada"})`
                        )
                    );
                }, 15000);

                const printOptions = {
                    silent: true,
                    printBackground: true,
                    jobName,
                    margins: {
                        marginType: "none",
                    },
                    scaleFactor: 100,
                    pageSize: {
                        width: 72000,
                        height: finalHeightMicrons,
                    }
                };

                if (deviceName) {
                    printOptions.deviceName = deviceName;
                }

                printWindow.webContents.print(
                    printOptions,
                    (success, failureReason) => {
                        clearTimeout(timeoutId);
                        if (success) {
                            resolve();
                            return;
                        }

                        reject(
                            new Error(
                                failureReason || "Windows no confirmó la impresión del comprobante"
                            )
                        );
                    }
                );
            });

        const hasRequestedPrinter =
            Boolean(printerName) &&
            availablePrinters.some((printer) => printer.name === printerName);

        try {
            // Intentar con impresora específica (térmica detectada o la que se pidió)
            const printerToUse = hasRequestedPrinter ? printerName : thermalPrinterName;
            await attemptPrint(printerToUse);
            
            const resolvedPrinterName = printerToUse ||
                availablePrinters.find((printer) => printer.isDefault)?.name ||
                "Impresora predeterminada de Windows";

            return { printerName: resolvedPrinterName };
        } catch (firstError) {
            appendDesktopLog(
                `print traditional print failed job="${jobName}" printer="${printerName || thermalPrinterName || "default"}" error="${firstError instanceof Error ? firstError.message : String(firstError)}"`
            );

            // Fallback: intentar con la predeterminada
            if (thermalPrinterName) {
                try {
                    await attemptPrint(null);
                    const defaultPrinterName =
                        availablePrinters.find((printer) => printer.isDefault)?.name ||
                        "Impresora predeterminada de Windows";

                    return { printerName: defaultPrinterName };
                } catch (secondError) {
                    appendDesktopLog(
                        `print traditional retry failed job="${jobName}" error="${secondError instanceof Error ? secondError.message : String(secondError)}"`
                    );
                    throw secondError;
                }
            }

            throw firstError;
        }
    } finally {
        // Limpiar archivo temporal
        try {
            if (fs.existsSync(tempHtmlFile)) {
                fs.unlinkSync(tempHtmlFile);
            }
        } catch (e) {
            appendDesktopLog(`print temp file cleanup error job="${jobName}" error="${e instanceof Error ? e.message : String(e)}"`);
        }
        
        // Cerrar ventana
        if (!printWindow.isDestroyed()) {
            printWindow.close();
        }
    }
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
    appendDesktopLog("desktop app ready");
    ipcMain.handle("pos-desktop:is-available", () => true);
    ipcMain.handle("pos-desktop:print-html", (_event, payload) => printHtmlSilently(payload));
    ipcMain.handle("pos-desktop:get-terminal-config", () => getTerminalConfig());
    ipcMain.handle("pos-desktop:set-terminal-config", (_event, payload) =>
        saveTerminalConfig(payload)
    );

    void createMainWindow().then((mainWindow) => {
        scheduleAutoUpdateCheck(mainWindow);
    });

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            void createMainWindow().then((mainWindow) => {
                scheduleAutoUpdateCheck(mainWindow);
            });
        }
    });
});

process.on("uncaughtException", (error) => {
    appendDesktopLog(`uncaughtException: ${error?.stack || error}`);
});

process.on("unhandledRejection", (reason) => {
    appendDesktopLog(
        `unhandledRejection: ${reason instanceof Error ? reason.stack : String(reason)}`
    );
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
