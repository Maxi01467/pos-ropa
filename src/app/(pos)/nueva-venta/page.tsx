"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { TicketReceipt } from "@/components/printing/ticket-receipt";
import {
    CheckoutDialog,
    type PaymentBreakdown,
    type PaymentMethod,
} from "@/components/sales/checkout-dialog";
import { motion } from "motion/react";
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
    CalendarDays,
    Bookmark,
    Tag,
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
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

import { toast } from "sonner";
import { cn } from "@/lib/core/utils";
import { formatArgentinaDateTime, formatArgentinaShortDate } from "@/lib/core/datetime";
import { barcodeFromSku, barcodeFromTicketNumber } from "@/lib/printing/barcodes";
import type { ReceiptPrintData } from "@/lib/printing/receipt-printing";
import { printSaleReceipt } from "@/lib/printing/printing";
import { CACHE_TAGS } from "@/lib/core/cache-tags";
import { notifyDataUpdated, useDataRefresh } from "@/lib/sync/data-sync-client";
import { useTerminalSnapshot } from "@/lib/terminal/terminal-client";
import { getPosRuntimeDataSource } from "@/lib/offline/pos-runtime-data";
import { getPosRuntimeMutations } from "@/lib/offline/pos-runtime-mutations";
import { Skeleton } from "boneyard-js/react";
import {
    ReservationDialog,
    type AppliedReservation,
} from "@/components/nueva-venta/reservation-dialog";
import {
    CreateReservationDialog,
    type CreateReservationItemPreview,
} from "@/components/nueva-venta/create-reservation-dialog";
import { createReservation, completeReservation } from "@/app/actions/reservations/reservations-actions";
import type { ReservationWithItems } from "@/app/actions/reservations/reservations-actions";


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
    // Reservas
    reservationDialogOpen: boolean;
    reservationDialogInitialSearch: string;
    createReservationOpen: boolean;
    appliedReservation: AppliedReservation | null;
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
        priceMode: "wholesale",
        exchangeDialogOpen: false,
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
        // Reservas
        reservationDialogOpen: false,
        reservationDialogInitialSearch: "",
        createReservationOpen: false,
        appliedReservation: null,
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
        draft.priceMode === "wholesale" &&
        !draft.exchangeSearchQuery.trim() &&
        !draft.selectedExchangeSale &&
        Object.keys(draft.exchangeQuantities).length === 0 &&
        !draft.appliedReservation &&
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

