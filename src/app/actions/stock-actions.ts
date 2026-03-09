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
export async function getStockPageData() {
    // Buscamos productos y proveedores para los selects
    const products = await prisma.product.findMany({
        select: { id: true, name: true, priceNormal: true, priceWholesale: true }
    });

    const suppliers = await prisma.supplier.findMany({
        select: { id: true, name: true }
    });

    // Buscamos el historial de ingresos y traemos los datos de la variante asociada
    const movements = await prisma.stockMovement.findMany({
        where: { type: "INGRESO" },
        include: {
            variant: {
                include: { product: true }
            },
        },
        orderBy: { createdAt: 'desc' }
    });

    // Mapeamos los movimientos de la BD al formato (StockEntry) que espera tu frontend
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
}

// 2. Registrar nuevos ingresos (Usa Transacciones para máxima seguridad)
export async function registerStockEntries(entries: RegisterStockEntry[]) {
    // entries recibe un array con: { productId, quantity, color, size, sku }
    
    return await prisma.$transaction(async (tx) => {
        for (const entry of entries) {
            // A. Buscamos si ya existe esta variante exacta (por el SKU)
            let variant = await tx.productVariant.findUnique({
                where: { sku: entry.sku }
            });

            if (variant) {
                // Si existe, le sumamos el stock nuevo
                variant = await tx.productVariant.update({
                    where: { id: variant.id },
                    data: { stock: { increment: entry.quantity } }
                });
            } else {
                // Si es un talle/color nuevo para este producto, lo creamos
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

            // B. Registramos el movimiento en el historial
            await tx.stockMovement.create({
                data: {
                    variantId: variant.id,
                    quantity: entry.quantity,
                    type: "INGRESO",
                    notes: "Ingreso desde panel de stock"
                }
            });
        }
    });
}
