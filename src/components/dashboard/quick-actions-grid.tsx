"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
    ArrowRight,
    ShoppingCart,
    Wallet,
    Users,
    Package,
    Shirt,
    ReceiptText,
} from "lucide-react";
import { useSessionSnapshot } from "@/lib/session/session-client";
import { useTerminalSnapshot } from "@/lib/terminal/terminal-client";
import { canAccessPath } from "@/lib/core/permissions";

const quickActions = [
    {
        href: "/nueva-venta",
        label: "Nueva Venta",
        description: "Registrar una venta en mostrador",
        icon: ShoppingCart,
        primary: true,
    },
    {
        href: "/caja",
        label: "Caja",
        description: "Abrir, cerrar o revisar la caja",
        icon: Wallet,
        primary: false,
    },
    {
        href: "/inventario",
        label: "Inventario",
        description: "Productos, precios y codigos",
        icon: Package,
        primary: false,
    },
    {
        href: "/stock",
        label: "Stock",
        description: "Movimientos y faltantes",
        icon: Shirt,
        primary: false,
    },
    {
        href: "/caja?tab=historial",
        label: "Boletas",
        description: "Tickets y operaciones recientes",
        icon: ReceiptText,
        primary: false,
    },
] as const;

export function QuickActionsGrid() {
    const session = useSessionSnapshot();
    const terminal = useTerminalSnapshot();

    const visibleQuickActions = useMemo(() => {
        if (!session.role) {
            return [];
        }

        const role = session.role;
        const isDesktop =
            terminal.isDesktop ||
            (typeof window !== "undefined" && Boolean(window.posDesktop));

        return quickActions.filter((action) =>
            canAccessPath(role, action.href, { isDesktop })
        );
    }, [session.role, terminal.isDesktop]);

    if (visibleQuickActions.length === 0) {
        return null;
    }

    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleQuickActions.map((action) => {
                const Icon = action.icon;

                return (
                    <Link key={action.href} href={action.href} className="group">
                        <div
                            className={
                                action.primary
                                    ? "flex min-h-[156px] flex-col justify-between rounded-2xl bg-foreground p-5 text-background shadow-[0_22px_42px_-30px_rgba(0,0,0,0.65)] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:shadow-foreground/20"
                                    : "flex min-h-[156px] flex-col justify-between rounded-2xl border border-border/70 bg-background/85 p-5 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-foreground/15 hover:shadow-lg hover:shadow-foreground/5"
                            }
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div
                                    className={
                                        action.primary
                                            ? "flex size-12 items-center justify-center rounded-xl bg-background/14"
                                            : "flex size-12 items-center justify-center rounded-xl bg-muted"
                                    }
                                >
                                    <Icon className="size-5" />
                                </div>
                                <ArrowRight className="size-5 transition group-hover:translate-x-1" />
                            </div>
                            <div>
                                <p className="text-lg font-semibold">{action.label}</p>
                                <p
                                    className={
                                        action.primary
                                            ? "mt-2 text-sm leading-6 text-background/72"
                                            : "mt-2 text-sm leading-6 text-muted-foreground"
                                    }
                                >
                                    {action.description}
                                </p>
                            </div>
                        </div>
                    </Link>
                );
            })}
        </div>
    );
}
