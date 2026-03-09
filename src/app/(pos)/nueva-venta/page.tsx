"use client";

import { useEffect, useMemo, useState } from "react";
import { getProductsForPOS, getSellers } from "@/app/actions/pos-actions";
import { createSale } from "@/app/actions/sales-actions";
import { TicketReceipt } from "@/components/ticket-receipt";
import {
    CheckoutDialog,
    type PaymentBreakdown,
    type PaymentMethod,
} from "@/components/checkout-dialog";
import {
    Search,
    ScanBarcode,
    Plus,
    Minus,
    Trash2,
    ShoppingBag,
    Loader2,
    UserCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Dialog,
    DialogContent,
    DialogDescription,
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

interface Seller {
    id: string;
    name: string;
}

interface ReceiptData {
    ticketNumber: number;
    date: Date;
    sellerName: string;
    items: {
        name: string;
        quantity: number;
        price: number;
        subtotal: number;
    }[];
    total: number;
    paymentMethod: string;
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
    const [giftDialogOpen, setGiftDialogOpen] = useState(false);
    const [printGiftCopy, setPrintGiftCopy] = useState(false);
    const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [cart, setCart] = useState<CartItem[]>([]);
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [priceMode, setPriceMode] = useState<PriceMode>("retail");
    const [allProducts, setAllProducts] = useState<POSProduct[]>([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);
    const [productsError, setProductsError] = useState<string | null>(null);
    const [sellers, setSellers] = useState<Seller[]>([]);
    const [selectedSellerId, setSelectedSellerId] = useState("");
    const triggerPrint = (gift: boolean) => {
        setPrintGiftCopy(gift);
        setGiftDialogOpen(false);

        setTimeout(() => {
            window.print();
        }, 350);
    };

    useEffect(() => {
        let cancelled = false;

        const loadInitialData = async () => {
            setIsLoadingProducts(true);
            setProductsError(null);

            try {
                const [products, sellersData] = await Promise.all([
                    getProductsForPOS(),
                    getSellers(),
                ]);

                if (cancelled) return;

                setAllProducts(products);
                setSellers(sellersData);
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

    useEffect(() => {
        const handleAfterPrint = () => {
            setPrintGiftCopy(false);
            setReceiptData(null);
        };

        window.addEventListener("afterprint", handleAfterPrint);
        return () => {
            window.removeEventListener("afterprint", handleAfterPrint);
        };
    }, []);

    const filteredProducts = useMemo(() => {
        if (!searchQuery.trim()) return allProducts;
        const q = searchQuery.toLowerCase();
        return allProducts.filter(
            (product) =>
                product.name.toLowerCase().includes(q) ||
                product.code.toLowerCase().includes(q)
        );
    }, [searchQuery, allProducts]);

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
        setCart((prev) =>
            prev
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
                .filter(Boolean) as CartItem[]
        );
    };

    const removeFromCart = (productId: string) => {
        setCart((prev) => prev.filter((item) => item.product.id !== productId));
        toast("Producto eliminado del carrito", { duration: 1500 });
    };

    const clearCart = () => {
        setCart([]);
    };

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
            userId: selectedSellerId,
            items: cart.map((item) => ({
                variantId: item.product.id,
                quantity: item.quantity,
                priceAtTime: getUnitPrice(item.product),
                priceType: priceMode === "wholesale" ? "WHOLESALE" : "NORMAL",
            })),
        });

        const nextReceiptData: ReceiptData = {
            ticketNumber: sale.ticketNumber,
            date: new Date(),
            sellerName:
                sellers.find((seller) => seller.id === selectedSellerId)?.name || "Vendedor",
            items: cart.map((item) => ({
                name: item.product.name,
                quantity: item.quantity,
                price: getUnitPrice(item.product),
                subtotal: getUnitPrice(item.product) * item.quantity,
            })),
            total: totalAmount,
            paymentMethod: paymentMethodMap[payment.paymentMethod],
        };

        clearCart();
        const updatedProducts = await getProductsForPOS();
        setAllProducts(updatedProducts);
        setReceiptData(nextReceiptData);
        setGiftDialogOpen(true);

        return sale;
    };

    return (
        <>
            <div className="flex h-[calc(100vh-4rem)] print:hidden lg:h-screen flex-col lg:flex-row">
                <div className="flex flex-1 flex-col lg:w-[60%] lg:flex-none">
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

                <div className="flex flex-col border-t bg-card lg:w-[40%] lg:border-t-0 lg:border-l">
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
                                                onClick={() =>
                                                    updateQuantity(item.product.id, -1)
                                                }
                                            >
                                                <Minus className="size-3.5" />
                                            </Button>
                                            <span className="w-8 text-center text-base font-bold">
                                                {item.quantity}
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="icon-sm"
                                                onClick={() =>
                                                    updateQuantity(item.product.id, +1)
                                                }
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

                    <div className="border-t bg-card px-4 py-4 lg:px-6">
                        <div className="mb-4 space-y-2">
                            <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                <UserCircle className="size-3.5" />
                                Vendedor Atendiendo
                            </Label>
                            <Select
                                value={selectedSellerId}
                                onValueChange={setSelectedSellerId}
                            >
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
                            className="h-14 w-full bg-emerald-600 text-lg font-bold shadow-lg transition-all duration-200 hover:bg-emerald-700 hover:shadow-xl"
                            disabled={cart.length === 0 || !selectedSellerId}
                            onClick={() => setCheckoutOpen(true)}
                        >
                            COBRAR
                        </Button>
                    </div>
                </div>

                <CheckoutDialog
                    open={checkoutOpen}
                    onOpenChange={setCheckoutOpen}
                    total={totalAmount}
                    itemCount={totalItems}
                    onConfirm={handleConfirmSale}
                />
            </div>

            <GiftOptionDialog
                open={giftDialogOpen}
                onClose={() => {
                    setGiftDialogOpen(false);
                    setPrintGiftCopy(false);
                    setReceiptData(null);
                }}
                onSelect={triggerPrint}
            />

            {receiptData && (
                <div className="hidden print:block">
                    <style>{`
                        @media print {
                            @page {
                                size: 80mm auto;
                                margin: 0;
                            }

                            html,
                            body {
                                margin: 0 !important;
                                padding: 0 !important;
                                background: #fff !important;
                            }
                        }
                    `}</style>

                    <div className="fixed inset-0 z-[9999] bg-white text-black">
                        <div className="flex flex-col">
                            <div
                                style={{
                                    breakAfter: printGiftCopy ? "page" : "auto",
                                    pageBreakAfter: printGiftCopy ? "always" : "auto",
                                }}
                            >
                                <TicketReceipt data={receiptData} />
                            </div>
                            {printGiftCopy && <TicketReceipt data={receiptData} isGift />}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

function GiftOptionDialog({
    open,
    onClose,
    onSelect,
}: {
    open: boolean;
    onClose: () => void;
    onSelect: (isGift: boolean) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-sm text-center">
                <DialogHeader>
                    <DialogTitle className="text-xl">Venta Exitosa</DialogTitle>
                    <DialogDescription>
                        ¿Desea imprimir un ticket de regalo (sin precios)?
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 pt-4">
                    <Button
                        variant="outline"
                        className="h-12 text-base"
                        onClick={() => onSelect(false)}
                    >
                        Solo Boleta Normal
                    </Button>
                    <Button
                        className="h-12 bg-emerald-600 text-base hover:bg-emerald-700"
                        onClick={() => onSelect(true)}
                    >
                        Imprimir Ambos (Regalo)
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
