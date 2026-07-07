"use client";

import React from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/core/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { formatArgentinaShortDate } from "@/lib/core/datetime";
import type { StockEntry, StockMovement } from "@/app/(pos)/stock/hooks/use-stock";

interface MovementDetailsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedMovement: StockMovement | null;
    getProductName: (id: string) => string;
}

function getVariantLabel(entry: StockEntry) {
    const parts: string[] = [];
    if (entry.size !== "Único") parts.push(`Talle ${entry.size}`);
    if (entry.color !== "Único") parts.push(`Color ${entry.color}`);
    return parts.length > 0 ? parts.join(" - ") : "Talle y color único";
}

export function MovementDetailsDialog({
    open,
    onOpenChange,
    selectedMovement,
    getProductName,
}: MovementDetailsDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                {selectedMovement && (
                    <>
                        <DialogHeader>
                            {(() => {
                                const movementType = selectedMovement.variants[0]?.type;
                                const isIngreso = movementType === "INGRESO";
                                const isSalida = movementType === "SALIDA";
                                
                                return (
                                    <>
                                        <DialogTitle className="text-xl flex items-center gap-2">
                                            <span className={cn(
                                                "size-2.5 rounded-full inline-block animate-pulse",
                                                isIngreso 
                                                    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
                                                    : isSalida 
                                                      ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" 
                                                      : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                                            )} />
                                            {isIngreso
                                                ? "Detalle de Ingreso e Impresión"
                                                : isSalida
                                                  ? "Detalle de Reducción de Stock"
                                                  : "Detalle de Ajuste de Stock"}
                                        </DialogTitle>
                                        <DialogDescription className="text-xs font-semibold text-muted-foreground/80 mt-1 uppercase tracking-wider">
                                            {getProductName(selectedMovement.productId)} · {formatArgentinaShortDate(selectedMovement.date)}
                                        </DialogDescription>
                                    </>
                                );
                            })()}
                        </DialogHeader>

                        <div className="max-h-[60vh] overflow-y-auto rounded-[1.25rem] border border-border/70">
                            <Table>
                                <TableHeader className="bg-stone-50/100 dark:bg-neutral-900/40">
                                    <TableRow className="hover:bg-transparent border-b border-stone-200/50 dark:border-stone-800/40">
                                        <TableHead className="font-semibold text-xs tracking-wider uppercase text-neutral-400 py-3.5">Variante</TableHead>
                                        <TableHead className="font-semibold text-xs tracking-wider uppercase text-neutral-400 py-3.5">Cantidad</TableHead>
                                        <TableHead className="font-semibold text-xs tracking-wider uppercase text-neutral-400 py-3.5">SKU</TableHead>
                                        <TableHead className="text-right font-semibold text-xs tracking-wider uppercase text-neutral-400 py-3.5">
                                            Acción
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedMovement.variants.map((variant) => (
                                        <TableRow key={variant.id}>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium">
                                                        {getVariantLabel(variant)}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground uppercase">
                                                        {getProductName(variant.productId)}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">
                                                    {variant.quantity > 0 ? "+" : ""}
                                                    {variant.quantity} unidad(es)
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                                                    {variant.sku}
                                                </code>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {variant.quantity > 0 ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="gap-2"
                                                        onClick={() =>
                                                            toast.success(
                                                                "Etiqueta enviada a impresión",
                                                                {
                                                                    description: `${getVariantLabel(variant)} · ${variant.quantity} ticket(s)`,
                                                                }
                                                            )
                                                        }
                                                    >
                                                        <Printer className="size-4" />
                                                        Impresión rápida
                                                    </Button>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">
                                                        No aplica
                                                    </span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
