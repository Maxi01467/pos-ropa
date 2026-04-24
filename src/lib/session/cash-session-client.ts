"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
// Eliminamos: import { getCurrentSession } from "@/app/actions/cash/cash-actions";
import { CACHE_TAGS } from "@/lib/core/cache-tags";
import { notifyDataUpdated } from "@/lib/sync/data-sync-client";

const CASH_SESSION_UPDATED_EVENT = "cash-session-updated";
const listeners = new Set<() => void>();

let lastKnownCashSessionStatus: boolean | null = null;

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
        try {
            // Importar dinámicamente el local-first runtime para no bloquear la UI si no está listo
            const { getCashRuntime } = await import("@/lib/offline/cash-runtime");
            const cashRuntime = getCashRuntime();
            const session = await cashRuntime.getCurrentSession();
            setCashSessionStatus(Boolean(session));
        } catch {
            setCashSessionStatus(false);
        }
    }, []);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void refreshCashSessionStatus();
        }, 0);

        const handleRefresh = () => {
            void refreshCashSessionStatus();
        };

        window.addEventListener(CASH_SESSION_UPDATED_EVENT, handleRefresh);
        window.addEventListener("focus", handleRefresh);

        return () => {
            window.clearTimeout(timeoutId);
            window.removeEventListener(CASH_SESSION_UPDATED_EVENT, handleRefresh);
            window.removeEventListener("focus", handleRefresh);
        };
    }, [refreshCashSessionStatus]);

    return {
        hasOpenCashSession,
        refreshCashSessionStatus,
    };
}
