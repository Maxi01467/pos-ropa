"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { getProductsForPOS, getSellers } from "@/app/actions/pos-actions";
import { createExchangeSale, createSale, getSalesHistory } from "@/app/actions/sales-actions";
import { TicketReceipt } from "@/components/ticket-receipt";
import {
    CheckoutDialog,
    type PaymentBreakdown,
    type PaymentMethod,
} from "@/components/checkout-dialog";
import {
    Search,
    Plus,
    Minus,
    Trash2,
    ShoppingBag,
    Loader2,
    UserCircle,
    ReceiptText,
    RotateCcw,
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
import { barcodeFromSku, barcodeFromTicketNumber } from "@/lib/barcodes";
import { renderReceiptHtml, type ReceiptPrintData } from "@/lib/receipt-printing";
import { printHtmlWithQzTray } from "@/lib/qz-tray";

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

interface ExchangeSaleItem {
    id: string;
    productName: string;
    size: string;
    color: string;
    sku: string;
    quantity: number;
    priceAtTime: number;
    priceType: string;
    returnedQuantity: number;
}

interface ExchangeSaleTicket {
    id: string;
    ticketNumber: number;
    total: number;
    paymentMethod: string;
    date: string;
    sellerName: string;
    items: ExchangeSaleItem[];
}

interface AppliedExchange {
    saleId: string;
    ticketNumber: number;
    credit: number;
    items: Array<{
        saleItemId: string;
        quantity: number;
        label: string;
        amount: number;
    }>;
}

type PriceMode = "retail" | "wholesale";

function isEditableTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;

    const tagName = target.tagName;
    return (
        target.isContentEditable ||
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT"
    );
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 0,
    }).format(amount);
}

