"use client";

import React from "react";
import { 
    ChevronLeft, 
    ChevronRight, 
    Filter, 
    Package, 
    Printer 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/core/utils";
import { normalizeDateInput, ARGENTINA_TIME_ZONE } from "@/lib/core/datetime";
import type { StockMovement } from "@/app/(pos)/stock/hooks/use-stock";

interface MovementsTableProps {
    paginatedMovements: StockMovement[];
    filteredMovements: StockMovement[];
    selectedMovementIds: string[];
    currentPage: number;
    setCurrentPage: (page: number | ((prev: number) => number)) => void;
    totalMovementPages: number;
    isMovementSelectable: (m: StockMovement) => boolean;
    toggleMovementSelection: (id: string, checked: boolean) => void;
    getProductName: (id: string) => string;
    handleQuickPrintMovement: (m: StockMovement) => void;
    onSelectMovement: (m: StockMovement) => void;
    hasActiveFilters: boolean;
}

function getPageNumbers(currentPage: number, totalPages: number): (number | string)[] {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    
    const pages: (number | string)[] = [];
    const showLeftEllipsis = currentPage > 4;
    const showRightEllipsis = currentPage < totalPages - 3;
    
    if (!showLeftEllipsis && showRightEllipsis) {
        for (let i = 1; i <= 5; i++) {
            pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
    } else if (showLeftEllipsis && !showRightEllipsis) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 4; i <= totalPages; i++) {
            pages.push(i);
        }
    } else {
        pages.push(1);
        pages.push("...");
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push("...");
        pages.push(totalPages);
    }
    
    return pages;
}

