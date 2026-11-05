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

        // El runtime (getCashRuntime) ya usa estrategia server-first: consulta al
        // servidor y solo cae al SQLite local si no hay conexión. Por eso su
        // resultado es autoritativo y no necesitamos una segunda llamada al servidor.
        //
        // Si el runtime falla completamente (error inesperado en la importación o
        // en ambas fuentes), hacemos un último intento directo a la server action.
        try {
            const { getCashRuntime } = await import("@/lib/offline/cash-runtime");
            const cashRuntime = getCashRuntime();
            const session = await cashRuntime.getCurrentSession();
            if (refreshRequestId === latestRefreshRequestId) {
                setCashSessionStatus(Boolean(session));
            }
            return;
        } catch {
            // Runtime falló (ej: PowerSync no inicializado aún).
            // Intentar directamente con el servidor como último recurso.
        }

        try {
            const serverSession = await getServerCurrentSession();
            if (refreshRequestId === latestRefreshRequestId) {
                setCashSessionStatus(Boolean(serverSession));
            }
        } catch {
            // Ambas fuentes fallaron: preservar el último estado conocido.
            // No llamamos a setCashSessionStatus para no mostrar un estado
            // incorrecto por un error de red transitorio.
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
