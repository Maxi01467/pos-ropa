"use server";

import { revalidateTag } from "next/cache";
import { CACHE_TAGS, unstable_cache } from "@/lib/core/cache-tags";
import { barcodeFromTicketNumber } from "@/lib/printing/barcodes";
import { prisma } from "@/lib/prisma";
import {
    buildTicketNumber,
    computeNextTicketSequence,
    normalizeTerminalPrefix,
} from "@/lib/terminal/tickets";

const SHOULD_REVALIDATE_SERVER_CACHE = process.env.POS_DESKTOP !== "1";

function revalidateSalesRelatedTags() {
    if (!SHOULD_REVALIDATE_SERVER_CACHE) {
        return;
    }

    revalidateTag(CACHE_TAGS.sales, "max");
    revalidateTag(CACHE_TAGS.cash, "max");
    revalidateTag(CACHE_TAGS.posProducts, "max");
    revalidateTag(CACHE_TAGS.inventory, "max");
    revalidateTag(CACHE_TAGS.stock, "max");
}

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
    terminalPrefix?: string;
    items: CreateSaleItemInput[];
};

type ExchangeReturnItemInput = {
    saleItemId: string;
    quantity: number;
};

type CreateExchangeSaleInput = {
    total: number;
    paymentMethod: "EFECTIVO" | "TRANSFERENCIA" | "MIXTO" | "CAMBIO";
    cashAmount?: number;
    transferAmount?: number;
    userId?: string;
    terminalPrefix?: string;
    originalSaleId: string;
    returnedItems: ExchangeReturnItemInput[];
    items: CreateSaleItemInput[];
};

const DEFAULT_EXCHANGE_SEARCH_LIMIT = 20;

type SaleHistoryItem = {
    id: string;
    ticketNumber: string;
    total: number;
    paymentMethod: string;
    cashAmount?: number;
    transferAmount?: number;
    date: string;
    sellerName: string;
    items: {
        id: string;
        variantId: string;
        productName: string;
        size: string;
        color: string;
        sku: string;
        quantity: number;
        priceAtTime: number;
        priceType: string;
        returnedQuantity: number;
    }[];
};

function mapSaleHistoryItem(sale: {
    id: string;
    ticketNumber: string;
    total: number | { toString(): string };
    paymentMethod: string;
    cashAmount: number | { toString(): string } | null;
    transferAmount: number | { toString(): string } | null;
    createdAt: Date;
    user: { name: string } | null;
    items: Array<{
        id: string;
        variantId: string;
        quantity: number;
        priceAtTime: number | { toString(): string };
        priceType: string;
        returnedQuantity: number;
        variant: {
            size: string;
            color: string;
            sku: string;
            product: { name: string };
        };
    }>;
}): SaleHistoryItem {
    return {
        id: sale.id,
        ticketNumber: sale.ticketNumber,
        total: Number(sale.total),
        paymentMethod: sale.paymentMethod,
        cashAmount: sale.cashAmount == null ? undefined : Number(sale.cashAmount),
        transferAmount: sale.transferAmount == null ? undefined : Number(sale.transferAmount),
        date: sale.createdAt.toISOString(),
        sellerName: sale.user?.name ?? "Sin vendedor",
        items: sale.items.map((item) => ({
            id: item.id,
            variantId: item.variantId,
            productName: item.variant.product.name,
            size: item.variant.size,
            color: item.variant.color,
            sku: item.variant.sku,
            quantity: item.quantity,
            priceAtTime: Number(item.priceAtTime),
            priceType: item.priceType,
            returnedQuantity: item.returnedQuantity,
        })),
    };
}

const getSalesHistoryCached = unstable_cache(
    async (): Promise<SaleHistoryItem[]> => {
        const sales = await prisma.sale.findMany({
            where: {
                deletedAt: null,
            },
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: { name: true },
                },
                items: {
                    where: {
                        deletedAt: null,
                    },
                    include: {
                        variant: {
                            include: {
                                product: {
                                    select: { name: true },
                                },
                            },
                        },
                    },
                },
            },
        });

        return sales.map(mapSaleHistoryItem);
    },
    ["sales-history"],
    { revalidate: 120, tags: [CACHE_TAGS.sales, CACHE_TAGS.cash, CACHE_TAGS.posProducts] }
);

