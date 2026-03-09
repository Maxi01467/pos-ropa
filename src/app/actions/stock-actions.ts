// src/app/actions/stock-actions.ts
"use server";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
export async function getStockPageData() {
    const products = await prisma.product.findMany({
        select: { id: true, name: true }
    });

    const suppliers = await prisma.supplier.findMany({
        select: { id: true, name: true }
    });

    const movements = await prisma.stockMovement.findMany({
        include: {
            variant: {
                include: { product: true }
            },
        },
        orderBy: { createdAt: 'desc' }
    });

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
            (p): StockPageProduct => ({ ...p, code: p.id.slice(-6).toUpperCase() })
        ),
        suppliers: suppliers as StockPageSupplier[],
        entries: formattedEntries,
    };
}

// 2. Registrar nuevos ingresos (Usa Transacciones para máxima seguridad)
export async function registerStockEntries(entries: RegisterStockEntry[]) {
    return await prisma.$transaction(async (tx) => {
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
}

export async function reduceStockEntries(entries: RegisterStockEntry[]) {
    return await prisma.$transaction(async (tx) => {
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
}
