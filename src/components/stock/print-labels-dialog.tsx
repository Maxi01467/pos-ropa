"use client";

import React from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
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
import { formatArgentinaDateTimeWithSuffix } from "@/lib/core/datetime";
import type { StockEntry, StockMovement } from "@/app/(pos)/stock/hooks/use-stock";

interface PrintLabelsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    printableVariants: StockEntry[];
    printQuantities: Record<string, string>;
    setPrintQuantities: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    selectedMovements: StockMovement[];
    printableTickets: number;
    handleConfirmPrint: () => void;
    getProductName: (id: string) => string;
}

function formatDate(dateStr: string): string {
    return formatArgentinaDateTimeWithSuffix(dateStr, { year: "2-digit" });
}

function clampQuantity(rawValue: string | undefined, max: number) {
    if (rawValue === "") return 0;
    const parsed = Number.parseInt(rawValue ?? String(max), 10);
    return Number.isNaN(parsed) ? max : Math.max(0, Math.min(parsed, max));
}

function normalizePrintQuantity(rawValue: string, max: number) {
    if (rawValue === "") return "";
    const parsed = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsed)) return "";
    return String(Math.max(0, Math.min(parsed, max)));
}

export function PrintLabelsDialog({
    open,
    onOpenChange,
    printableVariants,
    printQuantities,
    setPrintQuantities,
    selectedMovements,
    printableTickets,
    handleConfirmPrint,
    getProductName,
}: PrintLabelsDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="print:hidden max-h-[90vh] max-w-[calc(100%-1rem)] sm:max-w-6xl xl:max-w-7xl transform-gpu"
            >
                <DialogHeader>
                    <DialogTitle>Imprimir etiquetas</DialogTitle>
                    <DialogDescription>
                        Revisá todo lo que seleccionaste y elegí la cantidad de tickets a imprimir por cada variante.
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[66vh] overflow-y-auto rounded-[1.25rem] border border-border/70">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead>Ingreso</TableHead>
                                <TableHead>Disponible</TableHead>
                                <TableHead>Tickets a imprimir</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {printableVariants.map((variant) => {
                                const previewQuantity = clampQuantity(printQuantities[variant.id], variant.quantity);
                                return (
                                    <TableRow key={variant.id}>
                                        <TableCell className="text-sm text-muted-foreground">
                                            <div>
                                                <p className="font-medium text-foreground">
                                                    {getProductName(variant.productId)}
                                                </p>
                                                <p>{formatDate(variant.date)}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{variant.quantity} ticket(s)</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="max-w-36 space-y-1">
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={variant.quantity}
                                                    value={printQuantities[variant.id] ?? String(variant.quantity)}
                                                    onChange={(event) =>
                                                        setPrintQuantities((current) => ({
                                                            ...current,
                                                            [variant.id]: normalizePrintQuantity(
                                                                event.target.value,
                                                                variant.quantity
                                                            ),
                                                        }))
                                                    }
                                                />
                                                <p className="text-xs text-muted-foreground">Vista previa: {previewQuantity}</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>

                <DialogFooter className="sm:justify-between">
                    <div className="text-sm text-muted-foreground">
                        {selectedMovements.length} ingreso(s) · {printableVariants.length} variante(s) · {printableTickets} ticket(s)
                    </div>
                    <Button
                        className="bg-emerald-600 hover:bg-emerald-700"
                        disabled={selectedMovements.length === 0 || printableTickets === 0}
                        onClick={handleConfirmPrint}
                    >
                        <Printer className="size-4" />
                        Confirmar impresión
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
