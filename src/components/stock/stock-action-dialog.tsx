"use client";

import React from "react";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import type { StockProduct, StockSupplier } from "@/app/(pos)/stock/hooks/use-stock";

interface StockActionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    stockAction: "add" | "remove" | "adjust";
    isSaving: boolean;
    advancedMode: boolean;
    setAdvancedMode: (val: boolean) => void;
    productSearchQuery: string;
    setProductSearchQuery: (val: string) => void;
    providerSearchQuery: string;
    setProviderSearchQuery: (val: string) => void;
    searchedProducts: StockProduct[];
    searchedProviders: StockSupplier[];
    selectedProductId: string;
    selectedProviderId: string;
    handleProductChange: (id: string) => void;
    handleProviderChange: (id: string) => void;
    selectedProduct: StockProduct | null;
    selectedProductCurrentStock: number;
    currentSimpleVariantStock: number;
    advancedColor: string;
    setAdvancedColor: (val: string) => void;
    selectedSizes: string[];
    toggleSize: (size: string) => void;
    sizeQuantities: Record<string, string>;
    setSizeQuantities: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    selectedVariantStocks: { size: string; stock: number }[];
    simpleQuantity: string;
    setSimpleQuantity: (val: string) => void;
    handleSaveStock: () => Promise<void>;
}

const commonSizes = ["XS", "S", "M", "L", "XL", "XXL", "38", "40", "42", "44", "46", "48"];

