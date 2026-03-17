"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    Home,
    ShoppingCart,
    Package,
    Wallet,
    ChevronLeft,
    ChevronRight,
    Store,
    Menu,
    Truck,
    BarChart3,
    ReceiptText,
    LogOut,
    Users,
    Clock3,
    ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Sheet,
    SheetContent,
    SheetTrigger,
    SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { canAccessPath, type SessionRole } from "@/lib/permissions";
import { useCashSessionStatus } from "@/lib/cash-session-client";
import { logoutUser } from "@/app/actions/auth-actions";

const navItems = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/nueva-venta", label: "Nueva Venta", icon: ShoppingCart },
    { href: "/inventario", label: "Inventario", icon: Package },
    { href: "/stock", label: "Stock", icon: BarChart3 },
    { href: "/proveedores", label: "Proveedores", icon: Truck },
    { href: "/caja", label: "Caja", icon: Wallet },
    { href: "/arqueos", label: "Arqueos", icon: ClipboardList },
    { href: "/asistencia", label: "Asistencia", icon: Clock3 },
    { href: "/boletas", label: "Historial Caja", icon: ReceiptText },
    { href: "/empleados", label: "Empleados", icon: Users },
] as const;

type NavItem = (typeof navItems)[number];

function NavLink({
    item,
    isActive,
    collapsed,
    disabled = false,
    onClick,
}: {
    item: NavItem;
    isActive: boolean;
    collapsed: boolean;
    disabled?: boolean;
    onClick?: () => void;
}) {
    const Icon = item.icon;

    const content = (
        <div
            className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-all duration-200",
                !disabled && "hover:bg-accent hover:text-accent-foreground",
                isActive
                    ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground"
                    : "text-muted-foreground",
                collapsed && "justify-center px-3",
                disabled && "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-muted-foreground"
            )}
        >
            <Icon className="size-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
        </div>
    );

    const link = disabled ? (
        content
    ) : (
        <Link href={item.href} onClick={onClick}>
            {content}
        </Link>
    );

    if (collapsed) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                    {disabled ? "Abrí la caja para habilitar ventas" : item.label}
                </TooltipContent>
            </Tooltip>
        );
    }

    if (disabled) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                    Abrí la caja para habilitar ventas
                </TooltipContent>
            </Tooltip>
        );
    }

    return link;
}

function SidebarContent({
    role,
    collapsed,
    onToggle,
    onNavClick,
}: {
    role: SessionRole;
    collapsed: boolean;
    onToggle?: () => void;
    onNavClick?: () => void;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const { hasOpenCashSession } = useCashSessionStatus();

    const visibleItems = navItems.filter((item) => canAccessPath(role, item.href));

    const handleLogout = async () => {
        await logoutUser();
        localStorage.removeItem("pos_session");
        localStorage.removeItem("pos_user");
        localStorage.removeItem("pos_role");
        localStorage.removeItem("pos_user_id");
        router.replace("/login");
        router.refresh();
    };

    const logoutButton = (
        <Button
            variant="ghost"
            onClick={handleLogout}
            className={cn(
                "w-full text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors",
                collapsed ? "justify-center px-0 h-10" : "justify-start gap-3 h-12 px-3"
            )}
        >
            <LogOut className="size-5 shrink-0" />
            {!collapsed && <span className="font-medium text-base">Cerrar Sesión</span>}
        </Button>
    );

    return (
        <div className="flex h-full flex-col">
            {/* Header */}
            <div
                className={cn(
                    "flex items-center border-b px-4 py-5",
                    collapsed ? "justify-center" : "gap-3"
                )}
            >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Store className="size-5" />
                </div>
                {!collapsed && (
                    <div className="flex flex-col">
                        <span className="text-base font-bold tracking-tight">Mi Tienda</span>
                        <span className="text-xs text-muted-foreground">
                            Punto de Venta
                        </span>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 p-3">
                {visibleItems.map((item) => (
                    <NavLink
                        key={item.href}
                        item={item}
                        isActive={pathname === item.href}
                        collapsed={collapsed}
                        disabled={item.href === "/nueva-venta" && hasOpenCashSession === false}
                        onClick={onNavClick}
                    />
                ))}
            </nav>

            {/* Bottom Actions (Logout & Collapse) */}
            <div className="border-t p-3 space-y-2">
                {/* Botón de Logout */}
                {collapsed ? (
                    <Tooltip>
                        <TooltipTrigger asChild>{logoutButton}</TooltipTrigger>
                        <TooltipContent side="right" sideOffset={10}>
                            Cerrar Sesión
                        </TooltipContent>
                    </Tooltip>
                ) : (
                    logoutButton
                )}

                {/* Collapse toggle (desktop only) */}
                {onToggle && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onToggle}
                        className={cn(
                            "w-full justify-center text-muted-foreground",
                            !collapsed && "justify-start gap-3 px-3 h-10"
                        )}
                    >
                        {collapsed ? (
                            <ChevronRight className="size-4" />
                        ) : (
                            <>
                                <ChevronLeft className="size-4" />
                                <span>Colapsar</span>
                            </>
                        )}
                    </Button>
                )}
            </div>
        </div>
    );
}

export function Sidebar({ role }: { role: SessionRole }) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <>
            {/* Mobile: Sheet sidebar */}
            <div className="lg:hidden fixed top-0 left-0 z-50 p-3">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="outline" size="icon-lg">
                            <Menu className="size-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-72 p-0">
                        <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
                        <SidebarContent role={role} collapsed={false} />
                    </SheetContent>
                </Sheet>
            </div>

            {/* Desktop: Fixed sidebar */}
            <aside
                className={cn(
                    "hidden lg:flex flex-col border-r bg-card transition-all duration-300 h-screen sticky top-0",
                    collapsed ? "w-[72px]" : "w-64"
                )}
            >
                <SidebarContent
                    role={role}
                    collapsed={collapsed}
                    onToggle={() => setCollapsed(!collapsed)}
                />
            </aside>
        </>
    );
}
