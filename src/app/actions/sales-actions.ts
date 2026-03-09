// src/app/actions/sales-actions.ts
"use server";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getSalesHistory() {
    const sales = await prisma.sale.findMany({
        orderBy: { createdAt: 'desc' }, // Las más nuevas primero
        include: {
            user: {
                select: { name: true } // Traemos el nombre del vendedor
            },
            items: {
                include: {
                    variant: {
                        include: {
                            product: {
                                select: { name: true }
                            }
                        }
                    }
                }
            }
        }
    });

    // Formateamos los datos para que el frontend los consuma fácil
    return sales.map(sale => ({
        id: sale.id,
        ticketNumber: sale.ticketNumber,
        total: Number(sale.total),
        paymentMethod: sale.paymentMethod,
        date: sale.createdAt.toISOString(),
        sellerName: sale.user.name,
        items: sale.items.map(item => ({
            id: item.id,
            productName: item.variant.product.name,
            size: item.variant.size,
            color: item.variant.color,
            sku: item.variant.sku,
            quantity: item.quantity,
            priceAtTime: Number(item.priceAtTime),
            priceType: item.priceType,
            returnedQuantity: item.returnedQuantity
        }))
    }));
}