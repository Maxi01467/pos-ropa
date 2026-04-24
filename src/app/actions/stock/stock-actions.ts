// src/app/actions/stock-actions.ts
"use server";

import { revalidateTag } from "next/cache";
import { CACHE_TAGS, unstable_cache } from "@/lib/core/cache-tags";
import { prisma } from "@/lib/prisma";

type RegisterStockEntry = {
    productId: string;
    quantity: number;
    color: string;
    size: string;
    sku: string;
    supplierId?: string;
};

type StockPageProduct = {
    id: string;
    name: string;
    code: string;
    price: number;
    wholesalePrice: number;
};

type StockPageSupplier = {
    id: string;
    name: string;
};

type StockPageEntry = {
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

type StockPageVariant = {
    id: string;
    productId: string;
    color: string;
    size: string;
    sku: string;
    stock: number;
};

type GetStockPageDataInput = {
    movementPage?: number;
    movementPageSize?: number;
    productId?: string;
    supplierId?: string;
    dateFrom?: string;
    dateTo?: string;
};

// 1. Traer los datos iniciales para la pantalla
const getStockPageDataCached = unstable_cache(
    async ({
        movementPage,
        movementPageSize,
        productId,
        supplierId,
        dateFrom,
        dateTo,
    }: Required<GetStockPageDataInput>) => {
        const hasServerPagination = movementPage > 0 && movementPageSize > 0;
        const safePage = hasServerPagination ? Math.max(1, Math.trunc(movementPage)) : 1;
        const safePageSize = hasServerPagination
            ? Math.max(1, Math.min(100, Math.trunc(movementPageSize)))
            : 0;
        const skip = hasServerPagination ? (safePage - 1) * safePageSize : undefined;
        const take = hasServerPagination ? safePageSize : undefined;
        const movementWhere = {
            deletedAt: null,
            variant: {
                deletedAt: null,
                product: {
                    deletedAt: null,
                },
                ...(productId ? { productId } : {}),
            },
            ...(supplierId ? { supplierId } : {}),
            ...(dateFrom || dateTo
                ? {
                      createdAt: {
                          ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00`) } : {}),
                          ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999`) } : {}),
                      },
                  }
                : {}),
        };

        const [products, suppliers, movements, totalMovements, variants] = await Promise.all([
            prisma.product.findMany({
                where: {
                    deletedAt: null,
                },
                select: { id: true, name: true, priceNormal: true, priceWholesale: true },
            }),
            prisma.supplier.findMany({
                where: {
                    deletedAt: null,
                },
                select: { id: true, name: true },
            }),
            prisma.stockMovement.findMany({
                where: movementWhere,
                select: {
                    id: true,
                    supplierId: true,
                    quantity: true,
                    type: true,
                    notes: true,
                    createdAt: true,
                    variant: {
                        select: {
                            productId: true,
                            color: true,
                            size: true,
                            sku: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take,
            }),
            prisma.stockMovement.count({
                where: movementWhere,
            }),
            prisma.productVariant.findMany({
                where: {
                    deletedAt: null,
                    product: {
                        deletedAt: null,
                    },
                },
                select: {
                    id: true,
                    productId: true,
                    color: true,
                    size: true,
                    sku: true,
                    stock: true,
                },
            }),
        ]);

        const formattedEntries: StockPageEntry[] = movements.map((m) => ({
            id: m.id,
            productId: m.variant.productId,
            providerId: m.supplierId || undefined,
            quantity: m.quantity,
            type: m.type,
            notes: m.notes || undefined,
            color: m.variant.color,
            size: m.variant.size,
            sku: m.variant.sku,
            date: m.createdAt.toISOString(),
            mode: "simple",
        }));

        return {
            products: products.map(
                (p): StockPageProduct => ({
                    id: p.id,
                    name: p.name,
                    code: p.id.slice(-6).toUpperCase(),
                    price: Number(p.priceNormal),
                    wholesalePrice: Number(p.priceWholesale),
                })
            ),
            suppliers: suppliers as StockPageSupplier[],
            entries: formattedEntries,
            variants: variants.map(
                (variant): StockPageVariant => ({
                    id: variant.id,
                    productId: variant.productId,
                    color: variant.color,
                    size: variant.size,
                    sku: variant.sku,
                    stock: variant.stock,
                })
            ),
            movementPage: safePage,
            movementPageSize: hasServerPagination ? safePageSize : totalMovements,
            totalMovements,
            totalMovementPages: hasServerPagination
                ? Math.max(1, Math.ceil(totalMovements / safePageSize))
                : 1,
        };
    },
    ["stock-page-data"],
    {
        revalidate: 300,
        tags: [CACHE_TAGS.stock, CACHE_TAGS.inventory, CACHE_TAGS.suppliers, CACHE_TAGS.posProducts],
    }
);

export async function getStockPageData({
    movementPage,
    movementPageSize,
    productId,
    supplierId,
    dateFrom,
    dateTo,
}: GetStockPageDataInput = {}) {
    return getStockPageDataCached({
        movementPage: movementPage ?? 0,
        movementPageSize: movementPageSize ?? 0,
        productId: productId ?? "",
        supplierId: supplierId ?? "",
        dateFrom: dateFrom ?? "",
        dateTo: dateTo ?? "",
    });
}

// 2. Registrar nuevos ingresos (Usa Transacciones para máxima seguridad)
export async function registerStockEntries(entries: RegisterStockEntry[]) {
    const result = await prisma.$transaction(async (tx) => {
        for (const entry of entries) {
            let variant = await tx.productVariant.findFirst({
                where: {
                    sku: entry.sku,
                    deletedAt: null,
                    product: {
                        deletedAt: null,
                    },
                }
            });

            if (variant) {
                variant = await tx.productVariant.update({
                    where: { id: variant.id },
                    data: { stock: { increment: entry.quantity } }
                });
            } else {
                variant = await tx.productVariant.create({
                    data: {
                        productId: entry.productId,
                        size: entry.size,
                        color: entry.color,
                        sku: entry.sku,
                        stock: entry.quantity
                    }
                });
            }

            await tx.stockMovement.create({
                data: {
                    variantId: variant.id,
                    supplierId: entry.supplierId || null,
                    quantity: entry.quantity,
                    type: "INGRESO",
                    notes: "Ingreso desde panel de stock"
                }
            });
        }
    });

    revalidateTag(CACHE_TAGS.stock, "max");
    revalidateTag(CACHE_TAGS.inventory, "max");
    revalidateTag(CACHE_TAGS.posProducts, "max");

    return result;
}

export async function reduceStockEntries(entries: RegisterStockEntry[]) {
    const result = await prisma.$transaction(async (tx) => {
        for (const entry of entries) {
            const variant = await tx.productVariant.findFirst({
                where: {
                    sku: entry.sku,
                    deletedAt: null,
                    product: {
                        deletedAt: null,
                    },
                },
            });

            if (!variant || variant.productId !== entry.productId) {
                throw new Error("La variante a descontar no existe");
            }

            if (variant.stock < entry.quantity) {
                throw new Error(`Stock insuficiente para ${entry.sku}`);
            }

            await tx.productVariant.update({
                where: { id: variant.id },
                data: { stock: { decrement: entry.quantity } },
            });

            await tx.stockMovement.create({
                data: {
                    variantId: variant.id,
                    quantity: -entry.quantity,
                    type: "SALIDA",
                    notes: "Salida desde panel de stock",
                },
            });
        }
    });

    revalidateTag(CACHE_TAGS.stock, "max");
    revalidateTag(CACHE_TAGS.inventory, "max");
    revalidateTag(CACHE_TAGS.posProducts, "max");

    return result;
}

export async function adjustStockEntries(entries: RegisterStockEntry[]) {
    const result = await prisma.$transaction(async (tx) => {
        for (const entry of entries) {
            let variant = await tx.productVariant.findFirst({
                where: {
                    sku: entry.sku,
                    deletedAt: null,
                    product: {
                        deletedAt: null,
                    },
                },
            });

            if (!variant) {
                if (entry.quantity <= 0) {
                    continue;
                }

                variant = await tx.productVariant.create({
                    data: {
                        productId: entry.productId,
                        size: entry.size,
                        color: entry.color,
                        sku: entry.sku,
                        stock: entry.quantity,
                    },
                });

                await tx.stockMovement.create({
                    data: {
                        variantId: variant.id,
                        supplierId: entry.supplierId || null,
                        quantity: entry.quantity,
                        type: "AJUSTE",
                        notes: "Ajuste desde panel de stock",
                    },
                });
                continue;
            }

            if (variant.productId !== entry.productId) {
                throw new Error("La variante a ajustar no coincide con el producto seleccionado");
            }

            const delta = entry.quantity - variant.stock;

            if (delta === 0) {
                continue;
            }

            await tx.productVariant.update({
                where: { id: variant.id },
                data: { stock: entry.quantity },
            });

            await tx.stockMovement.create({
                data: {
                    variantId: variant.id,
                    supplierId: entry.supplierId || null,
                    quantity: delta,
                    type: "AJUSTE",
                    notes: "Ajuste desde panel de stock",
                },
            });
        }
    });

    revalidateTag(CACHE_TAGS.stock, "max");
    revalidateTag(CACHE_TAGS.inventory, "max");
    revalidateTag(CACHE_TAGS.posProducts, "max");

    return result;
}
