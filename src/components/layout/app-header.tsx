"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Bell,
    /* Command, */
    Moon,
    Palette,
    /* Search, */
    /* SlidersHorizontal, */
    Sun,
    Clock
} from "lucide-react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { getAttendanceRuntime, type RuntimeAttendanceEmployee, type RuntimeAttendanceBoard } from "@/lib/offline/attendance-runtime";
import { useTheme } from "next-themes";
/* import { Input } from "@/components/ui/input"; */
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
} from "@/lib/core/pos-palette";
import { CACHE_TAGS } from "@/lib/core/cache-tags";
import { formatArgentinaDateTime } from "@/lib/core/datetime";
import { notifyDataUpdated, useDataRefresh } from "@/lib/sync/data-sync-client";
import type { SessionRole } from "@/lib/core/permissions";
import {
    getQuickCreationsRuntime,
    type QuickCreationNotification,
} from "@/lib/offline/quick-creations-runtime";
import { useOfflineBootstrap } from "@/lib/offline/offline-bootstrap";

const quickCreationsRuntime = getQuickCreationsRuntime();

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
    isDesktopClient,
}: {
    userName: string;
    role: SessionRole;
    isDesktopClient: boolean;
}) {
    const initials = getInitials(userName);
    const { theme, setTheme } = useTheme();
    const bootstrap = useOfflineBootstrap();

    // Control de Asistencia en Cabecera
    const attendanceRuntime = useMemo(() => getAttendanceRuntime(), []);
    const [activeShiftsCount, setActiveShiftsCount] = useState<number>(0);
    const [employees, setEmployees] = useState<RuntimeAttendanceEmployee[]>([]);
    const [board, setBoard] = useState<RuntimeAttendanceBoard | null>(null);
    const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
    const [isAttendanceSubmitting, setIsAttendanceSubmitting] = useState(false);

    const loadAttendanceCount = useCallback(async () => {
        try {
            const currentBoard = await attendanceRuntime.getAttendanceBoard();
            setBoard(currentBoard);
            const active = currentBoard.shifts.filter((s) => s.status === "ACTIVE").length;
            setActiveShiftsCount(active);
        } catch (error) {
            console.error("Error loading active shifts count:", error);
        }
    }, [attendanceRuntime]);

    const loadAttendanceEmployees = useCallback(async () => {
        try {
            const data = await attendanceRuntime.getAttendanceEmployees();
            setEmployees(data);
        } catch (error) {
            console.error("Error loading attendance employees:", error);
        }
    }, [attendanceRuntime]);

    useEffect(() => {
        void loadAttendanceCount();
        void loadAttendanceEmployees();
    }, [loadAttendanceCount, loadAttendanceEmployees]);

    useDataRefresh(CACHE_TAGS.attendance, () => {
        void loadAttendanceCount();
    }, { pollIntervalMs: false });

    const handleQuickAction = async (employeeId: string, isActive: boolean) => {
        setIsAttendanceSubmitting(true);
        try {
            if (isActive) {
                await attendanceRuntime.checkOutUser(employeeId);
                toast.success("Salida registrada");
            } else {
                await attendanceRuntime.checkInUser(employeeId);
                toast.success("Entrada registrada");
            }
            await loadAttendanceCount();
            notifyDataUpdated([CACHE_TAGS.attendance, CACHE_TAGS.cash]);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Error al registrar asistencia";
            toast.error(message);
        } finally {
            setIsAttendanceSubmitting(false);
        }
    };

    const [notifications, setNotifications] = useState<QuickCreationNotification[]>([]);
    const [seenNotificationIds, setSeenNotificationIds] = useState<Set<string>>(new Set());
    const [palette, setPalette] = useState<PosPalette>(() => {
        if (typeof window === "undefined") {
            return "current";
        }

        const savedPalette = window.localStorage.getItem(POS_PALETTE_STORAGE_KEY);
        return isPosPalette(savedPalette) ? savedPalette : "current";
    });

    useEffect(() => {
        document.documentElement.dataset.posPalette = palette;
        window.localStorage.setItem(POS_PALETTE_STORAGE_KEY, palette);
    }, [palette]);

    const loadNotifications = useCallback(async () => {
        if (role !== "ADMIN") return;
        try {
            const items = await quickCreationsRuntime.getNotifications();
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
        pollIntervalMs: false,
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
                await quickCreationsRuntime.markSeen(ids);
                notifyDataUpdated(CACHE_TAGS.quickCreations);
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
    const bootstrapLabel =
        bootstrap.state === "requires_initial_sync"
            ? "Sync inicial"
            : bootstrap.isOnline
              ? "Online"
              : "Offline";
    const bootstrapTone =
        bootstrap.state === "requires_initial_sync"
            ? "border-amber-500/60 bg-amber-400/22 text-amber-900 shadow-[0_12px_26px_-20px_rgba(217,119,6,0.8)] dark:border-amber-300/45 dark:bg-amber-400/18 dark:text-amber-50"
            : bootstrap.isOnline
              ? "border-emerald-500/60 bg-emerald-400/22 text-emerald-900 shadow-[0_12px_26px_-20px_rgba(5,150,105,0.8)] dark:border-emerald-300/45 dark:bg-emerald-400/18 dark:text-emerald-50"
              : "border-rose-500/60 bg-rose-400/22 text-rose-900 shadow-[0_12px_26px_-20px_rgba(225,29,72,0.8)] dark:border-rose-300/45 dark:bg-rose-400/18 dark:text-rose-50";
    const bootstrapHint =
        bootstrap.state === "requires_initial_sync"
            ? "Este equipo necesita una sincronización inicial online."
            : bootstrap.lastSuccessfulSyncAt
              ? `Ultima sync: ${formatArgentinaDateTime(bootstrap.lastSuccessfulSyncAt)}`
              : bootstrap.isOnline
                ? "Listo para sincronizar."
                : "Trabajando con datos locales.";

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
                    {isDesktopClient && (
                        <div
                            className={`hidden rounded-2xl border px-3 py-2 text-xs font-medium lg:flex lg:flex-col lg:items-start ${bootstrapTone}`}
                            title={bootstrapHint}
                        >
                            <span className="uppercase tracking-[0.18em] opacity-80">{bootstrapLabel}</span>
                        </div>
                    )}

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

                    {/* Widget Fichaje Asistencia */}
                    <button
                        type="button"
                        onClick={() => setIsAttendanceOpen(true)}
                        className={`relative flex h-10 cursor-pointer items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-semibold shadow-xs transition-colors hover:bg-muted ${
                            activeShiftsCount > 0
                                ? "border-emerald-600/40 bg-emerald-50/20 text-emerald-700 dark:text-emerald-400 dark:bg-emerald-950/10"
                                : "border-amber-600/40 bg-amber-50/20 text-amber-700 dark:text-amber-400 dark:bg-amber-950/10"
                        }`}
                        title="Control de Asistencia"
                    >
                        {activeShiftsCount > 0 ? (
                            <>
                                <span className="relative flex size-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full size-2 bg-emerald-500"></span>
                                </span>
                                <span>{activeShiftsCount} Activos</span>
                            </>
                        ) : (
                            <>
                                <span className="relative flex size-2">
                                    <span className="relative inline-flex rounded-full size-2 bg-amber-500"></span>
                                </span>
                                <span>Fichar</span>
                            </>
                        )}
                    </button>

                    <Dialog open={isAttendanceOpen} onOpenChange={setIsAttendanceOpen}>
                        <DialogContent className="sm:max-w-md rounded-[1.75rem]">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-xl font-semibold tracking-[-0.03em]">
                                    <Clock className="size-5 text-emerald-600 animate-pulse" />
                                    Fichaje del Personal
                                </DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-2 gap-3 py-4">
                                {employees.length === 0 ? (
                                    <div className="col-span-2 py-6 text-center text-sm text-muted-foreground">
                                        No hay empleados activos configurados.
                                    </div>
                                ) : (
                                    employees.map((emp) => {
                                        const activeShift = board?.shifts.find(
                                            (s) => s.userId === emp.id && s.status === "ACTIVE"
                                        );
                                        const isActive = !!activeShift;

                                        return (
                                            <button
                                                key={emp.id}
                                                type="button"
                                                disabled={isAttendanceSubmitting}
                                                onClick={() => handleQuickAction(emp.id, isActive)}
                                                className={`flex flex-col items-center justify-center p-4 rounded-[1.25rem] border text-center transition-all cursor-pointer ${
                                                    isActive
                                                        ? "border-emerald-600 bg-emerald-50/10 text-emerald-800 dark:text-emerald-300 dark:border-emerald-500 shadow-md hover:bg-emerald-100/10"
                                                        : "border-border bg-card hover:bg-muted text-foreground"
                                                }`}
                                            >
                                                <div
                                                    className={`flex size-11 items-center justify-center rounded-2xl text-sm font-semibold text-white mb-2 shadow-sm ${
                                                        isActive
                                                            ? "bg-[linear-gradient(135deg,#059669_0%,#10b981_100%)]"
                                                            : "bg-[linear-gradient(135deg,#6b7280_0%,#9ca3af_100%)]"
                                                    }`}
                                                >
                                                    {getInitials(emp.name)}
                                                </div>
                                                <span className="font-semibold text-sm truncate max-w-full">
                                                    {emp.name}
                                                </span>
                                                <div className="mt-1.5 flex items-center gap-1">
                                                    {isActive ? (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                                            <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                                                            Activo
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                                            Ausente
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Dark mode toggle like v0 */}
                    <button
                        type="button"
                        aria-label="Cambiar tema"
                        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                        className="relative flex size-10 cursor-pointer items-center justify-center rounded-2xl border border-border/60 bg-card/78 transition-[background-color,transform] duration-200 ease-out hover:bg-muted active:scale-[0.94]"
                    >
                        <Sun className="size-4 rotate-0 scale-100 transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute size-4 rotate-90 scale-0 transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] dark:rotate-0 dark:scale-100" />
                    </button>

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
                                                                ? formatArgentinaDateTime(notification.quickCreatedAt)
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

                    <div className="flex items-center gap-3 rounded-[1.4rem] border border-border/60 bg-card/82 px-2 py-2 shadow-xs">
                        <div
                            className="flex size-10 items-center justify-center rounded-2xl text-sm font-semibold text-white"
                            style={{ background: "linear-gradient(135deg, #FE369E 0%, #D0065F 100%)", color: "#ffffff" }}
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
