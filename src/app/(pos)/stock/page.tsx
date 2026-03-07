"use client";

import { useMemo, useState } from "react";
import {
    Barcode,
    CalendarDays,
    Eye,
    Filter,
    Package,
    PackagePlus,
    Printer,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    mockProducts,
    mockProviders,
    mockStockEntries,
    mockSizes,
    type StockEntry,
} from "@/lib/mock-data";
import { toast } from "sonner";

type StockMovement = {
    id: string;
    productId: string;
    providerId?: string;
    date: string;
    totalQuantity: number;
    variants: StockEntry[];
};

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatShortDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
    });
}

function buildMovements(entries: StockEntry[]): StockMovement[] {
    const grouped = new Map<string, StockMovement>();

    for (const entry of entries) {
        const key = `${entry.productId}-${entry.date}`;
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
    const cleanColor = color
        .substring(0, 3)
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    return `${productCode}-${cleanColor || "UNI"}-${size.toUpperCase()}`;
}

function getVariantLabel(entry: StockEntry) {
    const parts: string[] = [];

    if (entry.size !== "Único") {
        parts.push(`Talle ${entry.size}`);
    }

    if (entry.color !== "Único") {
        parts.push(`Color ${entry.color}`);
    }

    return parts.length > 0 ? parts.join(" - ") : "Talle y color único";
}

function clampQuantity(rawValue: string | undefined, max: number) {
    const parsed = Number.parseInt(rawValue ?? String(max), 10);

    if (Number.isNaN(parsed)) {
        return max;
    }

    return Math.max(0, Math.min(parsed, max));
}

export default function StockPage() {
    const [entries, setEntries] = useState<StockEntry[]>(mockStockEntries);
    const [filterProduct, setFilterProduct] = useState("all");
    const [filterProvider, setFilterProvider] = useState("all");
    const [filterDateFrom, setFilterDateFrom] = useState("");
    const [filterDateTo, setFilterDateTo] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    const [stockDialogOpen, setStockDialogOpen] = useState(false);
    const [advancedMode, setAdvancedMode] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState("");
    const [selectedProviderId, setSelectedProviderId] = useState("");
    const [simpleQuantity, setSimpleQuantity] = useState("");
    const [advancedColor, setAdvancedColor] = useState("");
    const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
    const [sizeQuantities, setSizeQuantities] = useState<Record<string, string>>({});
    const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);
    const [selectedMovementIds, setSelectedMovementIds] = useState<string[]>([]);
    const [printDialogOpen, setPrintDialogOpen] = useState(false);
    const [printQuantities, setPrintQuantities] = useState<Record<string, string>>({});
    const movements = useMemo(() => buildMovements(entries), [entries]);

    const filteredMovements = useMemo(() => {
        return movements.filter((movement) => {
            if (filterProduct !== "all" && movement.productId !== filterProduct) {
                return false;
            }

            if (filterProvider !== "all" && movement.providerId !== filterProvider) {
                return false;
            }

            if (filterDateFrom) {
                const fromDate = new Date(filterDateFrom);
                if (new Date(movement.date) < fromDate) {
                    return false;
                }
            }

            if (filterDateTo) {
                const toDate = new Date(`${filterDateTo}T23:59:59`);
                if (new Date(movement.date) > toDate) {
                    return false;
                }
            }

            return true;
        });
    }, [movements, filterProduct, filterProvider, filterDateFrom, filterDateTo]);

    const selectedMovements = useMemo(
        () =>
            filteredMovements.filter((movement) =>
                selectedMovementIds.includes(movement.id)
            ),
        [filteredMovements, selectedMovementIds]
    );

    const printableVariants = useMemo(
        () => selectedMovements.flatMap((movement) => movement.variants),
        [selectedMovements]
    );

    const printableTickets = printableVariants.reduce(
        (total, variant) =>
            total + clampQuantity(printQuantities[variant.id], variant.quantity),
        0
    );

    const totalUnits = movements.reduce(
        (sum, movement) => sum + movement.totalQuantity,
        0
    );
    const todayEntries = movements.filter(
        (movement) =>
            new Date(movement.date).toDateString() === new Date().toDateString()
    ).length;

    const hasActiveFilters =
        filterProduct !== "all" ||
        filterProvider !== "all" ||
        filterDateFrom !== "" ||
        filterDateTo !== "";

    const getProductName = (id: string) =>
        mockProducts.find((product) => product.id === id)?.name ?? "Desconocido";

    const getProviderName = (id?: string) =>
        mockProviders.find((provider) => provider.id === id)?.name ?? "—";

    const clearFilters = () => {
        setFilterProduct("all");
        setFilterProvider("all");
        setFilterDateFrom("");
        setFilterDateTo("");
    };

    const resetStockForm = () => {
        setSelectedProductId("");
        setSelectedProviderId("");
        setSimpleQuantity("");
        setAdvancedColor("");
        setSelectedSizes([]);
        setSizeQuantities({});
        setAdvancedMode(false);
    };

    const handleOpenNewStock = () => {
        resetStockForm();
        setStockDialogOpen(true);
    };

    const handleProductChange = (productId: string) => {
        setSelectedProductId(productId);
        const product = mockProducts.find((item) => item.id === productId);
        setSelectedProviderId(product?.providerId ?? "");
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

    const handleSaveStock = () => {
        if (!selectedProductId) {
            toast.error("Seleccioná un producto");
            return;
        }

        const product = mockProducts.find((item) => item.id === selectedProductId);
        if (!product) {
            return;
        }

        const now = new Date().toISOString();
        const newEntries: StockEntry[] = [];

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
                    id: `se-${Date.now()}-${size}`,
                    productId: selectedProductId,
                    providerId: selectedProviderId || undefined,
                    quantity,
                    color: advancedColor.trim(),
                    size,
                    sku: generateSKU(product.code, advancedColor.trim(), size),
                    date: now,
                    mode: "avanzado",
                });
            }
        } else {
            const quantity = Number.parseInt(simpleQuantity, 10);

            if (Number.isNaN(quantity) || quantity <= 0) {
                toast.error("Ingresá una cantidad válida");
                return;
            }

            newEntries.push({
                id: `se-${Date.now()}`,
                productId: selectedProductId,
                providerId: selectedProviderId || undefined,
                quantity,
                color: "Único",
                size: "Único",
                sku: `${product.code}-UNI`,
                date: now,
                mode: "simple",
            });
        }

        setEntries((current) => [...newEntries, ...current]);
        setStockDialogOpen(false);
        resetStockForm();
        toast.success("Ingreso de stock registrado", {
            description: `${product.name} · ${newEntries.reduce((sum, entry) => sum + entry.quantity, 0)} unidad(es)`,
        });
    };

    const toggleMovementSelection = (movementId: string, checked: boolean) => {
        setSelectedMovementIds((current) =>
            checked
                ? [...current, movementId]
                : current.filter((id) => id !== movementId)
        );
    };

    const handleOpenPrintDialog = () => {
        if (selectedMovements.length === 0) {
            return;
        }

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
        if (selectedMovements.length === 0 || printableTickets === 0) {
            return;
        }

        toast.success("Etiquetas enviadas a impresión", {
            description: `${selectedMovements.length} ingreso(s) · ${printableVariants.length} variante(s) · ${printableTickets} ticket(s)`,
        });
        setPrintDialogOpen(false);
    };

    return (
        <div className="p-4 lg:p-8">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
                        Stock
                    </h1>
                    <p className="mt-1 text-muted-foreground">
                        Ingresá y consultá las entradas de mercadería
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="lg"
                        className="h-12 gap-2 text-base"
                        disabled={selectedMovements.length === 0}
                        onClick={handleOpenPrintDialog}
                    >
                        <Barcode className="size-5" />
                        <span className="hidden sm:inline">Imprimir Etiquetas</span>
                        <span className="sm:hidden">Etiquetas</span>
                    </Button>
                    <Button
                        size="lg"
                        className="h-12 gap-2 bg-emerald-600 text-base font-semibold hover:bg-emerald-700"
                        onClick={handleOpenNewStock}
                    >
                        <PackagePlus className="size-5" />
                        Ingresar Stock
                    </Button>
                </div>
            </div>

            <div className="mb-6 grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <Package className="size-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">
                                Total unidades ingresadas
                            </p>
                            <p className="text-2xl font-bold">{totalUnits}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                            <PackagePlus className="size-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">
                                Ingresos registrados
                            </p>
                            <p className="text-2xl font-bold">{movements.length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                            <CalendarDays className="size-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Ingresos hoy</p>
                            <p className="text-2xl font-bold">{todayEntries}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="mb-4 flex items-center gap-2">
                <Button
                    variant={showFilters ? "secondary" : "outline"}
                    size="sm"
                    className="gap-2"
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
                        className="gap-1 text-muted-foreground"
                        onClick={clearFilters}
                    >
                        <X className="size-3.5" />
                        Limpiar filtros
                    </Button>
                )}
                <span className="ml-auto text-sm text-muted-foreground">
                    {filteredMovements.length} de {movements.length} registros
                </span>
            </div>

            {showFilters && (
                <div className="mb-4 rounded-lg border bg-muted/30 p-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Producto</Label>
                            <Select value={filterProduct} onValueChange={setFilterProduct}>
                                <SelectTrigger className="h-10">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los productos</SelectItem>
                                    {mockProducts.map((product) => (
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
                                    {mockProviders.map((provider) => (
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

            <div className="rounded-xl border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-14 font-semibold">Sel.</TableHead>
                            <TableHead className="font-semibold">Fecha</TableHead>
                            <TableHead className="font-semibold">Producto Principal</TableHead>
                            <TableHead className="font-semibold">
                                Cantidad Total Ingresada
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
                                            ? "No hay ingresos con estos filtros"
                                            : "Sin ingresos de stock aún"}
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
                                        <input
                                            type="checkbox"
                                            checked={selectedMovementIds.includes(movement.id)}
                                            onChange={(event) =>
                                                toggleMovementSelection(
                                                    movement.id,
                                                    event.target.checked
                                                )
                                            }
                                            aria-label={`Seleccionar ingreso de ${getProductName(movement.productId)}`}
                                            className="size-4 accent-emerald-600"
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
                                        <Badge className="bg-emerald-100 text-sm font-bold text-emerald-700">
                                            +{movement.totalQuantity}
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
                                    {getProductName(selectedMovement.productId)} - Ingreso{" "}
                                    {formatShortDate(selectedMovement.date)}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="max-h-[60vh] overflow-y-auto rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead>Variante</TableHead>
                                            <TableHead>Cantidad ingresada</TableHead>
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
                                                        {variant.quantity} unidad(es)
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                                                        {variant.sku}
                                                    </code>
                                                </TableCell>
                                                <TableCell className="text-right">
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
                        <DialogTitle className="text-xl">Ingresar Stock</DialogTitle>
                        <DialogDescription>
                            Registrá un ingreso simple o cargá varias variantes del mismo
                            producto en un solo movimiento.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Producto</Label>
                                <Select
                                    value={selectedProductId}
                                    onValueChange={handleProductChange}
                                >
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Seleccionar producto" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {mockProducts.map((product) => (
                                            <SelectItem key={product.id} value={product.id}>
                                                {product.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Proveedor</Label>
                                <Select
                                    value={selectedProviderId}
                                    onValueChange={setSelectedProviderId}
                                >
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Seleccionar proveedor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {mockProviders.map((provider) => (
                                            <SelectItem key={provider.id} value={provider.id}>
                                                {provider.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex rounded-lg border p-1">
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
                            <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                                <div className="space-y-2">
                                    <Label htmlFor="advanced-color">Color</Label>
                                    <Input
                                        id="advanced-color"
                                        value={advancedColor}
                                        onChange={(event) =>
                                            setAdvancedColor(event.target.value)
                                        }
                                        placeholder="Ej: Negro"
                                        className="h-11"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Talles</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {mockSizes.map((size) => {
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
                                                    Cantidad talle {size}
                                                </Label>
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
                                    onChange={(event) =>
                                        setSimpleQuantity(event.target.value)
                                    }
                                    placeholder="0"
                                    className="h-11"
                                />
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setStockDialogOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={handleSaveStock}
                        >
                            Guardar ingreso
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
                <DialogContent className="max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Imprimir etiquetas</DialogTitle>
                        <DialogDescription>
                            Revisá todo lo que seleccionaste y elegí la cantidad de tickets
                            a imprimir por cada variante.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="max-h-[60vh] overflow-y-auto rounded-lg border">
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
                                    const previewQuantity = clampQuantity(
                                        printQuantities[variant.id],
                                        variant.quantity
                                    );

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
                                                <Badge variant="outline">
                                                    {variant.quantity} ticket(s)
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="max-w-36 space-y-1">
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        max={variant.quantity}
                                                        value={
                                                            printQuantities[variant.id] ??
                                                            String(variant.quantity)
                                                        }
                                                        onChange={(event) =>
                                                            setPrintQuantities((current) => ({
                                                                ...current,
                                                                [variant.id]: event.target.value,
                                                            }))
                                                        }
                                                    />
                                                    <p className="text-xs text-muted-foreground">
                                                        Vista previa: {previewQuantity}
                                                    </p>
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
                            {selectedMovements.length} ingreso(s) · {printableVariants.length} variante(s) ·{" "}
                            {printableTickets} ticket(s)
                        </div>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={
                                selectedMovements.length === 0 || printableTickets === 0
                            }
                            onClick={handleConfirmPrint}
                        >
                            <Printer className="size-4" />
                            Confirmar impresión
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