export default function NuevaVentaPage() {
    const searchInputRef = useRef<HTMLInputElement>(null); // NUEVO
    const exchangeSearchInputRef = useRef<HTMLInputElement>(null);
    const [giftDialogOpen, setGiftDialogOpen] = useState(false);
    const [exchangeDialogOpen, setExchangeDialogOpen] = useState(false);
    const [printGiftCopy, setPrintGiftCopy] = useState(false);
    const [activePrintIsGift, setActivePrintIsGift] = useState(false);
    const [receiptData, setReceiptData] = useState<ReceiptPrintData | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [cart, setCart] = useState<CartItem[]>([]);
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [priceMode, setPriceMode] = useState<PriceMode>("retail");
    const [allProducts, setAllProducts] = useState<POSProduct[]>([]);
    const [exchangeSales, setExchangeSales] = useState<ExchangeSaleTicket[]>([]);
    const [isLoadingExchangeSales, setIsLoadingExchangeSales] = useState(false);
    const [exchangeSearchQuery, setExchangeSearchQuery] = useState("");
    const [selectedExchangeSale, setSelectedExchangeSale] = useState<ExchangeSaleTicket | null>(null);
    const [exchangeQuantities, setExchangeQuantities] = useState<Record<string, string>>({});
    const [appliedExchange, setAppliedExchange] = useState<AppliedExchange | null>(null);
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);
    const [productsError, setProductsError] = useState<string | null>(null);
    const [sellers, setSellers] = useState<Seller[]>([]);
    const [selectedSellerId, setSelectedSellerId] = useState("");
    const startBrowserPrint = ({
        gift,
        initialGiftCopy = false,
    }: {
        gift: boolean;
        initialGiftCopy?: boolean;
    }) => {
        setPrintGiftCopy(gift && !initialGiftCopy);
        setActivePrintIsGift(initialGiftCopy);

        setTimeout(() => {
            window.print();
        }, 350);
    };

    const triggerPrint = async (gift: boolean) => {
        const currentReceipt = receiptData;

        setGiftDialogOpen(false);

        if (!currentReceipt) {
            return;
        }

        let regularReceiptPrinted = false;

        try {
            const ticketLabel = currentReceipt.ticketNumber.toString().padStart(5, "0");
            const printerName = await printHtmlWithQzTray(
                renderReceiptHtml(currentReceipt, false),
                `Boleta ${ticketLabel}`
            );
            regularReceiptPrinted = true;

            if (gift) {
                await printHtmlWithQzTray(
                    renderReceiptHtml(currentReceipt, true),
                    `Ticket cambio ${ticketLabel}`
                );
            }

            setPrintGiftCopy(false);
            setActivePrintIsGift(false);
            setReceiptData(null);

            toast.success("Boleta enviada a QZ Tray", {
                description: gift
                    ? `${printerName} · cliente + regalo`
                    : printerName,
            });
        } catch (error) {
            console.error("QZ Tray printing failed:", error);

            if (regularReceiptPrinted && gift) {
                toast.error("Falló la copia de regalo en QZ Tray. Se abrirá esa copia en el navegador.");
                startBrowserPrint({ gift: false, initialGiftCopy: true });
                return;
            }

            toast.error("No se pudo imprimir con QZ Tray. Se abrirá la impresión del navegador.");
            startBrowserPrint({ gift });
        }
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
            if (printGiftCopy && !activePrintIsGift) {
                setActivePrintIsGift(true);
                setTimeout(() => {
                    window.print();
                }, 250);
                return;
            }

            setPrintGiftCopy(false);
            setActivePrintIsGift(false);
            setReceiptData(null);
        };

        window.addEventListener("afterprint", handleAfterPrint);
        return () => {
            window.removeEventListener("afterprint", handleAfterPrint);
        };
    }, [activePrintIsGift, printGiftCopy]);

    useEffect(() => {
        const handleGlobalScannerInput = (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey || event.altKey) return;
            if (checkoutOpen || giftDialogOpen || exchangeDialogOpen) return;

            const searchInput = searchInputRef.current;
            if (!searchInput) return;
            if (document.activeElement === searchInput) return;
            if (isEditableTarget(event.target)) return;

            if (event.key === "Enter") {
                searchInput.focus();
                return;
            }

            if (event.key.length !== 1) return;

            searchInput.focus();
            setSearchQuery((current) => `${current}${event.key}`);
            event.preventDefault();
        };

        window.addEventListener("keydown", handleGlobalScannerInput, true);
        return () => {
            window.removeEventListener("keydown", handleGlobalScannerInput, true);
        };
    }, [checkoutOpen, exchangeDialogOpen, giftDialogOpen]);

    useEffect(() => {
        if (!exchangeDialogOpen) return;
        setTimeout(() => exchangeSearchInputRef.current?.focus(), 0);
    }, [exchangeDialogOpen]);

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            
            // Usamos e.currentTarget.value en vez del estado searchQuery porque 
            // el escáner dispara los eventos en milisegundos.
            const scannedValue = e.currentTarget.value.trim().toLowerCase();
            if (!scannedValue) return;

            // Buscamos si el texto coincide EXACTAMENTE con el código de algún producto
            const matchedProduct = allProducts.find(
                (p) =>
                    p.code.toLowerCase() === scannedValue ||
                    barcodeFromSku(p.code) === scannedValue
            );

            if (matchedProduct) {
                // Si existe, lo agregamos al carrito
                addToCart(matchedProduct);
                // Vaciamos el input para el próximo escaneo
                setSearchQuery("");
                // Mantenemos el cursor en el input
                setTimeout(() => searchInputRef.current?.focus(), 10);
            } else {
                // Opcional: Si tipeó algo largo (ej: un código) y presionó Enter pero no existe
                if (scannedValue.length >= 4) {
                    toast.error("Código no encontrado", { description: scannedValue.toUpperCase() });
                    setSearchQuery(""); // Limpiamos para que no se trabe
                }
            }
        }
    };
    const filteredProducts = useMemo(() => {
        if (!searchQuery.trim()) return allProducts;
        const q = searchQuery.toLowerCase();
        return allProducts.filter(
            (product) =>
                product.name.toLowerCase().includes(q) ||
                product.code.toLowerCase().includes(q) ||
                barcodeFromSku(product.code).includes(q)
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
    const exchangeCredit = appliedExchange?.credit ?? 0;
    const balanceAmount = totalAmount - exchangeCredit;
    const payableAmount = Math.max(balanceAmount, 0);
    const hasExchangeOverage = balanceAmount < 0;

    const paymentMethodMap: Record<
        PaymentMethod,
        "EFECTIVO" | "TRANSFERENCIA" | "MIXTO"
    > = {
        efectivo: "EFECTIVO",
        transferencia: "TRANSFERENCIA",
        mixto: "MIXTO",
    };

    const finalizeSale = async (payment?: PaymentBreakdown) => {
        const paymentMethod: "EFECTIVO" | "TRANSFERENCIA" | "MIXTO" | "CAMBIO" =
            payment?.paymentMethod
                ? paymentMethodMap[payment.paymentMethod]
                : "CAMBIO";

        const saleItems: Array<{
            variantId: string;
            quantity: number;
            priceAtTime: number;
            priceType: "WHOLESALE" | "NORMAL";
        }> = cart.map((item) => ({
            variantId: item.product.id,
            quantity: item.quantity,
            priceAtTime: getUnitPrice(item.product),
            priceType: priceMode === "wholesale" ? "WHOLESALE" : "NORMAL",
        }));

        const exchangePayload = {
            total: payableAmount,
            paymentMethod,
            cashAmount: payment?.cashAmount ?? 0,
            transferAmount: payment?.transferAmount ?? 0,
            userId: selectedSellerId,
            items: saleItems,
        };

        const sale = appliedExchange
            ? await createExchangeSale({
                  ...exchangePayload,
                  originalSaleId: appliedExchange.saleId,
                  returnedItems: appliedExchange.items.map((item) => ({
                      saleItemId: item.saleItemId,
                      quantity: item.quantity,
                  })),
              })
            : await createSale({
                  ...exchangePayload,
                  paymentMethod: paymentMethodMap[payment!.paymentMethod],
              });

        const nextReceiptData: ReceiptPrintData = {
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
            total: payableAmount,
            paymentMethod,
            exchangeCredit: appliedExchange?.credit,
            exchangedTicketNumber: appliedExchange?.ticketNumber,
        };

        clearCart();
        const updatedProducts = await getProductsForPOS();
        setAllProducts(updatedProducts);
        setAppliedExchange(null);
        setReceiptData(nextReceiptData);
        setGiftDialogOpen(true);

        return sale;
    };

    const handleConfirmSale = async (payment: PaymentBreakdown) => finalizeSale(payment);

    const handleDirectExchangeCheckout = async () => {
        try {
            const sale = await finalizeSale();
            toast.success("¡Cambio registrado!", {
                description: `Boleta #${sale.ticketNumber.toString().padStart(4, "0")} · saldo $0`,
                duration: 4000,
            });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "No se pudo registrar el cambio";
            toast.error(message);
        }
    };

    const loadExchangeSales = async () => {
        setIsLoadingExchangeSales(true);
        try {
            const sales = await getSalesHistory();
            setExchangeSales(sales);
        } catch (error) {
            toast.error("No se pudieron cargar las boletas");
            console.error(error);
        } finally {
            setIsLoadingExchangeSales(false);
        }
    };

    const handleOpenExchangeDialog = async () => {
        if (exchangeSales.length === 0) {
            await loadExchangeSales();
        }
        setExchangeSearchQuery("");
        setSelectedExchangeSale(null);
        setExchangeQuantities({});
        setExchangeDialogOpen(true);
    };

    const filteredExchangeSales = useMemo(() => {
        const query = exchangeSearchQuery.trim();
        if (!query) return exchangeSales.slice(0, 20);

        return exchangeSales.filter((sale) => {
            return (
                sale.ticketNumber.toString().includes(query) ||
                barcodeFromTicketNumber(sale.ticketNumber).includes(query)
            );
        });
    }, [exchangeSales, exchangeSearchQuery]);

    const selectedExchangeItems = useMemo(() => {
        if (!selectedExchangeSale) return [];

        return selectedExchangeSale.items
            .map((item) => {
                const quantity = Number.parseInt(exchangeQuantities[item.id] ?? "0", 10);
                const safeQuantity = Number.isNaN(quantity) ? 0 : quantity;
                const availableQuantity = item.quantity - item.returnedQuantity;
                return {
                    ...item,
                    selectedQuantity: Math.max(0, Math.min(safeQuantity, availableQuantity)),
                    availableQuantity,
                };
            })
            .filter((item) => item.selectedQuantity > 0);
    }, [exchangeQuantities, selectedExchangeSale]);

    const selectedExchangeCredit = selectedExchangeItems.reduce(
        (sum, item) => sum + item.selectedQuantity * item.priceAtTime,
        0
    );

    const handleApplyExchange = () => {
        if (!selectedExchangeSale || selectedExchangeItems.length === 0) {
            toast.error("Seleccioná al menos un producto para cambiar");
            return;
        }

        setAppliedExchange({
            saleId: selectedExchangeSale.id,
            ticketNumber: selectedExchangeSale.ticketNumber,
            credit: selectedExchangeCredit,
            items: selectedExchangeItems.map((item) => ({
                saleItemId: item.id,
                quantity: item.selectedQuantity,
                label: `${item.productName} ${item.size !== "Único" ? `· ${item.size}` : ""}`,
                amount: item.selectedQuantity * item.priceAtTime,
            })),
        });
        setExchangeDialogOpen(false);
    };

    return (
        <>
            <div className="flex h-[calc(100vh-4rem)] print:hidden lg:h-screen flex-col lg:flex-row">
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
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Escanear código o buscar por nombre..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={handleSearchKeyDown} // Acá atajamos el Enter
                                    className="h-12 pl-11 text-lg font-medium"
                                    autoFocus // Pone el cursor automáticamente al entrar a la pantalla
                                />
                            </div>
                            <Button
                                variant="outline"
                                className="h-12 shrink-0 gap-2 px-4"
                                onClick={handleOpenExchangeDialog}
                            >
                                <RotateCcw className="size-4" />
                                Cambio
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
                        {appliedExchange && (
                            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="font-semibold text-amber-900">
                                            Cambio aplicado · Boleta #{appliedExchange.ticketNumber.toString().padStart(5, "0")}
                                        </p>
                                        <p className="text-xs text-amber-800">
                                            {appliedExchange.items.length} producto(s) seleccionado(s)
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-amber-900 hover:bg-amber-100"
                                        onClick={() => setAppliedExchange(null)}
                                    >
                                        Quitar
                                    </Button>
                                </div>
                            </div>
                        )}

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
                        {appliedExchange && (
                            <div className="mb-3 flex items-center justify-between text-sm text-amber-700">
                                <span>Crédito por cambio</span>
                                <span className="font-semibold">-{formatCurrency(exchangeCredit)}</span>
                            </div>
                        )}
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <span className="text-base font-medium text-muted-foreground">
                                    Total a cobrar
                                </span>
                                <p className="text-xs text-muted-foreground">
                                    Cobro actual:{" "}
                                    {priceMode === "wholesale"
                                        ? "precio mayorista"
                                        : "precio de venta"}
                                </p>
                                {hasExchangeOverage && (
                                    <p className="text-xs text-rose-600">
                                        El cambio supera la nueva venta. Ajustá el carrito o quitá productos del cambio.
                                    </p>
                                )}
                            </div>
                            <span className="text-3xl font-bold tracking-tight">
                                {formatCurrency(payableAmount)}
                            </span>
                        </div>
                        <Button
                            size="lg"
                            className="h-14 w-full bg-emerald-600 text-lg font-bold shadow-lg transition-all duration-200 hover:bg-emerald-700 hover:shadow-xl"
                            disabled={cart.length === 0 || !selectedSellerId || hasExchangeOverage}
                            onClick={() =>
                                payableAmount === 0 && appliedExchange
                                    ? void handleDirectExchangeCheckout()
                                    : setCheckoutOpen(true)
                            }
                        >
                            {payableAmount === 0 && appliedExchange ? "FINALIZAR CAMBIO" : "COBRAR"}
                        </Button>
                    </div>
                </div>

                <CheckoutDialog
                    open={checkoutOpen}
                    onOpenChange={setCheckoutOpen}
                    total={payableAmount}
                    itemCount={totalItems}
                    onConfirm={handleConfirmSale}
                />
            </div>

            <ExchangeDialog
                open={exchangeDialogOpen}
                onOpenChange={setExchangeDialogOpen}
                isLoading={isLoadingExchangeSales}
                sales={filteredExchangeSales}
                searchQuery={exchangeSearchQuery}
                onSearchQueryChange={setExchangeSearchQuery}
                selectedSale={selectedExchangeSale}
                onSelectSale={(sale) => {
                    setSelectedExchangeSale(sale);
                    setExchangeQuantities({});
                }}
                exchangeQuantities={exchangeQuantities}
                onQuantityChange={(saleItemId, quantity) =>
                    setExchangeQuantities((current) => ({
                        ...current,
                        [saleItemId]: quantity,
                    }))
                }
                selectedCredit={selectedExchangeCredit}
                onConfirm={handleApplyExchange}
                searchInputRef={exchangeSearchInputRef}
            />

            <GiftOptionDialog
                open={giftDialogOpen}
                onClose={() => {
                    setGiftDialogOpen(false);
                    setPrintGiftCopy(false);
                    setActivePrintIsGift(false);
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
                        <TicketReceipt data={receiptData} isGift={activePrintIsGift} />
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

function ExchangeDialog({
    open,
    onOpenChange,
    isLoading,
    sales,
    searchQuery,
    onSearchQueryChange,
    selectedSale,
    onSelectSale,
    exchangeQuantities,
    onQuantityChange,
    selectedCredit,
    onConfirm,
    searchInputRef,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isLoading: boolean;
    sales: ExchangeSaleTicket[];
    searchQuery: string;
    onSearchQueryChange: (value: string) => void;
    selectedSale: ExchangeSaleTicket | null;
    onSelectSale: (sale: ExchangeSaleTicket) => void;
    exchangeQuantities: Record<string, string>;
    onQuantityChange: (saleItemId: string, quantity: string) => void;
    selectedCredit: number;
    onConfirm: () => void;
    searchInputRef: React.RefObject<HTMLInputElement | null>;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <ReceiptText className="size-5" />
                        Aplicar Cambio
                    </DialogTitle>
                    <DialogDescription>
                        Buscá una boleta, elegí los productos a cambiar y aplicá el crédito.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <div className="space-y-3">
                        <Input
                            ref={searchInputRef}
                            placeholder="Escanear o buscar N° de boleta..."
                            value={searchQuery}
                            onChange={(event) => onSearchQueryChange(event.target.value)}
                        />

                        <div className="max-h-[52vh] space-y-2 overflow-y-auto rounded-lg border p-2">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                    Cargando boletas...
                                </div>
                            ) : sales.length === 0 ? (
                                <div className="py-10 text-center text-sm text-muted-foreground">
                                    No se encontraron boletas.
                                </div>
                            ) : (
                                sales.map((sale) => (
                                    <button
                                        key={sale.id}
                                        type="button"
                                        className={cn(
                                            "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                                            selectedSale?.id === sale.id
                                                ? "border-emerald-600 bg-emerald-50"
                                                : "hover:border-muted-foreground/30 hover:bg-muted/40"
                                        )}
                                        onClick={() => onSelectSale(sale)}
                                    >
                                        <p className="font-semibold">
                                            Boleta #{sale.ticketNumber.toString().padStart(5, "0")}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(sale.date).toLocaleDateString("es-AR")}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {sale.items.length} item(s)
                                        </p>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="rounded-lg border">
                        {!selectedSale ? (
                            <div className="flex h-full min-h-[260px] items-center justify-center text-sm text-muted-foreground">
                                Seleccioná una boleta para ver sus productos.
                            </div>
                        ) : (
                            <div className="flex h-full flex-col">
                                <div className="border-b p-4">
                                    <p className="font-semibold">
                                        Boleta #{selectedSale.ticketNumber.toString().padStart(5, "0")}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {selectedSale.sellerName} · {new Date(selectedSale.date).toLocaleString("es-AR")}
                                    </p>
                                </div>
                                <div className="max-h-[44vh] space-y-2 overflow-y-auto p-4">
                                    {selectedSale.items.map((item) => {
                                        const availableQuantity = item.quantity - item.returnedQuantity;
                                        const value = exchangeQuantities[item.id] ?? "";

                                        return (
                                            <div
                                                key={item.id}
                                                className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_100px]"
                                            >
                                                <div>
                                                    <p className="font-medium">{item.productName}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {item.size !== "Único" ? `Talle ${item.size} · ` : ""}
                                                        {item.color}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Disponible para cambio: {availableQuantity} · {formatCurrency(item.priceAtTime)} c/u
                                                    </p>
                                                </div>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={availableQuantity}
                                                    disabled={availableQuantity === 0}
                                                    value={value}
                                                    onChange={(event) =>
                                                        onQuantityChange(item.id, event.target.value)
                                                    }
                                                />
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="border-t p-4">
                                    <div className="mb-3 flex items-center justify-between font-semibold">
                                        <span>Crédito a aplicar</span>
                                        <span>{formatCurrency(selectedCredit)}</span>
                                    </div>
                                    <Button
                                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                                        disabled={selectedCredit <= 0}
                                        onClick={onConfirm}
                                    >
                                        Aplicar cambio
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
