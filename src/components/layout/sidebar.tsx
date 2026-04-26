"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    CalendarClock,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    FileText,
    Home,
    LogOut,
    Menu,
    Plus,
    ReceiptText,
    Settings,
    ShoppingCart,
    Users,
    Wallet,
    Boxes,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Sheet,
    SheetContent,
    SheetTrigger,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/core/utils";
import { canAccessPath, type SessionRole } from "@/lib/core/permissions";
import { useCashSessionStatus } from "@/lib/session/cash-session-client";
import { clearLocalSession } from "@/lib/session/session-client";
import { useTerminalSnapshot } from "@/lib/terminal/terminal-client";

const mainItems = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/nueva-venta", label: "Nueva venta", icon: ShoppingCart },
    { href: "/caja", label: "Caja", icon: Wallet },
    { href: "/asistencia", label: "Asistencia", icon: CalendarClock },
] as const;

const workspaceItems = [
    {
        label: "Operacion",
        icon: Boxes,
        badge: 3,
        children: [
            { href: "/inventario", label: "Inventario" },
            { href: "/stock", label: "Stock" },
            { href: "/proveedores", label: "Proveedores" },
        ],
    },
    {
        href: "/boletas",
        label: "Historial caja",
        icon: ReceiptText,
        badge: 1,
    },
    {
        href: "/arqueos",
        label: "Arqueos",
        icon: ClipboardList,
        badge: 1,
    },
    {
        href: "/reportes",
        label: "Reportes",
        icon: FileText,
        badge: 1,
    },
    {
        href: "/empleados",
        label: "Empleados",
        icon: Users,
        badge: 1,
    },
    {
        href: "/configuracion",
        label: "Configuracion",
        icon: Settings,
        hidden: true,
    },
] as const;

function countVisibleWorkspaceChildren(role: SessionRole, isDesktop: boolean) {
    return workspaceItems[0].children.filter((child) =>
        canAccessPath(role, child.href, { isDesktop })
    ).length;
}

