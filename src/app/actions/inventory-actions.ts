// src/app/actions/inventory-actions.ts
"use server";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 1. Traer todos los datos iniciales
export async function getInventoryData() {
    const products = await prisma.product.findMany({
        include: { supplier: true, variants: true },
        orderBy: { createdAt: 'desc' }
    });
    
    const suppliers = await prisma.supplier.findMany();

    // Extraemos las categorías únicas que ya existen en los productos
    const categories = Array.from(
        new Set(products.map(p => p.category).filter(Boolean))
    ) as string[];

    return {
        products: products.map(p => ({
            id: p.id,
            code: p.id.slice(-6).toUpperCase(), // Generamos un código visual corto
            name: p.name,
            price: Number(p.priceNormal),
            wholesalePrice: Number(p.priceWholesale),
            costPrice: p.costPrice ? Number(p.costPrice) : undefined,
            category: p.category || "",
            providerId: p.supplierId || "",
            providerName: p.supplier?.name || "Sin proveedor",
            // Calculamos el stock total sumando las variantes
            stock: p.variants.reduce((acc, v) => acc + v.stock, 0), 
        })),
        suppliers: suppliers.map(s => ({ id: s.id, name: s.name })),
        categories
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
            category: data.category,
            supplierId: data.providerId || null,
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
            category: data.category,
            supplierId: data.providerId || null,
        }
    });
}

// 4. Eliminar un producto
export async function deleteProduct(id: string) {
    return await prisma.product.delete({
        where: { id }
    });
}