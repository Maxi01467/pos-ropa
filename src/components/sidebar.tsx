"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Home,
    ShoppingCart,
    Package,
    Wallet,
    ChevronLeft,
    ChevronRight,
    Store,
    Menu,
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

const navItems = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/nueva-venta", label: "Nueva Venta", icon: ShoppingCart },
    { href: "/inventario", label: "Inventario", icon: Package },
    { href: "/caja", label: "Caja", icon: Wallet },
];

function NavLink({
    item,
    isActive,
    collapsed,
    onClick,
}: {
    item: (typeof navItems)[0];
    isActive: boolean;
    collapsed: boolean;
    onClick?: () => void;
}) {
    const Icon = item.icon;

    const link = (
        <Link
            href={item.href}
            onClick={onClick}
            className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-all duration-200",
                "hover:bg-accent hover:text-accent-foreground",
                isActive
                    ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground"
                    : "text-muted-foreground",
                collapsed && "justify-center px-3"
            )}
        >
            <Icon className="size-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
        </Link>
    );

    if (collapsed) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                    {item.label}
                </TooltipContent>
            </Tooltip>
        );
    }

    return link;
}

function SidebarContent({
    collapsed,
    onToggle,
    onNavClick,
}: {
    collapsed: boolean;
    onToggle?: () => void;
    onNavClick?: () => void;
}) {
    const pathname = usePathname();

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
                {navItems.map((item) => (
                    <NavLink
                        key={item.href}
                        item={item}
                        isActive={pathname === item.href}
                        collapsed={collapsed}
                        onClick={onNavClick}
                    />
                ))}
            </nav>

            {/* Collapse toggle (desktop only) */}
            {onToggle && (
                <div className="border-t p-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onToggle}
                        className={cn(
                            "w-full justify-center text-muted-foreground",
                            !collapsed && "justify-start"
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
                </div>
            )}
        </div>
    );
}

export function Sidebar() {
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
                        <SidebarContent collapsed={false} />
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
                    collapsed={collapsed}
                    onToggle={() => setCollapsed(!collapsed)}
                />
            </aside>
        </>
    );
}
