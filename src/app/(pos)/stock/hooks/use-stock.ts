"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CACHE_TAGS } from "@/lib/core/cache-tags";
import { notifyDataUpdated, useDataRefresh } from "@/lib/sync/data-sync-client";
import { getStockRuntime } from "@/lib/offline/stock-runtime";

export type StockEntry = {
    id: string;
    productId: string;
    providerId?: string;
    quantity: number;
    type: string;
    notes?: string;
    color: string;
    size: string;
    sku: string;
    date: string;
    mode: "simple" | "avanzado";
};

export type StockProduct = {
    id: string;
    name: string;
    code: string;
    price: number;
    wholesalePrice: number;
};

export type StockSupplier = {
    id: string;
    name: string;
};

export type StockVariant = {
    id: string;
    productId: string;
    color: string;
    size: string;
    sku: string;
    stock: number;
};

export type RegisterStockEntry = {
    productId: string;
    quantity: number;
    color: string;
    size: string;
    sku: string;
    supplierId?: string;
};

export type StockMovement = {
    id: string;
    productId: string;
    providerId?: string;
    date: string;
    totalQuantity: number;
    variants: StockEntry[];
};

export type LabelPrintItem = {
    productName: string;
    sku: string;
    size: string;
    color: string;
    retailPrice: number;
    wholesalePrice: number;
};

function buildMovements(entries: StockEntry[]): StockMovement[] {
    const grouped = new Map<string, StockMovement>();
    for (const entry of entries) {
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

function clampQuantity(rawValue: string | undefined, max: number) {
    if (rawValue === "") return 0;
    const parsed = Number.parseInt(rawValue ?? String(max), 10);
    return Number.isNaN(parsed) ? max : Math.max(0, Math.min(parsed, max));
}

function normalizePrintQuantity(rawValue: string, max: number) {
    if (rawValue === "") return "";
    const parsed = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsed)) return "";
    return String(Math.max(0, Math.min(parsed, max)));
}

const STOCK_MOVEMENTS_PER_PAGE = 12;

