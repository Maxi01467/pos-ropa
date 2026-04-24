"use client";

import { useSyncExternalStore } from "react";
import { isOfflineModeEnabled } from "@/lib/offline-config";
import { db, initPowerSync } from "@/lib/powersync/db";

export type OfflineBootstrapState = "unknown" | "checking" | "ready_offline" | "requires_initial_sync";

export type OfflineBootstrapSnapshot = {
    state: OfflineBootstrapState;
    isOnline: boolean;
    hasSynced: boolean;
    minimumDatasetReady: boolean;
    activeUsers: number;
    productCount: number;
    checkedAt: string | null;
    lastSuccessfulSyncAt: string | null;
};

const STORAGE_KEY = "pos_offline_bootstrap_v1";
const UPDATE_EVENT = "pos-offline-bootstrap-updated";

const DEFAULT_SNAPSHOT: OfflineBootstrapSnapshot = {
    state: "unknown",
    isOnline: true,
    hasSynced: false,
    minimumDatasetReady: false,
    activeUsers: 0,
    productCount: 0,
    checkedAt: null,
    lastSuccessfulSyncAt: null,
};

let lastSnapshot: OfflineBootstrapSnapshot = DEFAULT_SNAPSHOT;
let lastSnapshotKey = JSON.stringify(DEFAULT_SNAPSHOT);
let refreshTimer: number | null = null;

export class OfflineBootstrapRequiredError extends Error {
    constructor(message = getOfflineBootstrapRequiredMessage()) {
        super(message);
        this.name = "OfflineBootstrapRequiredError";
    }
}

function getIsOnline() {
    if (typeof navigator === "undefined") {
        return true;
    }

    const browserOnline = navigator.onLine;
    if (!browserOnline) {
        return false;
    }

    if (!isOfflineModeEnabled()) {
        return browserOnline;
    }

    const status = db.currentStatus;
    if (status.connected || status.connecting) {
        return true;
    }

    if (status.hasSynced === true) {
        return false;
    }

    return browserOnline;
}

function readStoredSnapshot(): OfflineBootstrapSnapshot {
    if (typeof window === "undefined") {
        return DEFAULT_SNAPSHOT;
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        const snapshot: OfflineBootstrapSnapshot = !raw
            ? {
                ...DEFAULT_SNAPSHOT,
                isOnline: getIsOnline(),
            }
            : (() => {
                const parsed = JSON.parse(raw) as Partial<OfflineBootstrapSnapshot>;
                return {
                    state:
                        parsed.state === "checking" ||
                        parsed.state === "ready_offline" ||
                        parsed.state === "requires_initial_sync"
                            ? parsed.state
                            : "unknown",
                    isOnline: getIsOnline(),
                    hasSynced: parsed.hasSynced === true,
                    minimumDatasetReady: parsed.minimumDatasetReady === true,
                    activeUsers: Number.isFinite(parsed.activeUsers) ? Number(parsed.activeUsers) : 0,
                    productCount: Number.isFinite(parsed.productCount) ? Number(parsed.productCount) : 0,
                    checkedAt: typeof parsed.checkedAt === "string" ? parsed.checkedAt : null,
                    lastSuccessfulSyncAt:
                        typeof parsed.lastSuccessfulSyncAt === "string" ? parsed.lastSuccessfulSyncAt : null,
                };
            })();

        const snapshotKey = JSON.stringify(snapshot);
        if (snapshotKey === lastSnapshotKey) {
            return lastSnapshot;
        }

        lastSnapshot = snapshot;
        lastSnapshotKey = snapshotKey;
        return snapshot;
    } catch {
        const snapshot = {
            ...DEFAULT_SNAPSHOT,
            isOnline: getIsOnline(),
        };
        const snapshotKey = JSON.stringify(snapshot);
        if (snapshotKey === lastSnapshotKey) {
            return lastSnapshot;
        }

        lastSnapshot = snapshot;
        lastSnapshotKey = snapshotKey;
        return snapshot;
    }
}

function emitUpdate() {
    if (typeof window === "undefined") {
        return;
    }

    window.dispatchEvent(new Event(UPDATE_EVENT));
}

