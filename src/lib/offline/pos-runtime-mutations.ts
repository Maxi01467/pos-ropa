"use client";

import { createQuickProductWithStock } from "@/app/actions/inventory/inventory-actions";
import { createExchangeSale, createSale } from "@/app/actions/sales/sales-actions";
import { assertOfflineBootstrapReady } from "@/lib/offline/offline-bootstrap";
import { isOfflineModeEnabled } from "@/lib/offline-config";
import { db, initPowerSync } from "@/lib/powersync/db";
import {
    buildTicketNumber,
    computeNextTicketSequence,
    normalizeTerminalPrefix,
} from "@/lib/terminal/tickets";

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

type QuickProductInput = {
    name: string;
    price: number;
    wholesalePrice: number;
    initialStock: number;
    creatorUserId?: string;
};

type SaleResult = {
    id: string;
    ticketNumber: string;
};

type QuickProductResult = {
    id: string;
    variantId: string;
    sku: string;
    pendingReview: boolean;
};

export type PosRuntimeMutationMode = "server" | "powersync";

export interface PosRuntimeMutations {
    mode: PosRuntimeMutationMode;
    createSale(input: CreateSaleInput): Promise<SaleResult>;
    createExchangeSale(input: CreateExchangeSaleInput): Promise<SaleResult>;
    createQuickProductWithStock(input: QuickProductInput): Promise<QuickProductResult>;
}

type VariantStockRow = {
    id: string;
    stock: number | string | null;
};

type OpenCashSessionRow = {
    id: string;
};

type LocalUserRow = {
    id: string;
    name: string;
    role: string;
};

type LocalSaleItemRow = {
    id: string;
    variantId: string;
    quantity: number | string | null;
    returnedQuantity: number | string | null;
};

let powerSyncInitPromise: Promise<void> | null = null;

async function ensurePowerSyncReady(): Promise<void> {
    if (!powerSyncInitPromise) {
        powerSyncInitPromise = initPowerSync();
    }

    await powerSyncInitPromise;
}

function toNumber(value: number | string | null | undefined): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function validateSalePayment(
    total: number,
    paymentMethod: "EFECTIVO" | "TRANSFERENCIA" | "MIXTO" | "CAMBIO",
    cashAmount = 0,
    transferAmount = 0
) {
    if (paymentMethod === "MIXTO" && cashAmount + transferAmount !== total) {
        throw new Error("La suma de efectivo y transferencia debe coincidir con el total");
    }

    if (paymentMethod === "EFECTIVO" && (cashAmount !== total || transferAmount !== 0)) {
        throw new Error("El desglose del pago en efectivo es inválido");
    }

    if (paymentMethod === "TRANSFERENCIA" && (cashAmount !== 0 || transferAmount !== total)) {
        throw new Error("El desglose del pago por transferencia es inválido");
    }

    if (paymentMethod === "CAMBIO" && (cashAmount !== 0 || transferAmount !== 0 || total > 0)) {
        throw new Error("Un cambio con saldo a favor no puede registrar cobros");
    }
}

async function getLocalUser(userId?: string): Promise<LocalUserRow | null> {
    if (userId) {
        const currentUser = await db.getOptional<LocalUserRow>(
            `SELECT id, name, role FROM "User" WHERE id = ? AND deletedAt IS NULL`,
            [userId]
        );

        if (currentUser) {
            return currentUser;
        }
    }

    return db.getOptional<LocalUserRow>(
        `SELECT id, name, role FROM "User" WHERE active = 1 AND deletedAt IS NULL ORDER BY createdAt ASC LIMIT 1`
    );
}

async function generateLocalTicketNumber(terminalPrefix?: string): Promise<string> {
    const rows = await db.getAll<{ ticketNumber: string | number | null }>(
        `SELECT ticketNumber FROM "Sale" WHERE deletedAt IS NULL`
    );

    const normalizedPrefix = normalizeTerminalPrefix(terminalPrefix);
    const nextSequence = computeNextTicketSequence(
        rows.map((row) => row.ticketNumber),
        normalizedPrefix
    );

    return buildTicketNumber(normalizedPrefix, nextSequence);
}