export function StockActionDialog({
    open,
    onOpenChange,
    stockAction,
    isSaving,
    advancedMode,
    setAdvancedMode,
    productSearchQuery,
    setProductSearchQuery,
    providerSearchQuery,
    setProviderSearchQuery,
    searchedProducts,
    searchedProviders,
    selectedProductId,
    selectedProviderId,
    handleProductChange,
    handleProviderChange,
    selectedProduct,
    selectedProductCurrentStock,
    currentSimpleVariantStock,
    advancedColor,
    setAdvancedColor,
    selectedSizes,
    toggleSize,
    sizeQuantities,
    setSizeQuantities,
    selectedVariantStocks,
    simpleQuantity,
    setSimpleQuantity,
    handleSaveStock,
}: StockActionDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="print:hidden sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl">
                        {stockAction === "add"
                            ? "Ingresar Stock"
                            : stockAction === "remove"
                              ? "Reducir Stock"
                              : "Ajustar Stock"}
                    </DialogTitle>
                    <DialogDescription>
                        {stockAction === "add"
                            ? "Registrá un ingreso simple o cargá varias variantes del mismo producto en un solo movimiento."
                            : stockAction === "remove"
                              ? "Descontá stock simple o por variantes del producto seleccionado."
                              : "Definí el stock final real y el sistema calculará automáticamente si el ajuste sube o baja."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div
                        className={
                            stockAction === "add"
                                ? "grid gap-4 sm:grid-cols-2"
                                : "grid gap-4"
                        }
                    >
                        <div className="space-y-2">
                            <Label>Producto</Label>
                            <div className="rounded-[1.25rem] border border-border/70 bg-background">
                                <div className="relative border-b">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        value={productSearchQuery}
                                        onChange={(event) => setProductSearchQuery(event.target.value)}
                                        placeholder="Buscar producto por nombre o código"
                                        className="h-11 border-0 pl-9 shadow-none focus-visible:ring-0"
                                    />
                                </div>
                                <ScrollArea className="h-44">
                                    <div className="p-2">
                                        {searchedProducts.length === 0 ? (
                                            <p className="px-2 py-3 text-sm text-muted-foreground">
                                                No se encontraron productos
                                            </p>
                                        ) : (
                                            searchedProducts.map((product) => (
                                                <button
                                                    key={product.id}
                                                    type="button"
                                                    onClick={() => handleProductChange(product.id)}
                                                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                                        selectedProductId === product.id
                                                            ? "bg-emerald-950/8 text-emerald-800 dark:text-emerald-100"
                                                            : "hover:bg-muted"
                                                    }`}
                                                >
                                                    <span className="font-medium">
                                                        {product.name}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {product.code}
                                                    </span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                        {stockAction === "add" && (
                            <div className="space-y-2">
                                <Label>Proveedor</Label>
                                <div className="rounded-[1.25rem] border border-border/70 bg-background">
                                    <div className="relative border-b">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            value={providerSearchQuery}
                                            onChange={(event) =>
                                                setProviderSearchQuery(event.target.value)
                                            }
                                            placeholder="Buscar proveedor"
                                            className="h-11 border-0 pl-9 shadow-none focus-visible:ring-0"
                                        />
                                    </div>
                                    <ScrollArea className="h-44">
                                        <div className="p-2">
                                            {searchedProviders.length === 0 ? (
                                                <p className="px-2 py-3 text-sm text-muted-foreground">
                                                    No se encontraron proveedores
                                                </p>
                                            ) : (
                                                searchedProviders.map((provider) => (
                                                    <button
                                                        key={provider.id}
                                                        type="button"
                                                        onClick={() =>
                                                            handleProviderChange(provider.id)
                                                        }
                                                        className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                                            selectedProviderId === provider.id
                                                                ? "bg-emerald-950/8 text-emerald-800 dark:text-emerald-100"
                                                                : "hover:bg-muted"
                                                        }`}
                                                    >
                                                        <span className="font-medium">
                                                            {provider.name}
                                                        </span>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </ScrollArea>
                                </div>
                            </div>
                        )}
                    </div>

                    {selectedProduct && (
                        <div className="rounded-[1.2rem] border border-border/70 bg-muted/20 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Stock actual del producto
                            </p>
                            <p className="mt-1 text-2xl font-semibold tracking-[-0.05em] text-foreground">
                                {selectedProductCurrentStock}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {selectedProduct.name}
                            </p>
                        </div>
                    )}

                    <div className="flex rounded-[1.15rem] border border-border/70 bg-muted/20 p-1">
                        <Button
                            type="button"
                            variant={!advancedMode ? "default" : "ghost"}
                            className="flex-1"
                            onClick={() => setAdvancedMode(false)}
                        >
                            Ingreso simple
                        </Button>
                        <Button
                            type="button"
                            variant={advancedMode ? "default" : "ghost"}
                            className="flex-1"
                            onClick={() => setAdvancedMode(true)}
                        >
                            Por variantes
                        </Button>
                    </div>

                    {advancedMode ? (
                        <div className="space-y-4 rounded-[1.25rem] border border-border/70 bg-muted/20 p-4">
                            <div className="space-y-2">
                                <Label htmlFor="advanced-color">Color</Label>
                                <Input
                                    id="advanced-color"
                                    value={advancedColor}
                                    onChange={(event) => setAdvancedColor(event.target.value)}
                                    placeholder="Ej: Negro"
                                    className="h-11"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Talles</Label>
                                <div className="flex flex-wrap gap-2">
                                    {commonSizes.map((size) => {
                                        const active = selectedSizes.includes(size);
                                        return (
                                            <Button
                                                key={size}
                                                type="button"
                                                variant={active ? "default" : "outline"}
                                                size="sm"
                                                onClick={() => toggleSize(size)}
                                            >
                                                {size}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>

                            {selectedSizes.length > 0 && (
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {selectedSizes.map((size) => (
                                        <div key={size} className="space-y-2">
                                            <Label htmlFor={`qty-${size}`}>
                                                {stockAction === "adjust"
                                                    ? `Nuevo stock talle ${size}`
                                                    : stockAction === "remove"
                                                      ? `Cantidad a descontar talle ${size}`
                                                      : `Cantidad talle ${size}`}
                                            </Label>
                                            {(stockAction === "adjust" || stockAction === "remove") && (
                                                <p className="text-xs text-muted-foreground">
                                                    Actual: {
                                                        selectedVariantStocks.find((variant) => variant.size === size)?.stock ?? 0
                                                    }
                                                </p>
                                            )}
                                            <Input
                                                id={`qty-${size}`}
                                                type="number"
                                                min="0"
                                                value={sizeQuantities[size] ?? ""}
                                                onChange={(event) =>
                                                    setSizeQuantities((current) => ({
                                                        ...current,
                                                        [size]: event.target.value,
                                                    }))
                                                }
                                                className="h-11"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor="simple-quantity">
                                {stockAction === "adjust"
                                    ? "Nuevo stock final"
                                    : stockAction === "remove"
                                      ? "Cantidad a descontar"
                                      : "Cantidad"}
                            </Label>
                            {(stockAction === "adjust" || stockAction === "remove") && (
                                <p className="text-xs text-muted-foreground">
                                    Variante simple actual: {currentSimpleVariantStock}
                                </p>
                            )}
                            <Input
                                id="simple-quantity"
                                type="number"
                                min="0"
                                value={simpleQuantity}
                                onChange={(event) => setSimpleQuantity(event.target.value)}
                                placeholder="0"
                                className="h-11"
                            />
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        Cancelar
                    </Button>
                    <Button
                        className={
                            stockAction === "add"
                                ? "bg-emerald-600 hover:bg-emerald-700 gap-2"
                                : stockAction === "remove"
                                  ? "bg-rose-600 hover:bg-rose-700 gap-2"
                                  : "bg-amber-600 hover:bg-amber-700 gap-2"
                        }
                        onClick={handleSaveStock}
                        disabled={isSaving || !selectedProductId}
                    >
                        {isSaving && <Loader2 className="size-4 animate-spin" />}
                        {stockAction === "add"
                            ? "Guardar ingreso"
                            : stockAction === "remove"
                              ? "Confirmar baja"
                              : "Confirmar ajuste"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
