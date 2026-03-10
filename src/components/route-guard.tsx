// src/components/route-guard.tsx
"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { canAccessPath } from "@/lib/permissions";
import { useSessionSnapshot } from "@/lib/session-client";

export function RouteGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { hasSession, role } = useSessionSnapshot();
    const isLoginRoute = pathname === "/login";

    useEffect(() => {
        if (!hasSession && !isLoginRoute) {
            router.push("/login");
            return;
        }

        if (hasSession && role && !isLoginRoute && !canAccessPath(role, pathname)) {
            router.push("/nueva-venta");
            return;
        }

        if (hasSession && role && isLoginRoute) {
            router.push(role === "ADMIN" ? "/" : "/nueva-venta");
            return;
        }

        if (hasSession && role === "STAFF" && pathname === "/") {
            router.push("/nueva-venta");
            return;
        }
    }, [hasSession, isLoginRoute, pathname, role, router]);

    if (!isLoginRoute && !hasSession) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="size-10 animate-spin text-emerald-600" />
            </div>
        );
    }

    if (!isLoginRoute && (!role || !canAccessPath(role, pathname))) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="size-10 animate-spin text-emerald-600" />
            </div>
        );
    }

    if (isLoginRoute && hasSession) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="size-10 animate-spin text-emerald-600" />
            </div>
        );
    }

    if (hasSession && role === "STAFF" && pathname === "/") {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="size-10 animate-spin text-emerald-600" />
            </div>
        );
    }

    return <>{children}</>;
}
