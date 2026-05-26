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
    Check,
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
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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
    giftGroupLabel?: string;
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
    manualGiftGroupingActive: boolean;
    manualGiftSelectedLineIds: string[];
    manualGiftTargetGroupLabel: string | null;
    nextGiftGroupNumber: number;
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
        manualGiftGroupingActive: false,
        manualGiftSelectedLineIds: [],
        manualGiftTargetGroupLabel: null,
        nextGiftGroupNumber: 1,
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
        !draft.manualGiftGroupingActive &&
        draft.manualGiftSelectedLineIds.length === 0 &&
        !draft.manualGiftTargetGroupLabel &&
        draft.nextGiftGroupNumber === 1 &&
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

function AnimatedValue({
    value,
    children,
    className,
}: {
    value: string | number;
    children?: React.ReactNode;
    className?: string;
}) {
    return (
        <span className={cn("inline-block tabular-nums", className)}>
            <span key={String(value)} className="inline-block animate-pos-value-change">
                {children ?? value}
            </span>
        </span>
    );
}

function AnimatedSizeContainer({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    const contentRef = useRef<HTMLDivElement | null>(null);
    const [height, setHeight] = useState<number | null>(null);

    useEffect(() => {
        const content = contentRef.current;
        if (!content) return;

        const resizeObserver = new ResizeObserver(([entry]) => {
            if (!entry) return;
            setHeight(entry.contentRect.height);
        });

        resizeObserver.observe(content);

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    return (
        <div
            className={cn(
                "overflow-hidden transition-[height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                className
            )}
            style={height == null ? undefined : { height }}
        >
            <div ref={contentRef}>{children}</div>
        </div>
    );
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

function getGiftGroupLabelMap(cart: CartItem[]) {
    const labelMap = new Map<string, string>();

    for (const item of cart) {
        if (!item.giftGroupLabel || labelMap.has(item.giftGroupLabel)) {
            continue;
        }

        labelMap.set(item.giftGroupLabel, `Regalo ${labelMap.size + 1}`);
    }

    return labelMap;
}

function normalizeGiftGroupLabels(cart: CartItem[]): CartItem[] {
    const labelMap = getGiftGroupLabelMap(cart);

    return cart.map((item) => {
        if (!item.giftGroupLabel) {
            return item.isGift ? { ...item, isGift: false } : item;
        }

        const normalizedLabel = labelMap.get(item.giftGroupLabel) ?? item.giftGroupLabel;

        if (item.giftGroupLabel === normalizedLabel && item.isGift) {
            return item;
        }

        return {
            ...item,
            isGift: true,
            giftGroupLabel: normalizedLabel,
        };
    });
}

function getNextGiftGroupNumber(cart: CartItem[]) {
    return new Set(cart.map((item) => item.giftGroupLabel).filter(Boolean)).size + 1;
}

function mergeGiftGroupItems(cart: CartItem[]): CartItem[] {
    const mergedCart: CartItem[] = [];

    for (const item of cart) {
        if (!item.giftGroupLabel) {
            mergedCart.push({ ...item });
            continue;
        }

        const existingGiftItem = mergedCart.find(
            (currentItem) =>
                currentItem.giftGroupLabel === item.giftGroupLabel &&
                currentItem.product.id === item.product.id
        );

        if (existingGiftItem) {
            existingGiftItem.quantity = existingGiftItem.quantity + item.quantity;
            continue;
        }

        mergedCart.push({ ...item });
    }

    return mergedCart;
}

function mergeUngroupedCartItems(cart: CartItem[]): CartItem[] {
    const mergedCart: CartItem[] = [];

    for (const item of cart) {
        if (item.giftGroupLabel) {
            mergedCart.push({ ...item });
            continue;
        }

        const existingCartItem = mergedCart.find(
            (currentItem) =>
                !currentItem.giftGroupLabel && currentItem.product.id === item.product.id
        );

        if (existingCartItem) {
            existingCartItem.quantity = existingCartItem.quantity + item.quantity;
            continue;
        }

        mergedCart.push({ ...item });
    }

    return mergedCart;
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
    const [activePrintGiftGroupIndex, setActivePrintGiftGroupIndex] = useState(0);
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
    const manualGiftGroupingActive = activeDraft.manualGiftGroupingActive;
    const manualGiftSelectedLineIds = activeDraft.manualGiftSelectedLineIds;
    const manualGiftTargetGroupLabel = activeDraft.manualGiftTargetGroupLabel;
    const nextGiftGroupNumber = activeDraft.nextGiftGroupNumber;
    const quickCreateOpen = activeDraft.quickCreateOpen;
    const quickCreateName = activeDraft.quickCreateName;
    const quickCreatePrice = activeDraft.quickCreatePrice;
    const quickCreateWholesalePrice = activeDraft.quickCreateWholesalePrice;
    const quickCreateInitialStock = activeDraft.quickCreateInitialStock;
    const setSearchQuery = useCallback(
        (action: SetStateAction<string>) => updateDraftField("searchQuery", action),
        [updateDraftField]
    );
    const setCart = useCallback((action: SetStateAction<CartItem[]>) => {
        setDraftTabs((currentTabs) => ({
            ...currentTabs,
            drafts: currentTabs.drafts.map((draft) => {
                if (draft.id !== currentTabs.activeDraftId) {
                    return draft;
                }

                const nextCartBeforeNormalize = applyStateAction(draft.cart, action);
                const giftGroupLabelMap = getGiftGroupLabelMap(nextCartBeforeNormalize);
                const nextCart = mergeGiftGroupItems(
                    normalizeGiftGroupLabels(nextCartBeforeNormalize)
                );
                const nextTargetGroupLabel = draft.manualGiftTargetGroupLabel
                    ? giftGroupLabelMap.get(draft.manualGiftTargetGroupLabel) ?? null
                    : null;

                return {
                    ...draft,
                    cart: nextCart,
                    manualGiftTargetGroupLabel: nextTargetGroupLabel,
                    nextGiftGroupNumber: getNextGiftGroupNumber(nextCart),
                    updatedAt: new Date().toISOString(),
                };
            }),
        }));
    }, []);
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
    const setManualGiftGroupingActive = useCallback(
        (action: SetStateAction<boolean>) => updateDraftField("manualGiftGroupingActive", action),
        [updateDraftField]
    );
    const setManualGiftSelectedLineIds = useCallback(
        (action: SetStateAction<string[]>) => updateDraftField("manualGiftSelectedLineIds", action),
        [updateDraftField]
    );
    const setManualGiftTargetGroupLabel = useCallback(
        (action: SetStateAction<string | null>) => updateDraftField("manualGiftTargetGroupLabel", action),
        [updateDraftField]
    );
    const setNextGiftGroupNumber = useCallback(
        (action: SetStateAction<number>) => updateDraftField("nextGiftGroupNumber", action),
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
                toast.error(`Podés tener hasta ${MAX_SALE_DRAFT_TABS} ventas abiertas`, {
                    id: "max-sale-draft-tabs",
                });
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
        setActivePrintGiftGroupIndex(0);
        setActivePrintIsGift(initialGiftCopy);

        setTimeout(() => {
            window.print();
        }, 350);
    };

    const triggerPrint = async (currentReceipt: ReceiptPrintData) => {
        const hasGiftCopy = Boolean(
            currentReceipt.giftGroups?.some((group) => group.items.length > 0) ||
            (currentReceipt.giftItems && currentReceipt.giftItems.length > 0)
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
            const printableGiftGroups =
                receiptData?.giftGroups?.filter((group) => group.items.length > 0) ?? [];
            const giftCopyCount =
                printableGiftGroups.length > 0
                    ? printableGiftGroups.length
                    : receiptData?.giftItems?.length
                        ? 1
                        : 0;

            if (printGiftCopy && !activePrintIsGift && giftCopyCount > 0) {
                setActivePrintIsGift(true);
                setActivePrintGiftGroupIndex(0);
                setTimeout(() => {
                    window.print();
                }, 250);
                return;
            }

            if (activePrintIsGift && activePrintGiftGroupIndex + 1 < giftCopyCount) {
                setActivePrintGiftGroupIndex((current) => current + 1);
                setTimeout(() => {
                    window.print();
                }, 250);
                return;
            }

            setPrintGiftCopy(false);
            setActivePrintIsGift(false);
            setActivePrintGiftGroupIndex(0);
            setReceiptData(null);
        };

        window.addEventListener("afterprint", handleAfterPrint);
        return () => {
            window.removeEventListener("afterprint", handleAfterPrint);
        };
    }, [activePrintGiftGroupIndex, activePrintIsGift, printGiftCopy, receiptData]);

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
                    id: `add-to-cart-no-stock-${product.id}`,
                });
                return prev;
            }

            if (quantityInCart >= availableStock) {
                toast.error("Sin stock suficiente", {
                    description: `Solo quedan ${availableStock} unidades disponibles de ${product.name}`,
                    id: `add-to-cart-insufficient-stock-${product.id}`,
                });
                return prev;
            }

            toast.success("Producto agregado", {
                description: product.name,
                duration: 1500,
                id: `add-to-cart-${product.id}`,
            });

            if (!manualGiftGroupingActive) {
                const existingCartItem = prev.find(
                    (item) => item.product.id === product.id && !item.giftGroupLabel
                );

                if (existingCartItem) {
                    return prev.map((item) =>
                        item.lineId === existingCartItem.lineId
                            ? { ...item, quantity: item.quantity + 1 }
                            : item
                    );
                }
            }

            return [...prev, createCartItem(product)];
        });
    };

    const increaseCartItemQuantity = (lineId: string) => {
        setCart((prev) =>
            prev.map((item) => {
                if (item.lineId !== lineId) return item;

                const availableStock = getAvailableStockForActiveDraft(item.product);
                const quantityInCart = prev.reduce(
                    (sum, cartItem) =>
                        cartItem.product.id === item.product.id
                            ? sum + cartItem.quantity
                            : sum,
                    0
                );

                if (quantityInCart >= availableStock) {
                    toast.error("Sin stock suficiente", {
                        description: `Solo quedan ${availableStock} unidades disponibles de ${item.product.name}`,
                        id: `increase-cart-insufficient-stock-${item.product.id}`,
                    });
                    return item;
                }

                return { ...item, quantity: item.quantity + 1 };
            })
        );
    };

    const decreaseCartItemQuantity = (lineId: string) => {
        let shouldRemoveLineFromSelection = false;

        setCart((prev) =>
            prev
                .map((item) => {
                    if (item.lineId !== lineId) return item;

                    const nextQuantity = item.quantity - 1;
                    if (nextQuantity <= 0) {
                        shouldRemoveLineFromSelection = true;
                        return null;
                    }

                    return { ...item, quantity: nextQuantity };
                })
                .filter(Boolean) as CartItem[]
        );

        if (shouldRemoveLineFromSelection) {
            setManualGiftSelectedLineIds((current) =>
                current.filter((selectedLineId) => selectedLineId !== lineId)
            );
        }
    };

    const decreaseGiftGroupItemQuantity = (lineId: string) => {
        setCart((prev) => {
            const giftItem = prev.find((item) => item.lineId === lineId);
            if (!giftItem?.giftGroupLabel) {
                return prev;
            }

            const nextCart = prev.map((item) => {
                if (item.lineId !== lineId) return item;

                if (item.quantity <= 1) {
                    return { ...item, isGift: false, giftGroupLabel: undefined };
                }

                return { ...item, quantity: item.quantity - 1 };
            });

            if (giftItem.quantity <= 1) {
                return nextCart;
            }

            return [...nextCart, createCartItem(giftItem.product, 1, false)];
        });
    };

    const removeFromCart = (lineId: string) => {
        setCart((prev) => prev.filter((item) => item.lineId !== lineId));
        setManualGiftSelectedLineIds((current) =>
            current.filter((selectedLineId) => selectedLineId !== lineId)
        );
        toast("Producto eliminado del carrito", { duration: 1500 });
    };

    const toggleManualGiftSelection = (lineId: string) => {
        setManualGiftSelectedLineIds((current) =>
            current.includes(lineId)
                ? current.filter((selectedLineId) => selectedLineId !== lineId)
                : [...current, lineId]
        );
    };

    const handleCreateGiftGroup = () => {
        const selectedLineIds = manualGiftSelectedLineIds.filter((lineId) =>
            cart.some((item) => item.lineId === lineId && !item.giftGroupLabel)
        );

        if (selectedLineIds.length === 0) {
            toast.error("Seleccioná productos sin grupo para crear un regalo");
            return;
        }

        const giftGroupLabel = manualGiftTargetGroupLabel ?? `Regalo ${nextGiftGroupNumber}`;
        setCart((prev) =>
            prev.map((item) =>
                selectedLineIds.includes(item.lineId)
                    ? { ...item, isGift: true, giftGroupLabel }
                    : item
            )
        );
        setManualGiftSelectedLineIds([]);
        setManualGiftTargetGroupLabel(null);
        toast.success(
            manualGiftTargetGroupLabel
                ? `Productos agregados a ${giftGroupLabel}`
                : `${giftGroupLabel} creado`
        );
    };

    const handleAddToGiftGroup = (giftGroupLabel: string) => {
        if (manualGiftTargetGroupLabel === giftGroupLabel) {
            setManualGiftTargetGroupLabel(null);
            setManualGiftSelectedLineIds([]);
            return;
        }

        setManualGiftGroupingActive(true);
        setManualGiftTargetGroupLabel(giftGroupLabel);
        setManualGiftSelectedLineIds([]);
        toast.info(`Seleccioná productos para agregar a ${giftGroupLabel}`);
    };

    const removeFromGiftGroup = (lineId: string) => {
        setCart((prev) =>
            prev.map((item) =>
                item.lineId === lineId
                    ? { ...item, isGift: false, giftGroupLabel: undefined }
                    : item
            )
        );
        setManualGiftSelectedLineIds((current) =>
            current.filter((selectedLineId) => selectedLineId !== lineId)
        );
    };

    const handleToggleGiftGrouping = () => {
        if (manualGiftGroupingActive) {
            setCart(mergeUngroupedCartItems);
            setManualGiftGroupingActive(false);
            setManualGiftSelectedLineIds([]);
            setManualGiftTargetGroupLabel(null);
            return;
        }

        setCart((prev) =>
            prev.flatMap((item) => {
                if (item.giftGroupLabel || item.quantity <= 1) {
                    return [item];
                }

                return Array.from({ length: item.quantity }, (_, index) =>
                    index === 0
                        ? { ...item, quantity: 1 }
                        : createCartItem(item.product, 1, false)
                );
            })
        );
        setManualGiftGroupingActive(true);
        setManualGiftSelectedLineIds([]);
        setManualGiftTargetGroupLabel(null);
        toast.info("Seleccioná los productos del carrito para crear grupos de regalo");
    };

    const clearCart = () => {
        setCart([]);
        setAppliedExchange(null);
        setManualGiftGroupingActive(false);
        setManualGiftSelectedLineIds([]);
        setManualGiftTargetGroupLabel(null);
        setNextGiftGroupNumber(1);
    };

    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const getUnitPrice = (product: POSProduct) =>
        priceMode === "wholesale" ? product.wholesalePrice : product.price;
    const totalAmount = cart.reduce(
        (sum, item) => sum + getUnitPrice(item.product) * item.quantity,
        0
    );
    const ungroupedCartItems = cart.filter((item) => !item.giftGroupLabel);
    const giftGroups = cart.reduce<Array<{ label: string; items: CartItem[] }>>((groups, item) => {
        if (!item.giftGroupLabel) return groups;

        const existingGroup = groups.find((group) => group.label === item.giftGroupLabel);
        if (existingGroup) {
            existingGroup.items.push(item);
            return groups;
        }

        return [...groups, { label: item.giftGroupLabel, items: [item] }];
    }, []);
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
            giftGroups: giftGroups.map((group) => ({
                label: group.label,
                items: group.items.map((item) => ({
                    name: item.product.name,
                    quantity: item.quantity,
                    price: getUnitPrice(item.product),
                    subtotal: getUnitPrice(item.product) * item.quantity,
                })),
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

                    <div className="rounded-2xl border border-border/60 bg-muted/30 p-1.5 shadow-sm dark:border-white/5 dark:bg-slate-950/20">
                        <ScrollArea className="w-full">
                            <div 
                                role="tablist" 
                                aria-label="Pestañas de venta"
                                className="flex min-w-max items-center gap-1.5 p-0.5"
                            >
                                {draftTabSummaries.map((draft) => {
                                    const isActive = draft.id === activeDraft.id;

                                    return (
                                        <div
                                            key={draft.id}
                                            role="presentation"
                                            className={cn(
                                                "group relative flex min-w-[140px] max-w-[200px] items-center gap-1.5 rounded-xl px-3 py-1.5 transition-all text-sm",
                                                isActive
                                                    ? "bg-background text-foreground shadow-sm ring-1 ring-border/50 dark:ring-white/10"
                                                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground dark:hover:bg-slate-900/50"
                                            )}
                                        >
                                            <button
                                                type="button"
                                                role="tab"
                                                aria-selected={isActive}
                                                className="min-w-0 flex-1 text-left outline-none"
                                                onClick={() => handleSwitchDraftTab(draft.id)}
                                            >
                                                <span className="block truncate font-medium">
                                                    {draft.label}
                                                </span>
                                                <span className={cn(
                                                    "mt-0.5 block truncate text-[11px] opacity-80 transition-colors",
                                                    isActive ? "text-muted-foreground" : "text-muted-foreground/80"
                                                )}>
                                                    <AnimatedValue value={`${draft.itemCount}-${draft.total}`}>
                                                        {draft.itemCount} art. · {formatCurrency(draft.total)}
                                                    </AnimatedValue>
                                                    {draft.hasExchange ? " · camb" : ""}
                                                </span>
                                            </button>
                                            
                                            {draftTabs.drafts.length > 1 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className={cn(
                                                        "h-6 w-6 shrink-0 rounded-md transition-all",
                                                        isActive
                                                            ? "opacity-60 hover:bg-destructive/10 hover:text-destructive hover:opacity-100 dark:hover:bg-destructive/20"
                                                            : "opacity-0 group-hover:opacity-60 hover:!bg-destructive/10 hover:!text-destructive group-hover:hover:opacity-100"
                                                    )}
                                                    onClick={() => handleCloseDraftTab(draft.id)}
                                                    title={`Cerrar ${draft.label}`}
                                                    aria-label={`Cerrar ${draft.label}`}
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })}

                                {draftTabs.drafts.length < MAX_SALE_DRAFT_TABS && (
                                    <div className="pl-1">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-10 w-10 shrink-0 rounded-xl text-muted-foreground transition-all hover:bg-background hover:text-foreground hover:shadow-sm ring-1 ring-transparent hover:ring-border/50 dark:hover:bg-slate-900/60"
                                            onClick={handleCreateDraftTab}
                                            title="Nueva venta"
                                            aria-label="Nueva venta"
                                        >
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                            <ScrollBar orientation="horizontal" className="hidden h-1.5 sm:flex" />
                        </ScrollArea>
                    </div>

                    <div className="items-start gap-5 min-[1400px]:grid min-[1400px]:grid-cols-[minmax(0,1fr)_380px]">
                        <div className="min-w-0">
                            <Card className="overflow-visible rounded-[1.75rem] border-border/70 bg-card/90 shadow-[0_20px_56px_-36px_rgba(0,0,0,0.35)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.94),rgba(15,23,42,0.96))] dark:shadow-[0_28px_70px_-40px_rgba(0,0,0,0.78)]">
                                <CardContent className="flex min-w-0 flex-col p-5 sm:p-6">
                                    <div className="relative z-30 mb-5 flex flex-col gap-3 xl:flex-row">
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
                                                <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-2xl border border-border/70 bg-background shadow-[0_22px_44px_-26px_rgba(0,0,0,0.45)] dark:border-white/10 dark:bg-slate-950">
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

                                    <ScrollArea className="relative max-w-full overflow-hidden min-[1400px]:max-h-[calc(100vh-16rem)]">
                                        <AnimatedSizeContainer>
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
                                            <div className={cn("space-y-3 pr-2", manualGiftGroupingActive && "pb-20")}>
                                                <div className="grid grid-cols-1 gap-3 transition-[gap,padding] duration-200 ease-out md:grid-cols-2 xl:grid-cols-3">
                                                    {appliedExchange?.items.map((item) => (
                                                        <div
                                                            key={item.saleItemId}
                                                            className="animate-pos-cart-card-in flex h-[130px] flex-col justify-between rounded-[22px] border border-rose-500/10 bg-white/90 p-4 text-rose-900 shadow-[0_18px_45px_-38px_rgba(0,0,0,0.55)] backdrop-blur dark:border-rose-300/15 dark:bg-white/8 dark:text-rose-100"
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

                                                    {giftGroups.map((group) => (
                                                        <div
                                                            key={group.label}
                                                            className={cn(
                                                                "animate-pos-cart-card-in relative overflow-hidden rounded-[22px] border border-amber-200/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,249,235,0.72))] shadow-[0_20px_48px_-38px_rgba(146,64,14,0.34)] backdrop-blur dark:border-amber-300/35 dark:bg-[linear-gradient(180deg,rgba(252,211,77,0.14),rgba(255,255,255,0.08))]",
                                                                manualGiftTargetGroupLabel === group.label &&
                                                                "border-amber-400/80 ring-2 ring-amber-400/35 dark:border-amber-300/55 dark:ring-amber-300/30"
                                                            )}
                                                        >
                                                            <span
                                                                className="absolute inset-x-0 top-0 h-1.5 bg-amber-400 dark:bg-amber-300"
                                                                aria-hidden="true"
                                                            />
                                                            <div className="flex items-center justify-between gap-3 border-b border-amber-200/60 bg-white/55 px-4 py-3 pt-4 dark:border-amber-300/20 dark:bg-amber-300/10">
                                                                <div className="flex min-w-0 items-center gap-3">
                                                                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-[0_12px_24px_-18px_rgba(217,119,6,0.7)] dark:bg-amber-300 dark:text-amber-950">
                                                                        <Gift className="size-4" />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className="flex min-w-0 items-center gap-2">
                                                                            <p className="truncate text-sm font-bold text-amber-950 dark:text-amber-50">
                                                                                {group.label}
                                                                            </p>
                                                                            {manualGiftTargetGroupLabel === group.label && (
                                                                                <Badge className="shrink-0 border-amber-300/50 bg-amber-50 px-2 py-0 text-[10px] text-amber-700 hover:bg-amber-50 dark:border-amber-300/25 dark:bg-amber-300/10 dark:text-amber-100">
                                                                                    Agregando
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                        <p className="mt-0.5 text-xs text-amber-900/55 dark:text-amber-100/65">
                                                                            {group.items.length} {group.items.length === 1 ? "producto" : "productos"}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex shrink-0 items-center gap-2">
                                                                    <span className="text-lg font-bold text-amber-800 dark:text-amber-100">
                                                                        <AnimatedValue
                                                                            value={`${priceMode}-${group.items
                                                                                .map((item) => `${item.lineId}:${item.quantity}`)
                                                                                .join("|")}`}
                                                                        >
                                                                            {formatCurrency(
                                                                                group.items.reduce(
                                                                                    (sum, item) => sum + getUnitPrice(item.product) * item.quantity,
                                                                                    0
                                                                                )
                                                                            )}
                                                                        </AnimatedValue>
                                                                    </span>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="icon-sm"
                                                                        className={cn(
                                                                            "shrink-0 rounded-full border-black/5 bg-white/85 text-amber-700 shadow-[0_10px_26px_-22px_rgba(0,0,0,0.55)] hover:bg-amber-50 hover:text-amber-800 dark:border-white/10 dark:bg-white/10 dark:text-amber-200 dark:hover:bg-amber-300/10 dark:hover:text-amber-100",
                                                                            manualGiftTargetGroupLabel === group.label &&
                                                                            "border-amber-400/40 bg-amber-500 text-white hover:bg-amber-600 hover:text-white dark:bg-amber-300 dark:text-amber-950 dark:hover:bg-amber-200"
                                                                        )}
                                                                        onClick={() => handleAddToGiftGroup(group.label)}
                                                                        title={`Agregar productos a ${group.label}`}
                                                                        aria-label={`Agregar productos a ${group.label}`}
                                                                        aria-pressed={manualGiftTargetGroupLabel === group.label}
                                                                    >
                                                                        <Plus className="size-3.5" />
                                                                    </Button>
                                                                </div>
                                                            </div>

                                                            <div className="divide-y divide-black/5 px-3 py-2 dark:divide-white/10">
                                                                {group.items.map((item) => (
                                                                    <div
                                                                        key={item.lineId}
                                                                        className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2"
                                                                    >
                                                                        <div className="min-w-0 flex-1">
                                                                            <p className="truncate text-sm font-semibold text-foreground">
                                                                                {item.product.name}
                                                                            </p>
                                                                        </div>
                                                                        <div className="flex flex-wrap items-center justify-end gap-2">
                                                                            <div className="flex h-8 items-center gap-1 rounded-full border border-black/5 bg-muted/50 p-1 shadow-inner dark:border-white/10 dark:bg-white/8">
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="ghost"
                                                                                    size="icon-sm"
                                                                                    className="size-6 rounded-full"
                                                                                    onClick={() => decreaseGiftGroupItemQuantity(item.lineId)}
                                                                                    title="Sacar una unidad del regalo"
                                                                                >
                                                                                    <Minus className="size-3" />
                                                                                </Button>
                                                                                <span className="min-w-6 text-center text-xs font-bold text-foreground">
                                                                                    <AnimatedValue value={item.quantity}>
                                                                                        {item.quantity}
                                                                                    </AnimatedValue>
                                                                                </span>
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="ghost"
                                                                                    size="icon-sm"
                                                                                    className="size-6 rounded-full"
                                                                                    onClick={() => increaseCartItemQuantity(item.lineId)}
                                                                                    title="Aumentar cantidad"
                                                                                >
                                                                                    <Plus className="size-3" />
                                                                                </Button>
                                                                            </div>
                                                                            <span className="shrink-0 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                                                                                <AnimatedValue value={`${priceMode}-${item.lineId}-${item.quantity}`}>
                                                                                    {formatCurrency(getUnitPrice(item.product) * item.quantity)}
                                                                                </AnimatedValue>
                                                                            </span>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon-sm"
                                                                                className="shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                                                                onClick={() => removeFromGiftGroup(item.lineId)}
                                                                                title="Quitar del grupo"
                                                                            >
                                                                                <X className="size-3.5" />
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}

                                                    {ungroupedCartItems.map((item) => {
                                                        const isSelectedForGiftGroup = manualGiftSelectedLineIds.includes(item.lineId);

                                                        if (!manualGiftGroupingActive) {
                                                            return (
                                                                <div
                                                                    key={item.lineId}
                                                                    className="animate-pos-cart-card-in group relative flex h-[112px] flex-col justify-between overflow-hidden rounded-[22px] border border-black/5 bg-white/90 p-4 shadow-[0_18px_45px_-38px_rgba(0,0,0,0.55)] backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/8 dark:hover:bg-white/10"
                                                                >
                                                                    <span
                                                                        className="absolute left-4 top-4 size-2 rounded-full bg-emerald-500/80 dark:bg-emerald-400/80"
                                                                        aria-hidden="true"
                                                                    />
                                                                    <div className="flex items-start justify-between gap-3">
                                                                        <div className="min-w-0 flex-1 pl-4">
                                                                            <p className="truncate text-sm font-semibold">
                                                                                {item.product.name}
                                                                            </p>
                                                                        </div>
                                                                        <div className="shrink-0 text-right">
                                                                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                                                Subtotal
                                                                            </p>
                                                                            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                                                                                <AnimatedValue value={`${priceMode}-${item.lineId}-${item.quantity}`}>
                                                                                    {formatCurrency(getUnitPrice(item.product) * item.quantity)}
                                                                                </AnimatedValue>
                                                                            </p>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center justify-between gap-3">
                                                                        <div className="flex h-9 items-center gap-1 rounded-full border border-black/5 bg-muted/55 p-1 shadow-inner dark:border-white/10 dark:bg-white/8">
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon-sm"
                                                                                className="size-7 rounded-full"
                                                                                onClick={() => decreaseCartItemQuantity(item.lineId)}
                                                                                title="Restar cantidad"
                                                                            >
                                                                                <Minus className="size-3.5" />
                                                                            </Button>
                                                                            <span className="min-w-7 text-center text-sm font-bold text-foreground">
                                                                                <AnimatedValue value={item.quantity}>
                                                                                    {item.quantity}
                                                                                </AnimatedValue>
                                                                            </span>
                                                                            <Button
                                                                                type="button"
                                                                                variant="ghost"
                                                                                size="icon-sm"
                                                                                className="size-7 rounded-full"
                                                                                onClick={() => increaseCartItemQuantity(item.lineId)}
                                                                                title="Aumentar cantidad"
                                                                            >
                                                                                <Plus className="size-3.5" />
                                                                            </Button>
                                                                        </div>

                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon-sm"
                                                                            className="shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                                                            onClick={() => removeFromCart(item.lineId)}
                                                                            title="Eliminar del carrito"
                                                                        >
                                                                            <Trash2 className="size-3.5" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <button
                                                                key={item.lineId}
                                                                type="button"
                                                                onClick={() => toggleManualGiftSelection(item.lineId)}
                                                                aria-pressed={isSelectedForGiftGroup}
                                                                className={cn(
                                                                    "animate-pos-cart-card-in group relative flex h-[112px] w-full cursor-pointer flex-col justify-between overflow-hidden rounded-[22px] border border-black/5 bg-white/90 p-4 text-left shadow-[0_18px_45px_-38px_rgba(0,0,0,0.55)] backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/35 dark:border-white/10 dark:bg-white/8 dark:hover:bg-white/10",
                                                                    isSelectedForGiftGroup &&
                                                                    "border-amber-400/45 bg-amber-50/75 ring-2 ring-amber-400/25 dark:border-amber-300/35 dark:bg-amber-300/10 dark:ring-amber-300/20"
                                                                )}
                                                            >
                                                                <span
                                                                    className="absolute left-4 top-4 size-2 rounded-full bg-amber-400 dark:bg-amber-300"
                                                                    aria-hidden="true"
                                                                />
                                                                <div className="flex w-full items-start justify-between gap-3">
                                                                    <div className="min-w-0 flex-1 pl-4">
                                                                        <p className="truncate text-sm font-semibold">
                                                                            {item.product.name}
                                                                        </p>
                                                                    </div>
                                                                    <div className="shrink-0 text-right">
                                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                                            Subtotal
                                                                        </p>
                                                                        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                                                                            <AnimatedValue value={`${priceMode}-${item.lineId}`}>
                                                                                {formatCurrency(getUnitPrice(item.product))}
                                                                            </AnimatedValue>
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                <div className="flex w-full items-center justify-between gap-3">
                                                                    <span className="text-xs font-medium text-muted-foreground">
                                                                        {manualGiftTargetGroupLabel
                                                                            ? `Agregar a ${manualGiftTargetGroupLabel}`
                                                                            : "Seleccionar para grupo"}
                                                                    </span>
                                                                    <span
                                                                        className={cn(
                                                                            "flex size-7 items-center justify-center rounded-full border transition-colors",
                                                                            isSelectedForGiftGroup
                                                                                ? "border-amber-300 bg-amber-500 text-white shadow-[0_12px_22px_-14px_rgba(217,119,6,0.9)] dark:border-amber-300/35 dark:bg-amber-400 dark:text-amber-950"
                                                                                : "border-border/80 bg-background/80 text-transparent dark:border-white/15 dark:bg-slate-950/35"
                                                                        )}
                                                                        aria-hidden="true"
                                                                    >
                                                                        <Check className="size-4" />
                                                                    </span>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                        {manualGiftGroupingActive && (
                                            <div className="sticky bottom-3 z-20 mt-3 flex items-center justify-end gap-2 pr-2">
                                                {manualGiftTargetGroupLabel && (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon-sm"
                                                        className="h-12 w-12 rounded-2xl border-amber-300 bg-background/95 text-amber-800 hover:bg-amber-50 dark:border-amber-300/35 dark:text-amber-200 dark:hover:bg-amber-300/10"
                                                        onClick={() => {
                                                            setManualGiftTargetGroupLabel(null);
                                                            setManualGiftSelectedLineIds([]);
                                                        }}
                                                        title="Cancelar agregado al regalo"
                                                        aria-label="Cancelar agregado al regalo"
                                                    >
                                                        <X className="size-4" />
                                                    </Button>
                                                )}
                                                <Button
                                                    type="button"
                                                    size="lg"
                                                    className="h-12 rounded-2xl bg-amber-600 px-5 text-white shadow-[0_20px_42px_-18px_rgba(217,119,6,0.78)] hover:bg-amber-700"
                                                    disabled={manualGiftSelectedLineIds.length === 0}
                                                    onClick={handleCreateGiftGroup}
                                                >
                                                    {manualGiftTargetGroupLabel
                                                        ? `Agregar a ${manualGiftTargetGroupLabel}`
                                                        : "Crear grupo"}
                                                    {manualGiftSelectedLineIds.length > 0 && (
                                                        <Badge className="ml-1 border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-100">
                                                            {manualGiftSelectedLineIds.length}
                                                        </Badge>
                                                    )}
                                                </Button>
                                            </div>
                                        )}
                                        </AnimatedSizeContainer>
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
                                            
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon-sm"
                                                className={cn(
                                                    "rounded-xl text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:text-amber-300 dark:hover:bg-amber-400/10 dark:hover:text-amber-200",
                                                    manualGiftGroupingActive &&
                                                    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-300/40 dark:bg-amber-400/10 dark:text-amber-200"
                                                )}
                                                disabled={cart.length === 0}
                                                onClick={handleToggleGiftGrouping}
                                                aria-label={manualGiftGroupingActive ? "Desactivar regalos" : "Activar regalos"}
                                                aria-pressed={manualGiftGroupingActive}
                                                title={manualGiftGroupingActive ? "Desactivar regalos" : "Activar regalos"}
                                            >
                                                <Gift className="size-3.5" />
                                            </Button>
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
                                    </div>

                                    <div className="mb-2">
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={priceMode === "wholesale"}
                                            onClick={() =>
                                                setPriceMode(priceMode === "retail" ? "wholesale" : "retail")
                                            }
                                            className="relative grid h-12 w-full cursor-pointer grid-cols-2 rounded-2xl bg-muted p-1 text-sm font-semibold text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:bg-slate-800/70"
                                        >
                                            <span
                                                className={cn(
                                                    "absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-[0.85rem] transition-transform",
                                                    priceMode === "retail"
                                                        ? "translate-x-0 bg-[linear-gradient(135deg,#1c1c28_0%,#3f3f50_100%)] shadow-[0_18px_32px_-24px_rgba(0,0,0,0.8)] dark:bg-[linear-gradient(135deg,rgba(51,65,85,0.98),rgba(30,41,59,0.98))]"
                                                        : "translate-x-full bg-[linear-gradient(135deg,#2563eb_0%,#93c5fd_100%)] shadow-[0_18px_32px_-24px_rgba(37,99,235,0.55)] dark:bg-[linear-gradient(135deg,rgba(37,99,235,0.92),rgba(30,64,175,0.92))]"
                                                )}
                                                aria-hidden="true"
                                            />
                                            <span
                                                className={cn(
                                                    "relative z-10 flex items-center justify-center rounded-xl transition-colors",
                                                    priceMode === "retail"
                                                        ? "text-white dark:text-slate-50"
                                                        : "text-muted-foreground dark:text-slate-300"
                                                )}
                                            >
                                                Precio venta
                                            </span>
                                            <span
                                                className={cn(
                                                    "relative z-10 flex items-center justify-center rounded-xl transition-colors",
                                                    priceMode === "wholesale"
                                                        ? "text-white dark:text-sky-50"
                                                        : "text-muted-foreground dark:text-slate-300"
                                                )}
                                            >
                                                Mayorista
                                            </span>
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
                                                <span className="text-2xl font-bold tracking-tight text-foreground">
                                                    <AnimatedValue value={totalItems}>
                                                        {totalItems}
                                                    </AnimatedValue>
                                                </span>
                                            </div>
                                            <AnimatedSizeContainer>
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
                                                            -<AnimatedValue value={exchangeCredit}>
                                                                {formatCurrency(exchangeCredit)}
                                                            </AnimatedValue>
                                                        </span>
                                                    </div>
                                                )}
                                            </AnimatedSizeContainer>
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
                                                    <AnimatedSizeContainer>
                                                        {hasExchangeOverage && (
                                                            <p className="mt-1 text-xs text-rose-600">
                                                                El cambio supera la nueva venta.
                                                            </p>
                                                        )}
                                                    </AnimatedSizeContainer>
                                                </div>
                                                <span className="text-3xl font-bold tracking-tight">
                                                    <AnimatedValue
                                                        value={`${priceMode}-${appliedExchange ? balanceAmount : payableAmount}`}
                                                    >
                                                        {formatCurrency(appliedExchange ? balanceAmount : payableAmount)}
                                                    </AnimatedValue>
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
                                                : (
                                                    <>
                                                        Cobrar{" "}
                                                        <AnimatedValue value={`${priceMode}-${payableAmount}`}>
                                                            {formatCurrency(payableAmount)}
                                                        </AnimatedValue>
                                                    </>
                                                )}
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
                        <TicketReceipt
                            data={receiptData}
                            isGift={activePrintIsGift}
                            giftGroup={
                                activePrintIsGift
                                    ? receiptData.giftGroups?.filter((group) => group.items.length > 0)[
                                        activePrintGiftGroupIndex
                                    ]
                                    : undefined
                            }
                        />
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
