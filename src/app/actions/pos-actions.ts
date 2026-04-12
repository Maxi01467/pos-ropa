// src/app/actions/pos-actions.ts
"use server";

import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";

type POSProduct = {
    id: string;
    code: string;
    name: string;
    price: number;
    wholesalePrice: number;
    stock: number;
    sizes: string[];
    color: string;
    productId?: string;
    legacyBarcodes: string[];
};

const PRODUCT_FOR_POS_SELECT = {
    id: true,
    name: true,
    priceNormal: true,
    priceWholesale: true,
    variants: {
        select: {
            id: true,
            sku: true,
            size: true,
            color: true,
            stock: true,
            barcodeAliases: {
                select: { barcode: true },
            },
        },
    },
} satisfies Prisma.ProductSelect;

function mapProductsForPOS(
    products: Prisma.ProductGetPayload<{ select: typeof PRODUCT_FOR_POS_SELECT }>[]
): POSProduct[] {
    return products.flatMap((product) => {
        if (product.variants.length === 0) {
            return [
                {
                    id: product.id,
                    code: product.id.slice(-6).toUpperCase(),
                    name: product.name,
                    price: Number(product.priceNormal),
                    wholesalePrice: Number(product.priceWholesale),
                    stock: 0,
                    sizes: [],
                    color: "",
                    productId: product.id,
                    legacyBarcodes: [] as string[],
                },
            ];
        }

        return product.variants.map((variant) => ({
            id: variant.id,
            code: variant.sku,
            name: variant.size === "Único"
                ? product.name
                : `${product.name} - Talle ${variant.size}`,
            price: Number(product.priceNormal),
            wholesalePrice: Number(product.priceWholesale),
            stock: variant.stock,
            sizes: [variant.size],
            color: variant.color,
            productId: product.id,
            legacyBarcodes: variant.barcodeAliases.map((a) => a.barcode),
        }));
    });
}

const getSellersCached = unstable_cache(
    async () =>
        prisma.user.findMany({
            where: {
                active: true,
            },
            select: {
                id: true,
                name: true,
                role: true,
            },
            orderBy: { name: "asc" },
        }),
    ["pos-sellers"],
    { revalidate: 300, tags: [CACHE_TAGS.posSellers, CACHE_TAGS.employees] }
);

const getProductsForPOSCached = unstable_cache(
    async () => {
        const products = await prisma.product.findMany({
            select: PRODUCT_FOR_POS_SELECT,
            orderBy: {
                createdAt: "desc",
            },
        });

        return mapProductsForPOS(products);
    },
    ["pos-products"],
    { revalidate: 300, tags: [CACHE_TAGS.posProducts, CACHE_TAGS.inventory, CACHE_TAGS.stock] }
);

const getFeaturedProductsForPOSCached = unstable_cache(
    async () => {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentSales = await prisma.sale.findMany({
            where: {
                createdAt: {
                    gte: since,
                },
            },
            orderBy: {
                createdAt: "desc",
            },
            include: {
                items: {
                    select: {
                        variantId: true,
                        quantity: true,
                    },
                },
            },
        });

        const soldByVariant = new Map<string, number>();
        for (const sale of recentSales) {
            for (const item of sale.items) {
                soldByVariant.set(
                    item.variantId,
                    (soldByVariant.get(item.variantId) ?? 0) + item.quantity
                );
            }
        }

        const products = await prisma.product.findMany({
            select: PRODUCT_FOR_POS_SELECT,
            orderBy: {
                createdAt: "desc",
            },
        });

        const variants = mapProductsForPOS(products);
        const ranked = [...variants].sort((left, right) => {
            const soldRight = soldByVariant.get(right.id) ?? 0;
            const soldLeft = soldByVariant.get(left.id) ?? 0;

            if (soldRight !== soldLeft) {
                return soldRight - soldLeft;
            }

            if (right.stock !== left.stock) {
                return right.stock - left.stock;
            }

            return left.name.localeCompare(right.name, "es", { sensitivity: "base" });
        });

        const inStockRanked = ranked.filter((product) => product.stock > 0);
        const fallback = ranked.filter((product) => product.stock <= 0);

        return [...inStockRanked, ...fallback].slice(0, 9);
    },
    ["pos-featured-products"],
    {
        revalidate: 300,
        tags: [CACHE_TAGS.sales, CACHE_TAGS.posProducts, CACHE_TAGS.inventory, CACHE_TAGS.stock],
    }
);

export async function getSellers() {
    return getSellersCached();
}

export async function getProductsForPOS() {
    return getProductsForPOSCached();
}

export async function getFeaturedProductsForPOS() {
    return getFeaturedProductsForPOSCached();
}
