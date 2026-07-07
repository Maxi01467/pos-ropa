"use client";

import React from "react";
import { AlertCircle, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DBProduct } from "@/app/(pos)/inventario/page";

interface ProductCardProps {
    product: DBProduct;
    onEdit: (product: DBProduct) => void;
    onDelete: (product: DBProduct) => void;
    formatCurrency: (amount: number) => string;
}

export const ProductCard = React.memo(function ProductCard({
    product,
    onEdit,
    onDelete,
    formatCurrency,
}: ProductCardProps) {
    return (
        <Card className="group relative rounded-[1.25rem] border border-border/60 bg-card/75 backdrop-blur-md transition-all duration-300 hover:shadow-[0_12px_24px_-10px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 overflow-hidden">
            <CardContent className="p-4 flex flex-col justify-between h-full">
                {/* Sección Superior: Info y Botones de Acción */}
                <div>
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                                CÓD. #{product.code}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                                <h3 className="text-base font-bold text-foreground tracking-tight leading-tight truncate uppercase" title={product.name}>
                                    {product.name}
                                </h3>
                                <div className="flex gap-1 shrink-0">
                                    {product.stock === 0 ? (
                                        <Badge className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 text-[12px] font-semibold text-rose-700 dark:text-rose-400">
                                            <span className="size-1 rounded-full bg-rose-500" />
                                            Sin stock
                                        </Badge>
                                    ) : product.stock <= 3 ? (
                                        <Badge className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[12px] font-semibold text-amber-700 dark:text-amber-400">
                                            <span className="size-1 rounded-full bg-amber-500 animate-pulse" />
                                            {product.stock} u.
                                        </Badge>
                                    ) : (
                                        <Badge className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">
                                            <span className="size-1 rounded-full bg-emerald-500" />
                                            {product.stock} u.
                                        </Badge>
                                    )}
                                    {product.pendingReview && (
                                        <Badge className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 dark:text-indigo-400 animate-pulse" title="Pendiente de revisión">
                                            ⚠️ Revisar
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {/* Botones de Acción (estilo iOS translúcido, aparecen con hover suave) */}
                        <div className="flex gap-1 opacity-0 transition-all duration-200 group-hover:opacity-100 shrink-0">
                            <Button
                                variant="secondary"
                                size="icon-sm"
                                onClick={() => onEdit(product)}
                                className="size-6 rounded-full bg-muted/65 hover:bg-muted text-muted-foreground hover:text-foreground backdrop-blur-sm border border-border/40 shadow-xs cursor-pointer"
                                title="Editar producto"
                            >
                                <Pencil className="size-3" />
                            </Button>
                            <Button
                                variant="secondary"
                                size="icon-sm"
                                onClick={() => onDelete(product)}
                                className="size-6 rounded-full bg-muted/65 hover:bg-muted text-muted-foreground hover:text-destructive backdrop-blur-sm border border-border/40 shadow-xs cursor-pointer"
                                title="Eliminar producto"
                            >
                                <Trash2 className="size-3" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Panel Financiero (El "Widget" de Apple) */}
                <div className="mt-4 rounded-xl border border-border/50 bg-muted/20 p-3 grid grid-cols-2 gap-2.5">
                    <div className="space-y-0.5">
                        <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            P. Venta
                        </span>
                        <p className="text-lg font-extrabold tracking-tight text-foreground animate-pos-value-change">
                            {formatCurrency(product.price)}
                        </p>
                    </div>

                    <div className="space-y-0.5 border-l border-border/40 pl-3">
                        <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Mayorista
                        </span>
                        <p className="text-lg font-extrabold tracking-tight text-violet-600 dark:text-violet-300 animate-pos-value-change">
                            {formatCurrency(product.wholesalePrice)}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
});
