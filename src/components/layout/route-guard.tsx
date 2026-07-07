// src/components/route-guard.tsx
"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useCashSessionStatus } from "@/lib/session/cash-session-client";
import { ScreenLoader } from "@/components/ui/screen-loader";

export function RouteGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { hasOpenCashSession } = useCashSessionStatus();
    const isSalesRoute = pathname === "/nueva-venta" || pathname?.startsWith("/nueva-venta/");
    const bypassOpenSessionCheck = process.env.NODE_ENV === "development"; // Habilitado en modo desarrollo para pruebas

    useEffect(() => {
        if (!bypassOpenSessionCheck && isSalesRoute && hasOpenCashSession === false) {
            router.push("/caja");
        }
    }, [hasOpenCashSession, isSalesRoute, router]);

    if (!bypassOpenSessionCheck && isSalesRoute && (hasOpenCashSession === null || hasOpenCashSession === false)) {
        return <ScreenLoader layout="centered" message="Verificando sesión de caja..." />;
    }

    return <>{children}</>;
}
