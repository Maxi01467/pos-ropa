"use client";

type TerminalStoragePayload = {
    deviceId?: string | null;
    terminalId?: string | null;
    terminalPrefix?: string | null;
};

function trimOrNull(value: string | null | undefined) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
}

async function readDesktopTerminalConfig() {
    if (typeof window === "undefined" || !window.posDesktop?.getTerminalConfig) {
        return null;
    }

    try {
        const payload = (await window.posDesktop.getTerminalConfig()) as TerminalStoragePayload | null;
        return payload;
    } catch (error) {
        console.warn("No se pudo leer la configuración local de terminal para PowerSync", error);
        return null;
    }
}

export async function getTerminalRequestHeaders() {
    const payload = await readDesktopTerminalConfig();
    const headers: Record<string, string> = {};

    const deviceId = trimOrNull(payload?.deviceId);
    const terminalId = trimOrNull(payload?.terminalId);
    const terminalPrefix = trimOrNull(payload?.terminalPrefix);

    if (deviceId) {
        headers["x-pos-device-id"] = deviceId;
    }

    if (terminalId) {
        headers["x-pos-terminal-id"] = terminalId;
    }

    if (terminalPrefix) {
        headers["x-pos-terminal-prefix"] = terminalPrefix;
    }

    return headers;
}
