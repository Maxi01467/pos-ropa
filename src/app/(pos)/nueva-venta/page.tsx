"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { TicketReceipt } from "@/components/printing/ticket-receipt";
import {
    CheckoutDialog,
    type PaymentBreakdown,
    type PaymentMethod,
} from "@/components/sales/checkout-dialog";
import {
    Search,
    Plus,
    Minus,
    Trash2,
    Gift,
    ShoppingBag,
    Loader2,
    UserCircle,
    ReceiptText,
    RotateCcw,
    X,
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
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/core/utils";
import { formatArgentinaDateTime, formatArgentinaShortDate } from "@/lib/core/datetime";
import { barcodeFromSku } from "@/lib/printing/barcodes";
import type { ReceiptPrintData } from "@/lib/printing/receipt-printing";
import { printSaleReceipt } from "@/lib/printing/printing";
import { CACHE_TAGS } from "@/lib/core/cache-tags";
import { notifyDataUpdated, useDataRefresh } from "@/lib/sync/data-sync-client";
import { useTerminalSnapshot } from "@/lib/terminal/terminal-client";
import { getPosRuntimeDataSource } from "@/lib/offline/pos-runtime-data";
import { getPosRuntimeMutations } from "@/lib/offline/pos-runtime-mutations";

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
    legacyBarcodes?: string[]; // Códigos del sistema viejo (aliases temporales)
}

interface CartItem {
    lineId: string;
    product: POSProduct;
    quantity: number;
    isGift: boolean;
}

interface Seller {
    id: string;
    name: string;
}

interface ExchangeSaleItem {
    id: string;
    variantId: string;
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
    ticketNumber: string;
    total: number;
    paymentMethod: string;
    date: string;
    sellerName: string;
    items: ExchangeSaleItem[];
}

interface AppliedExchange {
    saleId: string;
    ticketNumber: string;
    credit: number;
    items: Array<{
        saleItemId: string;
        variantId: string;
        quantity: number;
        label: string;
        amount: number;
    }>;
}

type PriceMode = "retail" | "wholesale";

const MAX_SALE_DRAFT_TABS = 5;

type SaleDraft = {
    id: string;
    label: string;
    createdAt: string;
    updatedAt: string;
    searchQuery: string;
    cart: CartItem[];
    checkoutOpen: boolean;
    priceMode: PriceMode;
    exchangeDialogOpen: boolean;
    sellerSelectOpen: boolean;
    exchangeSearchQuery: string;
    selectedExchangeSale: ExchangeSaleTicket | null;
    exchangeQuantities: Record<string, string>;
    appliedExchange: AppliedExchange | null;
    selectedSellerId: string;
    quickCreateOpen: boolean;
    quickCreateName: string;
    quickCreatePrice: string;
    quickCreateWholesalePrice: string;
    quickCreateInitialStock: string;
};

function createSaleDraft(label = "Venta 1"): SaleDraft {
    const timestamp = new Date().toISOString();

    return {
        id: crypto.randomUUID(),
        label,
        createdAt: timestamp,
        updatedAt: timestamp,
        searchQuery: "",
        cart: [],
        checkoutOpen: false,
        priceMode: "retail",
        exchangeDialogOpen: false,
        sellerSelectOpen: false,
        exchangeSearchQuery: "",
        selectedExchangeSale: null,
        exchangeQuantities: {},
        appliedExchange: null,
        selectedSellerId: "",
        quickCreateOpen: false,
        quickCreateName: "",
        quickCreatePrice: "",
        quickCreateWholesalePrice: "",
        quickCreateInitialStock: "1",
    };
}

function resetSaleDraft(draft: SaleDraft): SaleDraft {
    return {
        ...createSaleDraft(draft.label),
        id: draft.id,
        createdAt: draft.createdAt,
    };
}

function applyStateAction<T>(current: T, action: SetStateAction<T>): T {
    return typeof action === "function"
        ? (action as (currentValue: T) => T)(current)
        : action;
}

function isSaleDraftEmpty(draft: SaleDraft) {
    return (
        draft.cart.length === 0 &&
        !draft.appliedExchange &&
        !draft.searchQuery.trim() &&
        !draft.selectedSellerId &&
        draft.priceMode === "retail" &&
        !draft.exchangeSearchQuery.trim() &&
        !draft.selectedExchangeSale &&
        Object.keys(draft.exchangeQuantities).length === 0 &&
        !draft.quickCreateName.trim() &&
        !draft.quickCreatePrice.trim() &&
        !draft.quickCreateWholesalePrice.trim() &&
        draft.quickCreateInitialStock === "1"
    );
}

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

function normalizeProductCodeSearchValue(value: string): string {
    return value.trim().toLowerCase();
}

function createCartItem(product: POSProduct, quantity = 1, isGift = false): CartItem {
    return {
        lineId: crypto.randomUUID(),
        product,
        quantity,
        isGift,
    };
}

function productCodeSearchValues(product: POSProduct): string[] {
    return [
        product.code,
        barcodeFromSku(product.code),
        ...(product.legacyBarcodes ?? []),
    ]
        .map(normalizeProductCodeSearchValue)
        .filter(Boolean);
}

function productMatchesSearch(product: POSProduct, query: string): boolean {
    const normalizedQuery = normalizeProductCodeSearchValue(query);
    if (!normalizedQuery) {
        return true;
    }

    return (
        product.name.toLowerCase().includes(normalizedQuery) ||
        productCodeSearchValues(product).some((code) => code.includes(normalizedQuery))
    );
}

function productMatchesExactCode(product: POSProduct, query: string): boolean {
    const normalizedQuery = normalizeProductCodeSearchValue(query);
    if (!normalizedQuery) {
        return false;
    }

    return productCodeSearchValues(product).includes(normalizedQuery);
}

function reconcileProductStocks(
    products: POSProduct[],
    soldItems: Array<{ variantId: string; quantity: number }>,
    returnedItems: Array<{ variantId: string; quantity: number }> = []
) {
    const stockDeltaByVariant = new Map<string, number>();

    for (const item of soldItems) {
        stockDeltaByVariant.set(
            item.variantId,
            (stockDeltaByVariant.get(item.variantId) ?? 0) - item.quantity
        );
    }

    for (const item of returnedItems) {
        stockDeltaByVariant.set(
            item.variantId,
            (stockDeltaByVariant.get(item.variantId) ?? 0) + item.quantity
        );
    }

    if (stockDeltaByVariant.size === 0) {
        return products;
    }

    return products.map((product) => {
        const delta = stockDeltaByVariant.get(product.id);
        if (delta == null || delta === 0) {
            return product;
        }

        return {
            ...product,
            stock: Math.max(0, product.stock + delta),
        };
    });
}

function upsertProduct(products: POSProduct[], product: POSProduct) {
    const existingIndex = products.findIndex((item) => item.id === product.id);

    if (existingIndex === -1) {
        return [product, ...products];
    }

    return products.map((item, index) => (index === existingIndex ? product : item));
}

