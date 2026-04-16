"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Bell,
    /* Command, */
    Moon,
    Palette,
    /* Search, */
    /* SlidersHorizontal, */
    Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
/* import { Input } from "@/components/ui/input"; */
import {
    getQuickCreationNotifications,
    markQuickCreationNotificationsSeen,
} from "@/app/actions/inventory-actions";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
    isPosPalette,
    POS_PALETTES,
    POS_PALETTE_STORAGE_KEY,
    type PosPalette,
} from "@/lib/pos-palette";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { useDataRefresh } from "@/lib/data-sync-client";
import type { SessionRole } from "@/lib/permissions";

type QuickCreationNotification = {
    id: string;
    name: string;
    quickCreatedAt: string | null;
    quickCreatedByName: string;
    quickCreatedByRole: string;
    pendingReview: boolean;
};

function getInitials(name: string) {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
}

export function AppHeader({
    userName,
    role,
}: {
    userName: string;
    role: SessionRole;
}) {
    const initials = getInitials(userName);
    const { theme, setTheme } = useTheme();
    const [notifications, setNotifications] = useState<QuickCreationNotification[]>([]);
    const [seenNotificationIds, setSeenNotificationIds] = useState<Set<string>>(new Set());
    const [palette, setPalette] = useState<PosPalette>("current");
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const savedPalette = window.localStorage.getItem(POS_PALETTE_STORAGE_KEY);
        if (isPosPalette(savedPalette)) {
            setPalette(savedPalette);
        }
    }, []);

    useEffect(() => {
        if (!isMounted) return;
        document.documentElement.dataset.posPalette = palette;
        window.localStorage.setItem(POS_PALETTE_STORAGE_KEY, palette);
    }, [palette, isMounted]);

    const loadNotifications = useCallback(async () => {
        if (role !== "ADMIN") return;
        try {
            const items = await getQuickCreationNotifications();
            setNotifications(items);
            setSeenNotificationIds(new Set());
        } catch (error) {
            console.error("Error loading quick creation notifications:", error);
        }
    }, [role]);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            void loadNotifications();
        }, 0);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [loadNotifications]);

    useDataRefresh(CACHE_TAGS.quickCreations, loadNotifications, {
        debugLabel: "admin-quick-creations",
    });

    const handleNotificationsOpenChange = useCallback(
        async (open: boolean) => {
            if (!open || role !== "ADMIN" || notifications.length === 0) return;
            const ids = notifications
                .map((notification) => notification.id)
                .filter((id) => !seenNotificationIds.has(id));

            if (ids.length === 0) return;

            setSeenNotificationIds((current) => {
                const next = new Set(current);
                ids.forEach((id) => next.add(id));
                return next;
            });

            try {
                await markQuickCreationNotificationsSeen(ids);
            } catch (error) {
                console.error("Error marking notifications seen:", error);
                setSeenNotificationIds((current) => {
                    const next = new Set(current);
                    ids.forEach((id) => next.delete(id));
                    return next;
                });
                void loadNotifications();
            }
        },
        [loadNotifications, notifications, role, seenNotificationIds]
    );

    const unreadNotificationCount = notifications.filter(
        (notification) => !seenNotificationIds.has(notification.id)
    ).length;

    return (
        <header className="sticky top-0 z-30 border-b border-white/20 bg-white/40 dark:bg-black/20 dark:border-white/10 backdrop-blur-xl">
            <div className="flex min-h-[76px] items-center gap-4 px-4 py-3 sm:px-5 lg:px-6">
                <div className="min-w-0 flex-1 pl-14 lg:pl-0">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#111827_0%,#374151_100%)] text-white shadow-[0_18px_28px_-18px_rgba(0,0,0,0.55)] dark:bg-[linear-gradient(135deg,#4f46e5_0%,#818cf8_100%)]">
                            <span className="text-sm font-bold tracking-[-0.08em]">GF</span>
                        </div>
                        <div>
                            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                                Punto de venta
                            </p>
                            <h1 className="text-2xl font-semibold tracking-[-0.05em]">
                                GangaFits
                            </h1>
                        </div>
                    </div>
                </div>

                {/* Barra de búsqueda deshabilitada temporalmente porque hoy no tiene funcionalidad.
                <div className="hidden max-w-xl flex-1 lg:block">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Buscar modulo, producto o accion..."
                            className="h-11 rounded-2xl border-border/60 bg-card/72 pl-10 pr-22 shadow-none"
                        />
                        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                            <kbd className="hidden rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] font-mono text-muted-foreground sm:inline-flex sm:items-center sm:gap-1">
                                <Command className="size-3" />
                                K
                            </kbd>
                            <SlidersHorizontal className="size-4 text-muted-foreground" />
                        </div>
                    </div>
                </div>
                */}

                <div className="flex items-center gap-2">
                    <Select
                        value={palette}
                        onValueChange={(value) => {
                            if (isPosPalette(value)) {
                                setPalette(value);
                            }
                        }}
                    >
                        <SelectTrigger className="hidden min-w-[184px] border-border/60 bg-card/78 lg:flex">
                            <Palette className="size-4" />
                            <SelectValue placeholder="Paleta" />
                        </SelectTrigger>
                        <SelectContent className="min-w-[220px]">
                            {POS_PALETTES.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    <span className="flex items-center gap-3">
                                        <span className="flex items-center gap-1.5">
                                            {option.swatches.map((swatch) => (
                                                <span
                                                    key={swatch}
                                                    className="size-3 rounded-full border border-black/8 shadow-sm"
                                                    style={{ backgroundColor: swatch }}
                                                />
                                            ))}
                                        </span>
                                        {option.label}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {role === "ADMIN" && (
                        <DropdownMenu onOpenChange={handleNotificationsOpenChange}>
                            <DropdownMenuTrigger asChild>
                                <button
                                    className="relative hidden size-10 cursor-pointer items-center justify-center rounded-2xl border border-border/60 bg-card/78 lg:flex"
                                    type="button"
                                    aria-label="Notificaciones"
                                >
                                    <Bell className="size-4 text-muted-foreground" />
                                    {unreadNotificationCount > 0 && (
                                        <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                            {unreadNotificationCount}
                                        </span>
                                    )}
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[360px] p-0">
                                <div className="max-h-[360px] overflow-y-auto p-2">
                                    {notifications.length === 0 ? (
                                        <div className="rounded-[1rem] px-3 py-6 text-center">
                                            <p className="text-sm font-medium text-foreground">
                                                No hay notificaciones nuevas
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Cuando alguien cree productos desde venta rápida, aparecerán acá.
                                            </p>
                                        </div>
                                    ) : (
                                        notifications.map((notification) => (
                                            <div
                                                key={notification.id}
                                                className="rounded-[1rem] border border-border/60 bg-card/80 p-3"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold text-foreground">
                                                            {notification.name}
                                                        </p>
                                                        <p className="mt-1 text-xs text-muted-foreground">
                                                            Creó: {notification.quickCreatedByName} · {notification.quickCreatedByRole}
                                                        </p>
                                                        <p className="mt-1 text-xs text-muted-foreground">
                                                            {notification.quickCreatedAt
                                                                ? new Date(notification.quickCreatedAt).toLocaleString("es-AR")
                                                                : "Fecha no disponible"}
                                                        </p>
                                                    </div>
                                                    <Badge
                                                        className={
                                                            notification.pendingReview
                                                                ? "bg-amber-600 text-white"
                                                                : "bg-emerald-600 text-white"
                                                        }
                                                    >
                                                        {notification.pendingReview ? "Pendiente" : "Creado"}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}

                    {/* Dark mode toggle like v0 */}
                    <button
                        type="button"
                        aria-label="Cambiar tema"
                        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                        className="relative flex size-10 cursor-pointer items-center justify-center rounded-2xl border border-border/60 bg-card/78 transition-colors hover:bg-muted"
                    >
                        <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    </button>

                    <div className="flex items-center gap-3 rounded-[1.4rem] border border-border/60 bg-card/82 px-2 py-2 shadow-xs">
                        <div
                            className="flex size-10 items-center justify-center rounded-2xl text-sm font-semibold text-white"
                            style={{ background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)", color: "#fff7ed" }}
                        >
                            {initials}
                        </div>
                        <div className="hidden pr-2 lg:block">
                            <p className="text-sm font-medium leading-none">
                                {userName}
                            </p>
                            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                {role}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
