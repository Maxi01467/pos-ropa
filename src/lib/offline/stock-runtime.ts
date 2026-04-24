"use client";

import {
    adjustStockEntries,
    getStockPageData,
    reduceStockEntries,
    registerStockEntries,
} from "@/app/actions/stock/stock-actions";
import { isOfflineModeEnabled } from "@/lib/offline-config";
import { withOfflineMutationFallback, withOfflineReadFallback } from "@/lib/offline/runtime-fallback";
import { db, initPowerSync } from "@/lib/powersync/db";

export type RuntimeStockProduct = {
    id: string;
    name: string;
    code: string;
    price: number;
    wholesalePrice: number;
};

export type RuntimeStockSupplier = {
    id: string;
    name: string;
};

export type RuntimeStockEntry = {
    id: string;
    productId: string;
    providerId?: string;
    quantity: number;
    type: string;
    notes?: string;
    color: string;
    size: string;
    sku: string;
    date: string;
    mode: "simple" | "avanzado";
};

export type RuntimeStockVariant = {
    id: string;
    productId: string;
    color: string;
    size: string;
    sku: string;
    stock: number;
};

export type RuntimeRegisterStockEntry = {
    productId: string;
    quantity: number;
    color: string;
    size: string;
    sku: string;
    supplierId?: string;
};

type StockPageData = {
    products: RuntimeStockProduct[];
    suppliers: RuntimeStockSupplier[];
    entries: RuntimeStockEntry[];
    variants: RuntimeStockVariant[];
};

type ProductRow = {
    id: string;
    name: string;
    priceNormal: number | string | null;
    priceWholesale: number | string | null;
};

type SupplierRow = {
    id: string;
    name: string;
};

type VariantRow = {
    id: string;
    productId: string;
    color: string;
    size: string;
    sku: string;
    stock: number | string | null;
};

type MovementRow = {
    id: string;
    supplierId: string | null;
    quantity: number | string | null;
    type: string;
    notes: string | null;
    createdAt: string;
    productId: string;
    color: string;
    size: string;
    sku: string;
};

export interface StockRuntime {
    getStockPageData(): Promise<StockPageData>;
    registerStockEntries(entries: RuntimeRegisterStockEntry[]): Promise<void>;
    reduceStockEntries(entries: RuntimeRegisterStockEntry[]): Promise<void>;
    adjustStockEntries(entries: RuntimeRegisterStockEntry[]): Promise<void>;
}

let powerSyncInitPromise: Promise<void> | null = null;

async function ensurePowerSyncReady() {
    if (!powerSyncInitPromise) {
        powerSyncInitPromise = initPowerSync();
    }

    await powerSyncInitPromise;
}

function toNumber(value: number | string | null | undefined): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

async function queryRows<T extends object>(sql: string, parameters: unknown[] = []): Promise<T[]> {
    const rows = await db.getAll(sql, parameters);
    return rows as T[];
}

async function getLocalStockPageData(): Promise<StockPageData> {
    const [products, suppliers, movements, variants] = await Promise.all([
        queryRows<ProductRow>(
            `
                SELECT id, name, priceNormal, priceWholesale
                FROM "Product"
                WHERE deletedAt IS NULL
                ORDER BY createdAt DESC
            `
        ),
        queryRows<SupplierRow>(
            `
                SELECT id, name
                FROM "Supplier"
                WHERE deletedAt IS NULL
                ORDER BY name ASC
            `
        ),
        queryRows<MovementRow>(
            `
                SELECT
                    sm.id,
                    sm.supplierId,
                    sm.quantity,
                    sm.type,
                    sm.notes,
                    sm.createdAt,
                    pv.productId,
                    pv.color,
                    pv.size,
                    pv.sku
                FROM "StockMovement" sm
                INNER JOIN "ProductVariant" pv
                    ON pv.id = sm.variantId
                WHERE sm.deletedAt IS NULL
                ORDER BY sm.createdAt DESC
            `
        ),
        queryRows<VariantRow>(
            `
                SELECT id, productId, color, size, sku, stock
                FROM "ProductVariant"
                WHERE deletedAt IS NULL
            `
        ),
    ]);

    return {
        products: products.map((product) => ({
            id: product.id,
            name: product.name,
            code: product.id.slice(-6).toUpperCase(),
            price: toNumber(product.priceNormal),
            wholesalePrice: toNumber(product.priceWholesale),
        })),
        suppliers: suppliers,
        entries: movements.map((movement) => ({
            id: movement.id,
            productId: movement.productId,
            providerId: movement.supplierId ?? undefined,
            quantity: toNumber(movement.quantity),
            type: movement.type,
            notes: movement.notes ?? undefined,
            color: movement.color,
            size: movement.size,
            sku: movement.sku,
            date: movement.createdAt,
            mode: "simple",
        })),
        variants: variants.map((variant) => ({
            id: variant.id,
            productId: variant.productId,
            color: variant.color,
            size: variant.size,
            sku: variant.sku,
            stock: toNumber(variant.stock),
        })),
    };
}