async function createLocalSaleRecord(
    input: {
        total: number;
        paymentMethod: "EFECTIVO" | "TRANSFERENCIA" | "MIXTO" | "CAMBIO";
        cashAmount?: number;
        transferAmount?: number;
        userId?: string;
        terminalPrefix?: string;
        items: CreateSaleItemInput[];
    },
    options?: {
        returnedItems?: ExchangeReturnItemInput[];
        originalSaleId?: string;
    }
): Promise<SaleResult> {
    validateSalePayment(
        input.total,
        input.paymentMethod,
        input.cashAmount ?? 0,
        input.transferAmount ?? 0
    );

    const user = await getLocalUser(input.userId);
    if (!user) {
        throw new Error("No hay usuarios configurados para registrar ventas");
    }

    const ticketNumber = await generateLocalTicketNumber(input.terminalPrefix);
    const saleId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    await db.writeTransaction(async (tx) => {
        if (options?.originalSaleId) {
            const originalSaleItems = await tx.getAll<LocalSaleItemRow>(
                `
                    SELECT id, variantId, quantity, returnedQuantity
                    FROM "SaleItem"
                    WHERE saleId = ? AND deletedAt IS NULL
                `,
                [options.originalSaleId]
            );

            const originalItemsMap = new Map(originalSaleItems.map((item) => [item.id, item]));

            for (const returnedItem of options.returnedItems ?? []) {
                const saleItem = originalItemsMap.get(returnedItem.saleItemId);

                if (!saleItem) {
                    throw new Error("Uno de los productos seleccionados no pertenece a la boleta");
                }

                const availableToReturn =
                    toNumber(saleItem.quantity) - toNumber(saleItem.returnedQuantity);

                if (
                    returnedItem.quantity <= 0 ||
                    returnedItem.quantity > availableToReturn
                ) {
                    throw new Error("La cantidad a cambiar excede lo disponible en la boleta");
                }
            }

            for (const returnedItem of options.returnedItems ?? []) {
                const saleItem = originalItemsMap.get(returnedItem.saleItemId)!;

                await tx.execute(
                    `
                        UPDATE "SaleItem"
                        SET returnedQuantity = returnedQuantity + ?, updatedAt = ?
                        WHERE id = ?
                          AND deletedAt IS NULL
                    `,
                    [returnedItem.quantity, timestamp, returnedItem.saleItemId]
                );

                await tx.execute(
                    `
                        UPDATE "ProductVariant"
                        SET stock = stock + ?, updatedAt = ?
                        WHERE id = ?
                          AND deletedAt IS NULL
                    `,
                    [returnedItem.quantity, timestamp, saleItem.variantId]
                );
            }
        }

        for (const item of input.items) {
            const variant = await tx.getOptional<VariantStockRow>(
                `SELECT id, stock FROM "ProductVariant" WHERE id = ? AND deletedAt IS NULL`,
                [item.variantId]
            );

            if (!variant) {
                throw new Error("La variante no existe en la base local");
            }

            const currentStock = toNumber(variant.stock);
            if (currentStock < item.quantity) {
                throw new Error("Stock insuficiente para completar la venta");
            }
        }

        const currentSession = await tx.getOptional<OpenCashSessionRow>(
            `SELECT id FROM "CashSession" WHERE status = 'OPEN' AND deletedAt IS NULL ORDER BY openingDate DESC LIMIT 1`
        );

        await tx.execute(
            `
                INSERT INTO "Sale" (
                    id,
                    ticketNumber,
                    total,
                    paymentMethod,
                    cashAmount,
                    transferAmount,
                    userId,
                    cashSessionId,
                    createdAt,
                    updatedAt,
                    deletedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                saleId,
                String(ticketNumber),
                input.total,
                input.paymentMethod,
                input.cashAmount ?? 0,
                input.transferAmount ?? 0,
                user.id,
                currentSession?.id ?? null,
                timestamp,
                timestamp,
                null,
            ]
        );

        for (const item of input.items) {
            await tx.execute(
                `
                    INSERT INTO "SaleItem" (
                        id,
                        saleId,
                        variantId,
                        quantity,
                        priceAtTime,
                        priceType,
                        returnedQuantity,
                        createdAt,
                        updatedAt,
                        deletedAt
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    crypto.randomUUID(),
                    saleId,
                    item.variantId,
                    item.quantity,
                    item.priceAtTime,
                    item.priceType,
                    0,
                    timestamp,
                    timestamp,
                    null,
                ]
            );

            await tx.execute(
                `
                    UPDATE "ProductVariant"
                    SET stock = stock - ?, updatedAt = ?
                    WHERE id = ?
                      AND deletedAt IS NULL
                `,
                [item.quantity, timestamp, item.variantId]
            );
        }

        return Promise.resolve();
    });

    return {
        id: saleId,
        ticketNumber,
    };
}

const serverMutations: PosRuntimeMutations = {
    mode: "server",
    async createSale(input) {
        return (await createSale(input)) as SaleResult;
    },
    async createExchangeSale(input) {
        return (await createExchangeSale(input)) as SaleResult;
    },
    async createQuickProductWithStock(input) {
        return (await createQuickProductWithStock(input)) as QuickProductResult;
    },
};