function SidebarContent({
    role,
    userName,
    isDesktopClient,
    collapsed,
    onToggleCollapse,
    onNavClick,
}: {
    role: SessionRole;
    userName: string;
    isDesktopClient: boolean;
    collapsed: boolean;
    onToggleCollapse?: () => void;
    onNavClick?: () => void;
}) {
    const pathname = usePathname();
    const { hasOpenCashSession } = useCashSessionStatus();
    const terminal = useTerminalSnapshot();
    const isDesktop = isDesktopClient || terminal.isDesktop;
    const [menuExpanded] = useState(true);
    const [workspaceExpanded, setWorkspaceExpanded] = useState(true);

    const visibleMainItems = mainItems.filter((item) =>
        canAccessPath(role, item.href, { isDesktop })
    );
    const visibleWorkspaceItems = workspaceItems.filter((item) => {
        if ("hidden" in item && item.hidden) {
            return false;
        }

        if ("children" in item) {
            return item.children.some((child) =>
                canAccessPath(role, child.href, { isDesktop })
            );
        }

        return canAccessPath(role, item.href, { isDesktop });
    });

    const initials = userName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");

    const navItemBaseClass =
        "rounded-2xl transform-gpu transition-[background-color,color,box-shadow,transform] duration-150 ease-out";
    const navItemHoverClass = "text-muted-foreground hover:bg-muted/70 hover:text-foreground";

    const handleLogout = () => {
        clearLocalSession();
        window.location.replace("/login?logged_out=1");
    };

    return (
        <TooltipProvider delayDuration={140} skipDelayDuration={80}>
            <aside className="relative isolate flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-white/30 bg-white/22 shadow-[inset_1px_0_0_rgba(255,255,255,0.34),inset_0_1px_0_rgba(255,255,255,0.24),18px_0_48px_-32px_rgba(148,163,184,0.65)] backdrop-blur-3xl backdrop-saturate-[1.9] dark:border-white/14 dark:bg-white/8 dark:shadow-[inset_1px_0_0_rgba(255,255,255,0.12),inset_0_1px_0_rgba(255,255,255,0.08),18px_0_48px_-32px_rgba(0,0,0,0.75)] dark:backdrop-saturate-[1.7]">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                >
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.28)_0%,rgba(255,255,255,0.12)_18%,rgba(255,255,255,0.07)_42%,rgba(255,255,255,0.04)_100%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.04)_18%,rgba(255,255,255,0.03)_42%,rgba(255,255,255,0.02)_100%)]" />
                    <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(255,255,255,0.34)_0%,rgba(255,255,255,0.12)_55%,transparent_100%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.04)_55%,transparent_100%)]" />
                    <div className="absolute -top-16 left-[-18%] h-40 w-52 rounded-full bg-white/28 blur-3xl dark:bg-white/10" />
                    <div className="absolute bottom-12 left-[-12%] h-48 w-48 rounded-full bg-orange-200/18 blur-3xl dark:bg-indigo-400/10" />
                </div>
                {/* Header */}
                <div className="relative flex shrink-0 justify-end border-b border-white/35 p-3 dark:border-white/10">
                    {onToggleCollapse && (
                        <button
                            onClick={onToggleCollapse}
                            type="button"
                            aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
                            className="flex size-8 items-center justify-center rounded-2xl border border-white/35 bg-white/24 text-foreground shadow-[0_10px_24px_-18px_rgba(15,23,42,0.45)] backdrop-blur-xl transform-gpu transition-[background-color,transform,box-shadow] duration-150 ease-out hover:scale-105 hover:bg-white/34 dark:border-white/12 dark:bg-white/8 dark:hover:bg-white/12"
                        >
                            {collapsed ? (
                                <ChevronRight className="size-4" />
                            ) : (
                                <ChevronLeft className="size-4" />
                            )}
                        </button>
                    )}
                </div>

                {/* Nav */}
                <ScrollArea className="relative min-h-0 flex-1 bg-transparent">
                    <div className={cn("relative p-3", collapsed && "px-2")}>
                        {/* Menu section */}
                        <div className="mb-6">
                            {!collapsed && (
                                <div className="mb-3 flex items-center justify-between">
                                    <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                        Menu
                                    </span>
                                    <FileText className="size-3.5 text-muted-foreground" />
                                </div>
                            )}

                            {(menuExpanded || collapsed) && (
                                <nav className={cn("space-y-1.5", collapsed && "space-y-2")}>
                                    {visibleMainItems.map((item) => {
                                        const Icon = item.icon;
                                        const isActive = pathname === item.href;
                                        const isDisabled =
                                            item.href === "/nueva-venta" &&
                                            hasOpenCashSession === false;

                                        const navItem = collapsed ? (
                                            <Tooltip key={item.href}>
                                                <TooltipTrigger asChild>
                                                    <div
                                                        className={cn(
                                                            "flex w-full items-center justify-center p-3",
                                                            navItemBaseClass,
                                                            isActive
                                                                ? "text-white shadow-[0_18px_30px_-20px_rgba(0,0,0,0.7)]"
                                                                : navItemHoverClass,
                                                            isDisabled && "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-muted-foreground"
                                                        )}
                                                        style={isActive ? { background: "linear-gradient(135deg, #17171f 0%, #2c2d3b 100%)" } : undefined}
                                                    >
                                                        <Icon className="size-4.5 shrink-0" />
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent side="right">{item.label}</TooltipContent>
                                            </Tooltip>
                                        ) : (
                                            <div
                                                key={item.href}
                                                className={cn(
                                                    "flex w-full items-center gap-3 px-3 py-3 text-sm font-medium",
                                                    navItemBaseClass,
                                                    isActive
                                                        ? "text-white shadow-[0_18px_30px_-20px_rgba(0,0,0,0.7)]"
                                                        : navItemHoverClass,
                                                    isDisabled && "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-muted-foreground"
                                                )}
                                                style={isActive ? { background: "linear-gradient(135deg, #17171f 0%, #2c2d3b 100%)" } : undefined}
                                            >
                                                <Icon className="size-4.5 shrink-0" />
                                                <span className="flex-1 text-left">{item.label}</span>
                                                {isActive && (
                                                    <span className="rounded-full bg-white/14 px-2 py-0.5 text-[11px] uppercase tracking-[0.14em] text-white/80">
                                                        Activo
                                                    </span>
                                                )}
                                            </div>
                                        );

                                        if (isDisabled) {
                                            return <div key={item.href} title="Abrí la caja para habilitar ventas">{navItem}</div>;
                                        }

                                        return (
                                            <Link key={item.href} href={item.href} onClick={onNavClick}>
                                                {navItem}
                                            </Link>
                                        );
                                    })}
                                </nav>
                            )}
                        </div>

                        {/* Workspace section */}
                        <div>
                            {!collapsed && (
                                <div className="mb-3 flex items-center justify-between">
                                    <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                        Workspace
                                    </span>
                                    <Plus className="size-3.5 text-muted-foreground" />
                                </div>
                            )}

                            <nav className={cn("space-y-1.5", collapsed && "space-y-2")}>
                                {visibleWorkspaceItems.map((item) => {
                                    const Icon = item.icon;

                                    if ("children" in item) {
                                        const visibleChildren = item.children.filter((child) =>
                                            canAccessPath(role, child.href, { isDesktop })
                                        );

                                        if (collapsed) {
                                            return visibleChildren.map((child) => {
                                                const isActive = pathname === child.href;
                                                return (
                                                    <Tooltip key={child.href}>
                                                        <TooltipTrigger asChild>
                                                            <Link href={child.href} onClick={onNavClick}>
                                                                <div
                                                                    className={cn(
                                                                        "flex w-full items-center justify-center p-3",
                                                                        navItemBaseClass,
                                                                        isActive
                                                                            ? "font-medium text-white shadow-[0_18px_28px_-20px_rgba(124,58,237,0.8)]"
                                                                            : navItemHoverClass
                                                                    )}
                                                                    style={isActive ? { background: "linear-gradient(135deg, #6d28d9 0%, #312e81 100%)" } : undefined}
                                                                >
                                                                    <Icon className="size-4.5" />
                                                                </div>
                                                            </Link>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="right">{child.label}</TooltipContent>
                                                    </Tooltip>
                                                );
                                            });
                                        }

                                        return (
                                            <div key={item.label}>
                                                <button
                                                    onClick={() =>
                                                        setWorkspaceExpanded((current) => !current)
                                                    }
                                                    className={cn(
                                                        "flex w-full items-center gap-3 px-3 py-3 text-sm font-medium",
                                                        navItemBaseClass,
                                                        navItemHoverClass
                                                    )}
                                                    type="button"
                                                >
                                                    <ChevronDown
                                                        className={cn(
                                                            "size-4 transition-transform",
                                                            !workspaceExpanded && "-rotate-90"
                                                        )}
                                                    />
                                                    <Icon className="size-4.5" />
                                                    <span className="flex-1 text-left">{item.label}</span>
                                                    <span className="rounded-full bg-[linear-gradient(135deg,#6d28d9_0%,#4c1d95_100%)] px-2 py-0.5 text-xs text-white shadow-[0_12px_24px_-18px_rgba(76,29,149,0.9)]">
                                                        {countVisibleWorkspaceChildren(role, isDesktop)}
                                                    </span>
                                                </button>

                                                {workspaceExpanded && (
                                                    <div className="ml-8 mt-1 space-y-1">
                                                        {visibleChildren.map((child) => (
                                                            <Link
                                                                key={child.href}
                                                                href={child.href}
                                                                onClick={onNavClick}
                                                            >
                                                                <div
                                                                    className={cn(
                                                                        "px-3 py-2.5 text-sm",
                                                                        navItemBaseClass,
                                                                        pathname === child.href
                                                                            ? "font-medium text-white shadow-[0_18px_28px_-20px_rgba(124,58,237,0.8)]"
                                                                            : navItemHoverClass
                                                                    )}
                                                                    style={
                                                                        pathname === child.href
                                                                            ? { background: "linear-gradient(135deg, #6d28d9 0%, #312e81 100%)" }
                                                                            : undefined
                                                                    }
                                                                >
                                                                    {child.label}
                                                                </div>
                                                            </Link>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }

                                    const isActive = pathname === item.href;

                                    if (collapsed) {
                                        return (
                                            <Tooltip key={item.href}>
                                                <TooltipTrigger asChild>
                                                    <Link href={item.href} onClick={onNavClick}>
                                                        <div
                                                            className={cn(
                                                                "flex w-full items-center justify-center p-3",
                                                                navItemBaseClass,
                                                                isActive
                                                                    ? "text-white shadow-[0_18px_30px_-20px_rgba(0,0,0,0.7)]"
                                                                    : navItemHoverClass
                                                            )}
                                                            style={isActive ? { background: "linear-gradient(135deg, #17171f 0%, #2c2d3b 100%)" } : undefined}
                                                        >
                                                            <span className="sr-only">{item.label}</span>
                                                            <Icon className="size-4.5" />
                                                        </div>
                                                    </Link>
                                                </TooltipTrigger>
                                                <TooltipContent side="right">{item.label}</TooltipContent>
                                            </Tooltip>
                                        );
                                    }

                                    return (
                                        <Link key={item.href} href={item.href} onClick={onNavClick}>
                                            <div
                                                className={cn(
                                                    "flex items-center gap-3 px-3 py-3 text-sm font-medium",
                                                    navItemBaseClass,
                                                    isActive
                                                        ? "text-white shadow-[0_18px_30px_-20px_rgba(0,0,0,0.7)]"
                                                        : navItemHoverClass
                                                )}
                                                style={isActive ? { background: "linear-gradient(135deg, #17171f 0%, #2c2d3b 100%)" } : undefined}
                                            >
                                                <span className="w-4" />
                                                <Icon className="size-4.5" />
                                                <span className="flex-1 text-left">{item.label}</span>
                                                {"badge" in item && (
                                                    <span
                                                        className={cn(
                                                            "rounded-full px-2 py-0.5 text-xs",
                                                            isActive
                                                                ? "bg-white/15 text-white"
                                                                : "bg-[linear-gradient(135deg,#6d28d9_0%,#4c1d95_100%)] text-white"
                                                        )}
                                                        style={
                                                            isActive
                                                                ? { background: "linear-gradient(135deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.1) 100%)" }
                                                                : undefined
                                                        }
                                                    >
                                                        {item.badge}
                                                    </span>
                                                )}
                                            </div>
                                        </Link>
                                    );
                                })}
                            </nav>
                        </div>
                    </div>
                </ScrollArea>

                {/* Footer */}
                {!collapsed && (
                    <div className="relative shrink-0 border-t border-white/35 p-3 dark:border-white/10">
                        <div className="mb-2 flex items-center gap-3 rounded-[1.2rem] bg-card/65 px-3 py-2.5 shadow-xs">
                            <div className="flex size-9 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ea580c_0%,#c2410c_100%)] text-sm font-semibold text-orange-50">
                                {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{userName}</p>
                                <p className="text-xs text-muted-foreground">
                                    Sesion activa
                                </p>
                            </div>
                        </div>

                        <Button
                            variant="ghost"
                            onClick={handleLogout}
                            className="h-10 w-full justify-start gap-3 rounded-2xl px-3 text-rose-600 transform-gpu transition-[background-color,color,transform] duration-150 ease-out hover:bg-rose-950/8 hover:text-rose-700 dark:hover:bg-rose-500/12"
                        >
                            <LogOut className="size-4.5 shrink-0" />
                            <span className="text-sm font-medium">Cerrar sesion</span>
                        </Button>
                    </div>
                )}

                {/* Footer colapsado: solo avatar + logout */}
                {collapsed && (
                    <div className="relative flex shrink-0 flex-col items-center gap-2 border-t border-white/35 px-2 py-2 dark:border-white/10">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex size-9 cursor-default items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#ea580c_0%,#c2410c_100%)] text-sm font-semibold text-orange-50">
                                    {initials}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="right">{userName} — Sesion activa</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={handleLogout}
                                    className="flex size-9 items-center justify-center rounded-2xl text-rose-500 transform-gpu transition-[background-color,color,transform] duration-150 ease-out hover:bg-rose-500/10"
                                    type="button"
                                >
                                    <LogOut className="size-4" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right">Cerrar sesion</TooltipContent>
                        </Tooltip>
                    </div>
                )}
            </aside>
        </TooltipProvider>
    );
}

export function Sidebar({
    role,
    userName,
    isDesktopClient,
    collapsed,
    onToggleCollapse,
}: {
    role: SessionRole;
    userName: string;
    isDesktopClient: boolean;
    collapsed: boolean;
    onToggleCollapse: () => void;
}) {
    return (
        <>
            {/* Mobile: Sheet drawer */}
            <div className="lg:hidden fixed top-0 left-0 z-50 p-3">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button
                            variant="outline"
                            size="icon-lg"
                            className="rounded-2xl border-border/70 bg-background/85 backdrop-blur"
                        >
                            <Menu className="size-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-72 p-0">
                        <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
                        <SidebarContent
                            role={role}
                            userName={userName}
                            isDesktopClient={isDesktopClient}
                            collapsed={false}
                        />
                    </SheetContent>
                </Sheet>
            </div>

            {/* Desktop: sticky sidebar con transición de ancho */}
            <aside
                className={cn(
                    "relative z-10 hidden h-screen lg:sticky lg:top-0 lg:flex transition-[width] duration-300 ease-in-out",
                    collapsed ? "w-[72px]" : "w-72"
                )}
            >
                <SidebarContent
                    role={role}
                    userName={userName}
                    isDesktopClient={isDesktopClient}
                    collapsed={collapsed}
                    onToggleCollapse={onToggleCollapse}
                />
            </aside>
        </>
    );
}