function persistSnapshot(snapshot: OfflineBootstrapSnapshot) {
    if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    }

    emitUpdate();
    return snapshot;
}

function setCheckingSnapshot() {
    const current = readStoredSnapshot();
    return persistSnapshot({
        ...current,
        state: "checking",
        isOnline: getIsOnline(),
    });
}

function countRowToNumber(row: { count: number | string | null } | null) {
    const parsed = Number(row?.count ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

export function getOfflineBootstrapRequiredMessage() {
    return "Este equipo necesita una sincronización inicial online antes de poder trabajar sin internet.";
}

export function readOfflineBootstrapSnapshot() {
    return readStoredSnapshot();
}

export function isOfflineBootstrapReady(snapshot = readStoredSnapshot()) {
    return snapshot.state === "ready_offline" && snapshot.minimumDatasetReady;
}

export function shouldBlockForOfflineBootstrap(snapshot = readStoredSnapshot()) {
    return (
        isOfflineModeEnabled() &&
        snapshot.isOnline === false &&
        snapshot.state === "requires_initial_sync"
    );
}

export function assertOfflineBootstrapReady(snapshot = readStoredSnapshot()) {
    if (shouldBlockForOfflineBootstrap(snapshot)) {
        throw new OfflineBootstrapRequiredError();
    }
}

export async function refreshOfflineBootstrapState(): Promise<OfflineBootstrapSnapshot> {
    if (!isOfflineModeEnabled()) {
        return persistSnapshot({
            ...DEFAULT_SNAPSHOT,
            state: "ready_offline",
            isOnline: getIsOnline(),
            minimumDatasetReady: true,
            checkedAt: new Date().toISOString(),
            lastSuccessfulSyncAt: new Date().toISOString(),
        });
    }

    setCheckingSnapshot();
    await initPowerSync();

    const [activeUsersRow, productCountRow] = await Promise.all([
        db.getOptional<{ count: number | string | null }>(
            `
                SELECT COUNT(*) AS count
                FROM "User"
                WHERE deletedAt IS NULL
                  AND active = 1
            `
        ),
        db.getOptional<{ count: number | string | null }>(
            `
                SELECT COUNT(*) AS count
                FROM "Product"
                WHERE deletedAt IS NULL
            `
        ),
    ]);

    const activeUsers = countRowToNumber(activeUsersRow);
    const productCount = countRowToNumber(productCountRow);
    const hasSynced = db.currentStatus.hasSynced === true;
    const minimumDatasetReady = activeUsers > 0;
    const state: OfflineBootstrapState =
        minimumDatasetReady ? "ready_offline" : "requires_initial_sync";
    const previous = readStoredSnapshot();
    const checkedAt = new Date().toISOString();

    return persistSnapshot({
        state,
        isOnline: getIsOnline(),
        hasSynced,
        minimumDatasetReady,
        activeUsers,
        productCount,
        checkedAt,
        lastSuccessfulSyncAt:
            hasSynced && minimumDatasetReady
                ? checkedAt
                : previous.lastSuccessfulSyncAt,
    });
}

export function scheduleOfflineBootstrapRefresh(delayMs = 150) {
    if (typeof window === "undefined") {
        return;
    }

    if (refreshTimer) {
        window.clearTimeout(refreshTimer);
    }

    refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void refreshOfflineBootstrapState().catch((error) => {
            console.warn("No se pudo refrescar el estado de bootstrap offline", error);
        });
    }, delayMs);
}

function subscribe(callback: () => void) {
    if (typeof window === "undefined") {
        return () => {};
    }

    const handler = () => callback();
    const disposeDbListener = db.registerListener({
        statusChanged: () => callback(),
    });

    window.addEventListener("storage", handler);
    window.addEventListener("online", handler);
    window.addEventListener("offline", handler);
    window.addEventListener(UPDATE_EVENT, handler);

    return () => {
        disposeDbListener();
        window.removeEventListener("storage", handler);
        window.removeEventListener("online", handler);
        window.removeEventListener("offline", handler);
        window.removeEventListener(UPDATE_EVENT, handler);
    };
}

export function useOfflineBootstrap() {
    return useSyncExternalStore(subscribe, readStoredSnapshot, () => DEFAULT_SNAPSHOT);
}
