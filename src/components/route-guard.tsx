// src/components/route-guard.tsx
"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useCashSessionStatus } from "@/lib/cash-session-client";

export function RouteGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { hasOpenCashSession } = useCashSessionStatus();
    const isSalesRoute = pathname === "/nueva-venta";

    useEffect(() => {
        if (isSalesRoute && hasOpenCashSession === false) {
            router.push("/caja");
        }
    }, [hasOpenCashSession, isSalesRoute, router]);

    if (isSalesRoute && hasOpenCashSession === null) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="size-10 animate-spin text-emerald-700" />
            </div>
        );
    }

    if (isSalesRoute && hasOpenCashSession === false) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="size-10 animate-spin text-emerald-700" />
            </div>
        );
    }

    return <>{children}</>;
}
