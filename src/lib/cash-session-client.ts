"use client";

import { useCallback, useEffect, useState } from "react";
import { getCurrentSession } from "@/app/actions/cash-actions";

const CASH_SESSION_UPDATED_EVENT = "cash-session-updated";

export function notifyCashSessionUpdated() {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event(CASH_SESSION_UPDATED_EVENT));
}

export function useCashSessionStatus() {
    const [hasOpenCashSession, setHasOpenCashSession] = useState<boolean | null>(null);

    const refreshCashSessionStatus = useCallback(async () => {
        try {
            const session = await getCurrentSession();
            setHasOpenCashSession(Boolean(session));
        } catch {
            setHasOpenCashSession(false);
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
