"use client";

import { Bookmark, CalendarDays, Loader2 } from "lucide-react";
import { useState } from "react";

import type { CreateReservationInput } from "@/app/actions/reservations/reservations-actions";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/core/utils";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type CreateReservationItemPreview = {
    variantId: string;
    productName: string;
    variantLabel: string; // "Talle M · Azul"
    quantity: number;
    priceAtTime: number;
    priceType: "NORMAL" | "WHOLESALE";
};

type CreateReservationDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Los ítems del carrito actual */
    items: CreateReservationItemPreview[];
    estimatedTotal: number;
    /** Llamado al confirmar con los datos completos para crear la reserva */
    onConfirm: (input: Omit<CreateReservationInput, "userId" | "cashSessionId">) => Promise<void>;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number) {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0,
    }).format(value);
}

const EXPIRY_OPTIONS = [
    { value: "1", label: "1 día" },
    { value: "2", label: "2 días" },
    { value: "3", label: "3 días" },
    { value: "4", label: "4 días" },
    { value: "5", label: "5 días" },
    { value: "6", label: "6 días" },
    { value: "7", label: "7 días" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function CreateReservationDialog({
    open,
    onOpenChange,
    items,
    estimatedTotal,
    onConfirm,
}: CreateReservationDialogProps) {
    const [clientName, setClientName] = useState("");
    const [clientPhone, setClientPhone] = useState("");
    const [depositAmount, setDepositAmount] = useState("");
    const [depositMethod, setDepositMethod] = useState<"EFECTIVO" | "TRANSFERENCIA">("EFECTIVO");
    const [expiresIn, setExpiresIn] = useState("7");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    function resetForm() {
        setClientName("");
        setClientPhone("");
        setDepositAmount("");
        setDepositMethod("EFECTIVO");
        setExpiresIn("7");
        setNotes("");
    }

    function handleOpenChange(next: boolean) {
        if (!next) resetForm();
        onOpenChange(next);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!clientName.trim()) return;

        setIsSubmitting(true);
        try {
            const depositValue = depositAmount ? parseFloat(depositAmount) : undefined;

            await onConfirm({
                clientName: clientName.trim(),
                clientPhone: clientPhone.trim() || undefined,
                depositAmount: depositValue && depositValue > 0 ? depositValue : undefined,
                depositMethod: depositValue && depositValue > 0 ? depositMethod : undefined,
                expiresInDays: expiresIn === "0" ? undefined : parseInt(expiresIn, 10),
                notes: notes.trim() || undefined,
                estimatedTotal,
                items: items.map((item) => ({
                    variantId: item.variantId,
                    quantity: item.quantity,
                    priceAtTime: item.priceAtTime,
                    priceType: item.priceType,
                    productName: item.productName,
                    variantLabel: item.variantLabel,
                })),
            });

            resetForm();
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_28px_90px_-40px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(17,24,39,0.98))]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Bookmark className="size-5" />
                        Crear Reserva
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground dark:text-slate-300">
                        Guardá el carrito actual como reserva para un cliente.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-1">
                    {/* Cliente */}
                    <div className="space-y-1.5">
                        <Label htmlFor="res-client-name">
                            Nombre del cliente <span className="text-rose-500">*</span>
                        </Label>
                        <Input
                            id="res-client-name"
                            placeholder="Ej: María García"
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            autoFocus
                            required
                            className="rounded-xl"
                        />
                    </div>

                    {/* Teléfono */}
                    <div className="space-y-1.5">
                        <Label htmlFor="res-client-phone">Teléfono (opcional)</Label>
                        <Input
                            id="res-client-phone"
                            placeholder="Ej: 11-2345-6789"
                            value={clientPhone}
                            onChange={(e) => setClientPhone(e.target.value)}
                            className="rounded-xl"
                        />
                    </div>

                    {/* Seña */}
                    <div className="space-y-1.5">
                        <Label>Seña (opcional)</Label>
                        <div className="flex gap-2">
                            <Input
                                id="res-deposit"
                                type="number"
                                min="0"
                                step="100"
                                placeholder="0"
                                value={depositAmount}
                                onChange={(e) => setDepositAmount(e.target.value)}
                                className="rounded-xl flex-1"
                            />
                            <Select
                                value={depositMethod}
                                onValueChange={(v) => setDepositMethod(v as "EFECTIVO" | "TRANSFERENCIA")}
                                disabled={!depositAmount || parseFloat(depositAmount) <= 0}
                            >
                                <SelectTrigger id="res-deposit-method" className="w-[140px] rounded-xl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                                    <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Vencimiento */}
                    <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                            Vence en
                        </Label>
                        <div className="relative flex w-full rounded-2xl bg-neutral-100/80 p-0.5 dark:bg-slate-900/80 border border-black/5 dark:border-white/5 shadow-inner">
                            {EXPIRY_OPTIONS.map((opt) => {
                                const isSelected = expiresIn === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setExpiresIn(opt.value)}
                                        className={cn(
                                            "flex-1 py-1.5 text-center text-xs font-semibold rounded-[14px] transition-all duration-200 ease-out select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/20",
                                            isSelected
                                                ? "bg-white text-violet-700 shadow-[0_2px_8px_-1px_rgba(0,0,0,0.08)] scale-[1.02] dark:bg-slate-800 dark:text-violet-300"
                                                : "text-muted-foreground hover:text-foreground hover:bg-white/10 dark:hover:bg-slate-800/10"
                                        )}
                                        title={opt.label}
                                    >
                                        {opt.value}d
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Notas */}
                    <div className="space-y-1.5">
                        <Label htmlFor="res-notes">Notas (opcional)</Label>
                        <Input
                            id="res-notes"
                            placeholder="Ej: viene el sábado, busca en azul..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="rounded-xl"
                        />
                    </div>

                    {/* Resumen de productos */}
                    <div className="rounded-xl border border-border/70 bg-background/65 dark:border-white/10 dark:bg-slate-950/40 p-3 space-y-1.5">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                            Productos a reservar
                        </p>
                        {items.map((item) => (
                            <div key={item.variantId} className="flex items-center justify-between text-sm">
                                <div className="min-w-0 flex-1">
                                    <span className="font-medium truncate block">{item.productName}</span>
                                    {item.variantLabel && (
                                        <span className="text-xs text-muted-foreground">{item.variantLabel}</span>
                                    )}
                                </div>
                                <div className="text-right shrink-0 ml-3">
                                    <span className="text-muted-foreground text-xs">x{item.quantity}</span>
                                    <span className="ml-2 font-semibold tabular-nums">
                                        {formatCurrency(item.priceAtTime * item.quantity)}
                                    </span>
                                </div>
                            </div>
                        ))}
                        <div className="border-t border-border/40 pt-1.5 mt-1.5 flex items-center justify-between font-bold text-sm">
                            <span>Total estimado</span>
                            <span className="tabular-nums">{formatCurrency(estimatedTotal)}</span>
                        </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex gap-2 pt-1">
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1 rounded-xl"
                            onClick={() => handleOpenChange(false)}
                            disabled={isSubmitting}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold shadow-md shadow-violet-500/10 hover:shadow-violet-500/20 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40"
                            disabled={!clientName.trim() || isSubmitting}
                        >
                            {isSubmitting ? (
                                <><Loader2 className="mr-2 size-4 animate-spin" /> Guardando...</>
                            ) : (
                                <><Bookmark className="mr-2 size-4" /> Guardar reserva</>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
