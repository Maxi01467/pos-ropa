// src/app/actions/stock-actions.ts
"use server";

import { revalidateTag, unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
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
    color: string;
    size: string;
    sku: string;
    date: string;
    mode: "simple" | "avanzado";
};

// 1. Traer los datos iniciales para la pantalla
const getStockPageDataCached = unstable_cache(
    async () => {
        const [products, suppliers, movements] = await Promise.all([
            prisma.product.findMany({
                select: { id: true, name: true, priceNormal: true, priceWholesale: true },
            }),
            prisma.supplier.findMany({
                select: { id: true, name: true },
            }),
            prisma.stockMovement.findMany({
                select: {
                    id: true,
                    supplierId: true,
                    quantity: true,
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
            }),
        ]);

        const formattedEntries: StockPageEntry[] = movements.map((m) => ({
            id: m.id,
            productId: m.variant.productId,
            providerId: m.supplierId || undefined,
            quantity: m.quantity,
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
        };
    },
    ["stock-page-data"],
    {
        revalidate: 300,
        tags: [CACHE_TAGS.stock, CACHE_TAGS.inventory, CACHE_TAGS.suppliers, CACHE_TAGS.posProducts],
    }
);

export async function getStockPageData() {
    return getStockPageDataCached();
}

// 2. Registrar nuevos ingresos (Usa Transacciones para máxima seguridad)
export async function registerStockEntries(entries: RegisterStockEntry[]) {
    const result = await prisma.$transaction(async (tx) => {
        for (const entry of entries) {
            let variant = await tx.productVariant.findUnique({
                where: { sku: entry.sku }
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
            const variant = await tx.productVariant.findUnique({
                where: { sku: entry.sku },
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
                    type: "AJUSTE",
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
