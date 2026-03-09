"use server";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CreateSaleItemInput = {
    variantId: string;
    quantity: number;
    priceAtTime: number;
    priceType: "NORMAL" | "WHOLESALE";
};

type CreateSaleInput = {
    total: number;
    paymentMethod: "EFECTIVO" | "TRANSFERENCIA" | "MIXTO";
    cashAmount?: number;
    transferAmount?: number;
    userId?: string;
    items: CreateSaleItemInput[];
};

export async function createSale(input: CreateSaleInput) {
    if (input.items.length === 0) {
        throw new Error("La venta no tiene items");
    }

    const cashAmount = input.cashAmount ?? 0;
    const transferAmount = input.transferAmount ?? 0;

    if (input.paymentMethod === "MIXTO" && cashAmount + transferAmount !== input.total) {
        throw new Error("La suma de efectivo y transferencia debe coincidir con el total");
    }

    if (
        input.paymentMethod === "EFECTIVO" &&
        (cashAmount !== input.total || transferAmount !== 0)
    ) {
        throw new Error("El desglose del pago en efectivo es inválido");
    }

    if (
        input.paymentMethod === "TRANSFERENCIA" &&
        (cashAmount !== 0 || transferAmount !== input.total)
    ) {
        throw new Error("El desglose del pago por transferencia es inválido");
    }

    const user = input.userId
        ? await prisma.user.findUnique({
              where: { id: input.userId },
              select: { id: true },
          })
        : await prisma.user.findFirst({
              orderBy: { createdAt: "asc" },
              select: { id: true },
          });

    if (!user) {
        throw new Error("No hay usuarios configurados para registrar ventas");
    }

    return prisma.$transaction(async (tx) => {
        for (const item of input.items) {
            const variant = await tx.productVariant.findUnique({
                where: { id: item.variantId },
                select: { id: true, stock: true },
            });

            if (!variant) {
                throw new Error("Una variante del carrito ya no existe");
            }

            if (variant.stock < item.quantity) {
                throw new Error("Stock insuficiente para completar la venta");
            }
        }

        const sale = await tx.sale.create({
            data: {
                total: input.total,
                paymentMethod: input.paymentMethod,
                cashAmount,
                transferAmount,
                userId: user.id,
                items: {
                    create: input.items.map((item) => ({
                        variantId: item.variantId,
                        quantity: item.quantity,
                        priceAtTime: item.priceAtTime,
                        priceType: item.priceType,
                    })),
                },
            },
            select: {
                id: true,
                ticketNumber: true,
            },
        });

        for (const item of input.items) {
            await tx.productVariant.update({
                where: { id: item.variantId },
                data: { stock: { decrement: item.quantity } },
            });
        }

        return sale;
    });
}

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
        cashAmount: sale.cashAmount ? Number(sale.cashAmount) : undefined,
        transferAmount: sale.transferAmount ? Number(sale.transferAmount) : undefined,
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