const powerSyncMutations: PosRuntimeMutations = {
    mode: "powersync",
    async createSale(input) {
        try {
            await ensurePowerSyncReady();
            return await createLocalSaleRecord(input);
        } catch (error) {
            console.warn("[offline] createSale fallback to server", error);
            assertOfflineBootstrapReady();
            return serverMutations.createSale(input);
        }
    },
    async createExchangeSale(input) {
        try {
            await ensurePowerSyncReady();
            return await createLocalSaleRecord(
                {
                    total: input.total,
                    paymentMethod: input.paymentMethod,
                    cashAmount: input.cashAmount,
                    transferAmount: input.transferAmount,
                    userId: input.userId,
                    items: input.items,
                },
                {
                    originalSaleId: input.originalSaleId,
                    returnedItems: input.returnedItems,
                }
            );
        } catch (error) {
            console.warn("[offline] createExchangeSale fallback to server", error);
            assertOfflineBootstrapReady();
            return serverMutations.createExchangeSale(input);
        }
    },
    async createQuickProductWithStock(input) {
        try {
            await ensurePowerSyncReady();

            const name = input.name.trim();
            const price = Number(input.price);
            const wholesalePrice = Number(input.wholesalePrice);
            const initialStock = Number(input.initialStock);

            if (!name) {
                throw new Error("El nombre es obligatorio");
            }

            if (!Number.isFinite(price) || price <= 0) {
                throw new Error("Ingresá un precio de venta válido");
            }

            if (!Number.isFinite(wholesalePrice) || wholesalePrice <= 0) {
                throw new Error("Ingresá un precio mayorista válido");
            }

            if (!Number.isInteger(initialStock) || initialStock < 0) {
                throw new Error("Ingresá un stock inicial válido");
            }

            const user = await getLocalUser(input.creatorUserId);
            const timestamp = new Date().toISOString();
            const productId = crypto.randomUUID();
            const variantId = crypto.randomUUID();
            const productCode = productId.slice(-6).toUpperCase();
            const sku = `${productCode}-UNI`;
            const pendingReview = user?.role === "STAFF";

            await db.writeTransaction(async (tx) => {
                await tx.execute(
                    `
                        INSERT INTO "Product" (
                            id,
                            name,
                            quickCreated,
                            pendingReview,
                            quickCreatedAt,
                            quickCreatedByName,
                            quickCreatedByRole,
                            quickNotificationSeen,
                            reviewedAt,
                            reviewedByName,
                            priceNormal,
                            priceWholesale,
                            costPrice,
                            createdAt,
                            updatedAt,
                            deletedAt
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `,
                    [
                        productId,
                        name,
                        1,
                        pendingReview ? 1 : 0,
                        timestamp,
                        user?.name ?? "Sistema local",
                        user?.role ?? "STAFF",
                        0,
                        null,
                        null,
                        price,
                        wholesalePrice,
                        null,
                        timestamp,
                        timestamp,
                        null,
                    ]
                );

                await tx.execute(
                    `
                        INSERT INTO "ProductVariant" (
                            id,
                            productId,
                            size,
                            color,
                            sku,
                            stock,
                            createdAt,
                            updatedAt,
                            deletedAt
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `,
                    [
                        variantId,
                        productId,
                        "Único",
                        "Único",
                        sku,
                        initialStock,
                        timestamp,
                        timestamp,
                        null,
                    ]
                );

                if (initialStock > 0) {
                    await tx.execute(
                        `
                            INSERT INTO "StockMovement" (
                                id,
                                variantId,
                                supplierId,
                                quantity,
                                type,
                                notes,
                                createdAt,
                                updatedAt,
                                deletedAt
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `,
                        [
                            crypto.randomUUID(),
                            variantId,
                            null,
                            initialStock,
                            "INGRESO",
                            "Ingreso inicial desde creación rápida en nueva venta",
                            timestamp,
                            timestamp,
                            null,
                        ]
                    );
                }

                return Promise.resolve();
            });

            return {
                id: productId,
                variantId,
                sku,
                pendingReview,
            };
        } catch (error) {
            console.warn("[offline] createQuickProductWithStock fallback to server", error);
            assertOfflineBootstrapReady();
            return serverMutations.createQuickProductWithStock(input);
        }
    },
};

export function getPosRuntimeMutations(): PosRuntimeMutations {
    if (isOfflineModeEnabled()) {
        return powerSyncMutations;
    }

    return serverMutations;
}
