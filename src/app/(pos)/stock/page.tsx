"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    getStockPageData,
    registerStockEntries,
    reduceStockEntries,
} from "@/app/actions/stock-actions";
import {
    Barcode,
    CalendarDays,
    Eye,
    Filter,
    Minus,
    Package,
    PackagePlus,
    Printer,
    Search,
    X,
    Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { BarcodeLabels } from "@/components/barcode-labels";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { notifyDataUpdated, useDataRefresh } from "@/lib/data-sync-client";

// Reemplazamos mockSizes por un array constante aquí
const commonSizes = ["XS", "S", "M", "L", "XL", "XXL", "38", "40", "42", "44", "46", "48"];

type LabelPrintItem = {
    productName: string;
    sku: string;
    size: string;
    color: string;
    retailPrice: number;
    wholesalePrice: number;
};

export type StockEntry = {
    id: string;
    productId: string;
    providerId?: string;
    quantity: number;
    color: string;
    size: string;
    sku: string;
    date: string;
    mode: "simple" | "avanzado";
};

type StockProduct = {
    id: string;
    name: string;
    code: string;
    price: number;
    wholesalePrice: number;
};

type StockSupplier = {
    id: string;
    name: string;
};

type RegisterStockEntry = {
    productId: string;
    quantity: number;
    color: string;
    size: string;
    sku: string;
    supplierId?: string;
};

type StockMovement = {
    id: string;
    productId: string;
    providerId?: string;
    date: string;
    totalQuantity: number;
    variants: StockEntry[];
};

// ... Funciones de fecha iguales ...
function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-AR", {
        day: "2-digit", month: "2-digit", year: "2-digit",
        hour: "2-digit", minute: "2-digit",
    });
}

function formatShortDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