async function findVariantForEntry(
    tx: {
        getOptional<T extends object>(sql: string, parameters?: unknown[]): Promise<T | null>;
        execute(sql: string, parameters?: unknown[]): Promise<unknown>;
    },
    entry: RuntimeRegisterStockEntry,
    timestamp: string
): Promise<VariantRow | null> {
    let variant = await tx.getOptional<VariantRow>(
        `
            SELECT id, productId, color, size, sku, stock
            FROM "ProductVariant"
            WHERE sku = ?
              AND deletedAt IS NULL
        `,
        [entry.sku]
    );

    if (variant) {
        return variant;
    }

    variant = await tx.getOptional<VariantRow>(
        `
            SELECT id, productId, color, size, sku, stock
            FROM "ProductVariant"
            WHERE productId = ?
              AND color = ?
              AND size = ?
              AND deletedAt IS NULL
            ORDER BY CASE WHEN sku LIKE 'OFF-%' THEN 0 ELSE 1 END, createdAt ASC
            LIMIT 1
        `,
        [entry.productId, entry.color, entry.size]
    );

    if (!variant) {
        return null;
    }

    if (variant.sku !== entry.sku) {
        await tx.execute(
            `
                UPDATE "ProductVariant"
                SET sku = ?, updatedAt = ?
                WHERE id = ?
                  AND deletedAt IS NULL
            `,
            [entry.sku, timestamp, variant.id]
        );

        return {
            ...variant,
            sku: entry.sku,
        };
    }

    return variant;
}

async function withFallback<T>(label: string, local: () => Promise<T>, server: () => Promise<T>) {
    return withOfflineMutationFallback({
        label,
        logPrefix: "stock",
        ensureReady: ensurePowerSyncReady,
        local,
        server,
    });
}

const serverRuntime: StockRuntime = {
    async getStockPageData() {
        return (await getStockPageData()) as StockPageData;
    },
    async registerStockEntries(entries) {
        await registerStockEntries(entries);
    },
    async reduceStockEntries(entries) {
        await reduceStockEntries(entries);
    },
    async adjustStockEntries(entries) {
        await adjustStockEntries(entries);
    },
};

