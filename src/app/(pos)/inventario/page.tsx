"use client";

import {
    AlertCircle,
    CheckCheck,
    Package,
    Plus,
    Search,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatArgentinaDateTime } from "@/lib/core/datetime";
import { useInventory } from "./hooks/use-inventory";
import { ProductCard } from "@/components/inventario/product-card";
import { ProductFormDialog } from "@/components/inventario/product-form-dialog";
import { Skeleton } from "boneyard-js/react";

export interface DBProduct {
    id: string;
    code: string;
    name: string;
    quickCreated: boolean;
    pendingReview: boolean;
    quickCreatedAt?: string;
    quickCreatedByName?: string;
    quickCreatedByRole?: string;
    reviewedAt?: string;
    reviewedByName?: string;
    price: number;
    wholesalePrice: number;
    costPrice?: number;
    stock: number;
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 0,
    }).format(amount);
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

export default function InventarioPage() {
    const {
        isLoading,
        isSaving,
        searchQuery,
        setSearchQuery,
        activeTab,
        setActiveTab,
        currentPage,
        setCurrentPage,
        dialogOpen,
        setDialogOpen,
        editingProduct,
        formName,
        setFormName,
        formPrice,
        setFormPrice,
        formWholesalePrice,
        setFormWholesalePrice,
        formCostPrice,
        setFormCostPrice,
        filteredProducts,
        pendingProducts,
        paginatedProducts,
        totalCatalogPages,
        pendingCount,
        margin,
        calculatedWholesalePrice,
        costPriceNum,
        salePriceNum,
        handleOpenNew,
        handleOpenEdit,
        handleSave,
        handleMarkReviewed,
        handleDelete,
    } = useInventory();

    return (
        <Skeleton name="inventario-page" loading={isLoading}>
        <div className="p-4 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-violet-900/25 bg-[linear-gradient(135deg,rgba(109,40,217,0.18),rgba(67,56,202,0.08))] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-800 dark:text-violet-100">
                            <Package className="size-3.5" />
                            Catálogo
                        </div>
                        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-3xl">
                            Inventario
                        </h1>
                    </div>
                    <Button
                        size="lg"
                        className="h-11 px-5 gap-2 rounded-2xl border-0 bg-[linear-gradient(135deg,#EC4899_0%,#BE185D_100%)] text-white text-sm font-semibold shadow-[0_6px_16px_-4px_rgba(236,72,153,0.25)] hover:shadow-[0_10px_22px_-4px_rgba(236,72,153,0.35)] hover:scale-[1.01] active:scale-98 transition-all duration-200 cursor-pointer"
                        onClick={handleOpenNew}
                    >
                        <Plus className="size-4.5" />
                        Nuevo Producto
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
                <TabsList className="w-full justify-start sm:w-fit">
                    <TabsTrigger value="catalogo" className="gap-1.5">
                        Catálogo
                        <Badge className="ml-1 rounded-full bg-muted text-muted-foreground font-bold px-2 py-0 text-[10px]">
                            {filteredProducts.length}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="pendientes">
                        Pendientes
                        {pendingCount > 0 && (
                            <Badge className="ml-1 rounded-full bg-amber-600 px-2 py-0 text-[10px] text-white">
                                {pendingCount}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <div className="mb-4 mt-4 flex flex-col gap-3 sm:flex-row">
                    <div className="relative flex-1 max-w-md">
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder={
                                activeTab === "pendientes"
                                    ? "Buscar pendiente por nombre o código..."
                                    : "Buscar por nombre o código..."
                            }
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-11 pl-10"
                        />
                    </div>
                </div>

                <TabsContent value="catalogo">
                    {filteredProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-20 text-center">
                            <Package className="mb-4 size-16 text-muted-foreground/30" />
                            <p className="text-xl font-medium text-muted-foreground">
                                {searchQuery
                                    ? "No se encontraron productos"
                                    : "Sin productos aún"}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground/70">
                                {searchQuery
                                    ? "Probá con otros filtros"
                                    : "Creá tu primer producto para empezar"}
                            </p>
                            {!searchQuery && (
                                <Button 
                                    className="mt-6 gap-2 rounded-2xl border-0 bg-[linear-gradient(135deg,#EC4899_0%,#BE185D_100%)] text-white shadow-[0_8px_20px_-6px_rgba(236,72,153,0.3)] hover:shadow-[0_12px_28px_-6px_rgba(236,72,153,0.45)] hover:scale-[1.02] active:scale-98 transition-all duration-200 cursor-pointer" 
                                    size="lg" 
                                    onClick={handleOpenNew}
                                >
                                    <Plus className="size-5" />
                                    Nuevo Producto
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {paginatedProducts.map((product) => (
                                    <ProductCard
                                        key={product.id}
                                        product={product}
                                        onEdit={handleOpenEdit}
                                        onDelete={handleDelete}
                                        formatCurrency={formatCurrency}
                                    />
                                ))}
                            </div>

                            {/* Dock Flotante Glassmórfico de Paginación */}
                            {totalCatalogPages > 1 && (
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
                                            {getPageNumbers(currentPage, totalCatalogPages).map((page, idx) => {
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
                                                setCurrentPage((page) => Math.min(totalCatalogPages, page + 1))
                                            }
                                            disabled={currentPage === totalCatalogPages}
                                            className="size-7 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer transition-all"
                                            title="Página siguiente"
                                        >
                                            <ChevronRight className="size-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="pendientes">
                    {pendingProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-20 text-center">
                            <CheckCheck className="mb-4 size-16 text-muted-foreground/30" />
                            <p className="text-xl font-medium text-muted-foreground">
                                {searchQuery
                                    ? "No hay pendientes con esa búsqueda"
                                    : "No hay productos pendientes de revisión"}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground/70">
                                Todo lo creado rápido por staff ya fue revisado.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-3 xl:grid-cols-2">
                            {pendingProducts.map((product) => (
                                <Card
                                    key={product.id}
                                    className="rounded-[1.5rem] border-amber-900/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(120,53,15,0.04))] shadow-sm"
                                >
                                    <CardContent className="p-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <AlertCircle className="size-4 text-amber-700" />
                                                    <p className="truncate text-base font-semibold uppercase">
                                                        {product.name}
                                                    </p>
                                                </div>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    Código: {product.code}
                                                </p>
                                            </div>
                                            <Badge className="bg-amber-600 text-white">
                                                Pendiente
                                            </Badge>
                                        </div>

                                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                                    Creado por
                                                </p>
                                                <p className="mt-1 text-sm font-medium text-foreground">
                                                    {product.quickCreatedByName ?? "Sistema"}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {product.quickCreatedByRole ?? "STAFF"}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                                    Fecha
                                                </p>
                                                <p className="mt-1 text-sm font-medium text-foreground">
                                                    {product.quickCreatedAt
                                                        ? formatArgentinaDateTime(product.quickCreatedAt)
                                                        : "—"}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                                    Precios
                                                </p>
                                                <p className="mt-1 text-sm font-medium text-foreground">
                                                    Venta: {formatCurrency(product.price)}
                                                </p>
                                                <p className="text-xs text-blue-600">
                                                    Mayorista: {formatCurrency(product.wholesalePrice)}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                                    Stock inicial
                                                </p>
                                                <p className="mt-1 text-sm font-medium text-foreground">
                                                    {product.stock} unidad(es)
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-4 flex flex-wrap gap-2">
                                            <Button
                                                variant="outline"
                                                className="gap-2"
                                                onClick={() => handleOpenEdit(product)}
                                            >
                                                Nuevo ingreso o editar
                                            </Button>
                                            <Button
                                                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                                                onClick={() => handleMarkReviewed(product)}
                                            >
                                                <CheckCheck className="size-4" />
                                                Marcar revisado
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Create/Edit Form Dialog */}
            <ProductFormDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                editingProduct={editingProduct}
                formName={formName}
                setFormName={setFormName}
                formPrice={formPrice}
                setFormPrice={setFormPrice}
                formWholesalePrice={formWholesalePrice}
                setFormWholesalePrice={setFormWholesalePrice}
                formCostPrice={formCostPrice}
                setFormCostPrice={setFormCostPrice}
                costPriceNum={costPriceNum}
                salePriceNum={salePriceNum}
                calculatedWholesalePrice={calculatedWholesalePrice}
                margin={margin}
                isSaving={isSaving}
                onSave={handleSave}
            />
        </div>
        </Skeleton>
    );
}