export const MovementsTable = React.memo(function MovementsTable({
    paginatedMovements,
    filteredMovements,
    selectedMovementIds,
    currentPage,
    setCurrentPage,
    totalMovementPages,
    isMovementSelectable,
    toggleMovementSelection,
    getProductName,
    handleQuickPrintMovement,
    onSelectMovement,
    hasActiveFilters,
}: MovementsTableProps) {
    return (
        <div className="space-y-4">
            <div className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/92 shadow-sm">
                <Table>
                    <TableHeader className="bg-stone-50/100 dark:bg-neutral-900/40">
                        <TableRow className="hover:bg-transparent border-b border-stone-200/50 dark:border-stone-800/40">
                            <TableHead className="w-14 font-semibold text-xs tracking-wider uppercase text-neutral-400 py-3.5">Sel.</TableHead>
                            <TableHead className="font-semibold text-xs tracking-wider uppercase text-neutral-400 py-3.5">Fecha</TableHead>
                            <TableHead className="font-semibold text-xs tracking-wider uppercase text-neutral-400 py-3.5">Producto Principal</TableHead>
                            <TableHead className="font-semibold text-xs tracking-wider uppercase text-neutral-400 py-3.5">Variación</TableHead>
                            <TableHead className="text-right font-semibold text-xs tracking-wider uppercase text-neutral-400 py-3.5">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredMovements.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="py-16 text-center">
                                    <Package className="mx-auto mb-3 size-12 text-muted-foreground/30" />
                                    <p className="text-lg font-medium text-muted-foreground">
                                        {hasActiveFilters
                                            ? "No hay movimientos con estos filtros"
                                            : "Sin movimientos de stock aun"}
                                    </p>
                                    <p className="mt-1 text-sm text-muted-foreground/70">
                                        {hasActiveFilters
                                            ? "Probá con otros filtros"
                                            : "Cuando selecciones filas, se habilita la impresión"}
                                    </p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedMovements.map((movement) => {
                                const isSelected = selectedMovementIds.includes(movement.id);
                                const isSelectable = isMovementSelectable(movement);
                                const primaryType = movement.variants[0]?.type;

                                return (
                                    <TableRow
                                        key={movement.id}
                                        className={cn(
                                            "transition-colors",
                                            isSelected &&
                                                "bg-emerald-950/6 hover:bg-emerald-950/10 dark:bg-emerald-400/10 dark:hover:bg-emerald-400/14"
                                        )}
                                    >
                                        <TableCell className="text-center">
                                            <Checkbox
                                                checked={isSelected}
                                                disabled={!isSelectable}
                                                onCheckedChange={(checked) =>
                                                    toggleMovementSelection(
                                                        movement.id,
                                                        checked === true
                                                    )
                                                }
                                                aria-label={
                                                    isSelectable
                                                        ? `Seleccionar ingreso de ${getProductName(movement.productId)}`
                                                        : `Movimiento no seleccionable de ${getProductName(movement.productId)}`
                                                }
                                                className={cn(
                                                    "size-5 rounded-lg border-2 border-muted-foreground/35 transition-all dark:border-white/30",
                                                    isSelectable
                                                        ? "cursor-pointer hover:border-emerald-500 hover:bg-emerald-500/10 hover:shadow-[0_0_0_4px_rgba(16,185,129,0.12)] data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:text-white data-[state=checked]:shadow-[0_0_0_4px_rgba(16,185,129,0.22)] dark:hover:border-emerald-300 dark:hover:bg-emerald-300/12 dark:data-[state=checked]:border-emerald-300 dark:data-[state=checked]:bg-emerald-500 dark:data-[state=checked]:shadow-[0_0_0_4px_rgba(52,211,153,0.28)]"
                                                        : "cursor-not-allowed opacity-45"
                                                )}
                                            />
                                        </TableCell>
                                        <TableCell 
                                            className="cursor-pointer group select-none hover:bg-muted/10 transition-colors"
                                            onClick={() => onSelectMovement(movement)}
                                            title="Ver detalle del movimiento"
                                        >
                                            <div className="flex items-center gap-3">
                                                {(() => {
                                                    const rawDate = normalizeDateInput(movement.date);
                                                    const dayStr = new Intl.DateTimeFormat("es-AR", {
                                                        day: "numeric",
                                                        month: "short",
                                                        timeZone: ARGENTINA_TIME_ZONE
                                                    }).format(rawDate);
                                                    const timeStr = new Intl.DateTimeFormat("es-AR", {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                        hourCycle: "h23",
                                                        timeZone: ARGENTINA_TIME_ZONE
                                                    }).format(rawDate) + " hs";
                                                    
                                                    return (
                                                        <div className="flex flex-col min-w-[90px]">
                                                            <span className="text-[13px] font-semibold tracking-tight text-foreground/90 group-hover:text-primary transition-colors">
                                                                {dayStr}
                                                            </span>
                                                            <span className="text-[10px] font-medium text-muted-foreground/80 mt-0.5">
                                                                {timeStr}
                                                            </span>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </TableCell>
                                        <TableCell 
                                            className="cursor-pointer hover:bg-muted/10 transition-colors"
                                            onClick={() => onSelectMovement(movement)}
                                            title="Ver detalle del movimiento"
                                        >
                                            <div>
                                                <p className="text-sm font-semibold uppercase tracking-tight text-foreground/90 hover:text-primary transition-colors">
                                                    {getProductName(movement.productId)}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {movement.variants.length} variante(s)
                                                </p>
                                            </div>
                                        </TableCell>
                                        <TableCell 
                                            className="cursor-pointer hover:bg-muted/10 transition-colors"
                                            onClick={() => onSelectMovement(movement)}
                                            title="Ver detalle del movimiento"
                                        >
                                            <div className="flex items-center gap-2.5 select-none">
                                                <span className={cn(
                                                    "px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border inline-flex items-center gap-1.5 shadow-2xs transition-all",
                                                    primaryType === "INGRESO"
                                                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                                                        : primaryType === "SALIDA"
                                                          ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
                                                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                                                )}>
                                                    <span className={cn(
                                                        "size-1.5 rounded-full",
                                                        primaryType === "INGRESO"
                                                            ? "bg-emerald-500 dark:bg-emerald-400"
                                                            : primaryType === "SALIDA"
                                                              ? "bg-rose-500 dark:bg-rose-400"
                                                              : "bg-amber-500 dark:bg-amber-400"
                                                    )} />
                                                    {primaryType === "INGRESO" ? "Ingreso" : primaryType === "SALIDA" ? "Egreso" : "Ajuste"}
                                                </span>
                                                
                                                <span className={cn(
                                                    "text-sm font-extrabold tracking-tight tabular-nums inline-flex items-center gap-0.5",
                                                    movement.totalQuantity > 0
                                                        ? "text-emerald-600 dark:text-emerald-400"
                                                        : movement.totalQuantity < 0
                                                          ? "text-rose-600 dark:text-rose-400"
                                                          : "text-muted-foreground"
                                                )}>
                                                    {movement.totalQuantity > 0 ? `+${movement.totalQuantity}` : movement.totalQuantity}
                                                    <span className="text-[11px] font-semibold text-muted-foreground/80 ml-0.5">u.</span>
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {isSelectable ? (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-2 border-emerald-600/20 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                                                    onClick={() => handleQuickPrintMovement(movement)}
                                                >
                                                    <Printer className="size-4" />
                                                    Imprimir
                                                </Button>
                                            ) : (
                                                <span className="text-xs text-muted-foreground pr-4">—</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            {totalMovementPages > 1 && (
                <div className="flex justify-center mt-8 mb-2">
                    <div className="inline-flex items-center gap-3 rounded-full border border-border/60 bg-card/60 px-3.5 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.06)] backdrop-blur-xl">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                            disabled={currentPage === 1}
                            className="size-7 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer transition-all"
                            title="Página anterior"
                        >
                            <ChevronLeft className="size-4" />
                        </Button>

                        <div className="flex items-center gap-1">
                            {getPageNumbers(currentPage, totalMovementPages).map((page, idx) => {
                                if (page === "...") {
                                    return (
                                        <span
                                            key={`ellipsis-${idx}`}
                                            className="px-1 text-xs text-muted-foreground font-medium select-none"
                                        >
                                            ...
                                        </span>
                                    );
                                }

                                const pageNum = Number(page);
                                const isSelected = pageNum === currentPage;
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`size-6 rounded-full text-xs font-semibold flex items-center justify-center transition-all cursor-pointer ${
                                            isSelected
                                                ? "bg-foreground text-background font-bold shadow-xs scale-105"
                                                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                                setCurrentPage((page) => Math.min(totalMovementPages, page + 1))
                            }
                            disabled={currentPage === totalMovementPages}
                            className="size-7 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer transition-all"
                            title="Página siguiente"
                        >
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
});
