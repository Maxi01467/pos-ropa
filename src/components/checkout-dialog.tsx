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
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Cobrar Venta</DialogTitle>
                    <DialogDescription>
                        Seleccioná cómo paga el cliente.
                    </DialogDescription>
                </DialogHeader>

                {/* Resumen Total */}
                <div className="rounded-xl bg-muted/50 px-6 py-4 text-center">
                    <p className="text-sm font-medium text-muted-foreground">Total a cobrar</p>
                    <p className="text-4xl font-black tracking-tight text-primary">
                        {formatCurrency(total)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground uppercase font-semibold">
                        {itemCount} artículo{itemCount > 1 ? "s" : ""}
                    </p>
                </div>

                <Separator />

                {/* Métodos de Pago */}
                <div className="grid grid-cols-3 gap-2">
                    {paymentMethods.map((method) => {
                        const Icon = method.icon;
                        const isSelected = selectedMethod === method.value;
                        return (
                            <button
                                key={method.value}
                                onClick={() => setSelectedMethod(method.value)}
                                className={cn(
                                    "flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all",
                                    isSelected
                                        ? "border-emerald-600 bg-emerald-50/50 shadow-sm"
                                        : "border-border bg-card hover:border-muted-foreground/30"
                                )}
                            >
                                <Icon className={cn("size-6", isSelected ? "text-emerald-600" : "text-muted-foreground")} />
                                <span className={cn("text-xs font-bold", isSelected ? "text-emerald-700" : "text-foreground")}>
                                    {method.label}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Sección de Pago Mixto */}
                {selectedMethod === "mixto" && (
                    <div className="space-y-4 rounded-xl border bg-muted/20 p-4 animate-in fade-in zoom-in duration-200">
                        <p className="text-xs font-bold uppercase text-muted-foreground">Desglose de Pago</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="cash" className="text-xs">En Efectivo</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                                    <Input
                                        id="cash"
                                        type="number"
                                        className="pl-6 h-11 font-bold"
                                        value={cashAmount || ""}
                                        onChange={(e) => handleCashChange(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="transfer" className="text-xs">Transferencia</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                                    <Input
                                        id="transfer"
                                        type="number"
                                        className="pl-6 h-11 font-bold"
                                        value={transferAmount || ""}
                                        onChange={(e) => handleTransferChange(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                        <p className="text-[10px] text-center text-muted-foreground">
                            La suma debe dar exactamente {formatCurrency(total)}
                        </p>
                    </div>
                )}

                <DialogFooter className="mt-2">
                    <Button
                        size="lg"
                        className="w-full bg-emerald-600 text-lg font-bold hover:bg-emerald-700 h-14 gap-2"
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