const powerSyncRuntime: StockRuntime = {
    async getStockPageData() {
        return withOfflineReadFallback({
            label: "getStockPageData",
            logPrefix: "stock",
            ensureReady: ensurePowerSyncReady,
            local: getLocalStockPageData,
            server: () => serverRuntime.getStockPageData(),
            hasUsableLocalData: (result) =>
                result.products.length > 0 ||
                result.suppliers.length > 0 ||
                result.entries.length > 0 ||
                result.variants.length > 0,
        });
    },
    async registerStockEntries(entries) {
        return withFallback(
            "registerStockEntries",
            async () => {
                const timestamp = new Date().toISOString();

                await db.writeTransaction(async (tx) => {
                    for (const entry of entries) {
                        let variant = await findVariantForEntry(tx, entry, timestamp);

                        if (variant) {
                            await tx.execute(
                                `
                                    UPDATE "ProductVariant"
                                    SET stock = stock + ?, updatedAt = ?
                                    WHERE id = ?
                                      AND deletedAt IS NULL
                                `,
                                [entry.quantity, timestamp, variant.id]
                            );
                        } else {
                            const variantId = crypto.randomUUID();
                            await tx.execute(
                                `
                                    INSERT INTO "ProductVariant" (
                                        id, productId, size, color, sku, stock, createdAt, updatedAt, deletedAt
                                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                                `,
                                [
                                    variantId,
                                    entry.productId,
                                    entry.size,
                                    entry.color,
                                    entry.sku,
                                    entry.quantity,
                                    timestamp,
                                    timestamp,
                                    null,
                                ]
                            );
                            variant = {
                                id: variantId,
                                productId: entry.productId,
                                color: entry.color,
                                size: entry.size,
                                sku: entry.sku,
                                stock: entry.quantity,
                            };
                        }

                        await tx.execute(
                            `
                                INSERT INTO "StockMovement" (
                                    id, variantId, supplierId, quantity, type, notes, createdAt, updatedAt, deletedAt
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `,
                            [
                                crypto.randomUUID(),
                                variant.id,
                                entry.supplierId ?? null,
                                entry.quantity,
                                "INGRESO",
                                "Ingreso desde panel de stock",
                                timestamp,
                                timestamp,
                                null,
                            ]
                        );
                    }

                    return Promise.resolve();
                });
            },
            () => serverRuntime.registerStockEntries(entries)
        );
    },
    async reduceStockEntries(entries) {
        return withFallback(
            "reduceStockEntries",
            async () => {
                const timestamp = new Date().toISOString();

                await db.writeTransaction(async (tx) => {
                    for (const entry of entries) {
                        const variant = await findVariantForEntry(tx, entry, timestamp);

                        if (!variant || variant.productId !== entry.productId) {
                            throw new Error("La variante a descontar no existe");
                        }

                        const currentStock = toNumber(variant.stock);
                        if (currentStock < entry.quantity) {
                            throw new Error(`Stock insuficiente para ${entry.sku}`);
                        }

                        await tx.execute(
                            `
                                UPDATE "ProductVariant"
                                SET stock = stock - ?, updatedAt = ?
                                WHERE id = ?
                                  AND deletedAt IS NULL
                            `,
                            [entry.quantity, timestamp, variant.id]
                        );

                        await tx.execute(
                            `
                                INSERT INTO "StockMovement" (
                                    id, variantId, supplierId, quantity, type, notes, createdAt, updatedAt, deletedAt
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `,
                            [
                                crypto.randomUUID(),
                                variant.id,
                                null,
                                -entry.quantity,
                                "SALIDA",
                                "Salida desde panel de stock",
                                timestamp,
                                timestamp,
                                null,
                            ]
                        );
                    }

                    return Promise.resolve();
                });
            },
            () => serverRuntime.reduceStockEntries(entries)
        );
    },
    async adjustStockEntries(entries) {
        return withFallback(
            "adjustStockEntries",
            async () => {
                const timestamp = new Date().toISOString();

                await db.writeTransaction(async (tx) => {
                    for (const entry of entries) {
                        const variant = await findVariantForEntry(tx, entry, timestamp);

                        if (!variant) {
                            if (entry.quantity <= 0) {
                                continue;
                            }

                            const variantId = crypto.randomUUID();
                            await tx.execute(
                                `
                                    INSERT INTO "ProductVariant" (
                                        id, productId, size, color, sku, stock, createdAt, updatedAt, deletedAt
                                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                                `,
                                [
                                    variantId,
                                    entry.productId,
                                    entry.size,
                                    entry.color,
                                    entry.sku,
                                    entry.quantity,
                                    timestamp,
                                    timestamp,
                                    null,
                                ]
                            );

                            await tx.execute(
                                `
                                    INSERT INTO "StockMovement" (
                                        id, variantId, supplierId, quantity, type, notes, createdAt, updatedAt, deletedAt
                                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                                `,
                                [
                                    crypto.randomUUID(),
                                    variantId,
                                    entry.supplierId ?? null,
                                    entry.quantity,
                                    "AJUSTE",
                                    "Ajuste desde panel de stock",
                                    timestamp,
                                    timestamp,
                                    null,
                                ]
                            );

                            continue;
                        }

                        if (variant.productId !== entry.productId) {
                            throw new Error("La variante a ajustar no coincide con el producto seleccionado");
                        }

                        const currentStock = toNumber(variant.stock);
                        const delta = entry.quantity - currentStock;

                        if (delta === 0) {
                            continue;
                        }

                        await tx.execute(
                            `
                                UPDATE "ProductVariant"
                                SET stock = ?, updatedAt = ?
                                WHERE id = ?
                                  AND deletedAt IS NULL
                            `,
                            [entry.quantity, timestamp, variant.id]
                        );

                        await tx.execute(
                            `
                                INSERT INTO "StockMovement" (
                                    id, variantId, supplierId, quantity, type, notes, createdAt, updatedAt, deletedAt
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            `,
                            [
                                crypto.randomUUID(),
                                variant.id,
                                entry.supplierId ?? null,
                                delta,
                                "AJUSTE",
                                "Ajuste desde panel de stock",
                                timestamp,
                                timestamp,
                                null,
                            ]
                        );
                    }

                    return Promise.resolve();
                });
            },
            () => serverRuntime.adjustStockEntries(entries)
        );
    },
};

export function getStockRuntime(): StockRuntime {
    if (isOfflineModeEnabled()) {
        return powerSyncRuntime;
    }

    return serverRuntime;
}