function buildMovements(entries: StockEntry[]): StockMovement[] {
    const grouped = new Map<string, StockMovement>();
    for (const entry of entries) {
        // Agrupamos por el timestamp real del ingreso para no mezclar movimientos
        // distintos del mismo producto que ocurrieron el mismo día.
        const key = `${entry.productId}-${entry.providerId ?? "sin-proveedor"}-${entry.date}`;
        const existing = grouped.get(key);

        if (existing) {
            existing.totalQuantity += entry.quantity;
            existing.variants.push(entry);
            continue;
        }

        grouped.set(key, {
            id: key,
            productId: entry.productId,
            providerId: entry.providerId,
            date: entry.date,
            totalQuantity: entry.quantity,
            variants: [entry],
        });
    }

    return Array.from(grouped.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
}

function generateSKU(productCode: string, color: string, size: string) {
    const cleanColor = color.substring(0, 3).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return `${productCode}-${cleanColor || "UNI"}-${size.toUpperCase()}`;
}

function getVariantLabel(entry: StockEntry) {
    const parts: string[] = [];
    if (entry.size !== "Único") parts.push(`Talle ${entry.size}`);
    if (entry.color !== "Único") parts.push(`Color ${entry.color}`);
    return parts.length > 0 ? parts.join(" - ") : "Talle y color único";
}

function clampQuantity(rawValue: string | undefined, max: number) {
    const parsed = Number.parseInt(rawValue ?? String(max), 10);
    return Number.isNaN(parsed) ? max : Math.max(0, Math.min(parsed, max));
}

export default function StockPage() {
    // Estados de base de datos
    const [entries, setEntries] = useState<StockEntry[]>([]);
    const [products, setProducts] = useState<StockProduct[]>([]);
    const [providers, setProviders] = useState<StockSupplier[]>([]);
    const [labelsToPrint, setLabelsToPrint] = useState<LabelPrintItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // ... Resto de tus estados se mantienen exactamente igual ...
    const [filterProduct, setFilterProduct] = useState("all");
    const [filterProvider, setFilterProvider] = useState("all");
    const [filterDateFrom, setFilterDateFrom] = useState("");
    const [filterDateTo, setFilterDateTo] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    const [stockDialogOpen, setStockDialogOpen] = useState(false);
    const [stockAction, setStockAction] = useState<"add" | "remove">("add");
    const [advancedMode, setAdvancedMode] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState("");
    const [selectedProviderId, setSelectedProviderId] = useState("");
    const [productSearchQuery, setProductSearchQuery] = useState("");
    const [providerSearchQuery, setProviderSearchQuery] = useState("");
    const [simpleQuantity, setSimpleQuantity] = useState("");
    const [advancedColor, setAdvancedColor] = useState("");
    const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
    const [sizeQuantities, setSizeQuantities] = useState<Record<string, string>>({});
    const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);
    const [selectedMovementIds, setSelectedMovementIds] = useState<string[]>([]);
    const [printDialogOpen, setPrintDialogOpen] = useState(false);
    const [printQuantities, setPrintQuantities] = useState<Record<string, string>>({});
    
    const loadData = useCallback(async () => {
        try {
            const data = await getStockPageData();
            setProducts(data.products);
            setProviders(data.suppliers);
            setEntries(data.entries);
        } catch (error) {
            toast.error("Error al cargar el stock");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useDataRefresh(
        [CACHE_TAGS.stock, CACHE_TAGS.inventory, CACHE_TAGS.suppliers, CACHE_TAGS.posProducts],
        loadData
    );

    useEffect(() => {
        const handleAfterPrint = () => {
            setLabelsToPrint([]);
        };

        window.addEventListener("afterprint", handleAfterPrint);
        return () => {
            window.removeEventListener("afterprint", handleAfterPrint);
        };
    }, []);

    const movements = useMemo(() => buildMovements(entries), [entries]);

    const filteredMovements = useMemo(() => {
        return movements.filter((movement) => {
            if (filterProduct !== "all" && movement.productId !== filterProduct) return false;
            if (filterProvider !== "all" && movement.providerId !== filterProvider) return false;
            if (filterDateFrom && new Date(movement.date) < new Date(filterDateFrom)) return false;
            if (filterDateTo && new Date(movement.date) > new Date(`${filterDateTo}T23:59:59`)) return false;
            return true;
        });
    }, [movements, filterProduct, filterProvider, filterDateFrom, filterDateTo]);

    const selectedMovements = useMemo(
        () => filteredMovements.filter((movement) => selectedMovementIds.includes(movement.id)),
        [filteredMovements, selectedMovementIds]
    );

    const printableVariants = useMemo(
        () =>
            selectedMovements
                .flatMap((movement) => movement.variants)
                .filter((variant) => variant.quantity > 0),
        [selectedMovements]
    );

    const printableTickets = printableVariants.reduce(
        (total, variant) => total + clampQuantity(printQuantities[variant.id], variant.quantity),
        0
    );

    const totalUnits = movements.reduce((sum, movement) => sum + movement.totalQuantity, 0);
    const todayEntries = movements.filter(
        (movement) => new Date(movement.date).toDateString() === new Date().toDateString()
    ).length;

    const hasActiveFilters = filterProduct !== "all" || filterProvider !== "all" || filterDateFrom !== "" || filterDateTo !== "";
    const searchedProducts = useMemo(() => {
        const query = productSearchQuery.trim().toLowerCase();
        if (!query) return products;
        return products.filter(
            (product) =>
                product.name.toLowerCase().includes(query) ||
                product.code.toLowerCase().includes(query)
        );
    }, [products, productSearchQuery]);
    const searchedProviders = useMemo(() => {
        const query = providerSearchQuery.trim().toLowerCase();
        if (!query) return providers;
        return providers.filter((provider) =>
            provider.name.toLowerCase().includes(query)
        );
    }, [providers, providerSearchQuery]);

    const getProductName = (id: string) => products.find((product) => product.id === id)?.name ?? "Desconocido";
    const getProviderName = (id?: string) => providers.find((provider) => provider.id === id)?.name ?? "—";

    const clearFilters = () => {
        setFilterProduct("all");
        setFilterProvider("all");
        setFilterDateFrom("");
        setFilterDateTo("");
    };

    const resetStockForm = () => {
        setSelectedProductId("");
        setSelectedProviderId("");
        setProductSearchQuery("");
        setProviderSearchQuery("");
        setSimpleQuantity("");
        setAdvancedColor("");
        setSelectedSizes([]);
        setSizeQuantities({});
        setAdvancedMode(false);
        setStockAction("add");
    };

    const handleOpenNewStock = () => {
        resetStockForm();
        setStockAction("add");
        setStockDialogOpen(true);
    };

    const handleOpenReduceStock = () => {
        resetStockForm();
        setStockAction("remove");
        setStockDialogOpen(true);
    };

    const handleProductChange = (productId: string) => {
        setSelectedProductId(productId);
        const product = products.find((item) => item.id === productId);
        if (product) {
            setProductSearchQuery(product.name);
        }
    };

    const handleProviderChange = (providerId: string) => {
        setSelectedProviderId(providerId);
        const provider = providers.find((item) => item.id === providerId);
        if (provider) {
            setProviderSearchQuery(provider.name);
        }
    };

    const toggleSize = (size: string) => {
        setSelectedSizes((current) =>
            current.includes(size)
                ? current.filter((item) => item !== size)
                : [...current, size]
        );
        if (selectedSizes.includes(size)) {
            setSizeQuantities((current) => {
                const next = { ...current };
                delete next[size];
                return next;
            });
        }
    };

    const handleSaveStock = async () => {
        if (!selectedProductId) {
            toast.error("Seleccioná un producto");
            return;
        }

        const product = products.find((item) => item.id === selectedProductId);
        if (!product) return;

        const newEntries: RegisterStockEntry[] = [];

        if (advancedMode) {
            if (!advancedColor.trim()) {
                toast.error("Ingresá un color");
                return;
            }
            if (selectedSizes.length === 0) {
                toast.error("Seleccioná al menos un talle");
                return;
            }

            for (const size of selectedSizes) {
                const quantity = Number.parseInt(sizeQuantities[size] ?? "0", 10);
                if (Number.isNaN(quantity) || quantity <= 0) {
                    toast.error(`Ingresá una cantidad válida para el talle ${size}`);
                    return;
                }
                newEntries.push({
                    productId: selectedProductId,
                    quantity,
                    color: advancedColor.trim(),
                    size,
                    sku: generateSKU(product.code, advancedColor.trim(), size),
                    supplierId: selectedProviderId || undefined,
                });
            }
        } else {
            const quantity = Number.parseInt(simpleQuantity, 10);
            if (Number.isNaN(quantity) || quantity <= 0) {
                toast.error("Ingresá una cantidad válida");
                return;
            }
            newEntries.push({
                productId: selectedProductId,
                quantity,
                color: "Único",
                size: "Único",
                sku: `${product.code}-UNI`,
                supplierId: selectedProviderId || undefined,
            });
        }

        setIsSaving(true);
        try {
            if (stockAction === "add") {
                await registerStockEntries(newEntries);
            } else {
                await reduceStockEntries(newEntries);
            }
            await loadData();
            notifyDataUpdated([CACHE_TAGS.stock, CACHE_TAGS.inventory, CACHE_TAGS.posProducts]);
            
            setStockDialogOpen(false);
            resetStockForm();
            toast.success(
                stockAction === "add" ? "Ingreso de stock registrado" : "Stock reducido",
                {
                description: `${product.name} · ${newEntries.reduce((sum, entry) => sum + entry.quantity, 0)} unidad(es)`,
                }
            );
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : stockAction === "add"
                      ? "Error al guardar el ingreso en la base de datos"
                      : "Error al reducir stock";
            toast.error(message);
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const toggleMovementSelection = (movementId: string, checked: boolean) => {
        setSelectedMovementIds((current) =>
            checked ? [...current, movementId] : current.filter((id) => id !== movementId)
        );
    };

    const handleOpenPrintDialog = () => {
        if (selectedMovements.length === 0) return;
        setPrintQuantities((current) => {
            const next = { ...current };
            for (const variant of selectedMovements.flatMap((movement) => movement.variants)) {
                if (!next[variant.id]) {
                    next[variant.id] = String(variant.quantity);
                }
            }
            return next;
        });
        setPrintDialogOpen(true);
    };

    const handleConfirmPrint = () => {
        const itemsToPrint: LabelPrintItem[] = [];

        for (const variant of printableVariants) {
            const product = products.find((p) => p.id === variant.productId);
            const qtyToPrint = clampQuantity(printQuantities[variant.id], variant.quantity);

            for (let i = 0; i < qtyToPrint; i++) {
                itemsToPrint.push({
                    productName: product?.name || "Producto",
                    sku: variant.sku,
                    size: variant.size,
                    color: variant.color,
                    retailPrice: product?.price || 0,
                    wholesalePrice: product?.wholesalePrice || 0,
                });
            }
        }

        if (itemsToPrint.length === 0) {
            toast.error("No hay etiquetas para imprimir");
            return;
        }

        setLabelsToPrint(itemsToPrint);
        
        setPrintDialogOpen(false);
        setTimeout(() => {
            window.print();
        }, 300);
    };

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-6">
                <div className="rounded-[1.75rem] border border-border/70 bg-card/90 px-10 py-8 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="rounded-2xl bg-[linear-gradient(135deg,#2563eb_0%,#1d4ed8_100%)] p-3 text-blue-50">
                            <Loader2 className="size-6 animate-spin" />
                        </div>
                        <div>
                            <p className="text-base font-semibold text-foreground">Cargando stock</p>
                            <p className="text-sm text-muted-foreground">
                                Estamos preparando movimientos, productos y proveedores.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
    <>
        {/* Envolvemos todo en un div que se oculta al imprimir */}
        <div className="print:hidden p-4 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-indigo-50/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-700">
                            <Package className="size-3.5" />
                            Gestión de stock
                        </div>
                        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-3xl">
                            Stock
                        </h1>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <div className="rounded-[1.1rem] border border-border/70 bg-card/90 px-4 py-3 shadow-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                                Movimientos
                            </p>
                            <p className="mt-1 text-xl font-semibold text-foreground">{movements.length}</p>
                        </div>
                        <Button
                            variant="outline"
                            size="lg"
                            className="h-12 gap-2 rounded-2xl border-border/80 bg-white text-base"
                            disabled={selectedMovements.length === 0}
                            onClick={handleOpenPrintDialog}
                        >
                            <Barcode className="size-5" />
                            Imprimir etiquetas
                        </Button>
                        <Button
                            variant="outline"
                            size="lg"
                            className="h-12 gap-2 rounded-2xl border-rose-900/20 bg-white text-base text-rose-700 hover:bg-rose-950/6 hover:text-rose-800"
                            onClick={handleOpenReduceStock}
                        >
                            <Minus className="size-5" />
                            Reducir stock
                        </Button>
                        <Button
                            size="lg"
                            className="h-12 gap-2 rounded-2xl bg-emerald-600 text-base font-semibold hover:bg-emerald-700"
                            onClick={handleOpenNewStock}
                        >
                            <PackagePlus className="size-5" />
                            Ingresar stock
                        </Button>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                    <Card className="rounded-[1.5rem] border-blue-800/20 bg-[linear-gradient(135deg,rgba(37,99,235,0.14),rgba(30,64,175,0.04))] shadow-sm">
                        <CardContent className="flex items-center gap-4 p-5">
                            <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-900 text-blue-100">
                                <Package className="size-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">
                                    Variación total stock
                                </p>
                                <p className="text-3xl font-semibold tracking-[-0.05em]">{totalUnits}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-[1.5rem] border-emerald-800/20 bg-[linear-gradient(135deg,rgba(5,150,105,0.14),rgba(6,95,70,0.04))] shadow-sm">
                        <CardContent className="flex items-center gap-4 p-5">
                            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-900 text-emerald-100">
                                <PackagePlus className="size-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">
                                    Movimientos registrados
                                </p>
                                <p className="text-3xl font-semibold tracking-[-0.05em]">{movements.length}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-[1.5rem] border-orange-800/20 bg-[linear-gradient(135deg,rgba(234,88,12,0.14),rgba(194,65,12,0.04))] shadow-sm">
                        <CardContent className="flex items-center gap-4 p-5">
                            <div className="flex size-12 items-center justify-center rounded-2xl bg-orange-900 text-orange-100">
                                <CalendarDays className="size-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Movimientos hoy</p>
                                <p className="text-3xl font-semibold tracking-[-0.05em]">{todayEntries}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="rounded-[1.75rem] border-border/70 bg-card/92 shadow-sm">
                    <CardContent className="p-4 sm:p-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    variant={showFilters ? "secondary" : "outline"}
                                    size="sm"
                                    className="gap-2 rounded-xl"
                                    onClick={() => setShowFilters((current) => !current)}
                                >
                                    <Filter className="size-4" />
                                    Filtros
                                    {hasActiveFilters && (
                                        <Badge
                                            variant="default"
                                            className="ml-1 flex size-5 items-center justify-center rounded-full p-0 text-xs"
                                        >
                                            !
                                        </Badge>
                                    )}
                                </Button>
                                {hasActiveFilters && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="gap-1 rounded-xl text-muted-foreground"
                                        onClick={clearFilters}
                                    >
                                        <X className="size-3.5" />
                                        Limpiar filtros
                                    </Button>
                                )}
                            </div>
                            <div className="lg:ml-auto">
                                <span className="text-sm text-muted-foreground">
                                    {filteredMovements.length} de {movements.length} registros
                                </span>
                            </div>
                        </div>

                        {showFilters && (
                            <div className="mt-4 rounded-[1.5rem] border border-border/70 bg-muted/25 p-4">
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-sm font-medium">Producto</Label>
                                        <Select value={filterProduct} onValueChange={setFilterProduct}>
                                            <SelectTrigger className="h-10">
                                                <SelectValue placeholder="Todos" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todos los productos</SelectItem>
                                                {products.map((product) => (
                                                    <SelectItem key={product.id} value={product.id}>
                                                        {product.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-sm font-medium">Proveedor</Label>
                                        <Select value={filterProvider} onValueChange={setFilterProvider}>
                                            <SelectTrigger className="h-10">
                                                <SelectValue placeholder="Todos" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todos los proveedores</SelectItem>
                                                {providers.map((provider) => (
                                                    <SelectItem key={provider.id} value={provider.id}>
                                                        {provider.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-sm font-medium">Desde</Label>
                                        <Input
                                            type="date"
                                            value={filterDateFrom}
                                            onChange={(event) => setFilterDateFrom(event.target.value)}
                                            className="h-10"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-sm font-medium">Hasta</Label>
                                        <Input
                                            type="date"
                                            value={filterDateTo}
                                            onChange={(event) => setFilterDateTo(event.target.value)}
                                            className="h-10"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

            <div className="mt-5 overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/92 shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-14 font-semibold">Sel.</TableHead>
                            <TableHead className="font-semibold">Fecha</TableHead>
                            <TableHead className="font-semibold">Producto Principal</TableHead>
                            <TableHead className="font-semibold">
                                Variacion
                            </TableHead>
                            <TableHead className="font-semibold">Proveedor</TableHead>
                            <TableHead className="text-right font-semibold">
                                Acciones
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredMovements.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="py-16 text-center">
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
                            filteredMovements.map((movement) => (
                                <TableRow key={movement.id}>
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedMovementIds.includes(movement.id)}
                                            onCheckedChange={(checked) =>
                                                toggleMovementSelection(
                                                    movement.id,
                                                    checked === true
                                                )
                                            }
                                            aria-label={`Seleccionar ingreso de ${getProductName(movement.productId)}`}
                                        />
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {formatDate(movement.date)}
                                    </TableCell>
                                    <TableCell>
                                        <div>
                                            <p className="text-sm font-semibold">
                                                {getProductName(movement.productId)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {movement.variants.length} variante(s)
                                            </p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            className={
                                                movement.totalQuantity >= 0
                                                    ? "bg-emerald-900 text-sm font-bold text-emerald-100"
                                                    : "bg-rose-900 text-sm font-bold text-rose-100"
                                            }
                                        >
                                            {movement.totalQuantity > 0 ? "+" : ""}
                                            {movement.totalQuantity}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {getProviderName(movement.providerId)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="gap-2"
                                            onClick={() => setSelectedMovement(movement)}
                                        >
                                            <Eye className="size-4" />
                                            Ver detalle
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            </div>

            <Dialog
                open={Boolean(selectedMovement)}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedMovement(null);
                    }
                }}
            >
                <DialogContent className="max-w-4xl">
                    {selectedMovement && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Detalle de Ingreso e Impresión</DialogTitle>
                                <DialogDescription>
                                    {getProductName(selectedMovement.productId)} - Movimiento{" "}
                                    {formatShortDate(selectedMovement.date)}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="max-h-[60vh] overflow-y-auto rounded-[1.25rem] border border-border/70">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead>Variante</TableHead>
                                            <TableHead>Cantidad</TableHead>
                                            <TableHead>SKU</TableHead>
                                            <TableHead className="text-right">
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
                                                        <p className="text-xs text-muted-foreground">
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

            <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl">
                            {stockAction === "add" ? "Ingresar Stock" : "Reducir Stock"}
                        </DialogTitle>
                        <DialogDescription>
                            {stockAction === "add"
                                ? "Registrá un ingreso simple o cargá varias variantes del mismo producto en un solo movimiento."
                                : "Descontá stock simple o por variantes del producto seleccionado."}
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
                                            placeholder="Buscar producto por nombre o codigo"
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
                                                <Label htmlFor={`qty-${size}`}>Cantidad talle {size}</Label>
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
                                <Label htmlFor="simple-quantity">Cantidad</Label>
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
                        <Button variant="outline" onClick={() => setStockDialogOpen(false)} disabled={isSaving}>
                            Cancelar
                        </Button>
                        <Button
                            className={
                                stockAction === "add"
                                    ? "bg-emerald-600 hover:bg-emerald-700 gap-2"
                                    : "bg-rose-600 hover:bg-rose-700 gap-2"
                            }
                            onClick={handleSaveStock}
                            disabled={isSaving || !selectedProductId}
                        >
                            {isSaving && <Loader2 className="size-4 animate-spin" />}
                            {stockAction === "add" ? "Guardar ingreso" : "Confirmar baja"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
                <DialogContent className="max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Imprimir etiquetas</DialogTitle>
                        <DialogDescription>
                            Revisá todo lo que seleccionaste y elegí la cantidad de tickets a imprimir por cada variante.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="max-h-[60vh] overflow-y-auto rounded-[1.25rem] border border-border/70">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Ingreso</TableHead>
                                    <TableHead>Variante</TableHead>
                                    <TableHead>Disponible</TableHead>
                                    <TableHead>Tickets a imprimir</TableHead>
                                    <TableHead>SKU</TableHead>
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
                                            <TableCell>{getVariantLabel(variant)}</TableCell>
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
                                                                [variant.id]: event.target.value,
                                                            }))
                                                        }
                                                    />
                                                    <p className="text-xs text-muted-foreground">Vista previa: {previewQuantity}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                                                    {variant.sku}
                                                </code>
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
        </div>

        {/* 3. Insertamos las etiquetas fuera del div oculto */}
        <BarcodeLabels items={labelsToPrint} />
    </>
)};
