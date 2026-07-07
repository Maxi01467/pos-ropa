"use client";

import { useCallback, useEffect, useMemo, useState, type SetStateAction } from "react";
import { toast } from "sonner";
import { CACHE_TAGS } from "@/lib/core/cache-tags";
import { notifyDataUpdated, useDataRefresh } from "@/lib/sync/data-sync-client";
import { getInventoryRuntime } from "@/lib/offline/inventory-runtime";
import type { DBProduct } from "../page";

function sortProducts(items: DBProduct[]) {
    return [...items].sort((left, right) => right.id.localeCompare(left.id));
}

const CATALOG_ITEMS_PER_PAGE = 8;

export function useInventory() {
    const inventoryRuntime = useMemo(() => getInventoryRuntime(), []);

    // DB States
    const [products, setProducts] = useState<DBProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // UI States
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("catalogo");
    const [currentPage, setCurrentPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<DBProduct | null>(null);

    // Form States
    const [formName, setFormName] = useState("");
    const [formPrice, setFormPrice] = useState("");
    const [formWholesalePrice, setFormWholesalePrice] = useState("");
    const [formCostPrice, setFormCostPrice] = useState("");

    // Load data callback
    const loadData = useCallback(async () => {
        try {
            const data = await inventoryRuntime.getInventoryData();
            setProducts(data.products);
            setIsLoading(false);
        } catch (error) {
            toast.error("Error al cargar el inventario");
            console.error(error);
            setIsLoading(false);
        }
    }, [inventoryRuntime]);

    // Initial load
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            void loadData();
        }, 0);
        return () => clearTimeout(timeoutId);
    }, [loadData]);

    // Sync across tabs/updates
    useDataRefresh(
        [CACHE_TAGS.inventory, CACHE_TAGS.stock, CACHE_TAGS.posProducts, CACHE_TAGS.quickCreations],
        loadData,
        { pollIntervalMs: false }
    );

    // Reset Form
    const resetForm = () => {
        setFormName("");
        setFormPrice("");
        setFormWholesalePrice("");
        setFormCostPrice("");
        setEditingProduct(null);
    };

    const handleOpenNew = () => {
        resetForm();
        setDialogOpen(true);
    };

    const handleOpenEdit = (product: DBProduct) => {
        setEditingProduct(product);
        setFormName(product.name);
        setFormPrice(String(product.price));
        setFormWholesalePrice(String(product.wholesalePrice));
        setFormCostPrice(product.costPrice ? String(product.costPrice) : "");
        setDialogOpen(true);
    };

    // Save action (Create / Edit)
    const handleSave = async () => {
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
            costPrice !== undefined && isNaN(parsedWholesalePrice)
                ? Math.round(costPrice * 1.2)
                : parsedWholesalePrice;

        if (Number.isNaN(wholesalePrice) || wholesalePrice <= 0) {
            toast.error("Ingresá un precio mayorista válido");
            return;
        }

        setIsSaving(true);
        try {
            const productData = {
                name: formName.trim(),
                price,
                wholesalePrice,
                costPrice,
            };

            if (editingProduct) {
                const updatedProduct = await inventoryRuntime.updateProduct(editingProduct.id, productData);
                setProducts((current) =>
                    sortProducts(
                        current.map((product) =>
                            product.id === updatedProduct.id
                                ? {
                                      ...product,
                                      name: updatedProduct.name,
                                      pendingReview: updatedProduct.pendingReview,
                                      reviewedAt: updatedProduct.reviewedAt,
                                      reviewedByName: updatedProduct.reviewedByName ?? undefined,
                                      price: updatedProduct.price,
                                      wholesalePrice: updatedProduct.wholesalePrice,
                                      costPrice: updatedProduct.costPrice,
                                  }
                                : product
                        )
                    )
                );
                toast.success("Producto actualizado");
            } else {
                const createdProduct = await inventoryRuntime.createProduct(productData);
                setProducts((current) =>
                    sortProducts([
                        {
                            id: createdProduct.id,
                            code: createdProduct.id.slice(-6).toUpperCase(),
                            name: createdProduct.name,
                            quickCreated: createdProduct.quickCreated,
                            pendingReview: createdProduct.pendingReview,
                            quickCreatedAt: createdProduct.quickCreatedAt,
                            quickCreatedByName: createdProduct.quickCreatedByName,
                            quickCreatedByRole: createdProduct.quickCreatedByRole,
                            reviewedAt: createdProduct.reviewedAt,
                            reviewedByName: createdProduct.reviewedByName,
                            price: createdProduct.price,
                            wholesalePrice: createdProduct.wholesalePrice,
                            costPrice: createdProduct.costPrice,
                            stock: 0,
                        },
                        ...current,
                    ])
                );
                toast.success("Producto creado con éxito");
            }

            setDialogOpen(false);
            resetForm();
            notifyDataUpdated([
                CACHE_TAGS.inventory,
                CACHE_TAGS.stock,
                CACHE_TAGS.posProducts,
                CACHE_TAGS.quickCreations,
            ]);
            setIsSaving(false);
        } catch (error) {
            toast.error("Hubo un error al guardar");
            console.error(error);
            setIsSaving(false);
        }
    };

    // Mark reviewed action
    const handleMarkReviewed = async (product: DBProduct) => {
        try {
            const reviewedProduct = await inventoryRuntime.markProductReviewed(product.id);
            setProducts((current) =>
                sortProducts(
                    current.map((item) =>
                        item.id === reviewedProduct.id
                            ? {
                                  ...item,
                                  pendingReview: reviewedProduct.pendingReview,
                                  reviewedAt: reviewedProduct.reviewedAt,
                                  reviewedByName: reviewedProduct.reviewedByName ?? undefined,
                              }
                            : item
                    )
                )
            );
            notifyDataUpdated([CACHE_TAGS.inventory, CACHE_TAGS.quickCreations]);
            toast.success("Producto marcado como revisado");
        } catch (error) {
            toast.error("No se pudo marcar como revisado");
            console.error(error);
        }
    };

    // Delete action
    const handleDelete = async (product: DBProduct) => {
        if (!confirm(`¿Estás seguro de eliminar ${product.name}?`)) return;

        try {
            await inventoryRuntime.deleteProduct(product.id);
            setProducts((prev) => prev.filter((p) => p.id !== product.id));
            notifyDataUpdated([
                CACHE_TAGS.inventory,
                CACHE_TAGS.stock,
                CACHE_TAGS.posProducts,
                CACHE_TAGS.quickCreations,
            ]);
            toast.success("Producto eliminado", { description: product.name });
        } catch {
            toast.error("Error al eliminar el producto");
        }
    };

    // Computed Values
    const filteredProducts = useMemo(() => {
        return products.filter((p) => {
            return (
                !searchQuery.trim() ||
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.code.toLowerCase().includes(searchQuery.toLowerCase())
            );
        });
    }, [products, searchQuery]);

    const pendingProducts = useMemo(
        () => filteredProducts.filter((product) => product.pendingReview),
        [filteredProducts]
    );

    const totalCatalogPages = Math.max(
        1,
        Math.ceil(filteredProducts.length / CATALOG_ITEMS_PER_PAGE)
    );

    const paginatedProducts = useMemo(() => {
        const start = (currentPage - 1) * CATALOG_ITEMS_PER_PAGE;
        return filteredProducts.slice(start, start + CATALOG_ITEMS_PER_PAGE);
    }, [currentPage, filteredProducts]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setCurrentPage(1);
        }, 0);
        return () => clearTimeout(timeoutId);
    }, [activeTab, searchQuery]);

    useEffect(() => {
        if (currentPage > totalCatalogPages) {
            const timeoutId = setTimeout(() => {
                setCurrentPage(totalCatalogPages);
            }, 0);
            return () => clearTimeout(timeoutId);
        }
    }, [currentPage, totalCatalogPages]);

    const pendingCount = useMemo(
        () => products.filter((product) => product.pendingReview).length,
        [products]
    );

    // Margin calculations for form
    const salePriceNum = parseFloat(formPrice) || 0;
    const wholesalePriceNum = parseFloat(formWholesalePrice) || 0;
    const costPriceNum = parseFloat(formCostPrice) || 0;

    const calculatedWholesalePrice = useMemo(() => {
        return costPriceNum > 0 ? Math.round(costPriceNum * 1.2) : wholesalePriceNum;
    }, [costPriceNum, wholesalePriceNum]);

    const margin = useMemo(() => {
        return salePriceNum > 0 && costPriceNum > 0
            ? (((salePriceNum - costPriceNum) / costPriceNum) * 100).toFixed(0)
            : null;
    }, [salePriceNum, costPriceNum]);

    return {
        // States
        products,
        isLoading,
        isSaving,
        searchQuery,
        setSearchQuery,
        activeTab,
        setActiveTab,
        currentPage,
        setCurrentPage,
        dialogOpen,
        setDialogOpen,
        editingProduct,
        formName,
        setFormName,
        formPrice,
        setFormPrice,
        formWholesalePrice,
        setFormWholesalePrice,
        formCostPrice,
        setFormCostPrice,
        // Computed
        filteredProducts,
        pendingProducts,
        paginatedProducts,
        totalCatalogPages,
        pendingCount,
        margin,
        calculatedWholesalePrice,
        costPriceNum,
        salePriceNum,
        // Handlers
        handleOpenNew,
        handleOpenEdit,
        handleSave,
        handleMarkReviewed,
        handleDelete,
    };
}
