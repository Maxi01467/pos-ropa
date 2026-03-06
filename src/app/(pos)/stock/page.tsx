"use client";

import { useState } from "react";
import { Plus, Minus, Save, Search, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { mockProducts } from "@/lib/mock-data";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StockAdjustment {
    productId: string;
    originalStock: number;
    adjustment: number;
}

export default function StockPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [adjustments, setAdjustments] = useState<
        Record<string, StockAdjustment>
    >({});

    const filteredProducts = mockProducts.filter((p) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            p.name.toLowerCase().includes(q) ||
            p.code.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q)
        );
    });

    const getAdjustment = (productId: string): number => {
        return adjustments[productId]?.adjustment ?? 0;
    };

    const setAdjustment = (productId: string, originalStock: number, value: number) => {
        setAdjustments((prev) => ({
            ...prev,
            [productId]: {
                productId,
                originalStock,
                adjustment: value,
            },
        }));
    };

    const incrementAdjustment = (productId: string, originalStock: number, delta: number) => {
        const current = getAdjustment(productId);
        const newValue = current + delta;
        // Don't let stock go below 0
        if (originalStock + newValue < 0) return;
        setAdjustment(productId, originalStock, newValue);
    };

    const handleAdjustmentInput = (
        productId: string,
        originalStock: number,
        inputValue: string
    ) => {
        const num = parseInt(inputValue, 10);
        if (isNaN(num)) {
            setAdjustment(productId, originalStock, 0);
        } else {
            if (originalStock + num < 0) {
                setAdjustment(productId, originalStock, -originalStock);
            } else {
                setAdjustment(productId, originalStock, num);
            }
        }
    };

    const changedCount = Object.values(adjustments).filter(
        (a) => a.adjustment !== 0
    ).length;

    const handleSave = () => {
        const changes = Object.values(adjustments).filter(
            (a) => a.adjustment !== 0
        );
        if (changes.length === 0) {
            toast.error("No hay cambios para guardar");
            return;
        }

        toast.success("Stock actualizado", {
            description: `Se modificaron ${changes.length} producto${changes.length > 1 ? "s" : ""}`,
        });
        setAdjustments({});
    };

    return (
        <div className="p-4 lg:p-8">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
                        Gestión de Stock
                    </h1>
                    <p className="mt-1 text-muted-foreground">
                        Ajustá las cantidades rápidamente
                    </p>
                </div>
                <Button
                    size="lg"
                    className={cn(
                        "gap-2 h-12 text-base font-bold shadow-lg transition-all",
                        changedCount > 0
                            ? "bg-emerald-600 hover:bg-emerald-700"
                            : "bg-muted text-muted-foreground cursor-not-allowed"
                    )}
                    disabled={changedCount === 0}
                    onClick={handleSave}
                >
                    <Save className="size-5" />
                    Guardar Cambios
                    {changedCount > 0 && (
                        <Badge
                            variant="secondary"
                            className="ml-1 bg-white/20 text-white font-bold"
                        >
                            {changedCount}
                        </Badge>
                    )}
                </Button>
            </div>

            {/* Search */}
            <div className="relative mb-4 max-w-md">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Filtrar productos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-11 pl-10"
                />
            </div>

            {/* Stock Table */}
            <div className="rounded-xl border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="text-base font-semibold w-[45%]">
                                Producto
                            </TableHead>
                            <TableHead className="text-center text-base font-semibold w-[20%]">
                                Stock Actual
                            </TableHead>
                            <TableHead className="text-center text-base font-semibold w-[20%]">
                                Ajuste
                            </TableHead>
                            <TableHead className="text-center text-base font-semibold w-[15%]">
                                Nuevo Stock
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredProducts.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={4}
                                    className="py-16 text-center"
                                >
                                    <BarChart3 className="mx-auto mb-3 size-12 text-muted-foreground/30" />
                                    <p className="text-lg font-medium text-muted-foreground">
                                        No se encontraron productos
                                    </p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredProducts.map((product) => {
                                const adj = getAdjustment(product.id);
                                const newStock = product.stock + adj;
                                const isModified = adj !== 0;

                                return (
                                    <TableRow
                                        key={product.id}
                                        className={cn(
                                            "transition-colors",
                                            isModified && "bg-amber-50/50"
                                        )}
                                    >
                                        {/* Product Name */}
                                        <TableCell>
                                            <div>
                                                <p className="text-base font-semibold">
                                                    {product.name}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {product.code} · {product.category}
                                                </p>
                                            </div>
                                        </TableCell>

                                        {/* Current Stock */}
                                        <TableCell className="text-center">
                                            <span
                                                className={cn(
                                                    "text-lg font-bold",
                                                    product.stock <= 3
                                                        ? "text-rose-500"
                                                        : "text-foreground"
                                                )}
                                            >
                                                {product.stock}
                                            </span>
                                        </TableCell>

                                        {/* Adjustment Controls */}
                                        <TableCell>
                                            <div className="flex items-center justify-center gap-1">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="size-9 shrink-0"
                                                    onClick={() =>
                                                        incrementAdjustment(
                                                            product.id,
                                                            product.stock,
                                                            -1
                                                        )
                                                    }
                                                >
                                                    <Minus className="size-4" />
                                                </Button>
                                                <Input
                                                    type="number"
                                                    value={adj === 0 ? "" : adj}
                                                    onChange={(e) =>
                                                        handleAdjustmentInput(
                                                            product.id,
                                                            product.stock,
                                                            e.target.value
                                                        )
                                                    }
                                                    className={cn(
                                                        "h-9 w-16 text-center text-base font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                                        adj > 0 && "text-emerald-600",
                                                        adj < 0 && "text-rose-500"
                                                    )}
                                                    placeholder="0"
                                                />
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="size-9 shrink-0"
                                                    onClick={() =>
                                                        incrementAdjustment(
                                                            product.id,
                                                            product.stock,
                                                            1
                                                        )
                                                    }
                                                >
                                                    <Plus className="size-4" />
                                                </Button>
                                            </div>
                                        </TableCell>

                                        {/* New Stock */}
                                        <TableCell className="text-center">
                                            <span
                                                className={cn(
                                                    "text-lg font-bold",
                                                    isModified
                                                        ? adj > 0
                                                            ? "text-emerald-600"
                                                            : "text-rose-500"
                                                        : "text-muted-foreground"
                                                )}
                                            >
                                                {newStock}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
