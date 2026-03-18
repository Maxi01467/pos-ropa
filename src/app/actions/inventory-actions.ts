// src/app/actions/inventory-actions.ts
"use server";

import { revalidateTag, unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";

type QuickProductInput = {
    name: string;
    price: number;
    wholesalePrice: number;
    initialStock: number;
};

type InventoryProductInput = {
    name: string;
    price: number;
    wholesalePrice: number;
    costPrice?: number;
};

// 1. Traer todos los productos (sin proveedores ni categorías)
const getInventoryDataCached = unstable_cache(
    async () => {
        const products = await prisma.product.findMany({
            select: {
                id: true,
                name: true,
                priceNormal: true,
                priceWholesale: true,
                costPrice: true,
                variants: {
                    select: {
                        stock: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return {
            products: products.map((p) => ({
                id: p.id,
                code: p.id.slice(-6).toUpperCase(),
                name: p.name,
                price: Number(p.priceNormal),
                wholesalePrice: Number(p.priceWholesale),
                costPrice: p.costPrice ? Number(p.costPrice) : undefined,
                stock: p.variants.reduce((acc, v) => acc + v.stock, 0),
            })),
        };
    },
    ["inventory-data"],
    { revalidate: 300, tags: [CACHE_TAGS.inventory, CACHE_TAGS.posProducts, CACHE_TAGS.stock] }
);

export async function getInventoryData() {
    return getInventoryDataCached();
}

// 2. Crear un producto nuevo
export async function createProduct(data: InventoryProductInput) {
    const product = await prisma.product.create({
        data: {
            name: data.name,
            priceNormal: data.price,
            priceWholesale: data.wholesalePrice,
            costPrice: data.costPrice,
        }
    });

    revalidateTag(CACHE_TAGS.inventory, "max");
    revalidateTag(CACHE_TAGS.posProducts, "max");
    revalidateTag(CACHE_TAGS.stock, "max");

    return product;
}

export async function createQuickProductWithStock(data: QuickProductInput) {
    const name = data.name.trim();
    const price = Number(data.price);
    const wholesalePrice = Number(data.wholesalePrice);
    const initialStock = Number(data.initialStock);

    if (!name) {
        throw new Error("El nombre es obligatorio");
    }

    if (!Number.isFinite(price) || price <= 0) {
        throw new Error("Ingresá un precio de venta válido");
    }

    if (!Number.isFinite(wholesalePrice) || wholesalePrice <= 0) {
        throw new Error("Ingresá un precio mayorista válido");
    }

    if (!Number.isInteger(initialStock) || initialStock < 0) {
        throw new Error("Ingresá un stock inicial válido");
    }

    const result = await prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
            data: {
                name,
                priceNormal: price,
                priceWholesale: wholesalePrice,
            },
        });

        const productCode = product.id.slice(-6).toUpperCase();
        const sku = `${productCode}-UNI`;

        const variant = await tx.productVariant.create({
            data: {
                productId: product.id,
                size: "Único",
                color: "Único",
                sku,
                stock: initialStock,
            },
        });

        if (initialStock > 0) {
            await tx.stockMovement.create({
                data: {
                    variantId: variant.id,
                    quantity: initialStock,
                    type: "INGRESO",
                    notes: "Ingreso inicial desde creación rápida en nueva venta",
                },
            });
        }

        return {
            id: product.id,
            variantId: variant.id,
            sku,
        };
    });

    revalidateTag(CACHE_TAGS.inventory, "max");
    revalidateTag(CACHE_TAGS.posProducts, "max");
    revalidateTag(CACHE_TAGS.stock, "max");

    return result;
}

// 3. Actualizar un producto existente
export async function updateProduct(id: string, data: InventoryProductInput) {
    const product = await prisma.product.update({
        where: { id },
        data: {
            name: data.name,
            priceNormal: data.price,
            priceWholesale: data.wholesalePrice,
            costPrice: data.costPrice,
        }
    });

    revalidateTag(CACHE_TAGS.inventory, "max");
    revalidateTag(CACHE_TAGS.posProducts, "max");
    revalidateTag(CACHE_TAGS.stock, "max");

    return product;
}

// 4. Eliminar un producto
export async function deleteProduct(id: string) {
    const deleted = await prisma.product.delete({
        where: { id }
    });

    revalidateTag(CACHE_TAGS.inventory, "max");
    revalidateTag(CACHE_TAGS.posProducts, "max");
    revalidateTag(CACHE_TAGS.stock, "max");

    return deleted;
}
