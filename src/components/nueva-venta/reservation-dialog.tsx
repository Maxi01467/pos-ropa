"use client";

import { CalendarDays, Loader2, Phone, Search, UserCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { applyReservation, getReservations, getReservationByNumber } from "@/app/actions/reservations/reservations-actions";
import type { ReservationWithItems } from "@/app/actions/reservations/reservations-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/core/utils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number) {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0,
    }).format(value);
}

function formatDate(iso: string | null) {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

function getStatusLabel(status: string) {
    switch (status) {
        case "PENDING":
            return { label: "Pendiente", color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40" };
        case "IN_PROCESS":
            return { label: "En proceso", color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/40" };
        case "EXPIRED":
            return { label: "Vencida", color: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40" };
        default:
            return { label: status, color: "text-muted-foreground bg-muted border-border" };
    }
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type AppliedReservation = {
    reservationId: string;
    reservationNumber: string;
    clientName: string;
    depositAmount: number;
};

// ─── Component ───────────────────────────────────────────────────────────────

type ReservationDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onApply: (reservation: ReservationWithItems, appliedCredit: AppliedReservation) => void;
    /** Si viene del scanner: el número de reserva pre-buscado */
    initialSearch?: string;
};

export function ReservationDialog({
    open,
    onOpenChange,
    onApply,
    initialSearch,
}: ReservationDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [isApplying, setIsApplying] = useState(false);
    const [reservations, setReservations] = useState<ReservationWithItems[]>([]);
    const [searchQuery, setSearchQuery] = useState(initialSearch ?? "");
    const [selected, setSelected] = useState<ReservationWithItems | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Cargar reservas al abrir
    useEffect(() => {
        if (!open) {
            setSelected(null);
            setSearchQuery(initialSearch ?? "");
            return;
        }
        void loadReservations(initialSearch ?? "");
        setTimeout(() => searchInputRef.current?.focus(), 80);
    }, [open, initialSearch]);

    // Búsqueda debounced
    useEffect(() => {
        if (!open) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            void loadReservations(searchQuery);
        }, 320);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [searchQuery, open]);

    async function loadReservations(query: string) {
        setIsLoading(true);
        try {
            // Si parece un número de reserva exacto, buscar directo
            if (/^RES-\d+$/i.test(query.trim())) {
                const result = await getReservationByNumber(query.trim());
                setReservations(result ? [result] : []);
                if (result) setSelected(result);
            } else {
                const results = await getReservations({
                    status: ["PENDING", "IN_PROCESS", "EXPIRED"],
                    search: query || undefined,
                });
                setReservations(results);
            }
        } finally {
            setIsLoading(false);
        }
    }

    async function handleApply() {
        if (!selected) return;
        setIsApplying(true);
        try {
            const result = await applyReservation(selected.id);
            if (!result.success) {
                toast.error(result.error);
                return;
            }
            const credit: AppliedReservation = {
                reservationId: selected.id,
                reservationNumber: selected.reservationNumber,
                clientName: selected.clientName,
                depositAmount: selected.depositAmount ?? 0,
            };
            onApply(result.reservation, credit);
            onOpenChange(false);
            toast.success(`Reserva ${selected.reservationNumber} aplicada al carrito.`);
        } finally {
            setIsApplying(false);
        }
    }

    const saldo = selected
        ? Math.max(0, selected.estimatedTotal - (selected.depositAmount ?? 0))
        : 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] h-[600px] overflow-hidden border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_28px_90px_-40px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(17,24,39,0.98))] dark:shadow-[0_32px_100px_-36px_rgba(0,0,0,0.8)] sm:max-w-4xl flex flex-col">
                <DialogHeader className="shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <CalendarDays className="size-5" />
                        Reservas
                    </DialogTitle>
                    <DialogDescription className="text-sm leading-6 text-muted-foreground dark:text-slate-300">
                        Buscá una reserva para aplicarla al carrito.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] flex-1 min-h-0 overflow-hidden">
                    {/* ── Panel izquierdo: Lista ── */}
                    <div className="flex flex-col h-full min-h-0 space-y-3">
                        <div className="relative shrink-0 group">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60 transition-colors duration-200 group-focus-within:text-violet-500 dark:group-focus-within:text-violet-400" />
                            <Input
                                ref={searchInputRef}
                                placeholder="Buscar cliente o RES-0042..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 rounded-xl border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50 focus:bg-background dark:border-neutral-800 dark:bg-neutral-900/40 dark:hover:bg-neutral-900/60 dark:focus:bg-neutral-950 transition-all text-sm shadow-sm"
                            />
                        </div>

                        <div
                            data-lenis-prevent
                            className="flex-1 overflow-y-auto space-y-2 rounded-[1.25rem] border border-border/70 bg-background/65 p-2 dark:border-white/10 dark:bg-slate-950/45 min-h-0"
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                    Cargando reservas...
                                </div>
                            ) : reservations.length === 0 ? (
                                <div className="py-10 text-center text-sm text-muted-foreground">
                                    No se encontraron reservas.
                                </div>
                            ) : (
                                reservations.map((reservation) => {
                                    const statusInfo = getStatusLabel(reservation.status);
                                    return (
                                        <button
                                            key={reservation.id}
                                            type="button"
                                            className={cn(
                                                "w-full rounded-xl border p-3 text-left transition-all duration-200 relative overflow-hidden group active:scale-[0.98]",
                                                selected?.id === reservation.id
                                                    ? "border-violet-500/30 bg-violet-500/5 text-violet-950 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-50"
                                                    : "border-neutral-200 bg-transparent hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800/80 dark:hover:border-neutral-700/60 dark:hover:bg-neutral-800/30"
                                            )}
                                            onClick={() => setSelected(reservation)}
                                        >
                                            {selected?.id === reservation.id && (
                                                <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.6)] animate-pulse" />
                                            )}
                                            <p className={cn(
                                                "font-semibold text-sm tracking-tight",
                                                selected?.id === reservation.id ? "text-violet-900 dark:text-violet-200" : "text-foreground"
                                            )}>
                                                {reservation.reservationNumber}
                                            </p>
                                            <p className="text-xs text-muted-foreground/80 mt-0.5 truncate">{reservation.clientName}</p>
                                            <div className="mt-1.5 flex items-center justify-between gap-2">
                                                <span className={cn(
                                                    "text-[10px] font-semibold px-1.5 py-0.5 rounded border",
                                                    statusInfo.color
                                                )}>
                                                    {statusInfo.label}
                                                </span>
                                                <span className="text-xs font-semibold tabular-nums text-foreground/80">
                                                    {formatCurrency(reservation.estimatedTotal)}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* ── Panel derecho: Detalle ── */}
                    <div className="rounded-[1.35rem] border border-border/70 bg-background/65 dark:border-white/10 dark:bg-slate-950/40 overflow-hidden flex flex-col h-full min-h-0">
                        {!selected ? (
                            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground dark:text-slate-300">
                                Seleccioná una reserva a la izquierda para ver sus detalles.
                            </div>
                        ) : (
                            <div className="flex h-full flex-col min-h-0">
                                {/* Header del detalle */}
                                <div className="border-b border-border/40 p-4 dark:border-white/5 bg-neutral-50/50 dark:bg-neutral-900/20 shrink-0">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="font-bold text-base text-foreground tracking-tight">
                                                {selected.reservationNumber}
                                            </p>
                                            <div className="flex items-center gap-2 flex-wrap mt-2">
                                                <div className="inline-flex items-center gap-1.5 bg-neutral-100/80 dark:bg-neutral-800/80 px-3 py-1 rounded-full border border-neutral-200/50 dark:border-neutral-700/50 text-xs font-semibold text-neutral-800 dark:text-neutral-200 shadow-sm">
                                                    <UserCircle className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                                                    <span>{selected.clientName}</span>
                                                </div>
                                                {selected.clientPhone && (
                                                    <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                                        <Phone className="h-3 w-3" />
                                                        <span>{selected.clientPhone}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                <span className="text-xs text-muted-foreground">
                                                    Vendedor: <span className="font-medium text-foreground">{selected.user.name}</span>
                                                </span>
                                                {selected.expiresAt && (
                                                    <>
                                                        <span className="text-neutral-300 dark:text-neutral-700 text-xs">•</span>
                                                        <span className={cn(
                                                            "text-xs font-medium",
                                                            selected.status === "EXPIRED"
                                                                ? "text-rose-600 dark:text-rose-400"
                                                                : "text-muted-foreground"
                                                        )}>
                                                            Vence: {formatDate(selected.expiresAt)}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <span className={cn(
                                            "text-[11px] font-semibold px-2 py-1 rounded-full border shrink-0",
                                            getStatusLabel(selected.status).color
                                        )}>
                                            {getStatusLabel(selected.status).label}
                                        </span>
                                    </div>
                                </div>

                                {/* Lista de ítems */}
                                <div
                                    data-lenis-prevent
                                    className="overflow-y-auto p-4 flex-1 space-y-2 min-h-0"
                                >
                                    {selected.items.map((item) => (
                                        <div
                                            key={item.id}
                                            className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-background p-3 dark:border-neutral-800/80 dark:bg-slate-900/35"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-sm leading-snug tracking-tight text-foreground">
                                                    {item.variant.product.name}
                                                </p>
                                                <p className="text-xs text-muted-foreground/80 mt-0.5">
                                                    {item.variant.size !== "Único" ? `Talle ${item.variant.size} · ` : ""}
                                                    {item.variant.color}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-sm font-semibold tabular-nums text-foreground">
                                                    x{item.quantity}
                                                </p>
                                                <p className="text-xs text-muted-foreground tabular-nums">
                                                    {formatCurrency(item.priceAtTime)}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    {selected.notes && (
                                        <div className="rounded-xl border border-amber-200/70 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-300">
                                            <span className="font-semibold">Nota: </span>{selected.notes}
                                        </div>
                                    )}
                                </div>

                                {/* Footer con totales */}
                                <div className="border-t border-border/40 p-4 bg-neutral-50/50 dark:bg-neutral-900/10 dark:border-white/5 mt-auto shrink-0 space-y-1">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Total estimado</span>
                                        <span className="font-semibold tabular-nums">{formatCurrency(selected.estimatedTotal)}</span>
                                    </div>
                                    {(selected.depositAmount ?? 0) > 0 && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Seña abonada</span>
                                            <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                                                − {formatCurrency(selected.depositAmount!)}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between text-sm font-bold border-t border-border/40 pt-2 mt-2">
                                        <span>Saldo al retirar</span>
                                        <span className="tabular-nums text-base">{formatCurrency(saldo)}</span>
                                    </div>
                                    <Button
                                        className="w-full mt-3 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl py-5 shadow-md shadow-violet-500/10 hover:shadow-violet-500/20 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:pointer-events-none"
                                        disabled={selected.status === "COMPLETED" || selected.status === "CANCELLED" || isApplying}
                                        onClick={handleApply}
                                    >
                                        {isApplying ? (
                                            <><Loader2 className="mr-2 size-4 animate-spin" /> Aplicando...</>
                                        ) : (
                                            "Aplicar al carrito"
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
