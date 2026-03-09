// src/app/actions/supplier-actions.ts
"use server";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 1. Traer todos los proveedores
export async function getSuppliers() {
    return await prisma.supplier.findMany({
        orderBy: { name: 'asc' } // Los ordenamos alfabéticamente
    });
}

// 2. Crear un proveedor nuevo
export async function createSupplier(data: { name: string; phone?: string; notes?: string }) {
    return await prisma.supplier.create({
        data: {
            name: data.name,
            phone: data.phone || null,
            notes: data.notes || null,
        }
    });
}

// 3. Actualizar un proveedor
export async function updateSupplier(id: string, data: { name: string; phone?: string; notes?: string }) {
    return await prisma.supplier.update({
        where: { id },
        data: {
            name: data.name,
            phone: data.phone || null,
            notes: data.notes || null,
        }
    });
}

// 4. Eliminar un proveedor
export async function deleteSupplier(id: string) {
    return await prisma.supplier.delete({
        where: { id }
    });
}