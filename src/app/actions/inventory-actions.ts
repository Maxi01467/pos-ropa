// src/app/actions/inventory-actions.ts
"use server";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 1. Traer todos los productos (sin proveedores ni categorías)
export async function getInventoryData() {
    const products = await prisma.product.findMany({
        include: { variants: true },
        orderBy: { createdAt: 'desc' }
    });

    return {
        products: products.map(p => ({
            id: p.id,
            code: p.id.slice(-6).toUpperCase(), 
            name: p.name,
            price: Number(p.priceNormal),
            wholesalePrice: Number(p.priceWholesale),
            costPrice: p.costPrice ? Number(p.costPrice) : undefined,
            stock: p.variants.reduce((acc, v) => acc + v.stock, 0), 
        }))
    };
}

// 2. Crear un producto nuevo
export async function createProduct(data: any) {
    return await prisma.product.create({
        data: {
            name: data.name,
            priceNormal: data.price,
            priceWholesale: data.wholesalePrice,
            costPrice: data.costPrice,
        }
    });
}

// 3. Actualizar un producto existente
export async function updateProduct(id: string, data: any) {
    return await prisma.product.update({
        where: { id },
        data: {
            name: data.name,
            priceNormal: data.price,
            priceWholesale: data.wholesalePrice,
            costPrice: data.costPrice,
        }
    });
}

// 4. Eliminar un producto
export async function deleteProduct(id: string) {
    return await prisma.product.delete({
        where: { id }
    });
}