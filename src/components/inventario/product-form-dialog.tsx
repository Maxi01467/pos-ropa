"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import type { DBProduct } from "@/app/(pos)/inventario/page";

interface ProductFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingProduct: DBProduct | null;
    formName: string;
    setFormName: (val: string) => void;
    formPrice: string;
    setFormPrice: (val: string) => void;
    formWholesalePrice: string;
    setFormWholesalePrice: (val: string) => void;
    formCostPrice: string;
    setFormCostPrice: (val: string) => void;
    costPriceNum: number;
    salePriceNum: number;
    calculatedWholesalePrice: number;
    margin: string | null;
    isSaving: boolean;
    onSave: () => void;
}

export function ProductFormDialog({
    open,
    onOpenChange,
    editingProduct,
    formName,
    setFormName,
    formPrice,
    setFormPrice,
    formWholesalePrice,
    setFormWholesalePrice,
    formCostPrice,
    setFormCostPrice,
    costPriceNum,
    salePriceNum,
    calculatedWholesalePrice,
    margin,
    isSaving,
    onSave,
}: ProductFormDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-xl">
                        {editingProduct ? "Editar Producto" : "Nuevo Producto"}
                    </DialogTitle>
                    <DialogDescription>
                        {editingProduct
                            ? "Modificá los datos de este producto."
                            : "Definí un nuevo producto para tu catálogo. El stock se carga por separado."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Name */}
                    <div className="space-y-2">
                        <Label htmlFor="prod-name" className="text-base">
                            Nombre <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="prod-name"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            className="h-12 text-lg"
                            placeholder="Ej: Remera Lisa Algodón"
                            autoFocus
                        />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                            <Label htmlFor="prod-price" className="text-base">
                                Precio de Venta <span className="text-destructive">*</span>
                            </Label>
                            <div className="relative">
                                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">
                                    $
                                </span>
                                <Input
                                    id="prod-price"
                                    type="number"
                                    value={formPrice}
                                    onChange={(e) => setFormPrice(e.target.value)}
                                    className="h-12 pl-8 text-lg"
                                    placeholder="0"
                                    min="0"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="prod-wholesale" className="text-base">
                                Precio Mayorista <span className="text-destructive">*</span>
                            </Label>
                            <div className="relative">
                                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">
                                    $
                                </span>
                                <Input
                                    id="prod-wholesale"
                                    type="number"
                                    value={
                                        costPriceNum > 0
                                            ? String(calculatedWholesalePrice)
                                            : formWholesalePrice
                                    }
                                    onChange={(e) => setFormWholesalePrice(e.target.value)}
                                    className="h-12 pl-8 text-lg"
                                    placeholder="0"
                                    min="0"
                                    readOnly={costPriceNum > 0}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {costPriceNum > 0
                                    ? "Calculado automáticamente: costo + 20%."
                                    : "Si no cargás costo, podés definirlo manualmente."}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="prod-cost" className="text-base">
                                Precio de Costo
                            </Label>
                            <div className="relative">
                                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground">
                                    $
                                </span>
                                <Input
                                    id="prod-cost"
                                    type="number"
                                    value={formCostPrice}
                                    onChange={(e) => setFormCostPrice(e.target.value)}
                                    className="h-12 pl-8 text-lg"
                                    placeholder="Opcional"
                                    min="0"
                                />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {margin !== null && (
                        <p className="text-sm font-medium text-emerald-600">
                            Margen de ganancia: {margin}% sobre costo
                        </p>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={() => onOpenChange(false)}
                        disabled={isSaving}
                    >
                        Cancelar
                    </Button>
                    <Button
                        size="lg"
                        className="bg-emerald-600 font-bold hover:bg-emerald-700 gap-2"
                        onClick={onSave}
                        disabled={!formName.trim() || !formPrice || salePriceNum <= 0 || isSaving}
                    >
                        {isSaving && <Loader2 className="size-4 animate-spin" />}
                        {editingProduct ? "Guardar Cambios" : "Crear Producto"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
