// src/app/actions/pos-actions.ts
"use server";

import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";

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
            select: {
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
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

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
                    },
                ];
            }

            return product.variants.map((variant) => ({
                id: variant.id,
                code: variant.sku,
                name: `${product.name} - Talle ${variant.size}`,
                price: Number(product.priceNormal),
                wholesalePrice: Number(product.priceWholesale),
                stock: variant.stock,
                sizes: [variant.size],
                color: variant.color,
                productId: product.id,
            }));
        });
    },
    ["pos-products"],
    { revalidate: 300, tags: [CACHE_TAGS.posProducts, CACHE_TAGS.inventory, CACHE_TAGS.stock] }
);

export async function getSellers() {
    return getSellersCached();
}

export async function getProductsForPOS() {
    return getProductsForPOSCached();
}
