"use client";

import { isOfflineModeEnabled } from "@/lib/offline-config";
import { readOfflineBootstrapSnapshot, OfflineBootstrapRequiredError } from "@/lib/offline/offline-bootstrap";
import { db } from "@/lib/powersync/db";

type EnsureReady = () => Promise<void>;

type ReadFallbackOptions<T> = {
    label: string;
    logPrefix: string;
    ensureReady: EnsureReady;
    local: () => Promise<T>;
    server: () => Promise<T>;
    hasUsableLocalData: (result: T) => boolean;
    fallbackOnEmptyLocalResult?: boolean;
};

type MutationFallbackOptions<T> = {
    label: string;
    logPrefix: string;
    ensureReady: EnsureReady;
    local: () => Promise<T>;
    server: () => Promise<T>;
};

function hasLocalOfflineReadiness() {
    const snapshot = readOfflineBootstrapSnapshot();
    return (
        snapshot.minimumDatasetReady ||
        snapshot.hasSynced ||
        db.currentStatus.hasSynced === true
    );
}

function canFallbackToServer() {
    return !isOfflineModeEnabled() || !hasLocalOfflineReadiness();
}

export async function withOfflineReadFallback<T>({
    label,
    logPrefix,
    ensureReady,
    local,
    server,
    hasUsableLocalData,
    fallbackOnEmptyLocalResult = false,
}: ReadFallbackOptions<T>): Promise<T> {
    try {
        await ensureReady();
        const localResult = await local();

        // Un resultado local vacio puede ser perfectamente valido.
        // Solo consultamos al servidor por "resultado vacio" si el caller lo pide
        // explicitamente para un flujo puntual de bootstrap.
        if (!fallbackOnEmptyLocalResult) {
            return localResult;
        }

        if (hasUsableLocalData(localResult) || hasLocalOfflineReadiness()) {
            return localResult;
        }

        return await server();
    } catch (error) {
        if (error instanceof OfflineBootstrapRequiredError) {
            throw error;
        }

        if (canFallbackToServer()) {
            console.warn(`[offline] ${logPrefix} fallback to server for ${label}`, error);
            return server();
        }

        throw error;
    }
}

export async function withOfflineMutationFallback<T>({
    label,
    logPrefix,
    ensureReady,
    local,
    server,
}: MutationFallbackOptions<T>): Promise<T> {
    try {
        await ensureReady();
        return await local();
    } catch (error) {
        if (error instanceof OfflineBootstrapRequiredError) {
            throw error;
        }

        if (canFallbackToServer()) {
            console.warn(`[offline] ${logPrefix} fallback to server for ${label}`, error);
            return server();
        }

        throw error;
    }
}