export default function NuevaVentaPage() {
    const posDataSource = useMemo(() => getPosRuntimeDataSource(), []);
    const posMutations = useMemo(() => getPosRuntimeMutations(), []);
    const searchInputRef = useRef<HTMLInputElement>(null); // NUEVO
    const searchBoxRef = useRef<HTMLDivElement>(null);
    const exchangeSearchInputRef = useRef<HTMLInputElement>(null);
    const exchangeSalesRequestIdRef = useRef(0);
    const sellerSelectTriggerRef = useRef<HTMLButtonElement>(null);
    const [draftTabs, setDraftTabs] = useState(() => {
        const initialDraft = createSaleDraft();
        return {
            drafts: [initialDraft],
            activeDraftId: initialDraft.id,
        };
    });
    const [printGiftCopy, setPrintGiftCopy] = useState(false);
    const [activePrintIsGift, setActivePrintIsGift] = useState(false);
    const [receiptData, setReceiptData] = useState<ReceiptPrintData | null>(null);
    const [allProducts, setAllProducts] = useState<POSProduct[]>([]);
    const [exchangeSales, setExchangeSales] = useState<ExchangeSaleTicket[]>([]);
    const [isLoadingExchangeSales, setIsLoadingExchangeSales] = useState(false);
    const [hasLoadedExchangeSalesOnce, setHasLoadedExchangeSalesOnce] = useState(false);
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [hasLoadedCatalogOnce, setHasLoadedCatalogOnce] = useState(false);
    const [productsError, setProductsError] = useState<string | null>(null);
    const [sellers, setSellers] = useState<Seller[]>([]);
    const [isQuickCreating, setIsQuickCreating] = useState(false);
    const [draftIdPendingClose, setDraftIdPendingClose] = useState<string | null>(null);
    const terminal = useTerminalSnapshot();
    const activeDraft =
        draftTabs.drafts.find((draft) => draft.id === draftTabs.activeDraftId) ??
        draftTabs.drafts[0]!;
    const updateDraftField = useCallback(
        <Key extends keyof SaleDraft>(field: Key, action: SetStateAction<SaleDraft[Key]>) => {
            setDraftTabs((currentTabs) => ({
                ...currentTabs,
                drafts: currentTabs.drafts.map((draft) =>
                    draft.id === currentTabs.activeDraftId
                        ? {
                            ...draft,
                            [field]: applyStateAction(draft[field], action),
                            updatedAt: new Date().toISOString(),
                        }
                        : draft
                ),
            }));
        },
        []
    );
    const searchQuery = activeDraft.searchQuery;
    const cart = activeDraft.cart;
    const checkoutOpen = activeDraft.checkoutOpen;
    const priceMode = activeDraft.priceMode;
    const exchangeDialogOpen = activeDraft.exchangeDialogOpen;
    const sellerSelectOpen = activeDraft.sellerSelectOpen;
    const exchangeSearchQuery = activeDraft.exchangeSearchQuery;
    const selectedExchangeSale = activeDraft.selectedExchangeSale;
    const exchangeQuantities = activeDraft.exchangeQuantities;
    const appliedExchange = activeDraft.appliedExchange;
    const selectedSellerId = activeDraft.selectedSellerId;
    const quickCreateOpen = activeDraft.quickCreateOpen;
    const quickCreateName = activeDraft.quickCreateName;
    const quickCreatePrice = activeDraft.quickCreatePrice;
    const quickCreateWholesalePrice = activeDraft.quickCreateWholesalePrice;
    const quickCreateInitialStock = activeDraft.quickCreateInitialStock;
    const setSearchQuery = useCallback(
        (action: SetStateAction<string>) => updateDraftField("searchQuery", action),
        [updateDraftField]
    );
    const setCart = useCallback(
        (action: SetStateAction<CartItem[]>) => updateDraftField("cart", action),
        [updateDraftField]
    );
    const setCheckoutOpen = useCallback(
        (action: SetStateAction<boolean>) => updateDraftField("checkoutOpen", action),
        [updateDraftField]
    );
    const setPriceMode = useCallback(
        (action: SetStateAction<PriceMode>) => updateDraftField("priceMode", action),
        [updateDraftField]
    );
    const setExchangeDialogOpen = useCallback(
        (action: SetStateAction<boolean>) => updateDraftField("exchangeDialogOpen", action),
        [updateDraftField]
    );
    const setSellerSelectOpen = useCallback(
        (action: SetStateAction<boolean>) => updateDraftField("sellerSelectOpen", action),
        [updateDraftField]
    );
    const setExchangeSearchQuery = useCallback(
        (action: SetStateAction<string>) => updateDraftField("exchangeSearchQuery", action),
        [updateDraftField]
    );
    const setSelectedExchangeSale = useCallback(
        (action: SetStateAction<ExchangeSaleTicket | null>) =>
            updateDraftField("selectedExchangeSale", action),
        [updateDraftField]
    );
    const setExchangeQuantities = useCallback(
        (action: SetStateAction<Record<string, string>>) =>
            updateDraftField("exchangeQuantities", action),
        [updateDraftField]
    );
    const setAppliedExchange = useCallback(
        (action: SetStateAction<AppliedExchange | null>) => updateDraftField("appliedExchange", action),
        [updateDraftField]
    );
    const setSelectedSellerId = useCallback(
        (action: SetStateAction<string>) => updateDraftField("selectedSellerId", action),
        [updateDraftField]
    );
    const setQuickCreateOpen = useCallback(
        (action: SetStateAction<boolean>) => updateDraftField("quickCreateOpen", action),
        [updateDraftField]
    );
    const setQuickCreateName = useCallback(
        (action: SetStateAction<string>) => updateDraftField("quickCreateName", action),
        [updateDraftField]
    );
    const setQuickCreatePrice = useCallback(
        (action: SetStateAction<string>) => updateDraftField("quickCreatePrice", action),
        [updateDraftField]
    );
    const setQuickCreateWholesalePrice = useCallback(
        (action: SetStateAction<string>) => updateDraftField("quickCreateWholesalePrice", action),
        [updateDraftField]
    );
    const setQuickCreateInitialStock = useCallback(
        (action: SetStateAction<string>) => updateDraftField("quickCreateInitialStock", action),
        [updateDraftField]
    );
    const draftTabSummaries = useMemo(
        () =>
            draftTabs.drafts.map((draft) => {
                const itemCount = draft.cart.reduce((sum, item) => sum + item.quantity, 0);
                const total = draft.cart.reduce((sum, item) => {
                    const unitPrice =
                        draft.priceMode === "wholesale"
                            ? item.product.wholesalePrice
                            : item.product.price;

                    return sum + unitPrice * item.quantity;
                }, 0);

                return {
                    id: draft.id,
                    label: draft.label,
                    itemCount,
                    total,
                    hasExchange: Boolean(draft.appliedExchange),
                    isEmpty: isSaleDraftEmpty(draft),
                };
            }),
        [draftTabs.drafts]
    );
    const handleCreateDraftTab = useCallback(() => {
        setDraftTabs((currentTabs) => {
            if (currentTabs.drafts.length >= MAX_SALE_DRAFT_TABS) {
                toast.error(`Podés tener hasta ${MAX_SALE_DRAFT_TABS} ventas abiertas`);
                return currentTabs;
            }

            const nextDraft = createSaleDraft(`Venta ${currentTabs.drafts.length + 1}`);

            return {
                drafts: [...currentTabs.drafts, nextDraft],
                activeDraftId: nextDraft.id,
            };
        });
    }, []);
    const handleSwitchDraftTab = useCallback((draftId: string) => {
        setDraftTabs((currentTabs) => {
            if (currentTabs.activeDraftId === draftId) {
                return currentTabs;
            }

            return {
                ...currentTabs,
                activeDraftId: draftId,
            };
        });
    }, []);
    const closeDraftTab = useCallback((draftId: string) => {
        setDraftTabs((currentTabs) => {
            if (currentTabs.drafts.length === 1) {
                const replacementDraft = createSaleDraft("Venta 1");
                return {
                    drafts: [replacementDraft],
                    activeDraftId: replacementDraft.id,
                };
            }

            const closingIndex = currentTabs.drafts.findIndex((draft) => draft.id === draftId);
            const remainingDrafts = currentTabs.drafts
                .filter((draft) => draft.id !== draftId)
                .map((draft, index) => ({
                    ...draft,
                    label: `Venta ${index + 1}`,
                }));
            const nextActiveDraftId =
                currentTabs.activeDraftId === draftId
                    ? remainingDrafts[Math.min(closingIndex, remainingDrafts.length - 1)]!.id
                    : currentTabs.activeDraftId;

            return {
                drafts: remainingDrafts,
                activeDraftId: nextActiveDraftId,
            };
        });
        setDraftIdPendingClose(null);
    }, []);
    const completeSaleDraft = useCallback((draftId: string) => {
        setDraftTabs((currentTabs) => {
            const completedDraftIndex = currentTabs.drafts.findIndex(
                (draft) => draft.id === draftId
            );

            if (completedDraftIndex === -1) {
                return currentTabs;
            }

            if (currentTabs.drafts.length === 1) {
                return {
                    drafts: [resetSaleDraft(currentTabs.drafts[completedDraftIndex]!)],
                    activeDraftId: draftId,
                };
            }

            const remainingDrafts = currentTabs.drafts
                .filter((draft) => draft.id !== draftId)
                .map((draft, index) => ({
                    ...draft,
                    label: `Venta ${index + 1}`,
                }));
            const nextActiveDraftId =
                currentTabs.activeDraftId === draftId
                    ? remainingDrafts[
                        Math.min(completedDraftIndex, remainingDrafts.length - 1)
                    ]!.id
                    : currentTabs.activeDraftId;

            return {
                drafts: remainingDrafts,
                activeDraftId: nextActiveDraftId,
            };
        });
        setDraftIdPendingClose(null);
    }, []);
    const handleCloseDraftTab = useCallback((draftId: string) => {
        const draftToClose = draftTabs.drafts.find((draft) => draft.id === draftId);
        if (!draftToClose) {
            return;
        }

        if (draftToClose.cart.length > 0) {
            setDraftIdPendingClose(draftId);
            return;
        }

        closeDraftTab(draftId);
    }, [closeDraftTab, draftTabs.drafts]);
    const draftPendingClose = draftTabs.drafts.find((draft) => draft.id === draftIdPendingClose);
    const pendingCloseItemCount =
        draftPendingClose?.cart.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
    const pendingCloseTotal =
        draftPendingClose?.cart.reduce((sum, item) => {
            const unitPrice =
                draftPendingClose.priceMode === "wholesale"
                    ? item.product.wholesalePrice
                    : item.product.price;

            return sum + unitPrice * item.quantity;
        }, 0) ?? 0;
    const startBrowserPrint = ({
        hasGiftCopy,
        initialGiftCopy = false,
    }: {
        hasGiftCopy: boolean;
        initialGiftCopy?: boolean;
    }) => {
        setPrintGiftCopy(hasGiftCopy && !initialGiftCopy);
        setActivePrintIsGift(initialGiftCopy);

        setTimeout(() => {
            window.print();
        }, 350);
    };

    const triggerPrint = async (currentReceipt: ReceiptPrintData) => {
        const hasGiftCopy = Boolean(
            currentReceipt.giftItems && currentReceipt.giftItems.length > 0
        );
        let regularReceiptPrinted = false;

        try {
            const { printerName } = await printSaleReceipt(currentReceipt);
            regularReceiptPrinted = true;

            setPrintGiftCopy(false);
            setActivePrintIsGift(false);
            setReceiptData(null);

            toast.success("Boleta enviada a la app de escritorio", {
                description: hasGiftCopy
                    ? `${printerName} · cliente + regalo`
                    : printerName,
            });
        } catch (error) {
            const isDesktopUnavailable =
                error instanceof Error &&
                error.message === "La app de escritorio no está disponible";

            if (isDesktopUnavailable) {
                console.warn("Desktop print bridge no disponible. Usando impresión del navegador.");
            } else {
                console.error("Printing failed:", error);
            }

            if (regularReceiptPrinted && hasGiftCopy) {
                toast.error("Falló la copia de regalo. Se abrirá esa copia en el navegador.");
                startBrowserPrint({ hasGiftCopy: false, initialGiftCopy: true });
                return;
            }

            toast.error("No se pudo imprimir automáticamente. Se abrirá la impresión del navegador.");
            startBrowserPrint({ hasGiftCopy });
        }
    };

    const loadCatalog = useCallback(async (options?: { background?: boolean; reason?: string }) => {
        let cancelled = false;
        const isBackgroundRefresh = options?.background ?? false;

        if (!isBackgroundRefresh && !hasLoadedCatalogOnce) {
            setIsLoadingProducts(true);
        }
        setProductsError(null);

        try {
            const [productsResult, sellersResult] = await Promise.allSettled([
                posDataSource.getProducts(),
                posDataSource.getSellers(),
            ]);

            if (productsResult.status === "rejected") {
                console.error("Error loading products for POS:", productsResult.reason);
                throw productsResult.reason;
            }

            if (sellersResult.status === "rejected") {
                console.error("Error loading sellers for POS:", sellersResult.reason);
                throw sellersResult.reason;
            }

            const products = productsResult.value;
            const sellersData = sellersResult.value;

            if (cancelled) return;

            setAllProducts(products);
            setSellers(sellersData);
            setHasLoadedCatalogOnce(true);
            setSelectedSellerId((currentSelectedSellerId) => {
                if (
                    currentSelectedSellerId &&
                    sellersData.some((seller) => seller.id === currentSelectedSellerId)
                ) {
                    return currentSelectedSellerId;
                }

                return "";
            });
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

        return () => {
            cancelled = true;
        };
    }, [hasLoadedCatalogOnce, posDataSource, setSelectedSellerId]);

    useEffect(() => {
        let cleanup: (() => void) | undefined;
        void loadCatalog({ reason: "initial-mount" }).then((nextCleanup) => {
            cleanup = nextCleanup;
        });

        return () => {
            cleanup?.();
        };
    }, [loadCatalog]);

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
            if (checkoutOpen || exchangeDialogOpen || sellerSelectOpen) return;

            const searchInput = searchInputRef.current;
            if (!searchInput) return;
            if (document.activeElement === searchInput) return;
            if (isEditableTarget(event.target)) return;

            if (["j", "k", "l", "Enter", "Escape"].includes(event.key)) {
                return;
            }

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
    }, [checkoutOpen, exchangeDialogOpen, sellerSelectOpen, setSearchQuery]);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            const searchBox = searchBoxRef.current;
            if (!searchBox) return;
            if (searchBox.contains(event.target as Node)) return;

            setIsSearchFocused(false);
            searchInputRef.current?.blur();
        };

        window.addEventListener("pointerdown", handlePointerDown, true);
        return () => {
            window.removeEventListener("pointerdown", handlePointerDown, true);
        };
    }, []);

    useEffect(() => {
        const handleKeyboardShortcuts = (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey || event.altKey) return;

            if (event.key === "Escape") {
                if (checkoutOpen) {
                    event.preventDefault();
                    setCheckoutOpen(false);
                    return;
                }

                if (exchangeDialogOpen) {
                    event.preventDefault();
                    setExchangeDialogOpen(false);
                    return;
                }

                if (sellerSelectOpen) {
                    event.preventDefault();
                    setSellerSelectOpen(false);
                }

                return;
            }

            if (checkoutOpen || exchangeDialogOpen || sellerSelectOpen) return;
            if (isEditableTarget(event.target)) return;

            if (event.key === "j") {
                event.preventDefault();
                setExchangeSearchQuery("");
                setSelectedExchangeSale(null);
                setExchangeQuantities({});
                setExchangeDialogOpen(true);
                return;
            }

            if (event.key === "k") {
                event.preventDefault();
                setPriceMode((currentMode) =>
                    currentMode === "retail" ? "wholesale" : "retail"
                );
                return;
            }

            if (event.key === "l") {
                event.preventDefault();
                setSellerSelectOpen(true);
                setTimeout(() => {
                    sellerSelectTriggerRef.current?.focus();
                }, 0);
                return;
            }

        };

        window.addEventListener("keydown", handleKeyboardShortcuts, true);
        return () => {
            window.removeEventListener("keydown", handleKeyboardShortcuts, true);
        };
    }, [
        checkoutOpen,
        exchangeDialogOpen,
        setCheckoutOpen,
        setExchangeDialogOpen,
        setExchangeQuantities,
        setExchangeSearchQuery,
        setPriceMode,
        setSelectedExchangeSale,
        setSellerSelectOpen,
        sellerSelectOpen,
    ]);

    useEffect(() => {
        if (!exchangeDialogOpen) return;
        setTimeout(() => exchangeSearchInputRef.current?.focus(), 0);
    }, [exchangeDialogOpen]);

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();

            // Usamos e.currentTarget.value en vez del estado searchQuery porque 
            // el escáner dispara los eventos en milisegundos.
            const scannedValue = e.currentTarget.value;
            if (!scannedValue) return;

            // Buscamos si el texto coincide EXACTAMENTE con el código de algún producto
            const matchedProduct = allProducts.find((product) =>
                productMatchesExactCode(product, scannedValue)
            );

            if (matchedProduct) {
                // Si existe, lo agregamos al carrito
                addToCart(matchedProduct);
                // Vaciamos el input para el próximo escaneo
                setSearchQuery("");
                // Mantenemos el cursor en el input
                setTimeout(() => searchInputRef.current?.focus(), 10);
            } else if (filteredProducts.length === 1) {
                addToCart(filteredProducts[0]);
                setSearchQuery("");
                setTimeout(() => searchInputRef.current?.focus(), 10);
            } else if (filteredProducts.length > 1) {
                toast.info("Hay varios productos para esa búsqueda", {
                    description: "Escribí un poco más o escaneá el código.",
                });
            } else {
                // Opcional: Si tipeó algo largo (ej: un código) y presionó Enter pero no existe
                const normalizedScannedValue = normalizeProductCodeSearchValue(scannedValue);
                if (normalizedScannedValue.length >= 4) {
                    toast.error("Código no encontrado", {
                        description: normalizedScannedValue.toUpperCase(),
                    });
                    setSearchQuery(""); // Limpiamos para que no se trabe
                }
            }
        }
    };
    const filteredProducts = useMemo(() => {
        if (!searchQuery.trim()) return allProducts;
        return allProducts.filter((product) => productMatchesSearch(product, searchQuery));
    }, [searchQuery, allProducts]);
    const searchSuggestions = useMemo(() => {
        const q = normalizeProductCodeSearchValue(searchQuery);
        if (!q) return [];

        return filteredProducts
            .map((product) => {
                const name = product.name.toLowerCase();
                const code = product.code.toLowerCase();
                const barcode = barcodeFromSku(product.code);
                const codeValues = productCodeSearchValues(product);
                const legacyMatch = (product.legacyBarcodes ?? []).some((barcodeAlias) =>
                    normalizeProductCodeSearchValue(barcodeAlias).includes(q)
                );
                let score = 10;

                if (codeValues.includes(q)) score = 0;
                else if (code.startsWith(q)) score = 1;
                else if (name.startsWith(q)) score = 2;
                else if (barcode.includes(q) || legacyMatch) score = 3;
                else if (code.includes(q)) score = 4;
                else if (name.includes(q)) score = 5;

                return { product, score };
            })
            .sort((left, right) => {
                if (left.score !== right.score) return left.score - right.score;
                return left.product.name.localeCompare(right.product.name, "es", {
                    sensitivity: "base",
                });
            })
            .slice(0, 5)
            .map(({ product }) => product);
    }, [filteredProducts, searchQuery]);

    const getReservedQuantityInOtherDrafts = (variantId: string) =>
        draftTabs.drafts.reduce((sum, draft) => {
            if (draft.id === activeDraft.id) {
                return sum;
            }

            return (
                sum +
                draft.cart.reduce(
                    (itemSum, item) =>
                        item.product.id === variantId ? itemSum + item.quantity : itemSum,
                    0
                )
            );
        }, 0);

    const getAvailableStockForActiveDraft = (product: POSProduct) => {
        const currentProduct = allProducts.find((item) => item.id === product.id);
        const localStock = currentProduct?.stock ?? product.stock;
        return Math.max(0, localStock - getReservedQuantityInOtherDrafts(product.id));
    };

    const addToCart = (product: POSProduct) => {
        setCart((prev) => {
            const availableStock = getAvailableStockForActiveDraft(product);
            const quantityInCart = prev.reduce(
                (sum, item) => item.product.id === product.id ? sum + item.quantity : sum,
                0
            );

            if (availableStock <= 0) {
                toast.error("Producto sin stock", {
                    description: product.name,
                });
                return prev;
            }

            const existing = prev.find(
                (item) => item.product.id === product.id && !item.isGift
            ) ?? prev.find((item) => item.product.id === product.id);
            if (existing) {
                if (quantityInCart >= availableStock) {
                    toast.error("Sin stock suficiente", {
                        description: `Solo quedan ${availableStock} unidades disponibles de ${product.name}`,
                    });
                    return prev;
                }

                return prev.map((item) =>
                    item.lineId === existing.lineId
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }

            toast.success("Producto agregado", {
                description: product.name,
                duration: 1500,
            });
            return [...prev, createCartItem(product)];
        });
    };

    const updateQuantity = (lineId: string, delta: number) => {
        setCart((prev) =>
            prev
                .map((item) => {
                    if (item.lineId !== lineId) return item;
                    const newQty = item.quantity + delta;
                    const availableStock = getAvailableStockForActiveDraft(item.product);
                    const quantityInCart = prev.reduce(
                        (sum, cartItem) =>
                            cartItem.product.id === item.product.id
                                ? sum + cartItem.quantity
                                : sum,
                        0
                    );

                    if (quantityInCart + delta > availableStock) {
                        toast.error("Sin stock suficiente");
                        return item;
                    }

                    if (newQty <= 0) return null;
                    return { ...item, quantity: newQty };
                })
                .filter(Boolean) as CartItem[]
        );
    };

    const toggleGiftItem = (lineId: string) => {
        setCart((prev) =>
            prev.flatMap((item) => {
                if (item.lineId !== lineId) return [item];

                if (item.quantity <= 1) {
                    return [{ ...item, isGift: !item.isGift }];
                }

                return [
                    { ...item, quantity: item.quantity - 1 },
                    createCartItem(item.product, 1, !item.isGift),
                ];
            })
        );
    };

    const removeFromCart = (lineId: string) => {
        setCart((prev) => prev.filter((item) => item.lineId !== lineId));
        toast("Producto eliminado del carrito", { duration: 1500 });
    };

    const clearCart = () => {
        setCart([]);
        setAppliedExchange(null);
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
    const shouldFinalizeExchangeDirectly = Boolean(appliedExchange) && balanceAmount <= 0;

    const paymentMethodMap: Record<
        PaymentMethod,
        "EFECTIVO" | "TRANSFERENCIA" | "MIXTO"
    > = {
        efectivo: "EFECTIVO",
        transferencia: "TRANSFERENCIA",
        mixto: "MIXTO",
    };

    const finalizeSale = async (payment?: PaymentBreakdown) => {
        const completedDraftId = activeDraft.id;

        if (!selectedSellerId) {
            throw new Error("Seleccioná un vendedor antes de cobrar");
        }

        const isExchangeSale = Boolean(appliedExchange && appliedExchange.items.length > 0);
        const saleTotal = isExchangeSale ? balanceAmount : payableAmount;
        const shouldCloseAsExchangeCredit = isExchangeSale && saleTotal <= 0;

        if (saleTotal < 0 && !isExchangeSale) {
            throw new Error("Una venta normal no puede tener total negativo");
        }

        if (!shouldCloseAsExchangeCredit && !payment) {
            throw new Error("Seleccioná un método de pago antes de cobrar");
        }

        const paymentMethod: "EFECTIVO" | "TRANSFERENCIA" | "MIXTO" | "CAMBIO" =
            shouldCloseAsExchangeCredit
                ? "CAMBIO"
                : paymentMethodMap[payment!.paymentMethod];

        const saleItemsByVariant = new Map<
            string,
            {
                variantId: string;
                quantity: number;
                priceAtTime: number;
                priceType: "WHOLESALE" | "NORMAL";
            }
        >();

        for (const item of cart) {
            const priceAtTime = getUnitPrice(item.product);
            const priceType = priceMode === "wholesale" ? "WHOLESALE" : "NORMAL";
            const key = `${item.product.id}:${priceAtTime}:${priceType}`;
            const existing = saleItemsByVariant.get(key);

            if (existing) {
                existing.quantity += item.quantity;
            } else {
                saleItemsByVariant.set(key, {
                    variantId: item.product.id,
                    quantity: item.quantity,
                    priceAtTime,
                    priceType,
                });
            }
        }

        const saleItems: Array<{
            variantId: string;
            quantity: number;
            priceAtTime: number;
            priceType: "WHOLESALE" | "NORMAL";
        }> = Array.from(saleItemsByVariant.values());

        const exchangePayload = {
            total: saleTotal,
            paymentMethod,
            cashAmount: shouldCloseAsExchangeCredit ? 0 : payment!.cashAmount,
            transferAmount: shouldCloseAsExchangeCredit ? 0 : payment!.transferAmount,
            userId: selectedSellerId,
            terminalPrefix: terminal.terminalPrefix ?? undefined,
            items: saleItems,
        };

        const sale = isExchangeSale
            ? await posMutations.createExchangeSale({
                ...exchangePayload,
                originalSaleId: appliedExchange!.saleId,
                returnedItems: appliedExchange!.items.map((item) => ({
                    saleItemId: item.saleItemId,
                    quantity: item.quantity,
                })),
            })
            : await posMutations.createSale({
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
            giftItems: cart
                .filter((item) => item.isGift)
                .map((item) => ({
                    name: item.product.name,
                    quantity: item.quantity,
                    price: getUnitPrice(item.product),
                    subtotal: getUnitPrice(item.product) * item.quantity,
                })),
            total: saleTotal,
            paymentMethod,
            cashAmount: shouldCloseAsExchangeCredit ? 0 : payment!.cashAmount,
            transferAmount: shouldCloseAsExchangeCredit ? 0 : payment!.transferAmount,
            exchangeCredit: appliedExchange?.credit,
            exchangedTicketNumber: appliedExchange?.ticketNumber,
        };

        setAllProducts((currentProducts) =>
            reconcileProductStocks(
                currentProducts,
                saleItems.map((item) => ({
                    variantId: item.variantId,
                    quantity: item.quantity,
                })),
                appliedExchange?.items.map((item) => ({
                    variantId: item.variantId,
                    quantity: item.quantity,
                })) ?? []
            )
        );
        const updatedProducts = await posDataSource.getProducts();
        setAllProducts(updatedProducts);
        completeSaleDraft(completedDraftId);
        setReceiptData(nextReceiptData);
        notifyDataUpdated([
            CACHE_TAGS.sales,
            CACHE_TAGS.cash,
            CACHE_TAGS.posProducts,
            CACHE_TAGS.inventory,
            CACHE_TAGS.stock,
        ]);
        setTimeout(() => {
            void triggerPrint(nextReceiptData);
        }, 150);

        return sale;
    };

    const handleConfirmSale = async (payment: PaymentBreakdown) => finalizeSale(payment);

    const handleDirectExchangeCheckout = async () => {
        try {
            const sale = await finalizeSale();
            toast.success("¡Cambio registrado!", {
                description:
                    balanceAmount < 0
                        ? `Boleta #${sale.ticketNumber.toString().padStart(4, "0")} · saldo a favor ${formatCurrency(Math.abs(balanceAmount))}`
                        : `Boleta #${sale.ticketNumber.toString().padStart(4, "0")} · saldo $0`,
                duration: 4000,
            });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "No se pudo registrar el cambio";
            toast.error(message);
        }
    };

    const loadExchangeSales = useCallback(async () => {
        const requestId = exchangeSalesRequestIdRef.current + 1;
        exchangeSalesRequestIdRef.current = requestId;
        const shouldShowLoading = !hasLoadedExchangeSalesOnce;

        if (shouldShowLoading) {
            setIsLoadingExchangeSales(true);
        }

        try {
            const sales = await posDataSource.getSalesHistory({
                query: exchangeSearchQuery,
                limit: 5,
            });

            if (exchangeSalesRequestIdRef.current !== requestId) {
                return;
            }

            setExchangeSales(sales);
            setHasLoadedExchangeSalesOnce(true);
        } catch (error) {
            if (exchangeSalesRequestIdRef.current !== requestId) {
                return;
            }

            toast.error("No se pudieron cargar las boletas");
            console.error(error);
        } finally {
            if (exchangeSalesRequestIdRef.current === requestId && shouldShowLoading) {
                setIsLoadingExchangeSales(false);
            }
        }
    }, [exchangeSearchQuery, hasLoadedExchangeSalesOnce, posDataSource]);

    const refreshCatalogData = useCallback(async () => {
        await loadCatalog({ background: true, reason: "data-sync-catalog" });
    }, [loadCatalog]);

    const refreshExchangeSales = useCallback(async () => {
        if (!exchangeDialogOpen) {
            return;
        }

        await loadExchangeSales();
    }, [exchangeDialogOpen, loadExchangeSales]);

    useDataRefresh(
        [
            CACHE_TAGS.posProducts,
            CACHE_TAGS.inventory,
            CACHE_TAGS.stock,
            CACHE_TAGS.employees,
        ],
        refreshCatalogData,
        {
            debugLabel: "nueva-venta-catalog",
            pollIntervalMs: false,
        }
    );

    useDataRefresh(
        [CACHE_TAGS.sales, CACHE_TAGS.cash],
        refreshExchangeSales,
        {
            debugLabel: "nueva-venta-exchange",
            pollIntervalMs: false,
            refreshOnFocus: false,
        }
    );

    const handleOpenExchangeDialog = async () => {
        setExchangeSearchQuery("");
        setSelectedExchangeSale(null);
        setExchangeQuantities({});
        setExchangeDialogOpen(true);
    };

    useEffect(() => {
        if (!exchangeDialogOpen) return;

        const timeoutId = window.setTimeout(() => {
            void loadExchangeSales();
        }, 250);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [exchangeDialogOpen, exchangeSearchQuery, loadExchangeSales]);

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
                variantId: item.variantId,
                quantity: item.selectedQuantity,
                label: `${item.productName} ${item.size !== "Único" ? `· ${item.size}` : ""}`,
                amount: item.selectedQuantity * item.priceAtTime,
            })),
        });
        setExchangeDialogOpen(false);
    };

    const handleRemoveExchangeItem = (saleItemId: string) => {
        setAppliedExchange((currentExchange) => {
            if (!currentExchange) return null;

            const nextItems = currentExchange.items.filter((item) => item.saleItemId !== saleItemId);
            if (nextItems.length === 0) {
                return null;
            }

            return {
                ...currentExchange,
                items: nextItems,
                credit: nextItems.reduce((sum, item) => sum + item.amount, 0),
            };
        });
    };

    const openQuickCreateDialog = () => {
        const normalizedQuery = searchQuery.trim();
        setQuickCreateName(normalizedQuery);
        setQuickCreatePrice("");
        setQuickCreateWholesalePrice("");
        setQuickCreateInitialStock("1");
        setQuickCreateOpen(true);
    };

    const handleQuickCreateProduct = async () => {
        const normalizedName = quickCreateName.trim();
        const price = Number.parseFloat(quickCreatePrice);
        const wholesalePrice = Number.parseFloat(quickCreateWholesalePrice);
        const initialStock = Number.parseInt(quickCreateInitialStock, 10);

        if (!normalizedName) {
            return toast.error("Ingresá el nombre del producto");
        }

        if (Number.isNaN(price) || price <= 0) {
            return toast.error("Ingresá un precio de venta válido");
        }

        if (Number.isNaN(wholesalePrice) || wholesalePrice <= 0) {
            return toast.error("Ingresá un precio mayorista válido");
        }

        if (Number.isNaN(initialStock) || initialStock < 0) {
            return toast.error("Ingresá un stock inicial válido");
        }

        setIsQuickCreating(true);
        try {
            const createdProduct = await posMutations.createQuickProductWithStock({
                name: normalizedName,
                price,
                wholesalePrice,
                initialStock,
                creatorUserId: selectedSellerId || undefined,
            });
            const quickCreatedProduct: POSProduct = {
                id: createdProduct.variantId,
                code: createdProduct.sku,
                name: normalizedName,
                price,
                wholesalePrice,
                stock: initialStock,
                sizes: ["Único"],
                color: "Único",
                productId: createdProduct.id,
                legacyBarcodes: [],
            };

            setAllProducts((currentProducts) =>
                upsertProduct(currentProducts, quickCreatedProduct)
            );
            const reloadedProducts = await posDataSource.getProducts();
            setAllProducts(
                reloadedProducts.some((product) => product.id === createdProduct.variantId)
                    ? reloadedProducts
                    : upsertProduct(reloadedProducts, quickCreatedProduct)
            );
            notifyDataUpdated([
                CACHE_TAGS.inventory,
                CACHE_TAGS.stock,
                CACHE_TAGS.posProducts,
                CACHE_TAGS.quickCreations,
            ]);
            setSearchQuery(normalizedName);
            setQuickCreateOpen(false);
            toast.success(
                createdProduct.pendingReview
                    ? "Producto creado y enviado a revisión"
                    : "Producto creado con éxito"
            );
            setTimeout(() => searchInputRef.current?.focus(), 10);
        } catch (error) {
            console.error("Quick create product failed:", error);
            toast.error("No se pudo crear el producto");
        } finally {
            setIsQuickCreating(false);
        }
    };

    return (
        <>
            <div className="print:hidden p-4 sm:p-5 lg:p-6">
                <div className="flex w-full flex-col gap-5">
                    {/* <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#059669_0%,#065f46_100%)] px-3 py-1 text-xs font-medium text-emerald-50 shadow-[0_12px_24px_-18px_rgba(6,95,70,0.8)]">
                                <span className="size-2 rounded-full bg-emerald-100" />
                                Terminal activa
                            </div>
                            <h1 className="text-2xl font-semibold tracking-[-0.05em] sm:text-3xl">
                                Nueva venta
                            </h1>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <div className="rounded-2xl bg-[linear-gradient(135deg,#6d28d9_0%,#4338ca_100%)] px-4 py-2 text-xs font-medium text-white">
                                {allProducts.length} productos
                            </div>
                            <div className="rounded-2xl bg-[linear-gradient(135deg,#059669_0%,#065f46_100%)] px-4 py-2 text-xs font-medium text-emerald-50">
                                {totalItems} en carrito
                            </div>
                            <div className="rounded-2xl bg-[linear-gradient(135deg,#ea580c_0%,#c2410c_100%)] px-4 py-2 text-xs font-medium text-orange-50">
                                {priceMode === "wholesale" ? "Modo mayorista" : "Modo venta"}
                            </div>
                        </div>
                    </div> */}

                    <div className="rounded-[1.35rem] border border-border/70 bg-card/80 p-2 shadow-[0_16px_40px_-34px_rgba(0,0,0,0.45)] dark:border-white/10 dark:bg-slate-950/35">
                        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
                            {draftTabSummaries.map((draft) => {
                                const isActive = draft.id === activeDraft.id;

                                return (
                                    <div
                                        key={draft.id}
                                        className={cn(
                                            "group flex min-w-[155px] items-center gap-2 rounded-2xl border px-3 py-2 transition-colors",
                                            isActive
                                                ? "border-emerald-500/70 bg-emerald-50 text-emerald-950 shadow-[0_14px_28px_-24px_rgba(5,150,105,0.55)] dark:border-emerald-400/45 dark:bg-emerald-950/45 dark:text-emerald-50"
                                                : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted dark:bg-slate-900/70 dark:hover:bg-slate-800"
                                        )}
                                    >
                                        <button
                                            type="button"
                                            className="min-w-0 flex-1 text-left"
                                            onClick={() => handleSwitchDraftTab(draft.id)}
                                        >
                                            <span className="block truncate text-sm font-semibold">
                                                {draft.label}
                                            </span>
                                            <span className="mt-0.5 block truncate text-xs">
                                                {draft.itemCount} art. · {formatCurrency(draft.total)}
                                                {draft.hasExchange ? " · cambio" : ""}
                                            </span>
                                        </button>
                                        {draftTabs.drafts.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                className={cn(
                                                    "shrink-0 rounded-xl opacity-70 hover:opacity-100",
                                                    isActive
                                                        ? "text-emerald-900 hover:bg-emerald-100 dark:text-emerald-50 dark:hover:bg-emerald-900/70"
                                                        : "text-muted-foreground hover:text-destructive"
                                                )}
                                                onClick={() => handleCloseDraftTab(draft.id)}
                                                title={`Cerrar ${draft.label}`}
                                            >
                                                <X className="size-3.5" />
                                            </Button>
                                        )}
                                    </div>
                                );
                            })}
                            {draftTabs.drafts.length < MAX_SALE_DRAFT_TABS && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-[58px] w-12 shrink-0 rounded-2xl border-border/70 bg-background/85"
                                    onClick={handleCreateDraftTab}
                                    title="Nueva venta"
                                    aria-label="Nueva venta"
                                >
                                    <Plus className="size-4" />
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="items-start gap-5 min-[1400px]:grid min-[1400px]:grid-cols-[minmax(0,1fr)_380px]">
                        <div className="min-w-0">
                            <Card className="overflow-hidden rounded-[1.75rem] border-border/70 bg-card/90 shadow-[0_20px_56px_-36px_rgba(0,0,0,0.35)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.94),rgba(15,23,42,0.96))] dark:shadow-[0_28px_70px_-40px_rgba(0,0,0,0.78)]">
                                <CardContent className="flex min-w-0 flex-col p-5 sm:p-6">
                                    <div className="mb-5 flex flex-col gap-3 xl:flex-row">
                                        <div ref={searchBoxRef} className="relative min-w-0 flex-1">
                                            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                ref={searchInputRef}
                                                type="text"
                                                placeholder="Escanear codigo o buscar por nombre..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                onFocus={() => setIsSearchFocused(true)}
                                                onBlur={() => setIsSearchFocused(false)}
                                                onKeyDown={handleSearchKeyDown}
                                                className="h-12 rounded-2xl border-border/70 bg-background/85 pl-11 text-base"
                                                autoFocus
                                            />
                                            {isSearchFocused && searchSuggestions.length > 0 && (
                                                <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-2xl border border-border/70 bg-background shadow-[0_22px_44px_-26px_rgba(0,0,0,0.45)] dark:border-white/10 dark:bg-slate-950">
                                                    {searchSuggestions.map((product) => (
                                                        <button
                                                            key={product.id}
                                                            type="button"
                                                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/70"
                                                            onMouseDown={(event) => {
                                                                event.preventDefault();
                                                                addToCart(product);
                                                                setSearchQuery("");
                                                                setTimeout(() => searchInputRef.current?.focus(), 10);
                                                            }}
                                                        >
                                                            <span className="min-w-0">
                                                                <span className="block truncate text-sm font-semibold text-foreground">
                                                                    {product.name}
                                                                </span>
                                                                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                                                    {product.code}
                                                                    {product.color && ` · ${product.color}`}
                                                                </span>
                                                            </span>
                                                            <span className="shrink-0 text-right text-xs">
                                                                <span className="block font-semibold text-foreground">
                                                                    Venta: {formatCurrency(product.price)}
                                                                </span>
                                                                <span className="mt-0.5 block font-semibold text-blue-600">
                                                                    Mayorista: {formatCurrency(product.wholesalePrice)}
                                                                </span>
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                variant="outline"
                                                className="h-12 rounded-2xl border-border/70 bg-background/85 px-4"
                                                onClick={handleOpenExchangeDialog}
                                            >
                                                <RotateCcw className="size-4" />
                                                Cambio
                                            </Button>
                                            {searchQuery.trim() && filteredProducts.length === 0 && (
                                                <Button
                                                    className="h-12 rounded-2xl bg-[linear-gradient(135deg,#1f2937_0%,#334155_100%)] px-4 text-white shadow-[0_18px_30px_-24px_rgba(15,23,42,0.72)] hover:opacity-95 dark:bg-[linear-gradient(135deg,rgba(51,65,85,0.98),rgba(30,41,59,0.98))] dark:text-slate-50 dark:shadow-[0_20px_34px_-24px_rgba(0,0,0,0.85)]"
                                                    onClick={openQuickCreateDialog}
                                                >
                                                    <Plus className="size-4" />
                                                    Crear rapido
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    <ScrollArea className="max-w-full overflow-hidden min-[1400px]:max-h-[calc(100vh-16rem)]">
                                        {isLoadingProducts ? (
                                            <div className="flex flex-col items-center justify-center py-24 text-center">
                                                <Loader2 className="mb-3 size-10 animate-spin text-muted-foreground" />
                                                <p className="text-lg font-medium text-muted-foreground">
                                                    Cargando venta
                                                </p>
                                            </div>
                                        ) : productsError ? (
                                            <div className="flex flex-col items-center justify-center py-24 text-center">
                                                <Search className="mb-3 size-12 text-muted-foreground/35" />
                                                <p className="text-lg font-medium text-muted-foreground">
                                                    {productsError}
                                                </p>
                                                <p className="text-sm text-muted-foreground/70">
                                                    Verificá la conexión con la base de datos
                                                </p>
                                            </div>
                                        ) : cart.length === 0 && !appliedExchange ? (
                                            <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-center">
                                                <div className="flex size-14 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#f5f5f7_0%,#ebebf0_100%)] text-2xl dark:bg-[linear-gradient(135deg,rgba(51,65,85,0.9),rgba(30,41,59,0.96))] dark:text-slate-50">
                                                    🛒
                                                </div>
                                                <p className="text-base font-medium text-muted-foreground">
                                                    El carrito está vacío
                                                </p>
                                                <p className="text-sm text-muted-foreground/70">
                                                    Escaneá o buscá productos para sumarlos a la venta.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-3 pr-2 lg:grid-cols-2">
                                                {appliedExchange?.items.map((item) => (
                                                    <div
                                                        key={item.saleItemId}
                                                        className="flex h-[130px] flex-col justify-between rounded-[1.4rem] border border-rose-300/75 bg-[linear-gradient(135deg,rgba(255,241,242,0.98),rgba(255,228,230,0.92))] p-4 text-rose-900 shadow-[0_18px_30px_-24px_rgba(225,29,72,0.25)] dark:border-rose-400/35 dark:bg-[linear-gradient(135deg,rgba(76,5,25,0.92),rgba(136,19,55,0.52))] dark:text-rose-100"
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0 flex-1">
                                                                <p className="truncate text-sm font-semibold">
                                                                    {item.label}
                                                                </p>
                                                                <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">
                                                                    Crédito por cambio
                                                                </p>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon-sm"
                                                                className="shrink-0 rounded-xl text-rose-600 hover:bg-rose-200/60 hover:text-rose-800 dark:text-rose-300 dark:hover:bg-rose-400/15 dark:hover:text-rose-100"
                                                                onClick={() => handleRemoveExchangeItem(item.saleItemId)}
                                                                title="Quitar del cambio"
                                                            >
                                                                <Trash2 className="size-3.5" />
                                                            </Button>
                                                        </div>

                                                        <div className="flex items-center justify-between gap-3">
                                                            <p className="text-xs text-rose-600/80 dark:text-rose-300/80">
                                                                Cambio aplicado
                                                            </p>
                                                            <span className="text-sm font-bold text-rose-700 dark:text-rose-200">
                                                                -{formatCurrency(item.amount)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}

                                                {cart.map((item) => (
                                                    <div
                                                        key={item.lineId}
                                                        className={cn(
                                                            "group flex h-[130px] flex-col justify-between rounded-[1.4rem] border border-border/70 bg-background/85 p-4 transition-colors",
                                                            item.isGift &&
                                                            "border-amber-300/80 bg-[linear-gradient(135deg,rgba(254,243,199,0.98),rgba(253,230,138,0.72))] shadow-[0_18px_32px_-24px_rgba(217,119,6,0.5)] dark:border-amber-300/45 dark:bg-[linear-gradient(135deg,rgba(120,53,15,0.82),rgba(245,158,11,0.24))] dark:shadow-[0_20px_36px_-24px_rgba(251,191,36,0.4)]"
                                                        )}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className="min-w-0 flex-1">
                                                                <p className="truncate text-sm font-semibold">
                                                                    {item.product.name}
                                                                </p>
                                                                <div className="mt-1 space-y-0.5 text-xs">
                                                                    <p className="text-muted-foreground">
                                                                        Venta: {formatCurrency(item.product.price)} c/u
                                                                    </p>
                                                                    <p className="font-medium text-blue-600">
                                                                        Mayorista: {formatCurrency(item.product.wholesalePrice)} c/u
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <Button
                                                                variant="ghost"
                                                                size="icon-sm"
                                                                className={cn(
                                                                    "shrink-0 rounded-xl",
                                                                    item.isGift
                                                                        ? "bg-amber-100 text-amber-800 hover:bg-amber-200 hover:text-amber-900 dark:bg-amber-400/15 dark:text-amber-200 dark:hover:bg-amber-400/25 dark:hover:text-amber-100"
                                                                        : "text-muted-foreground hover:text-amber-700 dark:hover:text-amber-300"
                                                                )}
                                                                onClick={() => toggleGiftItem(item.lineId)}
                                                                title={item.isGift ? "Quitar regalo" : "Marcar como regalo"}
                                                            >
                                                                <Gift className="size-3.5" />
                                                            </Button>
                                                        </div>

                                                        <div className="flex items-center justify-between gap-3">
                                                            <div className="flex items-center gap-1">
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon-sm"
                                                                    className="rounded-xl"
                                                                    onClick={() =>
                                                                        updateQuantity(item.lineId, -1)
                                                                    }
                                                                >
                                                                    <Minus className="size-3.5" />
                                                                </Button>
                                                                <span className="w-8 text-center text-sm font-semibold">
                                                                    {item.quantity}
                                                                </span>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon-sm"
                                                                    className="rounded-xl"
                                                                    onClick={() =>
                                                                        updateQuantity(item.lineId, +1)
                                                                    }
                                                                >
                                                                    <Plus className="size-3.5" />
                                                                </Button>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-bold">
                                                                    {formatCurrency(
                                                                        getUnitPrice(item.product) * item.quantity
                                                                    )}
                                                                </span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon-sm"
                                                                    className="rounded-xl text-muted-foreground hover:text-destructive"
                                                                    onClick={() =>
                                                                        removeFromCart(item.lineId)
                                                                    }
                                                                >
                                                                    <Trash2 className="size-3.5" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="min-w-0 min-[1400px]:sticky min-[1400px]:top-5">
                            <Card className="rounded-[1.75rem] border-border/70 bg-card/90 shadow-[0_20px_56px_-36px_rgba(0,0,0,0.35)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.94),rgba(15,23,42,0.96))] dark:shadow-[0_28px_70px_-40px_rgba(0,0,0,0.78)]">
                                <CardContent className="flex flex-col p-5 sm:p-6">
                                    <div className="mb-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <ShoppingBag className="size-5 text-muted-foreground" />
                                            <h2 className="text-lg font-semibold">Orden actual</h2>
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
                                                className="rounded-xl text-muted-foreground hover:text-destructive"
                                                onClick={clearCart}
                                            >
                                                Vaciar
                                            </Button>
                                        )}
                                    </div>

                                    <div className="mb-2 grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setPriceMode("retail")}
                                            className={cn(
                                                "cursor-pointer rounded-2xl px-3 py-3 text-sm font-medium transition-all",
                                                priceMode === "retail"
                                                    ? "bg-[linear-gradient(135deg,#1c1c28_0%,#3f3f50_100%)] text-white dark:bg-[linear-gradient(135deg,rgba(51,65,85,0.98),rgba(30,41,59,0.98))] dark:text-slate-50 dark:shadow-[0_18px_32px_-24px_rgba(0,0,0,0.8)]"
                                                    : "bg-muted text-muted-foreground dark:bg-slate-800/70 dark:text-slate-300"
                                            )}
                                        >
                                            Precio venta
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPriceMode("wholesale")}
                                            className={cn(
                                                "cursor-pointer rounded-2xl px-3 py-3 text-sm font-medium transition-all",
                                                priceMode === "wholesale"
                                                    ? "bg-[linear-gradient(135deg,#2563eb_0%,#93c5fd_100%)] text-white dark:bg-[linear-gradient(135deg,rgba(37,99,235,0.92),rgba(30,64,175,0.92))] dark:text-sky-50 dark:shadow-[0_18px_32px_-24px_rgba(37,99,235,0.55)]"
                                                    : "bg-muted text-muted-foreground dark:bg-slate-800/70 dark:text-slate-300"
                                            )}
                                        >
                                            Mayorista
                                        </button>
                                    </div>

                                    <div className="mt-2 shrink-0 space-y-3 border-t border-border/70 bg-card/90 pt-3 dark:border-white/10 dark:bg-transparent">
                                        <div className="space-y-2">
                                            <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                                <UserCircle className="size-3.5" />
                                                Vendedor
                                            </Label>
                                            <Select
                                                value={selectedSellerId}
                                                open={sellerSelectOpen}
                                                onOpenChange={setSellerSelectOpen}
                                                onValueChange={setSelectedSellerId}
                                            >
                                                <SelectTrigger
                                                    ref={sellerSelectTriggerRef}
                                                    className="h-11 rounded-2xl bg-background/85"
                                                >
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

                                        <div className="space-y-2 rounded-[1.5rem] bg-muted/55 p-4 dark:bg-[linear-gradient(180deg,rgba(51,65,85,0.32),rgba(30,41,59,0.42))]">
                                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                                                <span>Items</span>
                                                <span>{totalItems}</span>
                                            </div>
                                            {appliedExchange && (
                                                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 rounded-xl bg-[linear-gradient(135deg,rgba(255,241,242,0.95),rgba(255,228,230,0.82))] px-3 py-2 text-sm text-rose-700 dark:bg-[linear-gradient(135deg,rgba(76,5,25,0.58),rgba(136,19,55,0.28))] dark:text-rose-100">
                                                    <div className="min-w-0">
                                                        <span className="font-medium">
                                                            Crédito por cambio
                                                        </span>
                                                        <div className="h-4 overflow-hidden pt-0.5 text-[11px] text-rose-600 dark:text-rose-300">
                                                            <button
                                                                type="button"
                                                                className="truncate font-medium underline decoration-rose-400/70 underline-offset-2 hover:text-rose-700 dark:hover:text-rose-200"
                                                                onClick={() => setExchangeDialogOpen(true)}
                                                            >
                                                                Boleta #{appliedExchange.ticketNumber.toString().padStart(5, "0")} · {appliedExchange.items.length} producto(s) · Ver detalle
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <span className="whitespace-nowrap text-right font-bold text-rose-700 dark:text-rose-100">
                                                        -{formatCurrency(exchangeCredit)}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between border-t border-border/70 pt-3">
                                                <div>
                                                    <p className="text-sm font-medium text-muted-foreground">
                                                        Total a cobrar
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {priceMode === "wholesale"
                                                            ? "Usando precio mayorista"
                                                            : "Usando precio de venta"}
                                                    </p>
                                                    <div className="h-4 overflow-hidden">
                                                        {hasExchangeOverage && (
                                                            <p className="mt-1 text-xs text-rose-600">
                                                                El cambio supera la nueva venta.
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="text-3xl font-bold tracking-tight">
                                                    {formatCurrency(appliedExchange ? balanceAmount : payableAmount)}
                                                </span>
                                            </div>
                                        </div>

                                        <Button
                                            size="lg"
                                            className="h-14 w-full rounded-2xl bg-[linear-gradient(135deg,#1c1c28_0%,#3f3f50_100%)] text-base font-semibold text-white shadow-[0_20px_36px_-22px_rgba(0,0,0,0.8)] hover:opacity-95 dark:bg-[linear-gradient(135deg,rgba(51,65,85,0.98),rgba(30,41,59,0.98))] dark:text-slate-50 dark:shadow-[0_24px_40px_-24px_rgba(0,0,0,0.88)]"
                                            disabled={(cart.length === 0 && !appliedExchange) || !selectedSellerId}
                                            onClick={() =>
                                                shouldFinalizeExchangeDirectly
                                                    ? void handleDirectExchangeCheckout()
                                                    : setCheckoutOpen(true)
                                            }
                                        >
                                            {shouldFinalizeExchangeDirectly
                                                ? "Finalizar cambio"
                                                : `Cobrar ${formatCurrency(payableAmount)}`}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
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
                sales={exchangeSales}
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

            <Dialog open={quickCreateOpen} onOpenChange={setQuickCreateOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Creación rápida de producto</DialogTitle>
                        <DialogDescription>
                            Alta mínima para seguir trabajando desde venta. Después podés completar stock o variantes desde inventario.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="quick-create-name">Nombre del producto</Label>
                            <Input
                                id="quick-create-name"
                                value={quickCreateName}
                                onChange={(event) => setQuickCreateName(event.target.value)}
                                placeholder="Ej: Remera básica"
                                autoFocus
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="quick-create-price">Precio de venta</Label>
                            <Input
                                id="quick-create-price"
                                type="number"
                                min="0"
                                step="0.01"
                                value={quickCreatePrice}
                                onChange={(event) => setQuickCreatePrice(event.target.value)}
                                placeholder="Ej: 24990"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="quick-create-wholesale-price">Precio mayorista</Label>
                            <Input
                                id="quick-create-wholesale-price"
                                type="number"
                                min="0"
                                step="0.01"
                                value={quickCreateWholesalePrice}
                                onChange={(event) => setQuickCreateWholesalePrice(event.target.value)}
                                placeholder="Ej: 19990"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="quick-create-initial-stock">Stock inicial</Label>
                            <Input
                                id="quick-create-initial-stock"
                                type="number"
                                min="0"
                                step="1"
                                value={quickCreateInitialStock}
                                onChange={(event) => setQuickCreateInitialStock(event.target.value)}
                                placeholder="Ej: 1"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setQuickCreateOpen(false)}
                            disabled={isQuickCreating}
                        >
                            Cancelar
                        </Button>
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={handleQuickCreateProduct}
                            disabled={isQuickCreating}
                        >
                            {isQuickCreating && <Loader2 className="mr-2 size-4 animate-spin" />}
                            Crear producto
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(draftIdPendingClose)}
                onOpenChange={(open) => {
                    if (!open) {
                        setDraftIdPendingClose(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Cerrar {draftPendingClose?.label ?? "venta"}</DialogTitle>
                        <DialogDescription>
                            Este borrador tiene datos cargados. Si cerrás la pestaña, se perderá
                            esta venta en preparación.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="rounded-[1.25rem] border border-border/70 bg-muted/45 p-4">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Artículos</span>
                            <span className="font-semibold">{pendingCloseItemCount}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Total parcial</span>
                            <span className="font-semibold">{formatCurrency(pendingCloseTotal)}</span>
                        </div>
                        {draftPendingClose?.appliedExchange && (
                            <div className="mt-2 flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Cambio aplicado</span>
                                <span className="font-semibold text-rose-600">Sí</span>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDraftIdPendingClose(null)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={() => {
                                if (draftIdPendingClose) {
                                    closeDraftTab(draftIdPendingClose);
                                }
                            }}
                        >
                            Cerrar borrador
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
    const [referenceNow] = useState(() => new Date().toISOString());

    const formatDaysSinceSale = (saleDate: string) => {
        const saleTime = new Date(saleDate).getTime();
        const diffMs = new Date(referenceNow).getTime() - saleTime;
        const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

        if (diffDays === 0) return "Hoy";
        if (diffDays === 1) return "Hace 1 día";
        return `Hace ${diffDays} días`;
    };

    const clampExchangeQuantity = (rawValue: string, max: number) => {
        if (rawValue.trim() === "") return "";

        const parsed = Number.parseInt(rawValue, 10);
        if (Number.isNaN(parsed)) return "";

        return String(Math.max(0, Math.min(parsed, max)));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-hidden border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_28px_90px_-40px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(17,24,39,0.98))] dark:shadow-[0_32px_100px_-36px_rgba(0,0,0,0.8)] sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <ReceiptText className="size-5" />
                        Aplicar Cambio
                    </DialogTitle>
                    <DialogDescription className="text-sm leading-6 text-muted-foreground dark:text-slate-300">
                        Buscá una boleta, elegí los productos a cambiar y aplicá el crédito.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <div className="space-y-3">
                        <div className="rounded-[1.2rem] border border-sky-200/70 bg-[linear-gradient(135deg,rgba(239,246,255,0.95),rgba(224,242,254,0.7))] px-4 py-3 text-sm text-sky-900 dark:border-sky-400/20 dark:bg-[linear-gradient(135deg,rgba(8,47,73,0.92),rgba(14,116,144,0.24))] dark:text-sky-100">
                            <p className="font-semibold">1. Elegí la boleta</p>
                            <p className="mt-1 text-xs leading-5 text-sky-800/80 dark:text-sky-100/75">
                                Podés escanear el número o buscarlo manualmente.
                            </p>
                        </div>
                        <Input
                            ref={searchInputRef}
                            placeholder="Escanear o buscar N° de boleta..."
                            value={searchQuery}
                            onChange={(event) => onSearchQueryChange(event.target.value)}
                            className="border-border/70 bg-background/90 dark:border-white/10 dark:bg-slate-950/65 dark:text-slate-100 dark:placeholder:text-slate-400"
                        />

                        <div className="max-h-[52vh] space-y-2 overflow-y-auto rounded-[1.25rem] border border-border/70 bg-background/65 p-2 dark:border-white/10 dark:bg-slate-950/45">
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
                                            "w-full rounded-xl border px-3 py-2 text-left transition-colors",
                                            selectedSale?.id === sale.id
                                                ? "border-emerald-500/80 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(209,250,229,0.78))] shadow-[0_14px_26px_-24px_rgba(5,150,105,0.45)] dark:border-emerald-400/45 dark:bg-[linear-gradient(135deg,rgba(6,78,59,0.88),rgba(5,150,105,0.2))] dark:text-emerald-50"
                                                : "hover:border-muted-foreground/30 hover:bg-muted/40 dark:hover:border-white/15 dark:hover:bg-white/6"
                                        )}
                                        onClick={() => onSelectSale(sale)}
                                    >
                                        <p className="font-semibold">
                                            Boleta #{sale.ticketNumber.toString().padStart(5, "0")}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {formatArgentinaShortDate(sale.date)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {sale.items.length} item(s)
                                        </p>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="rounded-[1.35rem] border border-border/70 bg-background/65 dark:border-white/10 dark:bg-slate-950/40">
                        {!selectedSale ? (
                            <div className="flex h-full min-h-[260px] items-center justify-center p-6 text-center text-sm text-muted-foreground dark:text-slate-300">
                                Seleccioná una boleta a la izquierda para cargar los productos disponibles para cambio.
                            </div>
                        ) : (
                            <div className="flex h-full flex-col">
                                <div className="border-b border-border/70 p-4 dark:border-white/10">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <p className="font-semibold">
                                            Boleta #{selectedSale.ticketNumber.toString().padStart(5, "0")}
                                        </p>
                                        <div className="rounded-2xl border border-amber-300/80 bg-[linear-gradient(135deg,rgba(254,243,199,0.98),rgba(253,230,138,0.72))] px-3 py-2 text-right text-amber-900 shadow-[0_18px_32px_-24px_rgba(217,119,6,0.5)] dark:border-amber-300/45 dark:bg-[linear-gradient(135deg,rgba(120,53,15,0.82),rgba(245,158,11,0.24))] dark:text-amber-100 dark:shadow-[0_20px_36px_-24px_rgba(251,191,36,0.4)]">
                                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">
                                                Antigüedad
                                            </p>
                                            <p className="text-sm font-bold leading-none">
                                                {formatDaysSinceSale(selectedSale.date)}
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground dark:text-slate-300">
                                        {selectedSale.sellerName} · {formatArgentinaDateTime(selectedSale.date)}
                                    </p>
                                </div>
                                <div className="rounded-[1.1rem] border border-dashed border-rose-200/70 bg-[linear-gradient(135deg,rgba(255,241,242,0.88),rgba(255,255,255,0.4))] px-4 py-3 text-sm text-rose-900 dark:border-rose-400/20 dark:bg-[linear-gradient(135deg,rgba(76,5,25,0.52),rgba(15,23,42,0.18))] dark:text-rose-100">
                                    <p className="font-semibold">2. Marcá cantidades a devolver</p>
                                    <p className="mt-1 text-xs leading-5 text-rose-800/80 dark:text-rose-100/75">
                                        Sólo podés cargar hasta la cantidad disponible de cada producto en la boleta.
                                    </p>
                                </div>
                                <div className="max-h-[44vh] space-y-2 overflow-y-auto p-4">
                                    {selectedSale.items.map((item) => {
                                        const availableQuantity = item.quantity - item.returnedQuantity;
                                        const value = exchangeQuantities[item.id] ?? "";

                                        return (
                                            <div
                                                key={item.id}
                                                className="grid gap-3 rounded-xl border border-border/70 bg-background/85 p-3 dark:border-white/10 dark:bg-slate-900/55 sm:grid-cols-[minmax(0,1fr)_100px]"
                                            >
                                                <div>
                                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="font-medium">{item.productName}</p>
                                                    <p className="text-xs text-muted-foreground dark:text-slate-300">
                                                        {item.size !== "Único" ? `Talle ${item.size} · ` : ""}
                                                        {item.color}
                                                    </p>
                                                        </div>
                                                        <div
                                                            className={cn(
                                                                "shrink-0 rounded-2xl px-3 py-2 shadow-sm",
                                                                availableQuantity > 0
                                                                    ? "border border-emerald-300/60 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(209,250,229,0.82))] text-emerald-900 dark:border-emerald-400/25 dark:bg-[linear-gradient(135deg,rgba(6,78,59,0.72),rgba(5,150,105,0.18))] dark:text-emerald-50"
                                                                    : "border border-rose-300/60 bg-[linear-gradient(135deg,rgba(255,241,242,0.98),rgba(255,228,230,0.82))] text-rose-900 dark:border-rose-400/25 dark:bg-[linear-gradient(135deg,rgba(76,5,25,0.72),rgba(190,24,93,0.16))] dark:text-rose-100"
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-4">
                                                                <div className="text-right">
                                                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">
                                                                        Máximo
                                                                    </p>
                                                                    <p className="text-xl font-bold leading-none">
                                                                        {availableQuantity}
                                                                    </p>
                                                                </div>
                                                                <div className="h-8 w-px bg-current/15" />
                                                                <div className="text-right">
                                                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-80">
                                                                        Precio c/u
                                                                    </p>
                                                                    <p className="text-sm font-semibold leading-none">
                                                                        {formatCurrency(item.priceAtTime)}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={availableQuantity}
                                                    disabled={availableQuantity === 0}
                                                    value={value}
                                                    className="border-border/70 bg-background/90 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-100"
                                                    onChange={(event) =>
                                                        onQuantityChange(
                                                            item.id,
                                                            clampExchangeQuantity(
                                                                event.target.value,
                                                                availableQuantity
                                                            )
                                                        )
                                                    }
                                                />
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="border-t border-border/70 p-4 dark:border-white/10">
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
