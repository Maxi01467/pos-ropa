"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Banknote,
    ArrowRightLeft,
    Layers,
    CheckCircle2,
    WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Eliminamos "tarjeta" del tipo
export type PaymentMethod = "efectivo" | "transferencia" | "mixto";

export type PaymentBreakdown = {
    paymentMethod: PaymentMethod;
    cashAmount: number;
    transferAmount: number;
};

interface CheckoutDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    total: number;
    itemCount: number;
    onConfirm: (
        payment: PaymentBreakdown
    ) => Promise<{ ticketNumber: number }>;
}

const paymentMethods: {
    value: PaymentMethod;
    label: string;
    icon: React.ElementType;
    description: string;
}[] = [
        {
            value: "efectivo",
            label: "Efectivo",
            icon: Banknote,
            description: "Pago en billetes",
        },
        {
            value: "transferencia",
            label: "Transferencia",
            icon: ArrowRightLeft,
            description: "Mercado Pago / CBU",
        },
        {
            value: "mixto",
            label: "Mixto",
            icon: Layers,
            description: "Efectivo + Transf.",
        },
    ];

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 0,
    }).format(amount);
}

export function CheckoutDialog({
    open,
    onOpenChange,
    total,
    itemCount,
    onConfirm,
}: CheckoutDialogProps) {
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
    const [cashAmount, setCashAmount] = useState<number>(0);
    const [transferAmount, setTransferAmount] = useState<number>(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (open) {
            setSelectedMethod(null);
            setCashAmount(total);
            setTransferAmount(0);
        }
    }, [open, total]);

    const handleCashChange = (value: string) => {
        const num = parseFloat(value) || 0;
        setCashAmount(num);
        setTransferAmount(Math.max(0, total - num));
    };

    const handleTransferChange = (value: string) => {
        const num = parseFloat(value) || 0;
        setTransferAmount(num);
        setCashAmount(Math.max(0, total - num));
    };

    const handleConfirm = async () => {
        if (!selectedMethod) {
            toast.error("Seleccioná un método de pago");
            return;
        }

        if (selectedMethod === "mixto" && cashAmount + transferAmount !== total) {
            toast.error("La suma de los montos debe ser igual al total");
            return;
        }

        const methodLabel = paymentMethods.find((m) => m.value === selectedMethod)?.label;
        const paymentData: PaymentBreakdown =
            selectedMethod === "mixto"
                ? {
                      paymentMethod: selectedMethod,
                      cashAmount,
                      transferAmount,
                  }
                : selectedMethod === "efectivo"
                  ? {
                        paymentMethod: selectedMethod,
                        cashAmount: total,
                        transferAmount: 0,
                    }
                  : {
                        paymentMethod: selectedMethod,
                        cashAmount: 0,
                        transferAmount: total,
                    };

        setIsSubmitting(true);

        try {
            const sale = await onConfirm(paymentData);
            onOpenChange(false);

            toast.success("¡Venta registrada!", {
                description: `Boleta #${sale.ticketNumber.toString().padStart(4, "0")} · ${itemCount} art. — ${formatCurrency(total)} (${methodLabel})`,
                duration: 4000,
            });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "No se pudo registrar la venta";
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <WalletCards className="size-5 text-emerald-700" />
                        Cobrar venta
                    </DialogTitle>
                    <DialogDescription>
                        Confirmá el medio de pago antes de emitir la boleta.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                    <div className="rounded-[1.35rem] border border-border/70 bg-muted/30 p-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Total a cobrar
                        </p>
                        <p className="mt-2 text-4xl font-semibold tracking-[-0.06em] text-foreground">
                            {formatCurrency(total)}
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">
                            {itemCount} artículo{itemCount > 1 ? "s" : ""} en esta venta
                        </p>
                    </div>
                    <div className="rounded-[1.35rem] border border-border/70 bg-card/90 p-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Estado
                        </p>
                        <p className="mt-2 text-lg font-semibold text-foreground">
                            {selectedMethod ? "Método elegido" : "Pendiente"}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {selectedMethod
                                ? paymentMethods.find((method) => method.value === selectedMethod)?.label
                                : "Elegí cómo paga el cliente"}
                        </p>
                    </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {paymentMethods.map((method) => {
                        const Icon = method.icon;
                        const isSelected = selectedMethod === method.value;
                        return (
                            <button
                                key={method.value}
                                onClick={() => setSelectedMethod(method.value)}
                                className={cn(
                                    "flex cursor-pointer flex-col items-start gap-2 rounded-[1.25rem] border p-4 text-left transition-all",
                                    isSelected
                                        ? "border-emerald-700/60 bg-[linear-gradient(135deg,rgba(6,95,70,0.16),rgba(2,6,23,0.04))] shadow-sm"
                                        : "border-border/70 bg-card/90 hover:border-foreground/15"
                                )}
                                type="button"
                            >
                                <div className={cn(
                                    "flex size-11 items-center justify-center rounded-2xl",
                                    isSelected ? "bg-emerald-900 text-emerald-100" : "bg-muted text-muted-foreground"
                                )}>
                                    <Icon className="size-5" />
                                </div>
                                <div>
                                    <p className={cn("text-sm font-semibold", isSelected ? "text-emerald-900 dark:text-emerald-100" : "text-foreground")}>
                                        {method.label}
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                        {method.description}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {selectedMethod === "mixto" && (
                    <div className="animate-in fade-in zoom-in duration-200 space-y-4 rounded-[1.35rem] border border-border/70 bg-muted/20 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Desglose de pago
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="cash">En efectivo</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                                    <Input
                                        id="cash"
                                        type="number"
                                        className="h-11 pl-6 font-semibold"
                                        value={cashAmount || ""}
                                        onChange={(e) => handleCashChange(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="transfer">Transferencia</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                                    <Input
                                        id="transfer"
                                        type="number"
                                        className="h-11 pl-6 font-semibold"
                                        value={transferAmount || ""}
                                        onChange={(e) => handleTransferChange(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                        <p className="text-center text-[11px] text-muted-foreground">
                            La suma debe dar exactamente {formatCurrency(total)}
                        </p>
                    </div>
                )}

                <DialogFooter className="mt-1">
                    <Button
                        size="lg"
                        className="h-14 w-full gap-2 bg-emerald-600 text-base font-semibold hover:bg-emerald-700"
                        onClick={handleConfirm}
                        disabled={!selectedMethod || isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                Registrando...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="size-5" />
                                Finalizar Venta
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
