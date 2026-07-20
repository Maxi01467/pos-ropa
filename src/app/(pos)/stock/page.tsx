"use client";

import React from "react";
import {
    Barcode,
    ChevronDown,
    ClipboardList,
    Filter,
    Minus,
    Package,
    PackagePlus,
    X,
    AlertTriangle,
    DollarSign,
    CalendarIcon,
    Check,
    ChevronsUpDown,
} from "lucide-react";
import { format, subDays, startOfMonth } from "date-fns";
import { Skeleton } from "boneyard-js/react";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { BarcodeLabels } from "@/components/printing/barcode-labels";
import { cn } from "@/lib/core/utils";
import { useStock } from "./hooks/use-stock";
import { MovementsTable } from "@/components/stock/movements-table";
import { StockActionDialog } from "@/components/stock/stock-action-dialog";
import { PrintLabelsDialog } from "@/components/stock/print-labels-dialog";
import { MovementDetailsDialog } from "@/components/stock/movement-details-dialog";

function formatPrice(val: number) {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(val);
}

function MetricCard({
    label,
    value,
    description,
    icon,
    tone = "default",
}: {
    label: string;
    value: string;
    description?: string;
    icon: React.ReactNode;
    tone?: "default" | "success" | "danger" | "warning" | "info" | "dark";
}) {
    const iconClassName = cn(
        "flex size-10 shrink-0 items-center justify-center rounded-2xl border",
        tone === "success"
            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
            : tone === "danger"
              ? "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30"
              : tone === "warning"
                ? "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30"
                : tone === "info"
                  ? "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30"
                  : tone === "dark"
                    ? "bg-neutral-900/5 text-neutral-900 border-neutral-900/10 dark:bg-white/10 dark:text-white dark:border-white/15"
                    : "bg-neutral-50 text-neutral-500 border-neutral-200/50 dark:bg-neutral-900/50 dark:text-neutral-400 dark:border-neutral-800/60"
    );

    const valueClassName =
        tone === "success"
            ? "text-emerald-600 dark:text-emerald-400"
            : tone === "danger"
              ? "text-rose-600 dark:text-rose-400"
              : tone === "warning"
                ? "text-amber-600 dark:text-amber-400"
                : tone === "info"
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-foreground font-extrabold";

    return (
        <Card className="h-full rounded-[2rem] border border-neutral-200/50 bg-background/80 dark:border-neutral-800/40 dark:bg-neutral-900/20 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-400 dark:text-neutral-500">
                            {label}
                        </p>
                        <p className={cn("mt-2 text-2xl font-bold tracking-tight", valueClassName)}>
                            {value}
                        </p>
                        {description ? (
                            <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                                {description}
                            </p>
                        ) : null}
                    </div>
                    <div className={iconClassName}>{icon}</div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function StockPage() {
    const {
        // DB states
        variants,
        labelsToPrint,
        isLoading,
        isSaving,
        // Filter states
        filterProduct,
        setFilterProduct,
        filterProvider,
        setFilterProvider,
        filterDateFrom,
        setFilterDateFrom,
        filterDateTo,
        setFilterDateTo,
        isFiltersOpen,
        setIsFiltersOpen,
        currentPage,
        setCurrentPage,
        // Form states
        stockDialogOpen,
        setStockDialogOpen,
        stockAction,
        advancedMode,
        setAdvancedMode,
        selectedProductId,
        selectedProviderId,
        productSearchQuery,
        setProductSearchQuery,
        providerSearchQuery,
        setProviderSearchQuery,
        simpleQuantity,
        setSimpleQuantity,
        advancedColor,
        setAdvancedColor,
        selectedSizes,
        sizeQuantities,
        setSizeQuantities,
        // Printing states
        selectedMovementIds,
        printDialogOpen,
        setPrintDialogOpen,
        printQuantities,
        setPrintQuantities,
        selectedMovement,
        setSelectedMovement,
        // Computed
        filteredMovements,
        totalMovements,
        totalMovementPages,
        paginatedMovements,
        selectedMovements,
        printableVariants,
        printableTickets,
        totalPhysicalStock,
        stockAlerts,
        inventoryValue,
        hasActiveFilters,
        searchedProducts,
        searchedProviders,
        selectedProduct,
        selectedProductCurrentStock,
        currentSimpleVariantStock,
        selectedVariantStocks,
        products,
        providers,
        // Methods
        clearFilters,
        handleOpenNewStock,
        handleOpenReduceStock,
        handleOpenAdjustStock,
        handleProductChange,
        handleProviderChange,
        toggleSize,
        handleSaveStock,
        toggleMovementSelection,
        handleOpenPrintDialog,
        handleConfirmPrint,
        handleQuickPrintMovement,
        isMovementSelectable,
        getProductName,
    } = useStock();

    return (
        <Skeleton name="stock-page" loading={isLoading}>
        <>
            <div className="print:hidden p-4 sm:p-5 lg:p-6">
                <div className="flex flex-col gap-5">
                    {/* Header */}
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-muted/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                                <Package className="size-3.5" />
                                Gestión de stock
                            </div>
                            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-3xl">
                                Stock
                            </h1>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                size="lg"
                                className="h-11 gap-2 rounded-2xl border-border/50 bg-card/60 backdrop-blur-md text-foreground text-sm font-semibold hover:bg-muted/70 cursor-pointer shadow-xs transition-all active:scale-98 disabled:opacity-40"
                                disabled={selectedMovements.length === 0}
                                onClick={handleOpenPrintDialog}
                            >
                                <Barcode className="size-4.5 text-blue-500 dark:text-blue-400" />
                                Imprimir etiquetas
                            </Button>
                            <Button
                                variant="outline"
                                size="lg"
                                className="h-11 gap-2 rounded-2xl border-border/50 bg-card/60 backdrop-blur-md text-foreground text-sm font-semibold hover:bg-muted/70 cursor-pointer shadow-xs transition-all active:scale-98"
                                onClick={handleOpenAdjustStock}
                            >
                                <ClipboardList className="size-4.5 text-amber-500 dark:text-amber-400" />
                                Ajustar stock
                            </Button>
                            <Button
                                variant="outline"
                                size="lg"
                                className="h-11 gap-2 rounded-2xl border-border/50 bg-card/60 backdrop-blur-md text-foreground text-sm font-semibold hover:bg-muted/70 cursor-pointer shadow-xs transition-all active:scale-98"
                                onClick={handleOpenReduceStock}
                            >
                                <Minus className="size-4.5 text-rose-500 dark:text-rose-400" />
                                Reducir stock
                            </Button>
                            <Button
                                size="lg"
                                className="h-11 gap-2 rounded-2xl border-0 bg-[linear-gradient(135deg,#EC4899_0%,#BE185D_100%)] text-white text-sm font-bold shadow-[0_6px_16px_-4px_rgba(236,72,153,0.25)] hover:shadow-[0_10px_22px_-4px_rgba(236,72,153,0.35)] hover:scale-[1.02] active:scale-98 transition-all duration-200 cursor-pointer"
                                onClick={handleOpenNewStock}
                            >
                                <PackagePlus className="size-4.5" />
                                Ingresar stock
                            </Button>
                        </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid gap-4 sm:grid-cols-3">
                        <MetricCard
                            label="Stock Físico Total"
                            value={String(totalPhysicalStock)}
                            description={`${variants.length} variantes en catálogo`}
                            icon={<Package className="size-5" />}
                            tone="info"
                        />
                        <MetricCard
                            label="Alertas de Stock"
                            value={`${stockAlerts.outOfStock} sin stock`}
                            description={`${stockAlerts.lowStock} variantes con stock bajo (≤ 3 u.)`}
                            icon={<AlertTriangle className="size-5" />}
                            tone="warning"
                        />
                        <MetricCard
                            label="Valor del Inventario"
                            value={formatPrice(inventoryValue.retail)}
                            description={`Costo est. (mayorista): ${formatPrice(inventoryValue.wholesale)}`}
                            icon={<DollarSign className="size-5" />}
                            tone="success"
                        />
                    </div>

                    {/* Filters & Table Card */}
                    <Card className="rounded-[1.75rem] border-border/40 bg-card/70 backdrop-blur-md shadow-xs">
                        <CardContent className="p-4 sm:p-5 space-y-4">
                            <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen} className="w-full">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="flex items-center gap-2">
                                        <CollapsibleTrigger asChild>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="gap-2 rounded-full text-xs font-bold h-8.5 px-3 border-border/40 bg-muted/20 hover:bg-muted/40 transition-all select-none"
                                            >
                                                <Filter className="size-3.5" />
                                                {hasActiveFilters ? "Filtros activos" : "Filtros"}
                                                <div
                                                    className={cn(
                                                        "ml-1 flex size-4 shrink-0 items-center justify-center rounded-full border border-border/40 bg-background/60 transition-transform duration-200",
                                                        isFiltersOpen && "rotate-180"
                                                    )}
                                                >
                                                    <ChevronDown className="size-3" />
                                                </div>
                                            </Button>
                                        </CollapsibleTrigger>
                                                                    
                                        {/* Filters pills */}
                                        {!isFiltersOpen && hasActiveFilters && (
                                            <div className="hidden sm:flex flex-wrap items-center gap-2">
                                                {filterProduct !== "all" && (
                                                    <Badge 
                                                        variant="secondary" 
                                                        className="gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 cursor-pointer transition-all text-xs font-semibold uppercase" 
                                                        onClick={() => setFilterProduct("all")}
                                                    >
                                                        <span>{products.find((p) => p.id === filterProduct)?.name.toUpperCase()}</span>
                                                        <X className="size-3" />
                                                    </Badge>
                                                )}
                                                {filterProvider !== "all" && (
                                                    <Badge 
                                                        variant="secondary" 
                                                        className="gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 cursor-pointer transition-all text-xs font-semibold uppercase" 
                                                        onClick={() => setFilterProvider("all")}
                                                    >
                                                        <span>{providers.find((p) => p.id === filterProvider)?.name.toUpperCase()}</span>
                                                        <X className="size-3" />
                                                    </Badge>
                                                )}
                                                {(filterDateFrom || filterDateTo) && (
                                                    <Badge 
                                                        variant="secondary" 
                                                        className="gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 cursor-pointer transition-all text-xs font-semibold" 
                                                        onClick={() => {setFilterDateFrom(undefined); setFilterDateTo(undefined);}}
                                                    >
                                                        <span>
                                                            {filterDateFrom ? format(filterDateFrom, "dd/MM/yyyy") : ""} 
                                                            {filterDateFrom && filterDateTo ? " - " : ""}
                                                            {filterDateTo ? format(filterDateTo, "dd/MM/yyyy") : ""}
                                                        </span>
                                                        <X className="size-3" />
                                                    </Badge>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="lg:ml-auto">
                                        <span className="text-[11px] font-bold text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full border border-border/20 shadow-3xs select-none">
                                            {totalMovements} {totalMovements === 1 ? "registro encontrado" : "registros encontrados"}
                                        </span>
                                    </div>
                                </div>

                                <CollapsibleContent className="space-y-4 pt-4">
                                    <div className="rounded-[1.75rem] border border-border/40 bg-card/40 backdrop-blur-md shadow-inner-xs p-4 sm:p-5 mt-2">
                                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
                                            {/* Product Combobox */}
                                            <div className="space-y-1.5">
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button 
                                                            variant="outline" 
                                                            role="combobox" 
                                                            className={cn(
                                                                "w-full justify-between h-9.5 text-xs font-medium rounded-full border-border/40 bg-background/50 hover:bg-background/80 hover:border-border/60 transition-all select-none shadow-2xs",
                                                                filterProduct === "all" 
                                                                    ? "text-muted-foreground" 
                                                                    : "border-indigo-500/30 bg-indigo-500/5 text-indigo-600 hover:bg-indigo-500/10 hover:border-indigo-500/45 font-bold dark:text-indigo-400"
                                                            )}
                                                        >
                                                            <span className="truncate flex items-center gap-1.5">
                                                                {filterProduct === "all" ? (
                                                                    <>
                                                                        <Filter className="size-3.5 opacity-60" />
                                                                        Producto: Todos
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <span className="size-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                                                        Producto: {products.find((p) => p.id === filterProduct)?.name.toUpperCase()}
                                                                    </>
                                                                )}
                                                            </span>
                                                            <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent align="start" className="w-[300px] sm:w-[380px] p-0 rounded-xl">
                                                        <Command>
                                                            <CommandInput placeholder="Buscar producto..." className="h-9" />
                                                            <CommandList className="max-h-[220px]">
                                                                <CommandEmpty>No se encontraron productos.</CommandEmpty>
                                                                <CommandGroup>
                                                                    <CommandItem
                                                                        onSelect={() => { setFilterProduct("all"); }}
                                                                        className="rounded-lg text-xs"
                                                                    >
                                                                        <Check className={cn("mr-2 size-4", filterProduct === "all" ? "opacity-100" : "opacity-0")} />
                                                                        Todos los productos
                                                                    </CommandItem>
                                                                    {products.map((p) => (
                                                                        <CommandItem
                                                                            key={p.id}
                                                                            onSelect={() => { setFilterProduct(p.id); }}
                                                                            className="rounded-lg text-xs uppercase"
                                                                        >
                                                                            <Check className={cn("mr-2 size-4", filterProduct === p.id ? "opacity-100" : "opacity-0")} />
                                                                            {p.name}
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>

                                            {/* Provider Combobox */}
                                            <div className="space-y-1.5">
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button 
                                                            variant="outline" 
                                                            role="combobox" 
                                                            className={cn(
                                                                "w-full justify-between h-9.5 text-xs font-medium rounded-full border-border/40 bg-background/50 hover:bg-background/80 hover:border-border/60 transition-all select-none shadow-2xs",
                                                                filterProvider === "all" 
                                                                    ? "text-muted-foreground" 
                                                                    : "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 hover:bg-emerald-500/10 hover:border-emerald-500/45 font-bold dark:text-emerald-400"
                                                            )}
                                                        >
                                                            <span className="truncate flex items-center gap-1.5">
                                                                {filterProvider === "all" ? (
                                                                    <>
                                                                        <Filter className="size-3.5 opacity-60" />
                                                                        Proveedor: Todos
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                                        Proveedor: {providers.find((p) => p.id === filterProvider)?.name.toUpperCase()}
                                                                    </>
                                                                )}
                                                            </span>
                                                            <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent align="start" className="w-[300px] sm:w-[380px] p-0 rounded-xl">
                                                        <Command>
                                                            <CommandInput placeholder="Buscar proveedor..." className="h-9" />
                                                            <CommandList className="max-h-[220px]">
                                                                <CommandEmpty>No se encontraron proveedores.</CommandEmpty>
                                                                <CommandGroup>
                                                                    <CommandItem
                                                                        onSelect={() => { setFilterProvider("all"); }}
                                                                        className="rounded-lg text-xs"
                                                                    >
                                                                        <Check className={cn("mr-2 size-4", filterProvider === "all" ? "opacity-100" : "opacity-0")} />
                                                                        Todos los proveedores
                                                                    </CommandItem>
                                                                    {providers.map((p) => (
                                                                        <CommandItem
                                                                            key={p.id}
                                                                            onSelect={() => { setFilterProvider(p.id); }}
                                                                            className="rounded-lg text-xs uppercase"
                                                                        >
                                                                            <Check className={cn("mr-2 size-4", filterProvider === p.id ? "opacity-100" : "opacity-0")} />
                                                                            {p.name}
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>

                                            {/* Date From */}
                                            <div className="space-y-1.5">
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            className={cn(
                                                                "w-full justify-start text-left h-9.5 text-xs font-medium rounded-full border-border/40 bg-background/50 hover:bg-background/80 hover:border-border/60 transition-all select-none shadow-2xs",
                                                                !filterDateFrom 
                                                                    ? "text-muted-foreground" 
                                                                    : "border-amber-500/30 bg-amber-500/5 text-amber-600 hover:bg-amber-500/10 hover:border-amber-500/45 font-bold dark:text-amber-400"
                                                            )}
                                                        >
                                                            <CalendarIcon className="mr-2 size-3.5 opacity-60" />
                                                            {filterDateFrom ? `Desde: ${format(filterDateFrom, "dd/MM/yyyy")}` : "Desde: Seleccionar"}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                                                        <Calendar
                                                            mode="single"
                                                            locale={es}
                                                            selected={filterDateFrom}
                                                            onSelect={setFilterDateFrom}
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                            </div>

                                            {/* Date To */}
                                            <div className="space-y-1.5">
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            className={cn(
                                                                "w-full justify-start text-left h-9.5 text-xs font-medium rounded-full border-border/40 bg-background/50 hover:bg-background/80 hover:border-border/60 transition-all select-none shadow-2xs",
                                                                !filterDateTo 
                                                                    ? "text-muted-foreground" 
                                                                    : "border-amber-500/30 bg-amber-500/5 text-amber-600 hover:bg-amber-500/10 hover:border-amber-500/45 font-bold dark:text-amber-400"
                                                            )}
                                                        >
                                                            <CalendarIcon className="mr-2 size-3.5 opacity-60" />
                                                            {filterDateTo ? `Hasta: ${format(filterDateTo, "dd/MM/yyyy")}` : "Hasta: Seleccionar"}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0 rounded-xl" align="start">
                                                        <Calendar
                                                            mode="single"
                                                            locale={es}
                                                            selected={filterDateTo}
                                                            onSelect={setFilterDateTo}
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                            
                                            {/* Quick Filters */}
                                            <div className="col-span-full pt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border/30 mt-1">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[11px] font-bold text-muted-foreground/80 uppercase tracking-wider select-none">Filtros rápidos:</span>
                                                    <div className="inline-flex rounded-full bg-muted/80 p-0.5 backdrop-blur-xs select-none shadow-inner-xs border border-border/40">
                                                        {(() => {
                                                            const isHoy = filterDateFrom?.toDateString() === new Date().toDateString() && filterDateTo?.toDateString() === new Date().toDateString();
                                                            const is7Dias = filterDateFrom?.toDateString() === subDays(new Date(), 7).toDateString() && filterDateTo?.toDateString() === new Date().toDateString();
                                                            const isEsteMes = filterDateFrom?.toDateString() === startOfMonth(new Date()).toDateString() && filterDateTo?.toDateString() === new Date().toDateString();
                                                            
                                                            return (
                                                                <>
                                                                    <button
                                                                        onClick={() => { setFilterDateFrom(new Date()); setFilterDateTo(new Date()); }}
                                                                        className={cn(
                                                                            "rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer",
                                                                            isHoy 
                                                                                ? "bg-background text-foreground shadow-xs font-bold scale-102" 
                                                                                : "text-muted-foreground hover:text-foreground"
                                                                        )}
                                                                    >
                                                                        Hoy
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { setFilterDateFrom(subDays(new Date(), 7)); setFilterDateTo(new Date()); }}
                                                                        className={cn(
                                                                            "rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer",
                                                                            is7Dias 
                                                                                ? "bg-background text-foreground shadow-xs font-bold scale-102" 
                                                                                : "text-muted-foreground hover:text-foreground"
                                                                        )}
                                                                    >
                                                                        Últimos 7 días
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { setFilterDateFrom(startOfMonth(new Date())); setFilterDateTo(new Date()); }}
                                                                        className={cn(
                                                                            "rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer",
                                                                            isEsteMes 
                                                                                ? "bg-background text-foreground shadow-xs font-bold scale-102" 
                                                                                : "text-muted-foreground hover:text-foreground"
                                                                        )}
                                                                    >
                                                                        Este mes
                                                                    </button>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                                
                                                {hasActiveFilters && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="gap-1.5 rounded-full text-xs font-bold text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 transition-all px-3 h-7.5 self-end sm:self-auto"
                                                        onClick={clearFilters}
                                                    >
                                                        <X className="size-3.5" />
                                                        Limpiar filtros
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>

                            {/* Movements Table Component */}
                            <MovementsTable
                                paginatedMovements={paginatedMovements}
                                filteredMovements={filteredMovements}
                                selectedMovementIds={selectedMovementIds}
                                currentPage={currentPage}
                                setCurrentPage={setCurrentPage}
                                totalMovementPages={totalMovementPages}
                                isMovementSelectable={isMovementSelectable}
                                toggleMovementSelection={toggleMovementSelection}
                                getProductName={getProductName}
                                handleQuickPrintMovement={handleQuickPrintMovement}
                                onSelectMovement={setSelectedMovement}
                                hasActiveFilters={hasActiveFilters}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Dialogs Components */}
            <MovementDetailsDialog
                open={Boolean(selectedMovement)}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedMovement(null);
                    }
                }}
                selectedMovement={selectedMovement}
                getProductName={getProductName}
            />

            <StockActionDialog
                open={stockDialogOpen}
                onOpenChange={setStockDialogOpen}
                stockAction={stockAction}
                isSaving={isSaving}
                advancedMode={advancedMode}
                setAdvancedMode={setAdvancedMode}
                productSearchQuery={productSearchQuery}
                setProductSearchQuery={setProductSearchQuery}
                providerSearchQuery={providerSearchQuery}
                setProviderSearchQuery={setProviderSearchQuery}
                searchedProducts={searchedProducts}
                searchedProviders={searchedProviders}
                selectedProductId={selectedProductId}
                selectedProviderId={selectedProviderId}
                handleProductChange={handleProductChange}
                handleProviderChange={handleProviderChange}
                selectedProduct={selectedProduct}
                selectedProductCurrentStock={selectedProductCurrentStock}
                currentSimpleVariantStock={currentSimpleVariantStock}
                advancedColor={advancedColor}
                setAdvancedColor={setAdvancedColor}
                selectedSizes={selectedSizes}
                toggleSize={toggleSize}
                sizeQuantities={sizeQuantities}
                setSizeQuantities={setSizeQuantities}
                selectedVariantStocks={selectedVariantStocks}
                simpleQuantity={simpleQuantity}
                setSimpleQuantity={setSimpleQuantity}
                handleSaveStock={handleSaveStock}
            />

            <PrintLabelsDialog
                open={printDialogOpen}
                onOpenChange={setPrintDialogOpen}
                printableVariants={printableVariants}
                printQuantities={printQuantities}
                setPrintQuantities={setPrintQuantities}
                selectedMovements={selectedMovements}
                printableTickets={printableTickets}
                handleConfirmPrint={handleConfirmPrint}
                getProductName={getProductName}
            />

            {/* Render print labels layout off-screen when print triggers */}
            <BarcodeLabels items={labelsToPrint} />
        </>
        </Skeleton>
    );
}
