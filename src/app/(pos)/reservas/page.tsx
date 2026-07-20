"use client";

import { useCallback, useEffect, useState } from "react";
import {
    CalendarDays,
    Search,
    X,
    CheckCircle2,
    Clock,
    AlertCircle,
    Ban,
    RefreshCw,
    Phone,
    UserCircle,
    Loader2,
    Filter,
} from "lucide-react";
import { toast } from "sonner";

import {
    getReservations,
    cancelReservation,
    expireReservations,
} from "@/app/actions/reservations/reservations-actions";
import type { ReservationWithItems, ReservationStatus } from "@/app/actions/reservations/reservations-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/core/utils";
import { useSessionSnapshot } from "@/lib/session/session-client";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number) {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0,
    }).format(value);
}

function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

type StatusConfig = {
    label: string;
    icon: React.ReactNode;
    badgeClass: string;
};

function getStatusConfig(status: string): StatusConfig {
    switch (status) {
        case "PENDING":
            return {
                label: "Pendiente",
                icon: <Clock className="h-3 w-3" />,
                badgeClass: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40",
            };
        case "IN_PROCESS":
            return {
                label: "En proceso",
                icon: <RefreshCw className="h-3 w-3" />,
                badgeClass: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/40",
            };
        case "COMPLETED":
            return {
                label: "Completada",
                icon: <CheckCircle2 className="h-3 w-3" />,
                badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40",
            };
        case "CANCELLED":
            return {
                label: "Cancelada",
                icon: <Ban className="h-3 w-3" />,
                badgeClass: "bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-900/40 dark:text-neutral-400 dark:border-neutral-800",
            };
        case "EXPIRED":
            return {
                label: "Vencida",
                icon: <AlertCircle className="h-3 w-3" />,
                badgeClass: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/40",
            };
        default:
            return {
                label: status,
                icon: null,
                badgeClass: "bg-muted text-muted-foreground border-border",
            };
    }
}

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
    { value: "ALL", label: "Todos los estados" },
    { value: "PENDING", label: "Pendientes" },
    { value: "IN_PROCESS", label: "En proceso" },
    { value: "COMPLETED", label: "Completadas" },
    { value: "EXPIRED", label: "Vencidas" },
    { value: "CANCELLED", label: "Canceladas" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function ReservasPage() {
    const session = useSessionSnapshot();
    const isAdmin = session?.role === "ADMIN";

    const [reservations, setReservations] = useState<ReservationWithItems[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [cancellingId, setCancellingId] = useState<string | null>(null);

    const loadReservations = useCallback(async () => {
        setIsLoading(true);
        try {
            const statusArg = statusFilter !== "ALL"
                ? (statusFilter as ReservationStatus)
                : undefined;
            const results = await getReservations({
                status: statusArg,
                search: searchQuery.trim() || undefined,
            });
            setReservations(results);
        } catch {
            toast.error("No se pudieron cargar las reservas.");
        } finally {
            setIsLoading(false);
        }
    }, [statusFilter, searchQuery]);

    useEffect(() => {
        void loadReservations();
    }, [loadReservations]);

    const handleCancel = async (id: string, number: string) => {
        if (!confirm(`¿Cancelar la reserva ${number}? La seña NO se devolverá.`)) return;
        setCancellingId(id);
        try {
            const result = await cancelReservation(id);
            if (result.success) {
                toast.success(`Reserva ${number} cancelada.`);
                void loadReservations();
            } else {
                toast.error(result.error);
            }
        } finally {
            setCancellingId(null);
        }
    };

    const handleExpireCheck = async () => {
        const result = await expireReservations();
        if (result.success) {
            if (result.expiredCount > 0) {
                toast.success(`${result.expiredCount} reserva(s) expiradas`, {
                    description: result.expiredNumbers.join(", "),
                });
                void loadReservations();
            } else {
                toast.info("No hay reservas vencidas por procesar.");
            }
        } else {
            toast.error(result.error);
        }
    };

    const activeCounts = {
        PENDING: reservations.filter((r) => r.status === "PENDING").length,
        EXPIRED: reservations.filter((r) => r.status === "EXPIRED").length,
    };

    return (
        <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <CalendarDays className="h-6 w-6 text-violet-500" />
                        Reservas
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Gestión de reservas de productos.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {isAdmin && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={handleExpireCheck}
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Verificar vencimientos
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={loadReservations}
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Actualizar
                    </Button>
                </div>
            </div>

            {/* Alertas de estado */}
            {activeCounts.EXPIRED > 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900/40 dark:bg-rose-950/20 p-3 flex items-center gap-2 text-sm text-rose-700 dark:text-rose-300">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>
                        Tenés <strong>{activeCounts.EXPIRED}</strong> reserva(s) vencida(s) sin atender.
                    </span>
                </div>
            )}

            {/* Filtros */}
            <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                    <Input
                        placeholder="Buscar por cliente, número o teléfono..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 rounded-xl"
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px] rounded-xl">
                        <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {STATUS_FILTER_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Lista */}
            {isLoading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : reservations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
                    <CalendarDays className="h-12 w-12 text-muted-foreground/30" />
                    <p className="text-lg font-medium text-muted-foreground">No hay reservas</p>
                    <p className="text-sm text-muted-foreground/70">
                        Cambiá los filtros o creá una reserva desde Nueva Venta.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {reservations.map((reservation) => {
                        const config = getStatusConfig(reservation.status);
                        const isExpanded = expandedId === reservation.id;
                        const saldo = Math.max(0, reservation.estimatedTotal - (reservation.depositAmount ?? 0));
                        const canCancel = isAdmin &&
                            (reservation.status === "PENDING" || reservation.status === "IN_PROCESS" || reservation.status === "EXPIRED");

                        return (
                            <Card
                                key={reservation.id}
                                className={cn(
                                    "overflow-hidden border transition-all duration-200",
                                    reservation.status === "EXPIRED"
                                        ? "border-rose-200/70 dark:border-rose-900/30"
                                        : "border-border/70"
                                )}
                            >
                                <CardHeader className="pb-0">
                                    <div className="flex items-start justify-between gap-3 flex-wrap">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <span className="font-bold text-base tracking-tight">
                                                {reservation.reservationNumber}
                                            </span>
                                            <span className={cn(
                                                "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border",
                                                config.badgeClass
                                            )}>
                                                {config.icon}
                                                {config.label}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-xs h-7"
                                                onClick={() => setExpandedId(isExpanded ? null : reservation.id)}
                                            >
                                                {isExpanded ? "Ocultar" : "Ver detalle"}
                                            </Button>
                                            {canCancel && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-xs h-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                                    disabled={cancellingId === reservation.id}
                                                    onClick={() => handleCancel(reservation.id, reservation.reservationNumber)}
                                                >
                                                    {cancellingId === reservation.id ? (
                                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                                    ) : (
                                                        <X className="h-3 w-3 mr-1" />
                                                    )}
                                                    Cancelar
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 flex-wrap mt-1">
                                        <div className="flex items-center gap-1.5 text-sm">
                                            <UserCircle className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-medium">{reservation.clientName}</span>
                                        </div>
                                        {reservation.clientPhone && (
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <Phone className="h-3 w-3" />
                                                <span>{reservation.clientPhone}</span>
                                            </div>
                                        )}
                                        <span className="text-xs text-muted-foreground">
                                            Vendedor: <span className="font-medium">{reservation.user.name}</span>
                                        </span>
                                    </div>
                                </CardHeader>

                                <CardContent className="pt-3">
                                    <div className="flex items-center gap-4 flex-wrap text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Total</span>
                                            <p className="font-semibold tabular-nums">
                                                {formatCurrency(reservation.estimatedTotal)}
                                            </p>
                                        </div>
                                        {(reservation.depositAmount ?? 0) > 0 && (
                                            <>
                                                <div>
                                                    <span className="text-muted-foreground">Seña</span>
                                                    <p className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                                                        {formatCurrency(reservation.depositAmount!)}
                                                        <span className="text-xs font-normal text-muted-foreground ml-1">
                                                            ({reservation.depositMethod})
                                                        </span>
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-muted-foreground">Saldo</span>
                                                    <p className="font-semibold tabular-nums">
                                                        {formatCurrency(saldo)}
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                        <div>
                                            <span className="text-muted-foreground">Creada</span>
                                            <p className="font-medium">{formatDateTime(reservation.createdAt)}</p>
                                        </div>
                                        {reservation.expiresAt && (
                                            <div>
                                                <span className="text-muted-foreground">Vence</span>
                                                <p className={cn(
                                                    "font-medium",
                                                    reservation.status === "EXPIRED"
                                                        ? "text-rose-600 dark:text-rose-400"
                                                        : ""
                                                )}>
                                                    {formatDate(reservation.expiresAt)}
                                                </p>
                                            </div>
                                        )}
                                        <div>
                                            <span className="text-muted-foreground">Productos</span>
                                            <p className="font-semibold">
                                                {reservation.items.length} ítem(s)
                                            </p>
                                        </div>
                                    </div>

                                    {/* Detalle expandido */}
                                    {isExpanded && (
                                        <div className="mt-4 space-y-2 border-t border-border/50 pt-4">
                                            {reservation.items.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="flex items-center justify-between rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-sm"
                                                >
                                                    <div>
                                                        <p className="font-medium">{item.variant.product.name}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {item.variant.size !== "Único"
                                                                ? `Talle ${item.variant.size} · `
                                                                : ""}
                                                            {item.variant.color} · SKU {item.variant.sku}
                                                        </p>
                                                    </div>
                                                    <div className="text-right shrink-0 ml-3">
                                                        <p className="font-semibold">x{item.quantity}</p>
                                                        <p className="text-xs text-muted-foreground tabular-nums">
                                                            {formatCurrency(item.priceAtTime)}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                            {reservation.notes && (
                                                <div className="rounded-lg border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                                                    <span className="font-semibold">Nota: </span>
                                                    {reservation.notes}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
