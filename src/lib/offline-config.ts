const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

function isEnabled(value: string | undefined): boolean {
    if (!value) {
        return false;
    }

    return ENABLED_VALUES.has(value.trim().toLowerCase());
}

export function isOfflineModeEnabled(): boolean {
    return isEnabled(process.env.NEXT_PUBLIC_POWERSYNC_ENABLED);
}

export function getPowerSyncEndpoint(): string | null {
    const endpoint = process.env.NEXT_PUBLIC_POWERSYNC_URL?.trim();
    return endpoint ? endpoint : null;
}

export function getPowerSyncServerConfig() {
    const endpoint = getPowerSyncEndpoint();
    const audience = process.env.POWERSYNC_JWT_AUDIENCE?.trim() || endpoint || "";

    return {
        enabled: isOfflineModeEnabled(),
        endpoint,
        audience,
        privateKey: process.env.POWERSYNC_PRIVATE_KEY?.trim() || "",
        keyId: process.env.POWERSYNC_KID?.trim() || "",
        issuer: process.env.POWERSYNC_JWT_ISSUER?.trim() || "pos-ropa-nextjs",
        syncSubject: process.env.POWERSYNC_SYNC_SUBJECT?.trim() || "pos-ropa-default-device",
    };
}
