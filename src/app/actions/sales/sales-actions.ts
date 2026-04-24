"use server";

import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { CACHE_TAGS, unstable_cache } from "@/lib/core/cache-tags";
import { barcodeFromTicketNumber } from "@/lib/printing/barcodes";
import { prisma } from "@/lib/prisma";

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
    originalSaleId: string;
    returnedItems: ExchangeReturnItemInput[];
    items: CreateSaleItemInput[];
};

type PaginatedSalesHistory = {
    items: Array<{
        id: string;
        ticketNumber: number;
        total: number;
        paymentMethod: string;
        cashAmount?: number;
        transferAmount?: number;
        date: string;
        sellerName: string;
        items: Array<{
            id: string;
            variantId: string;
            productName: string;
            size: string;
            color: string;
            sku: string;
            quantity: number;
            priceAtTime: number;
            priceType: "NORMAL" | "WHOLESALE";
            returnedQuantity: number;
        }>;
    }>;
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
};

const DEFAULT_SALES_HISTORY_PAGE_SIZE = 200;
const DEFAULT_EXCHANGE_SEARCH_LIMIT = 20;

type ExchangeSearchSale = PaginatedSalesHistory["items"][number];
type SaleHistoryRecord = Prisma.SaleGetPayload<{
    include: {
        user: {
            select: { name: true };
        };
        items: {
            include: {
                variant: {
                    include: {
                        product: {
                            select: { name: true };
                        };
                    };
                };
            };
        };
    };
}>;

function mapSaleHistoryItem(sale: SaleHistoryRecord): ExchangeSearchSale {
    return {
        id: sale.id,
        ticketNumber: sale.ticketNumber,
        total: Number(sale.total),
        paymentMethod: sale.paymentMethod,
        cashAmount: sale.cashAmount ? Number(sale.cashAmount) : undefined,
        transferAmount: sale.transferAmount ? Number(sale.transferAmount) : undefined,
        date: sale.createdAt.toISOString(),
        sellerName: sale.user.name,
                items: sale.items.map((item) => ({
                    id: item.id,
                    variantId: item.variantId,
                    productName: item.variant.product.name,
                    size: item.variant.size,
                    color: item.variant.color,
            sku: item.variant.sku,
            quantity: item.quantity,
            priceAtTime: Number(item.priceAtTime),
            priceType: item.priceType as "NORMAL" | "WHOLESALE",
            returnedQuantity: item.returnedQuantity,
        })),
    };
}

function parseExchangeTicketQuery(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return null;

    const digits = trimmed.replace(/\D/g, "");
    if (!digits) return null;

    if (digits.length === 13) {
        const ticketNumber = Number.parseInt(digits.slice(0, 12), 10);
        return Number.isNaN(ticketNumber) ? null : ticketNumber;
    }

    const ticketNumber = Number.parseInt(digits, 10);
    return Number.isNaN(ticketNumber) ? null : ticketNumber;
}

const getSalesHistoryCached = unstable_cache(
    async (page: number, pageSize: number): Promise<PaginatedSalesHistory> => {
        const safePage = Math.max(1, Math.trunc(page));
        const safePageSize = Math.max(1, Math.min(500, Math.trunc(pageSize)));
        const skip = (safePage - 1) * safePageSize;

        const [total, sales] = await Promise.all([
            prisma.sale.count(),
            prisma.sale.findMany({
                orderBy: { createdAt: "desc" },
                skip,
                take: safePageSize,
                include: {
                    user: {
                        select: { name: true }
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
            }),
        ]);

        return {
            items: sales.map(mapSaleHistoryItem),
            total,
            page: safePage,
            pageSize: safePageSize,
            totalPages: Math.max(1, Math.ceil(total / safePageSize)),
        };
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

    // NUEVO: Buscamos si hay una sesión de caja abierta actualmente
    const currentSession = await prisma.cashSession.findFirst({
        where: { status: "OPEN" },
        select: { id: true }
    });

    const sale = await prisma.$transaction(async (tx) => {
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
            await tx.productVariant.update({
                where: { id: item.variantId },
                data: { stock: { decrement: item.quantity } },
            });
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

    const currentSession = await prisma.cashSession.findFirst({
        where: { status: "OPEN" },
        select: { id: true },
    });

    if (requiresCashRefund && !currentSession) {
        throw new Error("Necesitás una caja abierta para registrar una devolución por cambio");
    }

    const sale = await prisma.$transaction(async (tx) => {
        const originalSale = await tx.sale.findUnique({
            where: { id: input.originalSaleId },
            include: {
                items: {
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

            await tx.productVariant.update({
                where: { id: saleItem.variantId },
                data: { stock: { increment: returnedItem.quantity } },
            });
        }

        for (const item of input.items) {
            const variant = await tx.productVariant.findUnique({
                where: { id: item.variantId },
                select: { id: true, stock: true },
            });

            if (!variant) {
                throw new Error("Una variante del carrito ya no existe");
            }

            if (variant.stock < item.quantity) {
                throw new Error("Stock insuficiente para completar el cambio");
            }
        }

        const sale = await tx.sale.create({
            data: {
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
            await tx.productVariant.update({
                where: { id: item.variantId },
                data: { stock: { decrement: item.quantity } },
            });
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

export async function getSalesHistory({
    page = 1,
    pageSize = DEFAULT_SALES_HISTORY_PAGE_SIZE,
}: {
    page?: number;
    pageSize?: number;
} = {}) {
    return getSalesHistoryCached(page, pageSize);
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
    const ticketNumber = parseExchangeTicketQuery(normalizedQuery);

    const sales = await prisma.sale.findMany({
        where: ticketNumber == null ? undefined : { ticketNumber },
        orderBy: { createdAt: "desc" },
        take: ticketNumber == null ? safeLimit : Math.max(1, Math.min(10, safeLimit)),
        include: {
            user: {
                select: { name: true },
            },
            items: {
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

    if (ticketNumber == null && normalizedQuery) {
        return sales
            .map(mapSaleHistoryItem)
            .filter((sale) => {
                const ticketValue = sale.ticketNumber.toString();
                return (
                    ticketValue.includes(normalizedQuery) ||
                    barcodeFromTicketNumber(sale.ticketNumber).includes(normalizedQuery)
                );
            })
            .slice(0, safeLimit);
    }

    return sales.map(mapSaleHistoryItem);
}