function normalizeProductCodeSearchValue(value: string) {
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
    const exchangeSearchQueryRef = useRef("");
    const hasLoadedExchangeSalesOnceRef = useRef(false);
    const loadExchangeSalesRef = useRef<() => Promise<void>>(async () => {});
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
    const reservationDialogOpen = activeDraft.reservationDialogOpen;
    const reservationDialogInitialSearch = activeDraft.reservationDialogInitialSearch;
    const createReservationOpen = activeDraft.createReservationOpen;
    const appliedReservation = activeDraft.appliedReservation;
    useEffect(() => {
        exchangeSearchQueryRef.current = exchangeSearchQuery;
    }, [exchangeSearchQuery]);
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
    const setReservationDialogOpen = useCallback(
        (action: SetStateAction<boolean>) => updateDraftField("reservationDialogOpen", action),
        [updateDraftField]
    );
    const setCreateReservationOpen = useCallback(
        (action: SetStateAction<boolean>) => updateDraftField("createReservationOpen", action),
        [updateDraftField]
    );
    const setAppliedReservation = useCallback(
        (action: SetStateAction<AppliedReservation | null>) => updateDraftField("appliedReservation", action),
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
    }, [setDraftIdPendingClose]);
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
    }, [setDraftIdPendingClose]);
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
    }, [closeDraftTab, draftTabs.drafts, setDraftIdPendingClose]);
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

            if (productsResult.status === "rejected" || sellersResult.status === "rejected") {
                const reason = productsResult.status === "rejected" 
                    ? (productsResult as PromiseRejectedResult).reason 
                    : (sellersResult as PromiseRejectedResult).reason;
                console.error("Error loading POS initial data:", reason);
                if (!cancelled) {
                    setProductsError("No se pudieron cargar los datos.");
                    toast.error("Error al conectar con la base de datos");
                    setIsLoadingProducts(false);
                }
                return () => {
                    cancelled = true;
                };
            }

            const products = productsResult.value;
            const sellersData = sellersResult.value;

            if (cancelled) return () => {};

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
            if (!cancelled) {
                setIsLoadingProducts(false);
            }
        } catch (error) {
            if (cancelled) return () => {};
            console.error("Error loading initial data:", error);
            setProductsError("No se pudieron cargar los datos.");
            toast.error("Error al conectar con la base de datos");
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
        const timeoutId = setTimeout(() => {
            void loadCatalog({ reason: "initial-mount" }).then((nextCleanup) => {
                cleanup = nextCleanup;
            });
        }, 0);

        return () => {
            clearTimeout(timeoutId);
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
            if (checkoutOpen || exchangeDialogOpen) return;

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
    }, [checkoutOpen, exchangeDialogOpen, setSearchQuery]);

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

                return;
            }

            if (checkoutOpen || exchangeDialogOpen) return;
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
                if (sellers.length > 0) {
                    setSelectedSellerId((currentId) => {
                        const currentIndex = sellers.findIndex((s) => s.id === currentId);
                        const nextIndex = (currentIndex + 1) % sellers.length;
                        return sellers[nextIndex]!.id;
                    });
                }
                return;
            }

            if (event.key === "Tab") {
                event.preventDefault();
                setDraftTabs((currentTabs) => {
                    const { drafts, activeDraftId } = currentTabs;
                    if (drafts.length <= 1) return currentTabs;

                    const currentIndex = drafts.findIndex((draft) => draft.id === activeDraftId);
                    if (currentIndex === -1) return currentTabs;

                    let nextIndex = currentIndex;
                    if (event.shiftKey) {
                        // Shift + Tab: Anterior pestaña (ir a la izquierda)
                        nextIndex = (currentIndex - 1 + drafts.length) % drafts.length;
                    } else {
                        // Tab: Siguiente pestaña (ir a la derecha)
                        nextIndex = (currentIndex + 1) % drafts.length;
                    }

                    return {
                        ...currentTabs,
                        activeDraftId: drafts[nextIndex]!.id,
                    };
                });
                return;
            }

            if (event.key === " ") {
                event.preventDefault();
                if (!selectedSellerId) {
                    if (sellers.length > 0) {
                        setSelectedSellerId(sellers[0].id);
                    }
                } else if (cart.length > 0 || appliedExchange) {
                    setCheckoutOpen(true);
                }
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
        setDraftTabs,
        selectedSellerId,
        setSelectedSellerId,
        sellers,
        cart,
        appliedExchange,
    ]);


    useEffect(() => {
        if (!exchangeDialogOpen) return;
        const timeoutId = setTimeout(() => exchangeSearchInputRef.current?.focus(), 0);
        return () => clearTimeout(timeoutId);
    }, [exchangeDialogOpen]);

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();

            // Usamos e.currentTarget.value en vez del estado searchQuery porque 
            // el escáner dispara los eventos en milisegundos.
            const scannedValue = e.currentTarget.value;
            if (!scannedValue) return;

            // Si el código escaneado parece un número de reserva, abrir el dialog de reservas
            if (/^RES-\d+$/i.test(scannedValue.trim())) {
                setSearchQuery("");
                updateDraftField("reservationDialogInitialSearch", scannedValue.trim().toUpperCase());
                setReservationDialogOpen(true);
                return;
            }

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
    const filteredProducts = !searchQuery.trim()
        ? allProducts
        : allProducts.filter((product) => productMatchesSearch(product, searchQuery));
    const searchSuggestions = (() => {
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
    })();

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
        const item = cart.find((i) => i.lineId === lineId);
        if (!item) return;

        const isSelected = manualGiftSelectedLineIds.includes(lineId);
        if (isSelected) {
            setManualGiftSelectedLineIds((current) =>
                current.filter((selectedLineId) => selectedLineId !== lineId)
            );
            
            setCart((prev) => {
                const currentItem = prev.find((i) => i.lineId === lineId);
                if (!currentItem) return prev;

                const otherItem = prev.find((i) => 
                    i.lineId !== lineId && 
                    i.product.id === currentItem.product.id && 
                    !i.giftGroupLabel && 
                    !manualGiftSelectedLineIds.includes(i.lineId)
                );

                if (otherItem) {
                    return prev.map((i) => {
                        if (i.lineId === otherItem.lineId) {
                            return { ...i, quantity: i.quantity + currentItem.quantity };
                        }
                        return i;
                    }).filter((i) => i.lineId !== lineId);
                }

                return prev;
            });
            return;
        }

        if (item.quantity > 1) {
            const newItem = createCartItem(item.product, 1, false);
            
            setCart((prev) =>
                prev.map((i) =>
                    i.lineId === lineId
                        ? { ...i, quantity: i.quantity - 1 }
                        : i
                ).concat(newItem)
            );
            
            setManualGiftSelectedLineIds((current) => [...current, newItem.lineId]);
            toast.success(`Se separó 1 unidad de ${item.product.name} para regalo`);
        } else {
            setManualGiftSelectedLineIds((current) => [...current, lineId]);
        }
    };

    const handleCreateGiftGroup = useCallback(() => {
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
    }, [
        manualGiftSelectedLineIds,
        cart,
        manualGiftTargetGroupLabel,
        nextGiftGroupNumber,
        setCart,
        setManualGiftSelectedLineIds,
        setManualGiftTargetGroupLabel,
    ]);

    // Atajo Shift para convertir los artículos seleccionados en regalo
    useEffect(() => {
        const handleShiftGiftShortcut = (event: KeyboardEvent) => {
            if (event.key === "Shift") {
                if (checkoutOpen || exchangeDialogOpen) return;
                if (isEditableTarget(event.target)) return;
                if (manualGiftSelectedLineIds.length === 0) return;

                event.preventDefault();
                handleCreateGiftGroup();
            }
        };

        window.addEventListener("keydown", handleShiftGiftShortcut, true);
        return () => {
            window.removeEventListener("keydown", handleShiftGiftShortcut, true);
        };
    }, [checkoutOpen, exchangeDialogOpen, manualGiftSelectedLineIds, handleCreateGiftGroup]);

    const handleAddToGiftGroup = (giftGroupLabel: string) => {
        const selectedLineIds = manualGiftSelectedLineIds.filter((lineId) =>
            cart.some((item) => item.lineId === lineId && !item.giftGroupLabel)
        );

        if (selectedLineIds.length === 0) {
            toast.info("Seleccioná productos en el carrito primero y luego hacé clic aquí para agregarlos a este regalo");
            return;
        }

        setCart((prev) =>
            prev.map((item) =>
                selectedLineIds.includes(item.lineId)
                    ? { ...item, isGift: true, giftGroupLabel }
                    : item
            )
        );
        setManualGiftSelectedLineIds([]);
        toast.success(`Productos agregados a ${giftGroupLabel}`);
    };

    const handleInstantGift = (lineId: string, groupLabel?: string) => {
        const item = cart.find((i) => i.lineId === lineId);
        if (!item) return;

        const finalGroupLabel = groupLabel ?? `Regalo ${nextGiftGroupNumber}`;

        if (item.quantity > 1) {
            const newItem = createCartItem(item.product, 1, false);
            newItem.isGift = true;
            newItem.giftGroupLabel = finalGroupLabel;

            setCart((prev) =>
                prev.map((i) =>
                    i.lineId === lineId
                        ? { ...i, quantity: i.quantity - 1 }
                        : i
                ).concat(newItem)
            );
            
            setManualGiftSelectedLineIds((current) => current.filter((id) => id !== lineId));
            toast.success(`Se separó 1 unidad de ${item.product.name} en ${finalGroupLabel}`);
        } else {
            setCart((prev) =>
                prev.map((i) =>
                    i.lineId === lineId
                        ? { ...i, isGift: true, giftGroupLabel: finalGroupLabel }
                        : i
                )
            );
            setManualGiftSelectedLineIds((current) => current.filter((id) => id !== lineId));
            toast.success(`${item.product.name} agregado a ${finalGroupLabel}`);
        }
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

    const clearCart = () => {
        setCart([]);
        setAppliedExchange(null);
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
    const reservationDeposit = appliedReservation?.depositAmount ?? 0;
    const balanceAmount = totalAmount - exchangeCredit;
    const payableAmount = Math.max(balanceAmount - reservationDeposit, 0);
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

        // Si había una reserva aplicada, marcarla como COMPLETADA
        if (appliedReservation?.reservationId) {
            void completeReservation(appliedReservation.reservationId);
        }

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

    useEffect(() => {
        loadExchangeSalesRef.current = async () => {
            const requestId = exchangeSalesRequestIdRef.current + 1;
            exchangeSalesRequestIdRef.current = requestId;
            const shouldShowLoading = !hasLoadedExchangeSalesOnceRef.current;

            if (shouldShowLoading) {
                setIsLoadingExchangeSales(true);
            }

            try {
                const sales = await posDataSource.getSalesHistory({
                    query: exchangeSearchQueryRef.current,
                    limit: 5,
                });

                if (exchangeSalesRequestIdRef.current !== requestId) {
                    return;
                }

                setExchangeSales(sales);
                hasLoadedExchangeSalesOnceRef.current = true;
                if (shouldShowLoading) {
                    setIsLoadingExchangeSales(false);
                }
            } catch (error) {
                if (exchangeSalesRequestIdRef.current !== requestId) {
                    return;
                }

                toast.error("No se pudieron cargar las boletas");
                console.error(error);
                if (shouldShowLoading) {
                    setIsLoadingExchangeSales(false);
                }
            }
        };
    }, [posDataSource]);

    const refreshCatalogData = useCallback(async () => {
        await loadCatalog({ background: true, reason: "data-sync-catalog" });
    }, [loadCatalog]);

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
        async () => {
            if (!exchangeDialogOpen) {
                return;
            }

            await loadExchangeSalesRef.current();
        },
        {
            debugLabel: "nueva-venta-exchange",
            pollIntervalMs: false,
            refreshOnFocus: false,
        }
    );

    const handleExchangeSearchKeyDown = useCallback(async (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            const scannedValue = event.currentTarget.value.trim();
            if (!scannedValue) return;

            setIsLoadingExchangeSales(true);
            try {
                const sales = await posDataSource.getSalesHistory({
                    query: scannedValue,
                    limit: 5,
                });

                setExchangeSales(sales);
                hasLoadedExchangeSalesOnceRef.current = true;

                if (sales.length > 0) {
                    const cleanQuery = scannedValue.replace(/\D/g, "");
                    const paddedQuery = cleanQuery.padStart(13, "0");
                    const exactMatch = sales.find(sale => {
                        const ticketNumberStr = sale.ticketNumber.toString().replace(/\D/g, "");
                        const barcode = barcodeFromTicketNumber(sale.ticketNumber);
                        return ticketNumberStr === cleanQuery || barcode === paddedQuery;
                    });

                    const saleToSelect = exactMatch || sales[0];
                    setSelectedExchangeSale(saleToSelect);
                    setExchangeQuantities({});
                } else {
                    toast.error("Boleta no encontrada", {
                        description: `No se encontró la boleta #${scannedValue}`,
                    });
                }
            } catch (error) {
                toast.error("No se pudieron cargar las boletas");
                console.error(error);
            } finally {
                setIsLoadingExchangeSales(false);
            }
        }
    }, [posDataSource, setSelectedExchangeSale, setExchangeQuantities, setExchangeSales, setIsLoadingExchangeSales]);

    const handleOpenExchangeDialog = async () => {
        setExchangeSearchQuery("");
        setSelectedExchangeSale(null);
        setExchangeQuantities({});
        setExchangeDialogOpen(true);
    };

    const handleOpenReservationDialog = () => {
        updateDraftField("reservationDialogInitialSearch", "");
        setReservationDialogOpen(true);
    };

    const handleApplyReservation = (reservation: ReservationWithItems, credit: AppliedReservation) => {
        // Cargar los ítems de la reserva al carrito
        for (const item of reservation.items) {
            const product = allProducts.find((p) => p.id === item.variant.product.id && p.code === item.variant.sku);
            if (product) {
                setCart((currentCart) => {
                    const existing = currentCart.find((c) => c.product.code === product.code && !c.isGift);
                    if (existing) {
                        return currentCart.map((c) =>
                            c.lineId === existing.lineId
                                ? { ...c, quantity: c.quantity + item.quantity }
                                : c
                        );
                    }
                    return [
                        ...currentCart,
                        {
                            lineId: crypto.randomUUID(),
                            product,
                            quantity: item.quantity,
                            isGift: false,
                        },
                    ];
                });
            }
        }
        setAppliedReservation(credit);
    };

    const handleCreateReservation = async (
        input: Omit<import("@/app/actions/reservations/reservations-actions").CreateReservationInput, "userId" | "cashSessionId">
    ) => {
        const seller = sellers.find((s) => s.id === selectedSellerId);
        if (!seller) {
            toast.error("Seleccioná un vendedor antes de reservar.");
            return;
        }

        const result = await createReservation({
            ...input,
            userId: selectedSellerId,
            cashSessionId: undefined,
        });

        if (!result.success) {
            toast.error(result.error);
            return;
        }

        toast.success(`Reserva ${result.reservation.reservationNumber} creada`, {
            description: `Para ${result.reservation.clientName}`,
        });

        // Vaciar el carrito y cerrar el dialog
        setCart([]);
        setAppliedReservation(null);
        setAppliedExchange(null);
        setCreateReservationOpen(false);
    };

    useEffect(() => {
        if (!exchangeDialogOpen) return;

        const timeoutId = window.setTimeout(() => {
            void loadExchangeSalesRef.current();
        }, 250);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [exchangeDialogOpen, exchangeSearchQuery]);

    // Redireccionar escaneos al buscador de cambios si el modal de cambios está abierto y el input no tiene foco
    useEffect(() => {
        const handleExchangeScannerInput = (event: KeyboardEvent) => {
            if (!exchangeDialogOpen) return;
            if (event.ctrlKey || event.metaKey || event.altKey) return;

            const searchInput = exchangeSearchInputRef.current;
            if (!searchInput) return;
            if (document.activeElement === searchInput) return;
            if (isEditableTarget(event.target)) return;

            if (["Enter", "Escape"].includes(event.key)) {
                return;
            }

            if (event.key.length !== 1) return;

            searchInput.focus();
            setExchangeSearchQuery((current) => `${current}${event.key}`);
            event.preventDefault();
        };

        window.addEventListener("keydown", handleExchangeScannerInput, true);
        return () => {
            window.removeEventListener("keydown", handleExchangeScannerInput, true);
        };
    }, [exchangeDialogOpen, setExchangeSearchQuery]);

    // Autoselección si hay un resultado con coincidencia exacta (código de barras o ticket)
    useEffect(() => {
        if (!exchangeDialogOpen || selectedExchangeSale) return;
        if (exchangeSales.length === 0) return;

        const cleanQuery = exchangeSearchQuery.trim().replace(/\D/g, "");
        const paddedQuery = cleanQuery.padStart(13, "0");
        if (cleanQuery.length >= 4) {
            const exactMatch = exchangeSales.find(sale => {
                const ticketNumberStr = sale.ticketNumber.toString().replace(/\D/g, "");
                const barcode = barcodeFromTicketNumber(sale.ticketNumber);
                return ticketNumberStr === cleanQuery || barcode === paddedQuery;
            });

            if (exactMatch) {
                setSelectedExchangeSale(exactMatch);
                setExchangeQuantities({});
            } else if (exchangeSales.length === 1) {
                const singleSale = exchangeSales[0];
                const ticketNumberStr = singleSale.ticketNumber.toString().replace(/\D/g, "");
                const barcode = barcodeFromTicketNumber(singleSale.ticketNumber);

                if (ticketNumberStr === cleanQuery || barcode === paddedQuery) {
                    setSelectedExchangeSale(singleSale);
                    setExchangeQuantities({});
                }
            }
        }
    }, [exchangeSales, exchangeSearchQuery, exchangeDialogOpen, selectedExchangeSale, setSelectedExchangeSale, setExchangeQuantities]);

    const selectedExchangeItems = (() => {
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
    })();

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
        const wholesalePrice = price;
        const initialStock = Number.parseInt(quickCreateInitialStock, 10);

        if (!normalizedName) {
            return toast.error("Ingresá el nombre del producto");
        }

        if (Number.isNaN(price) || price <= 0) {
            return toast.error("Ingresá un precio válido");
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
            addToCart(quickCreatedProduct);
            setSearchQuery("");
            setQuickCreateOpen(false);
            toast.success(
                createdProduct.pendingReview
                    ? "Producto creado y enviado a revisión"
                    : "Producto creado con éxito"
            );
            setTimeout(() => searchInputRef.current?.focus(), 10);
            setIsQuickCreating(false);
        } catch (error) {
            console.error("Quick create product failed:", error);
            toast.error("No se pudo crear el producto");
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
                                                    ? "text-foreground"
                                                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground dark:hover:bg-slate-900/50"
                                            )}
                                        >
                                            {isActive && (
                                                <motion.div
                                                    layoutId="activeDraftTabPill"
                                                    className="absolute inset-0 rounded-xl bg-background border border-stone-200/50 shadow-sm dark:border-white/10"
                                                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                                />
                                            )}
                                            <button
                                                type="button"
                                                role="tab"
                                                aria-selected={isActive}
                                                className="relative z-10 min-w-0 flex-1 text-left outline-none"
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
                                                        "relative z-10 h-6 w-6 shrink-0 rounded-md transition-all",
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
                                    <div className="mb-4 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Tag className="size-5 text-muted-foreground" />
                                            <h2 className="text-lg font-semibold">Búsqueda de productos</h2>
                                        </div>
                                    </div>

                                    <div className="relative z-30 mb-5 flex flex-col gap-3 xl:flex-row">
                                        <div ref={searchBoxRef} className="relative min-w-0 flex-1 group">
                                            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground/60 transition-colors duration-200 group-focus-within:text-rose-500 dark:group-focus-within:text-rose-400" />
                                            <Input
                                                ref={searchInputRef}
                                                type="text"
                                                placeholder="Escanear codigo o buscar por nombre..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                onFocus={() => setIsSearchFocused(true)}
                                                onBlur={() => setIsSearchFocused(false)}
                                                onKeyDown={handleSearchKeyDown}
                                                className="h-12 rounded-2xl border-border/70 bg-background/85 pl-11 text-base transition-all duration-200 focus:shadow-[0_8px_30px_rgba(244,63,94,0.04)]"
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
                                            <Button
                                                variant="outline"
                                                className="h-12 rounded-2xl border-border/70 bg-background/85 px-4"
                                                onClick={handleOpenReservationDialog}
                                            >
                                                <CalendarDays className="size-4" />
                                                Reservas
                                            </Button>
                                            <Button
                                                className="h-12 rounded-2xl bg-[linear-gradient(135deg,#1f2937_0%,#334155_100%)] px-4 text-white shadow-[0_18px_30px_-24px_rgba(15,23,42,0.72)] hover:opacity-95 dark:bg-[linear-gradient(135deg,rgba(51,65,85,0.98),rgba(30,41,59,0.98))] dark:text-slate-50 dark:shadow-[0_20px_34px_-24px_rgba(0,0,0,0.85)]"
                                                onClick={openQuickCreateDialog}
                                            >
                                                <Plus className="size-4" />
                                                Crear rapido
                                            </Button>
                                        </div>
                                    </div>

                                    <ScrollArea className="relative max-w-full overflow-hidden min-[1400px]:max-h-[calc(100vh-16rem)]">
                                        <AnimatedSizeContainer>
                                            <Skeleton name="nueva-venta-catalog" loading={isLoadingProducts}>
                                            {productsError ? (
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
                                            <div className="space-y-3 pr-2">
                                                <div className="grid grid-cols-1 gap-3 transition-[gap,padding] duration-200 ease-out md:grid-cols-2 xl:grid-cols-3">
                                                    {appliedExchange?.items.map((item) => (
                                                         <div
                                                             key={item.saleItemId}
                                                             className="animate-pos-cart-card-in group relative flex h-[112px] flex-col justify-between overflow-hidden rounded-[22px] border border-black/5 bg-neutral-50/50 p-4 shadow-sm backdrop-blur dark:border-white/5 dark:bg-slate-900/10"
                                                         >
                                                             <RotateCcw className="absolute left-4 top-4.5 size-3.5 text-muted-foreground/60" />
                                                             <div className="flex items-start justify-between gap-3">
                                                                 <div className="min-w-0 flex-1 pl-5">
                                                                     <p className="truncate text-sm font-semibold text-foreground">
                                                                         {item.label}
                                                                     </p>
                                                                     <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                                                                         Crédito por cambio
                                                                     </p>
                                                                 </div>
                                                                 <Button
                                                                     variant="ghost"
                                                                     size="icon-sm"
                                                                     className="shrink-0 rounded-xl text-muted-foreground hover:bg-neutral-100 hover:text-foreground dark:hover:bg-neutral-800"
                                                                     onClick={() => handleRemoveExchangeItem(item.saleItemId)}
                                                                     title="Quitar del cambio"
                                                                 >
                                                                     <Trash2 className="size-3.5" />
                                                                 </Button>
                                                             </div>

                                                             <div className="flex items-end justify-between gap-3">
                                                                 <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/75">
                                                                     Cambio aplicado
                                                                 </p>
                                                                 <span className="text-lg font-bold text-foreground">
                                                                     -{formatCurrency(item.amount)}
                                                                 </span>
                                                             </div>
                                                         </div>
                                                     ))}

                                                     {giftGroups.map((group) => (
                                                        <div
                                                            key={group.label}
                                                            className="animate-pos-cart-card-in relative overflow-hidden rounded-[22px] border border-amber-200/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,249,235,0.72))] shadow-[0_20px_48px_-38px_rgba(146,64,14,0.34)] backdrop-blur dark:border-amber-300/35 dark:bg-[linear-gradient(180deg,rgba(252,211,77,0.14),rgba(255,255,255,0.08))]"
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
                                                                        className="shrink-0 rounded-full border-black/5 bg-white/85 text-amber-700 shadow-[0_10px_26px_-22px_rgba(0,0,0,0.55)] hover:bg-amber-50 hover:text-amber-800 dark:border-white/10 dark:bg-white/10 dark:text-amber-200 dark:hover:bg-amber-300/10 dark:hover:text-amber-100"
                                                                        onClick={() => handleAddToGiftGroup(group.label)}
                                                                        title={`Agregar productos a ${group.label}`}
                                                                        aria-label={`Agregar productos a ${group.label}`}>
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

                                                         return (
                                                             <div
                                                                 key={item.lineId}
                                                                 className={cn(
                                                                     "animate-pos-cart-card-in group relative flex h-[112px] flex-col justify-between overflow-hidden rounded-[22px] border bg-white/90 p-4 shadow-[0_18px_45px_-38px_rgba(0,0,0,0.55)] backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white dark:bg-white/8 dark:hover:bg-white/10",
                                                                     isSelectedForGiftGroup
                                                                         ? "border-rose-400/80 bg-rose-50/20 shadow-[0_18px_45px_-38px_rgba(124,58,237,0.25)] dark:border-rose-400/30 dark:bg-rose-950/20"
                                                                         : "border-black/5 dark:border-white/10"
                                                                 )}
                                                             >
                                                                 <button
                                                                     type="button"
                                                                     onClick={() => toggleManualGiftSelection(item.lineId)}
                                                                     className={cn(
                                                                         "absolute left-3 top-3 z-10 flex size-5 cursor-pointer items-center justify-center rounded-full border transition-all duration-200",
                                                                         isSelectedForGiftGroup
                                                                             ? "border-rose-300 bg-rose-600 text-white shadow-sm scale-110"
                                                                             : "border-black/10 bg-black/5 text-transparent hover:border-rose-400 hover:bg-rose-50 hover:text-rose-600 dark:border-white/15 dark:bg-white/5 dark:hover:bg-rose-400/20"
                                                                     )}
                                                                     title={isSelectedForGiftGroup ? "Deseleccionar item" : "Seleccionar item"}
                                                                 >
                                                                     <Check className="size-3 stroke-[3]" />
                                                                 </button>
                                                                 <div
                                                                      onClick={() => toggleManualGiftSelection(item.lineId)}
                                                                      className="flex cursor-pointer select-none items-start justify-between gap-3"
                                                                  >
                                                                     <div className="min-w-0 flex-1 pl-6">
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

                                                                     <div className="flex items-center gap-1 shrink-0">
                                                                         <Button
                                                                              type="button"
                                                                              variant="ghost"
                                                                              size="icon-sm"
                                                                              className="shrink-0 rounded-full text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
                                                                              onClick={() => handleInstantGift(item.lineId)}
                                                                              title="Convertir en regalo"
                                                                          >
                                                                              <Gift className="size-3.5" />
                                                                          </Button>

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
                                                             </div>
                                                         );
})}
                                                </div>
                                            </div>
                                        )}
                                        
                                        </Skeleton>
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
                                                        : "translate-x-full bg-[linear-gradient(135deg,#8b5cf6_0%,#c084fc_100%)] shadow-[0_18px_32px_-24px_rgba(139,92,246,0.55)] dark:bg-[linear-gradient(135deg,rgba(139,92,246,0.92),rgba(109,40,217,0.92))]"
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
                                                        ? "text-white dark:text-purple-50"
                                                        : "text-muted-foreground dark:text-slate-300"
                                                )}
                                            >
                                                Mayorista
                                            </span>
                                        </button>
                                    </div>

                                    <div className="mt-2 shrink-0 space-y-3 border-t border-border/70 bg-card/90 pt-3 dark:border-white/10 dark:bg-transparent">
                                        <AnimatedSizeContainer>
                                            {manualGiftSelectedLineIds.length > 0 && (
                                                <div className="space-y-2.5 border-t border-border/70 pt-4 animate-pos-cart-card-in">
                                                    <div className="flex items-center justify-between">
                                                        <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-rose-700 dark:text-rose-300">
                                                            <Gift className="size-3.5" />
                                                            Regalos
                                                        </Label>
                                                        
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 min-[1400px]:grid-cols-1">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            className="h-10 justify-start rounded-xl border-rose-200 bg-background text-rose-700 hover:bg-rose-50/50 hover:text-rose-800 dark:border-rose-500/20 dark:bg-slate-900/40 dark:text-rose-300 dark:hover:bg-rose-950/20"
                                                            disabled={manualGiftSelectedLineIds.length === 0}
                                                            onClick={handleCreateGiftGroup}
                                                        >
                                                            <Plus className="size-4 text-rose-600 dark:text-rose-400" />
                                                            Crear regalo
                                                        </Button>

                                                        {giftGroups.length > 0 ? (
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        className="h-10 justify-start rounded-xl border-rose-200 bg-background text-rose-700 hover:bg-rose-50/50 hover:text-rose-800 dark:border-rose-500/20 dark:bg-slate-900/40 dark:text-rose-300 dark:hover:bg-rose-950/20"
                                                                        disabled={manualGiftSelectedLineIds.length === 0}
                                                                    >
                                                                        <Gift className="size-4 text-rose-600 dark:text-rose-400" />
                                                                        Agregar a regalo
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-56">
                                                                    {giftGroups.map((group) => (
                                                                        <DropdownMenuItem
                                                                            key={group.label}
                                                                            onClick={() => {
                                                                                const selectedLineIds = manualGiftSelectedLineIds.filter((lineId) =>
                                                                                    cart.some((item) => item.lineId === lineId && !item.giftGroupLabel)
                                                                                );
                                                                                setCart((prev) =>
                                                                                    prev.map((item) =>
                                                                                        selectedLineIds.includes(item.lineId)
                                                                                            ? { ...item, isGift: true, giftGroupLabel: group.label }
                                                                                            : item
                                                                                    )
                                                                                );
                                                                                setManualGiftSelectedLineIds([]);
                                                                                toast.success(`Productos agregados a ${group.label}`);
                                                                            }}
                                                                            className="cursor-pointer font-semibold text-amber-950 dark:text-amber-100"
                                                                        >
                                                                            <Gift className="mr-2 size-4 text-amber-600 dark:text-amber-400" />
                                                                            {group.label}
                                                                        </DropdownMenuItem>
                                                                    ))}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        ) : (
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                className="h-10 justify-start rounded-xl border-rose-200 bg-background text-rose-700 hover:bg-rose-50/50 hover:text-rose-800 dark:border-rose-500/20 dark:bg-slate-900/40 dark:text-rose-300 dark:hover:bg-rose-950/20"
                                                                disabled
                                                            >
                                                                <Gift className="size-4" />
                                                                Agregar a regalo
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </AnimatedSizeContainer>

                                        <div className="space-y-2">
                                             <div className="flex items-center justify-between">
                                                 <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                                     <UserCircle className="size-3.5" />
                                                     Vendedor
                                                 </Label>
                                             </div>
                                             <div className="relative flex w-full rounded-2xl bg-neutral-100/80 p-0.5 dark:bg-slate-900/80 border border-black/5 dark:border-white/5 shadow-inner">
                                                 {sellers.map((seller) => {
                                                     const isSelected = selectedSellerId === seller.id;
                                                     return (
                                                         <button
                                                             key={seller.id}
                                                             type="button"
                                                             onClick={() => setSelectedSellerId(seller.id)}
                                                             className={cn(
                                                                 "flex-1 py-1.5 text-center text-xs font-semibold rounded-[14px] transition-all duration-200 ease-out select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/20",
                                                                 isSelected
                                                                     ? "bg-white text-rose-700 shadow-[0_2px_8px_-1px_rgba(0,0,0,0.08)] scale-[1.02] dark:bg-slate-800 dark:text-rose-300"
                                                                     : "text-muted-foreground hover:text-foreground hover:bg-white/10 dark:hover:bg-slate-800/10"
                                                             )}
                                                             title={seller.name}
                                                         >
                                                             {seller.name.split(' ')[0]}
                                                         </button>
                                                     );
                                                 })}
                                             </div>
                                         </div>

                                        <div className="mt-2 space-y-3 border-t border-border/70 pt-4">
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
                                                     <div className="flex items-center justify-between text-base">
                                                         <button
                                                             type="button"
                                                             onClick={() => setExchangeDialogOpen(true)}
                                                             className="flex items-center gap-1.5 hover:underline decoration-black/30 dark:decoration-white/30 underline-offset-2 font-medium text-foreground"
                                                             title="Ver detalle del cambio"
                                                         >
                                                             <span>Cambio</span>
                                                             <span className="text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-1.5 py-0.5 rounded-md font-semibold">
                                                                 {appliedExchange.items.length} {appliedExchange.items.length === 1 ? "item" : "items"}
                                                             </span>
                                                         </button>
                                                         <span className="font-bold tabular-nums text-foreground">
                                                             -{formatCurrency(exchangeCredit)}
                                                         </span>
                                                     </div>
                                                 )}
                                                 {appliedReservation && (appliedReservation.depositAmount ?? 0) > 0 && (
                                                     <div className="flex items-center justify-between text-base mt-1">
                                                         <button
                                                             type="button"
                                                             onClick={handleOpenReservationDialog}
                                                             className="flex items-center gap-1.5 hover:underline decoration-black/30 dark:decoration-white/30 underline-offset-2 font-medium text-foreground"
                                                             title="Ver detalle de la reserva"
                                                         >
                                                             <span>Seña reserva</span>
                                                             <span className="text-xs bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded-md font-semibold">
                                                                 {appliedReservation.reservationNumber}
                                                             </span>
                                                         </button>
                                                         <span className="font-bold tabular-nums text-violet-600 dark:text-violet-400">
                                                             -{formatCurrency(appliedReservation.depositAmount ?? 0)}
                                                         </span>
                                                     </div>
                                                 )}
                                             </AnimatedSizeContainer>
                                             <div className="flex items-center justify-between border-t border-border/70 pt-3">
                                                 <div>
                                                     <p className={cn("text-sm font-medium", hasExchangeOverage ? "text-foreground" : "text-muted-foreground")}>
                                                         {hasExchangeOverage ? "A favor cliente" : "Total a cobrar"}
                                                     </p>
                                                     <p className="text-xs text-muted-foreground">
                                                         {priceMode === "wholesale"
                                                             ? "Usando precio mayorista"
                                                             : "Usando precio de venta"}
                                                     </p>
                                                 </div>
                                                 <span className={cn("text-3xl font-bold tracking-tight", hasExchangeOverage && "text-foreground")}>
                                                     <AnimatedValue
                                                         value={`${priceMode}-${appliedExchange ? balanceAmount : payableAmount}`}
                                                     >
                                                         {formatCurrency(appliedExchange ? balanceAmount : payableAmount)}
                                                     </AnimatedValue>
                                                 </span>
                                             </div>
                                         </div>

                                         <div className="space-y-2">
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
                                                 {shouldFinalizeExchangeDirectly ? (
                                                     balanceAmount === 0 ? "Finalizar cambio (Neto $0)" : "Finalizar cambio (A favor)"
                                                 ) : (
                                                     <>
                                                         Cobrar{" "}
                                                         <AnimatedValue value={`${priceMode}-${payableAmount}`}>
                                                             {formatCurrency(payableAmount)}
                                                         </AnimatedValue>
                                                     </>
                                                 )}
                                             </Button>

                                            {!shouldFinalizeExchangeDirectly && (
                                                <Button
                                                    variant="outline"
                                                    className="h-11 w-full rounded-xl border-dashed border-border/80 text-muted-foreground hover:text-foreground transition-all duration-200"
                                                    disabled={(cart.length === 0 && !appliedExchange) || !selectedSellerId}
                                                    onClick={() => setCreateReservationOpen(true)}
                                                >
                                                    <Bookmark className="size-4 mr-2" />
                                                    Reservar
                                                </Button>
                                            )}
                                        </div>
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
                onSearchKeyDown={handleExchangeSearchKeyDown}
            />

            <ReservationDialog
                open={reservationDialogOpen}
                onOpenChange={setReservationDialogOpen}
                onApply={handleApplyReservation}
                initialSearch={reservationDialogInitialSearch}
            />

            <CreateReservationDialog
                open={createReservationOpen}
                onOpenChange={setCreateReservationOpen}
                items={cart
                    .filter((item) => !item.isGift)
                    .map((item): CreateReservationItemPreview => ({
                        variantId: item.product.id,
                        productName: item.product.name,
                        variantLabel: [
                            item.product.sizes[0] && item.product.sizes[0] !== "Único"
                                ? `Talle ${item.product.sizes[0]}`
                                : null,
                            item.product.color && item.product.color !== "Único"
                                ? item.product.color
                                : null,
                        ]
                            .filter(Boolean)
                            .join(" · "),
                        quantity: item.quantity,
                        priceAtTime: priceMode === "wholesale"
                            ? item.product.wholesalePrice
                            : item.product.price,
                        priceType: priceMode === "wholesale" ? "WHOLESALE" : "NORMAL",
                    }))}
                estimatedTotal={payableAmount + reservationDeposit}
                onConfirm={handleCreateReservation}
            />

            <Dialog open={quickCreateOpen} onOpenChange={setQuickCreateOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Creación rápida de producto</DialogTitle>
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
                            <Label htmlFor="quick-create-price">Precio</Label>
                            <Input
                                id="quick-create-price"
                                type="number"
                                min="0"
                                step="0.01"
                                value={quickCreatePrice}
                                onChange={(event) => {
                                    setQuickCreatePrice(event.target.value);
                                    setQuickCreateWholesalePrice(event.target.value);
                                }}
                                placeholder="Ej: 24990"
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
    onSearchKeyDown,
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
    onSearchKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] h-[600px] overflow-hidden border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_28px_90px_-40px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(17,24,39,0.98))] dark:shadow-[0_32px_100px_-36px_rgba(0,0,0,0.8)] sm:max-w-4xl flex flex-col">
                <DialogHeader className="shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <ReceiptText className="size-5" />
                        Aplicar Cambio
                    </DialogTitle>
                    <DialogDescription className="text-sm leading-6 text-muted-foreground dark:text-slate-300">
                        Buscá una boleta, elegí los productos a cambiar y aplicá el crédito.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] flex-1 min-h-0 overflow-hidden">
                    <div className="flex flex-col h-full min-h-0 space-y-3">
                        <div className="relative shrink-0 group">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60 transition-colors duration-200 group-focus-within:text-rose-500 dark:group-focus-within:text-rose-400" />
                            <Input
                                ref={searchInputRef}
                                placeholder="Buscar número de boleta..."
                                value={searchQuery}
                                onChange={(event) => onSearchQueryChange(event.target.value)}
                                onKeyDown={onSearchKeyDown}
                                className="pl-9 rounded-xl border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50 focus:bg-background dark:border-neutral-800 dark:bg-neutral-900/40 dark:hover:bg-neutral-900/60 dark:focus:bg-neutral-950 transition-all text-sm shadow-sm focus:shadow-[0_8px_30px_rgba(244,63,94,0.04)]"
                            />
                        </div>

                        <div 
                            data-lenis-prevent
                            className="flex-1 overflow-y-auto space-y-2 rounded-[1.25rem] border border-border/70 bg-background/65 p-2 dark:border-white/10 dark:bg-slate-950/45 min-h-0"
                        >
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
                                            "w-full rounded-xl border p-3 text-left transition-all duration-200 relative overflow-hidden group active:scale-[0.98]",
                                            selectedSale?.id === sale.id
                                                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-950 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-50"
                                                : "border-neutral-200 bg-transparent hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800/80 dark:hover:border-neutral-700/60 dark:hover:bg-neutral-800/30"
                                        )}
                                        onClick={() => onSelectSale(sale)}
                                    >
                                        {selectedSale?.id === sale.id && (
                                            <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                                        )}
                                        <p className={cn(
                                            "font-semibold text-sm tracking-tight",
                                            selectedSale?.id === sale.id ? "text-emerald-900 dark:text-emerald-200" : "text-foreground"
                                        )}>
                                            Boleta #{sale.ticketNumber.toString().padStart(5, "0")}
                                        </p>
                                        <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground/80 dark:text-slate-400">
                                            <span className="flex items-center gap-1">
                                                {formatArgentinaShortDate(sale.date)}
                                            </span>
                                            <span className="bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded text-[10px] font-medium tracking-tight">
                                                {sale.items.length} {sale.items.length === 1 ? "ítem" : "ítems"}
                                            </span>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="rounded-[1.35rem] border border-border/70 bg-background/65 dark:border-white/10 dark:bg-slate-950/40 overflow-hidden flex flex-col h-full min-h-0">
                        {!selectedSale ? (
                            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground dark:text-slate-300">
                                Seleccioná una boleta a la izquierda para cargar los productos disponibles para cambio.
                            </div>
                        ) : (
                            <div className="flex h-full flex-col min-h-0">
                                <div className="border-b border-border/40 p-4 dark:border-white/5 bg-neutral-50/50 dark:bg-neutral-900/20 shrink-0">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p className="font-bold text-base text-foreground tracking-tight">
                                                Boleta #{selectedSale.ticketNumber.toString().padStart(5, "0")}
                                            </p>
                                            <div className="flex items-center gap-2.5 flex-wrap mt-2">
                                                <div className="inline-flex items-center gap-1.5 bg-neutral-100/80 dark:bg-neutral-800/80 px-3 py-1 rounded-full border border-neutral-200/50 dark:border-neutral-700/50 text-xs font-semibold text-neutral-800 dark:text-neutral-200 shadow-sm">
                                                    <UserCircle className="h-4 w-4 text-neutral-500 dark:text-neutral-400" />
                                                    <span>{selectedSale.sellerName}</span>
                                                </div>
                                                <span className="text-neutral-300 dark:text-neutral-700 text-xs">•</span>
                                                <span className="text-xs text-muted-foreground/85 dark:text-slate-400">
                                                    {formatArgentinaDateTime(selectedSale.date)}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-neutral-200 bg-neutral-100 text-neutral-800 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-200 text-xs font-semibold shadow-sm shrink-0">
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                            </span>
                                            {formatDaysSinceSale(selectedSale.date)}
                                        </div>
                                    </div>
                                </div>
                                
                                <div 
                                    data-lenis-prevent
                                    className="overflow-y-auto p-4 flex-1 space-y-2 min-h-0"
                                >
                                    {selectedSale.items.map((item) => {
                                        const availableQuantity = item.quantity - item.returnedQuantity;
                                        const value = exchangeQuantities[item.id] ?? "";
                                        const currentQty = value === "" ? 0 : parseInt(value, 10);

                                        return (
                                            <div
                                                key={item.id}
                                                className={cn(
                                                    "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border p-3 transition-all duration-200",
                                                    availableQuantity > 0
                                                        ? "border-neutral-200 bg-background hover:border-neutral-300 dark:border-neutral-800/80 dark:bg-slate-900/35 dark:hover:border-neutral-700/60"
                                                        : "border-neutral-200/60 bg-neutral-50/50 opacity-60 dark:border-neutral-800/40 dark:bg-neutral-900/10"
                                                )}
                                            >
                                                {/* Left side: Product Info */}
                                                <div className="flex items-start gap-3 min-w-0 flex-1">
                                                    {/* Availability status dot indicator */}
                                                    <span className={cn(
                                                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                                                        availableQuantity > 0 
                                                            ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" 
                                                            : "bg-neutral-300 dark:bg-neutral-700"
                                                    )} />
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-sm leading-snug tracking-tight text-foreground">{item.productName}</p>
                                                        <p className="text-xs text-muted-foreground/80 mt-0.5">
                                                            {item.size !== "Único" ? `Talle ${item.size} · ` : ""}
                                                            {item.color}
                                                        </p>
                                                        <div className="flex items-center gap-3 mt-1 text-xs">
                                                            <span className="text-muted-foreground">
                                                                Disponible: <span className="font-semibold text-foreground">{availableQuantity} ud.</span>
                                                            </span>
                                                            <span className="text-neutral-300 dark:text-neutral-700">•</span>
                                                            <span className="text-muted-foreground">
                                                                Precio: <span className="font-semibold text-foreground">{formatCurrency(item.priceAtTime)}</span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Right side: iOS Stepper */}
                                                <div className="shrink-0 flex items-center justify-end w-full sm:w-auto">
                                                    {availableQuantity > 0 ? (
                                                        <div className="flex items-center gap-1.5 bg-neutral-100/80 dark:bg-neutral-800/80 rounded-lg p-0.5 border border-neutral-200/50 dark:border-neutral-700/50 shadow-sm">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 rounded-md text-neutral-600 dark:text-neutral-400 hover:bg-white dark:hover:bg-neutral-700 hover:text-neutral-900 dark:hover:text-neutral-100 disabled:opacity-20 disabled:pointer-events-none transition-[background-color,color,transform] duration-150 active:scale-95"
                                                                disabled={currentQty <= 0}
                                                                onClick={() => {
                                                                    const nextQty = Math.max(0, currentQty - 1);
                                                                    onQuantityChange(item.id, nextQty === 0 ? "" : String(nextQty));
                                                                }}
                                                            >
                                                                <Minus className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <span className="w-8 text-center text-sm font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">
                                                                {currentQty}
                                                            </span>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 rounded-md text-neutral-600 dark:text-neutral-400 hover:bg-white dark:hover:bg-neutral-700 hover:text-neutral-900 dark:hover:text-neutral-100 disabled:opacity-20 disabled:pointer-events-none transition-[background-color,color,transform] duration-150 active:scale-95"
                                                                disabled={currentQty >= availableQuantity}
                                                                onClick={() => {
                                                                    const nextQty = Math.min(availableQuantity, currentQty + 1);
                                                                    onQuantityChange(item.id, String(nextQty));
                                                                }}
                                                            >
                                                                <Plus className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 px-2.5 py-1 rounded-full border border-rose-100 dark:border-rose-950/30">
                                                            Devuelto por completo
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="border-t border-border/40 p-4 bg-neutral-50/50 dark:bg-neutral-900/10 dark:border-white/5 mt-auto shrink-0">
                                    <div className="mb-4 flex items-center justify-between font-semibold">
                                        <span className="text-sm font-medium text-muted-foreground">Crédito total a aplicar</span>
                                        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                            {formatCurrency(selectedCredit)}
                                        </span>
                                    </div>
                                    <Button
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl py-5 shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none"
                                        disabled={selectedCredit <= 0}
                                        onClick={onConfirm}
                                    >
                                        Confirmar y aplicar cambio
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
