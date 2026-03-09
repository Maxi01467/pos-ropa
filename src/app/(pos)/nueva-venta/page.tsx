"use client";

import { useState, useMemo, useEffect } from "react";
// Importamos getSellers
import { getProductsForPOS, getSellers } from "@/app/actions/pos-actions";
import { createSale } from "@/app/actions/sales-actions";
import {
    Search,
    ScanBarcode,
    Plus,
    Minus,
    Trash2,
    ShoppingBag,
    Loader2,
    UserCircle, // Nuevo icono
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Importamos Label
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"; // Importamos Select de shadcn
import {
    CheckoutDialog,
    type PaymentBreakdown,
    type PaymentMethod,
} from "@/components/checkout-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface POSProduct {
    id: string;
    code: string;
    name: string;
    price: number;
    wholesalePrice: number;
    stock: number;
    sizes: string[];
    color: string;
    productId?: string;
}

interface CartItem {
    product: POSProduct;
    quantity: number;
}

type PriceMode = "retail" | "wholesale";

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 0,
    }).format(amount);
}

export default function NuevaVentaPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [cart, setCart] = useState<CartItem[]>([]);
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [priceMode, setPriceMode] = useState<PriceMode>("retail");
    const [allProducts, setAllProducts] = useState<POSProduct[]>([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);
    const [productsError, setProductsError] = useState<string | null>(null);

    // Estados para Vendedores
    const [sellers, setSellers] = useState<{ id: string; name: string }[]>([]);
    const [selectedSellerId, setSelectedSellerId] = useState<string>("");

    useEffect(() => {
        let cancelled = false;

        const loadInitialData = async () => {
            setIsLoadingProducts(true);
            setProductsError(null);

            try {
                // Cargamos productos y vendedores en paralelo
                const [products, sellersData] = await Promise.all([
                    getProductsForPOS(),
                    getSellers()
                ]);

                if (cancelled) return;

                setAllProducts(products);
                setSellers(sellersData);
                
                // Si hay vendedores, seleccionamos el primero por defecto
                if (sellersData.length > 0) {
                    setSelectedSellerId(sellersData[0].id);
                }
            } catch (error) {
                if (cancelled) return;
                console.error("Error loading initial data:", error);
                setProductsError("No se pudieron cargar los datos.");
                toast.error("Error al conectar con la base de datos");
            } finally {
                if (!cancelled) {
                    setIsLoadingProducts(false);
                }
            }
        };

        loadInitialData();

        return () => {
            cancelled = true;
        };
    }, []);

    // Filter products based on search
    const filteredProducts = useMemo(() => {
        if (!searchQuery.trim()) return allProducts;
        const q = searchQuery.toLowerCase();
        return allProducts.filter(
            (p) =>
                p.name.toLowerCase().includes(q) ||
                p.code.toLowerCase().includes(q) 
        );
    }, [searchQuery, allProducts]);

    // Cart operations
    const addToCart = (product: POSProduct) => {
        setCart((prev) => {
            if (product.stock <= 0) {
                toast.error("Producto sin stock", {
                    description: product.name,
                });
                return prev;
            }

            const existing = prev.find((item) => item.product.id === product.id);
            if (existing) {
                if (existing.quantity >= product.stock) {
                    toast.error("Sin stock suficiente", {
                        description: `Solo quedan ${product.stock} unidades de ${product.name}`,
                    });
                    return prev;
                }
                return prev.map((item) =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            toast.success("Producto agregado", {
                description: product.name,
                duration: 1500,
            });
            return [...prev, { product, quantity: 1 }];
        });
    };

    const updateQuantity = (productId: string, delta: number) => {
        setCart((prev) => {
            return prev
                .map((item) => {
                    if (item.product.id !== productId) return item;
                    const newQty = item.quantity + delta;
                    if (newQty > item.product.stock) {
                        toast.error("Sin stock suficiente");
                        return item;
                    }
                    if (newQty <= 0) return null;
                    return { ...item, quantity: newQty };
                })
                .filter(Boolean) as CartItem[];
        });
    };

    const removeFromCart = (productId: string) => {
        setCart((prev) => prev.filter((item) => item.product.id !== productId));
        toast("Producto eliminado del carrito", { duration: 1500 });
    };

    const clearCart = () => {
        setCart([]);
    };

    // Totals
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const getUnitPrice = (product: POSProduct) =>
        priceMode === "wholesale" ? product.wholesalePrice : product.price;
    const totalAmount = cart.reduce(
        (sum, item) => sum + getUnitPrice(item.product) * item.quantity,
        0
    );

    const paymentMethodMap: Record<
        PaymentMethod,
        "EFECTIVO" | "TRANSFERENCIA" | "MIXTO"
    > = {
        efectivo: "EFECTIVO",
        transferencia: "TRANSFERENCIA",
        mixto: "MIXTO",
    };

    const handleConfirmSale = async (payment: PaymentBreakdown) => {
        const sale = await createSale({
            total: totalAmount,
            paymentMethod: paymentMethodMap[payment.paymentMethod],
            cashAmount: payment.cashAmount,
            transferAmount: payment.transferAmount,
            userId: selectedSellerId, // Pasamos el ID del vendedor seleccionado
            items: cart.map((item) => ({
                variantId: item.product.id,
                quantity: item.quantity,
                priceAtTime: getUnitPrice(item.product),
                priceType: priceMode === "wholesale" ? "WHOLESALE" : "NORMAL",
            })),
        });

        clearCart();
        // Recargamos productos para actualizar stocks visualmente
        const updatedProducts = await getProductsForPOS();
        setAllProducts(updatedProducts);
        
        return sale;
    };

    return (
        <div className="flex h-[calc(100vh-4rem)] lg:h-screen flex-col lg:flex-row">
            {/* LEFT PANEL: Product Search — 60% */}
            <div className="flex flex-1 flex-col lg:w-[60%] lg:flex-none">
                {/* Search Header */}
                <div className="border-b bg-card px-4 py-4 lg:px-6">
                    <h1 className="mb-3 text-xl font-bold tracking-tight lg:text-2xl">
                        Nueva Venta
                    </h1>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Buscar por nombre o código..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-12 pl-11 text-lg"
                            />
                        </div>
                        <Button
                            variant="outline"
                            className="h-12 shrink-0 gap-2 px-4"
                            onClick={() => toast.info("Escáner no disponible en demo")}
                        >
                            <ScanBarcode className="size-5" />
                            <span className="hidden sm:inline">Escanear</span>
                        </Button>
                    </div>
                </div>

                {/* Product Grid */}
                <ScrollArea className="flex-1 p-4 lg:p-6">
                    {isLoadingProducts ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <Loader2 className="mb-3 size-10 animate-spin text-muted-foreground" />
                            <p className="text-lg font-medium text-muted-foreground">
                                Cargando productos
                            </p>
                        </div>
                    ) : productsError ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <Search className="mb-3 size-12 text-muted-foreground/40" />
                            <p className="text-lg font-medium text-muted-foreground">
                                {productsError}
                            </p>
                            <p className="text-sm text-muted-foreground/70">
                                Verificá la conexión con la base de datos
                            </p>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <Search className="mb-3 size-12 text-muted-foreground/40" />
                            <p className="text-lg font-medium text-muted-foreground">
                                No se encontraron productos
                            </p>
                            <p className="text-sm text-muted-foreground/70">
                                Probá con otro nombre o código
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {filteredProducts.map((product) => {
                                const inCart = cart.find(
                                    (item) => item.product.id === product.id
                                );
                                return (
                                    <Card
                                        key={product.id}
                                        className={cn(
                                            "cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30",
                                            inCart && "border-primary/40 bg-primary/[0.03]"
                                        )}
                                        onClick={() => addToCart(product)}
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-base font-semibold">
                                                        {product.name}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                                        {product.code}
                                                        {product.color && ` · ${product.color}`}
                                                    </p>
                                                </div>
                                                {inCart && (
                                                    <Badge
                                                        variant="default"
                                                        className="shrink-0 bg-primary"
                                                    >
                                                        ×{inCart.quantity}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="mt-3 flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                            Venta
                                                        </span>
                                                        <span className="text-lg font-bold">
                                                            {formatCurrency(product.price)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-medium uppercase tracking-wide text-blue-600">
                                                            Mayorista
                                                        </span>
                                                        <span className="text-base font-semibold text-blue-600">
                                                            {formatCurrency(product.wholesalePrice)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span
                                                    className={cn(
                                                        "text-sm font-medium",
                                                        product.stock <= 3
                                                            ? "text-rose-500"
                                                            : "text-muted-foreground"
                                                    )}
                                                >
                                                    Stock: {product.stock}
                                                </span>
                                            </div>
                                            {product.sizes.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {product.sizes.map((size) => (
                                                        <Badge
                                                            key={size}
                                                            variant="outline"
                                                            className="text-xs font-normal"
                                                        >
                                                            {size}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
            </div>

            {/* RIGHT PANEL: Cart/Ticket — 40% */}
            <div className="flex flex-col border-t lg:border-t-0 lg:border-l lg:w-[40%] bg-card">
                {/* Cart Header */}
                <div className="flex items-center justify-between border-b px-4 py-4 lg:px-6">
                    <div className="flex items-center gap-2">
                        <ShoppingBag className="size-5 text-muted-foreground" />
                        <h2 className="text-lg font-bold">Ticket</h2>
                        {totalItems > 0 && (
                            <Badge variant="secondary" className="font-semibold">
                                {totalItems}
                            </Badge>
                        )}
                    </div>
                    {cart.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={clearCart}
                        >
                            Vaciar
                        </Button>
                    )}
                </div>

                {/* Cart Items */}
                <ScrollArea className="flex-1 px-4 lg:px-6">
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <ShoppingBag className="mb-3 size-16 text-muted-foreground/20" />
                            <p className="text-base font-medium text-muted-foreground">
                                Carrito vacío
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground/70">
                                Hacé clic en un producto para agregarlo
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-1 py-3">
                            {cart.map((item) => (
                                <div
                                    key={item.product.id}
                                    className="group flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/50"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold">
                                            {item.product.name}
                                        </p>
                                        <div className="flex flex-col gap-0.5 text-sm">
                                            <p className="text-muted-foreground">
                                                Venta: {formatCurrency(item.product.price)} c/u
                                            </p>
                                            <p className="font-medium text-blue-600">
                                                Mayorista:{" "}
                                                {formatCurrency(item.product.wholesalePrice)} c/u
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="outline"
                                            size="icon-sm"
                                            onClick={() => updateQuantity(item.product.id, -1)}
                                        >
                                            <Minus className="size-3.5" />
                                        </Button>
                                        <span className="w-8 text-center text-base font-bold">
                                            {item.quantity}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="icon-sm"
                                            onClick={() => updateQuantity(item.product.id, +1)}
                                        >
                                            <Plus className="size-3.5" />
                                        </Button>
                                    </div>

                                    <span className="w-20 text-right text-sm font-bold">
                                        {formatCurrency(
                                            getUnitPrice(item.product) * item.quantity
                                        )}
                                    </span>

                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                                        onClick={() => removeFromCart(item.product.id)}
                                    >
                                        <Trash2 className="size-3.5" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>

                {/* Cart Footer: Total + Cobrar */}
                <div className="border-t bg-card px-4 py-4 lg:px-6">
                    
                    {/* SELECTOR DE VENDEDOR EN EL FOOTER */}
                    <div className="mb-4 space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <UserCircle className="size-3.5" />
                            Vendedor Atendiendo
                        </Label>
                        <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                            <SelectTrigger className="h-10 bg-background">
                                <SelectValue placeholder="Seleccionar vendedor" />
                            </SelectTrigger>
                            <SelectContent>
                                {sellers.map((seller) => (
                                    <SelectItem key={seller.id} value={seller.id}>
                                        {seller.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="mb-4 flex items-center justify-between rounded-lg border bg-muted/40 p-2">
                        <div>
                            <p className="text-sm font-semibold">Modo de precio</p>
                            <p className="text-xs text-muted-foreground">
                                Por defecto se cobra precio de venta.
                            </p>
                        </div>
                        <div className="flex rounded-lg border bg-background p-1">
                            <Button
                                variant={priceMode === "retail" ? "default" : "ghost"}
                                size="sm"
                                onClick={() => setPriceMode("retail")}
                            >
                                Venta
                            </Button>
                            <Button
                                variant={priceMode === "wholesale" ? "default" : "ghost"}
                                size="sm"
                                className={cn(
                                    priceMode === "wholesale" &&
                                        "bg-blue-600 text-white hover:bg-blue-700"
                                )}
                                onClick={() => setPriceMode("wholesale")}
                            >
                                Mayorista
                            </Button>
                        </div>
                    </div>
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <span className="text-base font-medium text-muted-foreground">
                                Total
                            </span>
                            <p className="text-xs text-muted-foreground">
                                Cobro actual:{" "}
                                {priceMode === "wholesale"
                                    ? "precio mayorista"
                                    : "precio de venta"}
                            </p>
                        </div>
                        <span className="text-3xl font-bold tracking-tight">
                            {formatCurrency(totalAmount)}
                        </span>
                    </div>
                    <Button
                        size="lg"
                        className="h-14 w-full bg-emerald-600 text-lg font-bold shadow-lg hover:bg-emerald-700 hover:shadow-xl transition-all duration-200"
                        disabled={cart.length === 0 || !selectedSellerId}
                        onClick={() => setCheckoutOpen(true)}
                    >
                        💵 COBRAR
                    </Button>
                </div>
            </div>

            {/* Checkout Dialog */}
            <CheckoutDialog
                open={checkoutOpen}
                onOpenChange={setCheckoutOpen}
                total={totalAmount}
                itemCount={totalItems}
                onConfirm={handleConfirmSale}
            />
        </div>
    );
}
