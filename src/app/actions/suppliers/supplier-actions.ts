// src/app/actions/supplier-actions.ts
"use server";

import { revalidateTag } from "next/cache";
import { CACHE_TAGS, unstable_cache } from "@/lib/core/cache-tags";
import { prisma } from "@/lib/prisma";

const getSuppliersCached = unstable_cache(
    async () =>
        prisma.supplier.findMany({
            orderBy: { name: "asc" }
        }),
    ["suppliers"],
    { revalidate: 300, tags: [CACHE_TAGS.suppliers, CACHE_TAGS.stock] }
);

// 1. Traer todos los proveedores
export async function getSuppliers() {
    return getSuppliersCached();
}

// 2. Crear un proveedor nuevo
export async function createSupplier(data: { name: string; phone?: string; notes?: string }) {
    const supplier = await prisma.supplier.create({
        data: {
            name: data.name,
            phone: data.phone || null,
            notes: data.notes || null,
        }
    });

    revalidateTag(CACHE_TAGS.suppliers, "max");
    revalidateTag(CACHE_TAGS.stock, "max");

    return supplier;
}

// 3. Actualizar un proveedor
export async function updateSupplier(id: string, data: { name: string; phone?: string; notes?: string }) {
    const supplier = await prisma.supplier.update({
        where: { id },
        data: {
            name: data.name,
            phone: data.phone || null,
            notes: data.notes || null,
        }
    });

    revalidateTag(CACHE_TAGS.suppliers, "max");
    revalidateTag(CACHE_TAGS.stock, "max");

    return supplier;
}

// 4. Eliminar un proveedor
export async function deleteSupplier(id: string) {
    const deleted = await prisma.supplier.delete({
        where: { id }
    });

    revalidateTag(CACHE_TAGS.suppliers, "max");
    revalidateTag(CACHE_TAGS.stock, "max");

    return deleted;
}