export function useStock() {
    const stockRuntime = useMemo(() => getStockRuntime(), []);

    // DB States
    const [entries, setEntries] = useState<StockEntry[]>([]);
    const [products, setProducts] = useState<StockProduct[]>([]);
    const [providers, setProviders] = useState<StockSupplier[]>([]);
    const [variants, setVariants] = useState<StockVariant[]>([]);
    const [labelsToPrint, setLabelsToPrint] = useState<LabelPrintItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Filter States
    const [filterProduct, setFilterProduct] = useState("all");
    const [filterProvider, setFilterProvider] = useState("all");
    const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>(new Date());
    const [filterDateTo, setFilterDateTo] = useState<Date | undefined>(new Date());
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    // Form/Dialog States
    const [stockDialogOpen, setStockDialogOpen] = useState(false);
    const [stockAction, setStockAction] = useState<"add" | "remove" | "adjust">("add");
    const [advancedMode, setAdvancedMode] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState("");
    const [selectedProviderId, setSelectedProviderId] = useState("");
    const [productSearchQuery, setProductSearchQuery] = useState("");
    const [providerSearchQuery, setProviderSearchQuery] = useState("");
    const [simpleQuantity, setSimpleQuantity] = useState("");
    const [advancedColor, setAdvancedColor] = useState("");
    const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
    const [sizeQuantities, setSizeQuantities] = useState<Record<string, string>>({});

    // Printing States
    const [selectedMovementIds, setSelectedMovementIds] = useState<string[]>([]);
    const [printDialogOpen, setPrintDialogOpen] = useState(false);
    const [printQuantities, setPrintQuantities] = useState<Record<string, string>>({});
    const [selectedMovement, setSelectedMovement] = useState<StockMovement | null>(null);

    // Load data callback
    const loadData = useCallback(async () => {
        try {
            const data = await stockRuntime.getStockPageData();
            setProducts(data.products);
            setProviders(data.suppliers);
            setEntries(data.entries);
            setVariants(data.variants);
            setIsLoading(false);
        } catch (error) {
            toast.error("Error al cargar el stock");
            console.error(error);
            setIsLoading(false);
        }
    }, [stockRuntime]);

    // Initial load
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            void loadData();
        }, 0);
        return () => clearTimeout(timeoutId);
    }, [loadData]);

    // Sync updates
    useDataRefresh(
        [CACHE_TAGS.stock, CACHE_TAGS.inventory, CACHE_TAGS.suppliers, CACHE_TAGS.posProducts],
        loadData,
        { pollIntervalMs: false }
    );

    // Print cleanup
    useEffect(() => {
        const handleAfterPrint = () => {
            setLabelsToPrint([]);
        };

        window.addEventListener("afterprint", handleAfterPrint);
        return () => {
            window.removeEventListener("afterprint", handleAfterPrint);
        };
    }, []);

    // Memoized Calculations
    const movements = useMemo(() => buildMovements(entries), [entries]);

    const filteredMovements = useMemo(() => {
        return movements.filter((movement) => {
            if (filterProduct !== "all" && movement.productId !== filterProduct) {
                return false;
            }

            if (filterProvider !== "all" && movement.providerId !== filterProvider) {
                return false;
            }

            const movementTime = new Date(movement.date).getTime();

            if (filterDateFrom) {
                const fromTime = new Date(filterDateFrom).setHours(0, 0, 0, 0);
                if (movementTime < fromTime) {
                    return false;
                }
            }

            if (filterDateTo) {
                const toTime = new Date(filterDateTo).setHours(23, 59, 59, 999);
                if (movementTime > toTime) {
                    return false;
                }
            }

            return true;
        });
    }, [filterDateFrom, filterDateTo, filterProduct, filterProvider, movements]);

    const totalMovements = filteredMovements.length;
    const totalMovementPages = Math.max(1, Math.ceil(totalMovements / STOCK_MOVEMENTS_PER_PAGE));

    const paginatedMovements = useMemo(() => {
        const start = (currentPage - 1) * STOCK_MOVEMENTS_PER_PAGE;
        return filteredMovements.slice(start, start + STOCK_MOVEMENTS_PER_PAGE);
    }, [currentPage, filteredMovements]);

    const isMovementSelectable = useCallback(
        (m: StockMovement) =>
            !m.variants.some(
                (variant) => variant.type === "AJUSTE" || variant.type === "SALIDA"
            ),
        []
    );

    const selectedMovements = useMemo(
        () =>
            filteredMovements.filter(
                (m) =>
                    selectedMovementIds.includes(m.id) && isMovementSelectable(m)
            ),
        [filteredMovements, isMovementSelectable, selectedMovementIds]
    );

    const printableVariants = useMemo(
        () =>
            selectedMovements
                .flatMap((m) => m.variants)
                .filter((variant) => variant.quantity > 0),
        [selectedMovements]
    );

    const printableTickets = useMemo(() => {
        return printableVariants.reduce(
            (total, variant) => total + clampQuantity(printQuantities[variant.id], variant.quantity),
            0
        );
    }, [printableVariants, printQuantities]);

    const totalPhysicalStock = useMemo(() => {
        return variants.reduce((sum, v) => sum + Math.max(0, v.stock), 0);
    }, [variants]);

    const stockAlerts = useMemo(() => {
        let outOfStock = 0;
        let lowStock = 0;
        for (const v of variants) {
            if (v.stock <= 0) {
                outOfStock++;
            } else if (v.stock > 0 && v.stock <= 3) {
                lowStock++;
            }
        }
        return { outOfStock, lowStock };
    }, [variants]);

    const inventoryValue = useMemo(() => {
        let retail = 0;
        let wholesale = 0;
        for (const v of variants) {
            if (v.stock > 0) {
                const p = products.find((prod) => prod.id === v.productId);
                if (p) {
                    retail += v.stock * (p.price || 0);
                    wholesale += v.stock * (p.wholesalePrice || 0);
                }
            }
        }
        return { retail, wholesale };
    }, [variants, products]);

    const hasActiveFilters = useMemo(() => {
        return filterProduct !== "all" || filterProvider !== "all" || filterDateFrom !== undefined || filterDateTo !== undefined;
    }, [filterProduct, filterProvider, filterDateFrom, filterDateTo]);

    // Pagination side effects
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setCurrentPage(1);
        }, 0);
        return () => clearTimeout(timeoutId);
    }, [filterProduct, filterProvider, filterDateFrom, filterDateTo]);

    useEffect(() => {
        if (currentPage > totalMovementPages) {
            const timeoutId = setTimeout(() => {
                setCurrentPage(totalMovementPages);
            }, 0);
            return () => clearTimeout(timeoutId);
        }
    }, [currentPage, totalMovementPages]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setSelectedMovementIds((current) =>
                current.filter((movementId) =>
                    movements.some(
                        (m) =>
                            m.id === movementId && isMovementSelectable(m)
                    )
                )
            );
        }, 0);
        return () => clearTimeout(timeoutId);
    }, [isMovementSelectable, movements]);

    // Autocomplete searches
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

    const getProductName = useCallback((id: string) => {
        return products.find((product) => product.id === id)?.name ?? "Desconocido";
    }, [products]);

    const getProviderName = useCallback((id?: string) => {
        return providers.find((provider) => provider.id === id)?.name ?? "—";
    }, [providers]);

    const getProductTotalStock = useCallback((productId: string) => {
        return variants
            .filter((variant) => variant.productId === productId)
            .reduce((sum, variant) => sum + variant.stock, 0);
    }, [variants]);

    const getVariantCurrentStock = useCallback((productId: string, color: string, size: string) => {
        return variants.find(
            (variant) =>
                variant.productId === productId &&
                variant.color === color &&
                variant.size === size
        )?.stock ?? 0;
    }, [variants]);

    const selectedProduct = useMemo(() => {
        return products.find((product) => product.id === selectedProductId) ?? null;
    }, [products, selectedProductId]);

    const selectedProductCurrentStock = useMemo(() => {
        return selectedProductId ? getProductTotalStock(selectedProductId) : 0;
    }, [selectedProductId, getProductTotalStock]);

    const currentSimpleVariantStock = useMemo(() => {
        return selectedProduct
            ? getVariantCurrentStock(selectedProduct.id, "Único", "Único")
            : 0;
    }, [selectedProduct, getVariantCurrentStock]);

    const selectedVariantStocks = useMemo(() => {
        return selectedSizes.map((size) => ({
            size,
            stock: selectedProductId
                ? getVariantCurrentStock(
                      selectedProductId,
                      advancedColor.trim() || "Único",
                      size
                  )
                : 0,
        }));
    }, [advancedColor, getVariantCurrentStock, selectedProductId, selectedSizes]);

    const clearFilters = () => {
        setFilterProduct("all");
        setFilterProvider("all");
        setFilterDateFrom(undefined);
        setFilterDateTo(undefined);
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

    const handleOpenAdjustStock = () => {
        resetStockForm();
        setStockAction("adjust");
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
                if (Number.isNaN(quantity) || quantity < 0) {
                    toast.error(`Ingresá una cantidad válida para el talle ${size}`);
                    return;
                }
                if (stockAction !== "adjust" && quantity <= 0) {
                    toast.error(`Ingresá una cantidad válida para el talle ${size}`);
                    return;
                }
                if (stockAction === "remove") {
                    const currentStock = getVariantCurrentStock(
                        selectedProductId,
                        advancedColor.trim(),
                        size
                    );
                    if (quantity > currentStock) {
                        toast.error(
                            `No podés descontar ${quantity} del talle ${size}; stock actual: ${currentStock}`
                        );
                        return;
                    }
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
            if (Number.isNaN(quantity) || quantity < 0) {
                toast.error("Ingresá una cantidad válida");
                return;
            }
            if (stockAction !== "adjust" && quantity <= 0) {
                toast.error("Ingresá una cantidad válida");
                return;
            }
            if (stockAction === "remove" && quantity > currentSimpleVariantStock) {
                toast.error(
                    `No podés descontar ${quantity}; stock actual de la variante simple: ${currentSimpleVariantStock}`
                );
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
                await stockRuntime.registerStockEntries(newEntries);
            } else if (stockAction === "remove") {
                await stockRuntime.reduceStockEntries(newEntries);
            } else {
                await stockRuntime.adjustStockEntries(newEntries);
            }
            await loadData();
            notifyDataUpdated([CACHE_TAGS.stock, CACHE_TAGS.inventory, CACHE_TAGS.posProducts]);
            
            setStockDialogOpen(false);
            resetStockForm();
            toast.success(
                stockAction === "add"
                    ? "Ingreso de stock registrado"
                    : stockAction === "remove"
                      ? "Stock reducido"
                      : "Stock ajustado",
                {
                    description:
                        stockAction === "adjust"
                            ? `${product.name} · nuevo stock actualizado`
                            : `${product.name} · ${newEntries.reduce((sum, entry) => sum + entry.quantity, 0)} unidad(es)`,
                }
            );
            setIsSaving(false);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : stockAction === "add"
                      ? "Error al guardar el ingreso en la base de datos"
                      : stockAction === "remove"
                        ? "Error al reducir stock"
                        : "Error al ajustar stock";
            toast.error(message);
            console.error(error);
            setIsSaving(false);
        }
    };

    const toggleMovementSelection = (movementId: string, checked: boolean) => {
        const movement = movements.find((item) => item.id === movementId);
        if (!movement || !isMovementSelectable(movement)) {
            return;
        }

        setSelectedMovementIds((current) =>
            checked ? [...current, movementId] : current.filter((id) => id !== movementId)
        );
    };

    const handleOpenPrintDialog = () => {
        if (selectedMovements.length === 0) return;
        setPrintQuantities((current) => {
            const next = { ...current };
            for (const variant of selectedMovements.flatMap((m) => m.variants)) {
                if (!next[variant.id]) {
                    next[variant.id] = String(variant.quantity);
                }
            }
            return next;
        });
        
        setTimeout(() => {
            setPrintDialogOpen(true);
        }, 10);
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
            setTimeout(() => {
                setLabelsToPrint([]);
            }, 1000);
        }, 300);
    };

    const handleQuickPrintMovement = (m: StockMovement) => {
        const itemsToPrint: LabelPrintItem[] = [];

        for (const variant of m.variants) {
            const product = products.find((p) => p.id === variant.productId);
            if (product && variant.quantity > 0) {
                for (let i = 0; i < variant.quantity; i++) {
                    itemsToPrint.push({
                        productName: product.name,
                        sku: variant.sku,
                        size: variant.size,
                        color: variant.color,
                        retailPrice: product.price,
                        wholesalePrice: product.wholesalePrice,
                    });
                }
            }
        }

        if (itemsToPrint.length === 0) {
            toast.error("No hay etiquetas para imprimir en este movimiento");
            return;
        }

        setLabelsToPrint(itemsToPrint);
        
        toast.success("Enviando a impresión...", {
            description: `${itemsToPrint.length} etiqueta(s) generada(s)`,
        });

        setTimeout(() => {
            window.print();
            setTimeout(() => {
                setLabelsToPrint([]);
            }, 1000);
        }, 300);
    };

    return {
        // DB states
        entries,
        products,
        providers,
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
        setStockAction,
        advancedMode,
        setAdvancedMode,
        selectedProductId,
        setSelectedProductId,
        selectedProviderId,
        setSelectedProviderId,
        productSearchQuery,
        setProductSearchQuery,
        providerSearchQuery,
        setProviderSearchQuery,
        simpleQuantity,
        setSimpleQuantity,
        advancedColor,
        setAdvancedColor,
        selectedSizes,
        setSelectedSizes,
        sizeQuantities,
        setSizeQuantities,
        // Printing states
        selectedMovementIds,
        setSelectedMovementIds,
        printDialogOpen,
        setPrintDialogOpen,
        printQuantities,
        setPrintQuantities,
        selectedMovement,
        setSelectedMovement,
        // Computed
        movements,
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
        // Methods
        clearFilters,
        resetStockForm,
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
        getProviderName,
    };
}
