"use client";

import { useState, useMemo } from "react";
import {
    Package,
    Plus,
    Search,
    Pencil,
    Trash2,
    DollarSign,
    TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    mockProducts as initialProducts,
    mockCategories,
    mockProviders,
    type Product,
} from "@/lib/mock-data";
import { toast } from "sonner";

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 0,
    }).format(amount);
}

export default function InventarioPage() {
    const [products, setProducts] = useState<Product[]>(initialProducts);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterCategory, setFilterCategory] = useState("all");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    // Form state
    const [formName, setFormName] = useState("");
    const [formPrice, setFormPrice] = useState("");
    const [formWholesalePrice, setFormWholesalePrice] = useState("");
    const [formCostPrice, setFormCostPrice] = useState("");
    const [formCategory, setFormCategory] = useState("");
    const [formProviderId, setFormProviderId] = useState("");

    const resetForm = () => {
        setFormName("");
        setFormPrice("");
        setFormWholesalePrice("");
        setFormCostPrice("");
        setFormCategory("");
        setFormProviderId("");
        setEditingProduct(null);
    };

    const handleOpenNew = () => {
        resetForm();
        setDialogOpen(true);
    };

    const handleOpenEdit = (product: Product) => {
        setEditingProduct(product);
        setFormName(product.name);
        setFormPrice(String(product.price));
        setFormWholesalePrice(String(product.wholesalePrice));
        setFormCostPrice(product.costPrice ? String(product.costPrice) : "");
        setFormCategory(product.category || "");
        setFormProviderId(product.providerId || "");
        setDialogOpen(true);
    };

    const handleSave = () => {
        if (!formName.trim()) {
            toast.error("El nombre es obligatorio");
            return;
        }
        const price = parseFloat(formPrice);
        if (isNaN(price) || price <= 0) {
            toast.error("Ingresá un precio de venta válido");
            return;
        }

        const parsedCostPrice = parseFloat(formCostPrice);
        const costPrice =
            formCostPrice.trim() === "" || Number.isNaN(parsedCostPrice)
                ? undefined
                : parsedCostPrice;
        const parsedWholesalePrice = parseFloat(formWholesalePrice);
        const wholesalePrice =
            costPrice !== undefined
                ? Math.round(costPrice * 1.2)
                : parsedWholesalePrice;

        if (Number.isNaN(wholesalePrice) || wholesalePrice <= 0) {
            toast.error("Ingresá un precio mayorista válido");
            return;
        }

        if (editingProduct) {
            setProducts((prev) =>
                prev.map((p) =>
                    p.id === editingProduct.id
                        ? {
                            ...p,
                            name: formName.trim(),
                            price,
                            wholesalePrice,
                            costPrice,
                            category: formCategory,
                            providerId: formProviderId || undefined,
                        }
                        : p
                )
            );
            toast.success("Producto actualizado", {
                description: formName.trim(),
            });
        } else {
            const newProduct: Product = {
                id: `prod-${Date.now()}`,
                code: `PRD-${String(products.length + 1).padStart(3, "0")}`,
                name: formName.trim(),
                price,
                wholesalePrice,
                costPrice,
                category: formCategory,
                providerId: formProviderId || undefined,
                stock: 0,
                color: "",
                sizes: [],
                createdAt: new Date().toISOString().split("T")[0],
            };
            setProducts((prev) => [newProduct, ...prev]);
            toast.success("Producto creado", {
                description: `${formName.trim()} — ${formatCurrency(price)}`,
            });
        }

        setDialogOpen(false);
        resetForm();
    };

    const handleDelete = (product: Product) => {
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
        toast.success("Producto eliminado", { description: product.name });
    };

    // Filter
    const filteredProducts = useMemo(() => {
        return products.filter((p) => {
            const matchesSearch =
                !searchQuery.trim() ||
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.code.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory =
                filterCategory === "all" || p.category === filterCategory;
            return matchesSearch && matchesCategory;
        });
    }, [products, searchQuery, filterCategory]);

    // Stats
    const totalProducts = products.length;
    const avgPrice =
        products.length > 0
            ? products.reduce((s, p) => s + p.price, 0) / products.length
            : 0;

    // Margin calc for form
    const salePriceNum = parseFloat(formPrice) || 0;
    const wholesalePriceNum = parseFloat(formWholesalePrice) || 0;
    const costPriceNum = parseFloat(formCostPrice) || 0;
    const calculatedWholesalePrice =
        costPriceNum > 0 ? Math.round(costPriceNum * 1.2) : wholesalePriceNum;
    const margin =
        salePriceNum > 0 && costPriceNum > 0
            ? (((salePriceNum - costPriceNum) / costPriceNum) * 100).toFixed(0)
            : null;

    const getProviderName = (id?: string) =>
        mockProviders.find((p) => p.id === id)?.name ?? "—";

    return (
        <div className="p-4 lg:p-8">
            {/* Header */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
                        Inventario
                    </h1>
                    <p className="mt-1 text-muted-foreground">
                        Catálogo de productos de tu tienda
                    </p>
                </div>
                <Button
                    size="lg"
                    className="gap-2 h-12 text-base font-semibold"
                    onClick={handleOpenNew}
                >
                    <Plus className="size-5" />
                    Nuevo Producto
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <Package className="size-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total productos</p>
                            <p className="text-2xl font-bold">{totalProducts}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                            <DollarSign className="size-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Precio promedio</p>
                            <p className="text-2xl font-bold">{formatCurrency(avgPrice)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="sm:col-span-2 lg:col-span-1">
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                            <TrendingUp className="size-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Categorías</p>
                            <p className="text-2xl font-bold">
                                {new Set(products.map((p) => p.category).filter(Boolean)).size}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1 max-w-md">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nombre o código..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-11 pl-10"
                    />
                </div>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="h-11 w-full sm:w-48">
                        <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas las categorías</SelectItem>
                        {mockCategories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                                {cat}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Product List */}
            {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-20 text-center">
                    <Package className="mb-4 size-16 text-muted-foreground/30" />
                    <p className="text-xl font-medium text-muted-foreground">
                        {searchQuery || filterCategory !== "all"
                            ? "No se encontraron productos"
                            : "Sin productos aún"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground/70">
                        {searchQuery || filterCategory !== "all"
                            ? "Probá con otros filtros"
                            : "Creá tu primer producto para empezar"}
                    </p>
                    {!searchQuery && filterCategory === "all" && (
                        <Button className="mt-6 gap-2" size="lg" onClick={handleOpenNew}>
                            <Plus className="size-5" />
                            Nuevo Producto
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {filteredProducts.map((product) => (
                        <Card
                            key={product.id}
                            className="group transition-all duration-200 hover:shadow-md"
                        >
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-base font-semibold">
                                            {product.name}
                                        </p>
                                        <p className="mt-0.5 text-xs text-muted-foreground">
                                            {product.code}
                                        </p>
                                    </div>
                                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => handleOpenEdit(product)}
                                            className="text-muted-foreground hover:text-foreground"
                                        >
                                            <Pencil className="size-3.5" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => handleDelete(product)}
                                            className="text-muted-foreground hover:text-destructive"
                                        >
                                            <Trash2 className="size-3.5" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="mt-3 flex items-baseline justify-between">
                                    <div className="space-y-1">
                                        <span className="block text-lg font-bold">
                                            Venta: {formatCurrency(product.price)}
                                        </span>
                                        <span className="block text-sm font-medium text-blue-600">
                                            Mayorista:{" "}
                                            {formatCurrency(product.wholesalePrice)}
                                        </span>
                                    </div>
                                    <span className="text-sm text-muted-foreground">
                                        {product.costPrice
                                            ? `Costo: ${formatCurrency(product.costPrice)}`
                                            : "Costo sin definir"}
                                    </span>
                                </div>

                                {product.costPrice && (
                                    <p className="mt-1 text-xs font-medium text-emerald-600">
                                        Margen:{" "}
                                        {(
                                            ((product.price - product.costPrice) /
                                                product.costPrice) *
                                            100
                                        ).toFixed(0)}
                                        %
                                    </p>
                                )}

                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {product.category && (
                                        <Badge variant="secondary" className="text-xs">
                                            {product.category}
                                        </Badge>
                                    )}
                                    {product.providerId && (
                                        <Badge variant="outline" className="text-xs">
                                            {getProviderName(product.providerId)}
                                        </Badge>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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

                        {/* Category + Provider */}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label className="text-base">Categoría</Label>
                                <Select value={formCategory} onValueChange={setFormCategory}>
                                    <SelectTrigger className="h-11 text-base">
                                        <SelectValue placeholder="Seleccionar" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {mockCategories.map((cat) => (
                                            <SelectItem key={cat} value={cat} className="text-base">
                                                {cat}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-base">Proveedor</Label>
                                <Select
                                    value={formProviderId}
                                    onValueChange={setFormProviderId}
                                >
                                    <SelectTrigger className="h-11 text-base">
                                        <SelectValue placeholder="Seleccionar" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {mockProviders.map((prov) => (
                                            <SelectItem
                                                key={prov.id}
                                                value={prov.id}
                                                className="text-base"
                                            >
                                                {prov.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => setDialogOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            size="lg"
                            className="bg-emerald-600 font-bold hover:bg-emerald-700"
                            onClick={handleSave}
                            disabled={!formName.trim() || !formPrice || salePriceNum <= 0}
                        >
                            {editingProduct ? "Guardar Cambios" : "Crear Producto"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