export async function createSale(input: CreateSaleInput) {
    if (input.items.length === 0) {
        throw new Error("La venta no tiene items");
    }

    if (input.total < 0) {
        throw new Error("Una venta normal no puede tener total negativo");
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
              where: { id: input.userId, deletedAt: null },
              select: { id: true },
          })
        : await prisma.user.findFirst({
              where: {
                  deletedAt: null,
              },
              orderBy: { createdAt: "asc" },
              select: { id: true },
          });

    if (!user) {
        throw new Error("No hay usuarios configurados para registrar ventas");
    }

    // NUEVO: Buscamos si hay una sesión de caja abierta actualmente
    const currentSession = await prisma.cashSession.findFirst({
        where: {
            status: "OPEN",
            deletedAt: null,
        },
        select: { id: true }
    });
    const terminalPrefix = normalizeTerminalPrefix(input.terminalPrefix);

    const sale = await prisma.$transaction(async (tx) => {
        for (const item of input.items) {
            const variant = await tx.productVariant.findFirst({
                where: {
                    id: item.variantId,
                    deletedAt: null,
                    product: {
                        deletedAt: null,
                    },
                },
                select: { id: true, stock: true },
            });

            if (!variant) {
                throw new Error("Una variante del carrito ya no existe");
            }

            if (variant.stock < item.quantity) {
                throw new Error("Stock insuficiente para completar la venta");
            }
        }

        const existingTickets = await tx.sale.findMany({
            where: {
                deletedAt: null,
            },
            select: { ticketNumber: true },
        });
        const nextTicket = computeNextTicketSequence(
            existingTickets.map((saleRow) => saleRow.ticketNumber),
            terminalPrefix
        );
        const ticketStr = buildTicketNumber(terminalPrefix, nextTicket);

        const sale = await tx.sale.create({
            data: {
                ticketNumber: ticketStr,
                total: input.total,
                paymentMethod: input.paymentMethod,
                cashAmount,
                transferAmount,
                userId: user.id,
                // NUEVO: Vinculamos la venta a la caja si es que hay una abierta
                cashSessionId: currentSession?.id || null, 
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
            const updatedVariant = await tx.productVariant.updateMany({
                where: {
                    id: item.variantId,
                    deletedAt: null,
                    product: {
                        deletedAt: null,
                    },
                },
                data: { stock: { decrement: item.quantity } },
            });

            if (updatedVariant.count !== 1) {
                throw new Error("No se pudo descontar stock de una variante activa");
            }
        }

        return sale;
    });

    revalidateSalesRelatedTags();

    return sale;
}

export async function createExchangeSale(input: CreateExchangeSaleInput) {
    if (input.items.length === 0) {
        throw new Error("El cambio debe incluir al menos un producto nuevo");
    }

    if (input.returnedItems.length === 0) {
        throw new Error("Seleccioná al menos un producto de la boleta para cambiar");
    }

    const cashAmount = input.cashAmount ?? 0;
    const transferAmount = input.transferAmount ?? 0;
    const requiresCashRefund = input.total < 0;

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

    if (
        input.paymentMethod === "CAMBIO" &&
        (cashAmount !== 0 || transferAmount !== 0 || input.total > 0)
    ) {
        throw new Error("Un cambio con saldo a favor no puede registrar cobros");
    }

    if (requiresCashRefund && input.paymentMethod !== "CAMBIO") {
        throw new Error("Un cambio con saldo a favor debe cerrarse como CAMBIO");
    }

    const user = input.userId
        ? await prisma.user.findUnique({
              where: { id: input.userId, deletedAt: null },
              select: { id: true },
          })
        : await prisma.user.findFirst({
              where: {
                  deletedAt: null,
              },
              orderBy: { createdAt: "asc" },
              select: { id: true },
          });

    if (!user) {
        throw new Error("No hay usuarios configurados para registrar ventas");
    }

    const currentSession = await prisma.cashSession.findFirst({
        where: {
            status: "OPEN",
            deletedAt: null,
        },
        select: { id: true },
    });

    const terminalPrefix = normalizeTerminalPrefix(input.terminalPrefix);

    const sale = await prisma.$transaction(async (tx) => {
        const originalSale = await tx.sale.findFirst({
            where: {
                id: input.originalSaleId,
                deletedAt: null,
            },
            include: {
                items: {
                    where: {
                        deletedAt: null,
                    },
                    include: {
                        variant: true,
                    },
                },
            },
        });

        if (!originalSale) {
            throw new Error("La boleta seleccionada ya no existe");
        }

        const returnMap = new Map(
            input.returnedItems.map((item) => [item.saleItemId, item.quantity])
        );

        for (const saleItem of originalSale.items) {
            const quantityToReturn = returnMap.get(saleItem.id);
            if (!quantityToReturn) continue;

            const availableToReturn = saleItem.quantity - saleItem.returnedQuantity;
            if (quantityToReturn <= 0 || quantityToReturn > availableToReturn) {
                throw new Error("La cantidad a cambiar excede lo disponible en la boleta");
            }
        }

        for (const returnedItem of input.returnedItems) {
            const saleItem = originalSale.items.find((item) => item.id === returnedItem.saleItemId);
            if (!saleItem) {
                throw new Error("Uno de los productos seleccionados no pertenece a la boleta");
            }

            await tx.saleItem.update({
                where: { id: saleItem.id },
                data: { returnedQuantity: { increment: returnedItem.quantity } },
            });

            const restoredVariant = await tx.productVariant.updateMany({
                where: {
                    id: saleItem.variantId,
                    deletedAt: null,
                    product: {
                        deletedAt: null,
                    },
                },
                data: { stock: { increment: returnedItem.quantity } },
            });

            if (restoredVariant.count !== 1) {
                throw new Error("No se pudo devolver stock sobre una variante activa");
            }
        }

        for (const item of input.items) {
            const variant = await tx.productVariant.findFirst({
                where: {
                    id: item.variantId,
                    deletedAt: null,
                    product: {
                        deletedAt: null,
                    },
                },
                select: { id: true, stock: true },
            });

            if (!variant) {
                throw new Error("Una variante del carrito ya no existe");
            }

            if (variant.stock < item.quantity) {
                throw new Error("Stock insuficiente para completar el cambio");
            }
        }

        const existingTickets = await tx.sale.findMany({
            where: {
                deletedAt: null,
            },
            select: { ticketNumber: true },
        });
        const nextTicket = computeNextTicketSequence(
            existingTickets.map((saleRow) => saleRow.ticketNumber),
            terminalPrefix
        );
        const ticketStr = buildTicketNumber(terminalPrefix, nextTicket);

        const sale = await tx.sale.create({
            data: {
                ticketNumber: ticketStr,
                total: input.total,
                paymentMethod: input.paymentMethod,
                cashAmount,
                transferAmount,
                userId: user.id,
                cashSessionId: currentSession?.id ?? null,
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
            const updatedVariant = await tx.productVariant.updateMany({
                where: {
                    id: item.variantId,
                    deletedAt: null,
                    product: {
                        deletedAt: null,
                    },
                },
                data: { stock: { decrement: item.quantity } },
            });

            if (updatedVariant.count !== 1) {
                throw new Error("No se pudo descontar stock de una variante activa");
            }
        }

        if (requiresCashRefund && currentSession) {
            await tx.cashMovement.create({
                data: {
                    sessionId: currentSession.id,
                    amount: Math.abs(input.total),
                    type: "EGRESO",
                    reason: `Devolucion de dinero por cambio · ticket #${sale.ticketNumber.toString().padStart(5, "0")}`,
                },
            });
        }

        return sale;
    });

    revalidateSalesRelatedTags();

    return sale;
}

export async function getSalesHistory() {
    return getSalesHistoryCached();
}

export async function findSalesForExchange({
    query = "",
    limit = DEFAULT_EXCHANGE_SEARCH_LIMIT,
}: {
    query?: string;
    limit?: number;
} = {}) {
    const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
    const normalizedQuery = query.trim();

    const sales = await prisma.sale.findMany({
        where: {
            deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
        take: normalizedQuery ? Math.max(safeLimit * 10, 50) : safeLimit,
        include: {
            user: {
                select: { name: true },
            },
            items: {
                where: {
                    deletedAt: null,
                },
                include: {
                    variant: {
                        include: {
                            product: {
                                select: { name: true },
                            },
                        },
                    },
                },
            },
        },
    });

    const mappedSales = sales.map(mapSaleHistoryItem);

    if (normalizedQuery) {
        const normalizedUpperQuery = normalizedQuery.toUpperCase();
        const normalizedDigitsQuery = normalizedQuery.replace(/\D/g, "");

        return mappedSales.filter((sale) => {
            const ticketValue = sale.ticketNumber.toUpperCase();
            const ticketDigits = ticketValue.replace(/\D/g, "");
            return (
                ticketValue.includes(normalizedUpperQuery) ||
                (normalizedDigitsQuery.length > 0 && ticketDigits.includes(normalizedDigitsQuery)) ||
                barcodeFromTicketNumber(sale.ticketNumber).includes(normalizedDigitsQuery)
            );
        }).slice(0, safeLimit);
    }

    return mappedSales;
}
