"use client";

import { useState } from "react";
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
import {
    Banknote,
    CreditCard,
    ArrowRightLeft,
    Layers,
    CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type PaymentMethod = "efectivo" | "transferencia" | "tarjeta" | "mixto";

interface CheckoutDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    total: number;
    itemCount: number;
    onConfirm: (paymentMethod: PaymentMethod) => Promise<{ ticketNumber: number }>;
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
            value: "tarjeta",
            label: "Tarjeta",
            icon: CreditCard,
            description: "Débito o crédito",
        },
        {
            value: "mixto",
            label: "Mixto",
            icon: Layers,
            description: "Combinar métodos",
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
    const [selectedMethod, setSelectedMethod] =
        useState<PaymentMethod | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
        if (!selectedMethod) {
            toast.error("Seleccioná un método de pago");
            return;
        }

        const methodLabel = paymentMethods.find(
            (m) => m.value === selectedMethod
        )?.label;

        setIsSubmitting(true);

        try {
            const sale = await onConfirm(selectedMethod);
            setSelectedMethod(null);
            onOpenChange(false);

            toast.success("¡Venta registrada con éxito!", {
                description: `Boleta #${sale.ticketNumber.toString().padStart(4, "0")} · ${itemCount} artículo${itemCount > 1 ? "s" : ""} · ${formatCurrency(total)} (${methodLabel})`,
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
                    <DialogTitle className="text-xl">Cobrar Venta</DialogTitle>
                    <DialogDescription>
                        Seleccioná el método de pago para completar la venta.
                    </DialogDescription>
                </DialogHeader>

                {/* Total */}
                <div className="rounded-xl bg-muted/50 px-6 py-5 text-center">
                    <p className="text-sm font-medium text-muted-foreground">
                        Total a cobrar
                    </p>
                    <p className="mt-1 text-4xl font-bold tracking-tight">
                        {formatCurrency(total)}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {itemCount} artículo{itemCount > 1 ? "s" : ""}
                    </p>
                </div>

                <Separator />

                {/* Payment Methods */}
                <div className="grid grid-cols-2 gap-3">
                    {paymentMethods.map((method) => {
                        const Icon = method.icon;
                        const isSelected = selectedMethod === method.value;
                        return (
                            <button
                                key={method.value}
                                onClick={() => setSelectedMethod(method.value)}
                                className={cn(
                                    "flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200",
                                    "hover:border-primary/50 hover:bg-accent/50",
                                    isSelected
                                        ? "border-primary bg-primary/5 shadow-sm"
                                        : "border-border bg-card"
                                )}
                            >
                                <Icon
                                    className={cn(
                                        "size-7",
                                        isSelected ? "text-primary" : "text-muted-foreground"
                                    )}
                                />
                                <span
                                    className={cn(
                                        "text-sm font-semibold",
                                        isSelected ? "text-primary" : "text-foreground"
                                    )}
                                >
                                    {method.label}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    {method.description}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <DialogFooter className="mt-2">
                    <Button
                        size="lg"
                        className="w-full bg-emerald-600 text-lg font-bold hover:bg-emerald-700 h-14"
                        onClick={handleConfirm}
                        disabled={!selectedMethod || isSubmitting}
                    >
                        {isSubmitting ? (
                            <span className="flex items-center gap-2">
                                <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                Registrando...
                            </span>
                        ) : (
                            <>
                        <CheckCircle2 className="size-5" />
                        Confirmar Venta
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
