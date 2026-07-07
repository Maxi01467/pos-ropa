"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getCurrentSession as getServerCurrentSession } from "@/app/actions/cash/cash-actions";
import { CACHE_TAGS } from "@/lib/core/cache-tags";
import { scheduleOfflineBootstrapRefresh } from "@/lib/offline/offline-bootstrap";
import { notifyDataUpdated } from "@/lib/sync/data-sync-client";

const CASH_SESSION_UPDATED_EVENT = "cash-session-updated";
const listeners = new Set<() => void>();

let lastKnownCashSessionStatus: boolean | null = null;
let latestRefreshRequestId = 0;

function emitChange() {
    listeners.forEach((listener) => listener());
}

function setCashSessionStatus(nextStatus: boolean | null) {
    if (lastKnownCashSessionStatus === nextStatus) return;
    lastKnownCashSessionStatus = nextStatus;
    emitChange();
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function getSnapshot() {
    return lastKnownCashSessionStatus;
}

export function notifyCashSessionUpdated(hasOpenCashSession?: boolean) {
    if (typeof hasOpenCashSession === "boolean") {
        setCashSessionStatus(hasOpenCashSession);
    }

    if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(CASH_SESSION_UPDATED_EVENT));
    }
    notifyDataUpdated([CACHE_TAGS.cash, CACHE_TAGS.attendance]);
}

export function useCashSessionStatus() {
    const hasOpenCashSession = useSyncExternalStore(subscribe, getSnapshot, () => null);

    const refreshCashSessionStatus = useCallback(async () => {
        const refreshRequestId = ++latestRefreshRequestId;
        let localHasOpenSession: boolean | null = null;

        try {
            // Importar dinámicamente el local-first runtime para no bloquear la UI si no está listo.
            const { getCashRuntime } = await import("@/lib/offline/cash-runtime");
            const cashRuntime = getCashRuntime();
            const session = await cashRuntime.getCurrentSession();
            localHasOpenSession = Boolean(session);

            if (localHasOpenSession) {
                if (refreshRequestId === latestRefreshRequestId) {
                    setCashSessionStatus(true);
                }
                return;
            }
        } catch {
            localHasOpenSession = null;
        }

        try {
            const serverSession = await getServerCurrentSession();
            if (refreshRequestId === latestRefreshRequestId) {
                setCashSessionStatus(Boolean(serverSession));
            }
        } catch {
            if (refreshRequestId === latestRefreshRequestId) {
                // Si ambas fuentes fallan (local Y servidor), no asumimos que la caja
                // está cerrada. Preservamos el último estado conocido para evitar que
                // un corte de internet muestre falsamente la caja como cerrada.
                // Solo actualizamos si tenemos información local válida.
                if (localHasOpenSession !== null) {
                    setCashSessionStatus(localHasOpenSession);
                }
                // Si localHasOpenSession es null (ambas fuentes fallaron sin datos),
                // no llamamos a setCashSessionStatus → el estado previo se mantiene.
            }
        }
    }, []);

    useEffect(() => {
        scheduleOfflineBootstrapRefresh();

        const timeoutId = window.setTimeout(() => {
            void refreshCashSessionStatus();
        }, 0);

        const handleRefresh = () => {
            scheduleOfflineBootstrapRefresh();
            void refreshCashSessionStatus();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                handleRefresh();
            }
        };

        window.addEventListener(CASH_SESSION_UPDATED_EVENT, handleRefresh);
        window.addEventListener("focus", handleRefresh);
        window.addEventListener("online", handleRefresh);
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            window.clearTimeout(timeoutId);
            window.removeEventListener(CASH_SESSION_UPDATED_EVENT, handleRefresh);
            window.removeEventListener("focus", handleRefresh);
            window.removeEventListener("online", handleRefresh);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [refreshCashSessionStatus]);

    return {
        hasOpenCashSession,
        refreshCashSessionStatus,
    };
}
