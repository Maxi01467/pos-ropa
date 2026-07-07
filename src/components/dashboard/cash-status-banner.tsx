"use client";

import { useMemo } from "react";
import { useCashSessionStatus } from "@/lib/session/cash-session-client";

export function CashStatusBanner() {
    const { hasOpenCashSession } = useCashSessionStatus();

    const cashStatus = useMemo(() => {
        if (hasOpenCashSession === true) {
            return {
                label: "Caja abierta",
                detail: "Ventas habilitadas",
                className:
                    "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200",
                dotClassName: "bg-emerald-500",
            };
        }

        if (hasOpenCashSession === false) {
            return {
                label: "Caja cerrada",
                detail: "Abrir caja para vender",
                className:
                    "border-amber-500/30 bg-amber-500/12 text-amber-700 dark:text-amber-200",
                dotClassName: "bg-amber-500",
            };
        }

        return {
            label: "Verificando caja",
            detail: "Consultando estado",
            className: "border-border bg-muted/60 text-muted-foreground",
            dotClassName: "bg-muted-foreground",
        };
    }, [hasOpenCashSession]);

    return (
        <div
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${cashStatus.className}`}
        >
            <span className={`size-3 rounded-full ${cashStatus.dotClassName}`} />
            <div>
                <p className="text-sm font-semibold">{cashStatus.label}</p>
                <p className="text-xs opacity-80">{cashStatus.detail}</p>
            </div>
        </div>
    );
}
