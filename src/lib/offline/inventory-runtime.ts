"use client";

import {
    createProduct,
    deleteProduct,
    getInventoryData,
    markProductReviewed,
    updateProduct,
} from "@/app/actions/inventory/inventory-actions";
import { isOfflineModeEnabled } from "@/lib/offline-config";
import { withOfflineMutationFallback, withOfflineReadFallback } from "@/lib/offline/runtime-fallback";
import { db, initPowerSync } from "@/lib/powersync/db";

export type InventoryRuntimeProduct = {
    id: string;
    code: string;
    name: string;
    quickCreated: boolean;
    pendingReview: boolean;
    quickCreatedAt?: string;
    quickCreatedByName?: string;
    quickCreatedByRole?: string;
    reviewedAt?: string;
    reviewedByName?: string;
    price: number;
    wholesalePrice: number;
    costPrice?: number;
    stock: number;
};

type InventoryProductInput = {
    name: string;
    price: number;
    wholesalePrice: number;
    costPrice?: number;
};

type InventoryDataResult = {
    products: InventoryRuntimeProduct[];
};

type ProductRow = {
    id: string;
    name: string;
    quickCreated: number | string | null;
    pendingReview: number | string | null;
    quickCreatedAt: string | null;
    quickCreatedByName: string | null;
    quickCreatedByRole: string | null;
    reviewedAt: string | null;
    reviewedByName: string | null;
    priceNormal: number | string | null;
    priceWholesale: number | string | null;
    costPrice: number | string | null;
    stock: number | string | null;
};

export interface InventoryRuntime {
    getInventoryData(): Promise<InventoryDataResult>;
    createProduct(input: InventoryProductInput): Promise<InventoryRuntimeProduct>;
    updateProduct(id: string, input: InventoryProductInput): Promise<InventoryRuntimeProduct>;
    deleteProduct(id: string): Promise<void>;
    markProductReviewed(id: string): Promise<InventoryRuntimeProduct>;
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

function toBoolean(value: number | string | null | undefined): boolean {
    return toNumber(value) === 1;
}

async function queryRows<T extends object>(sql: string, parameters: unknown[] = []): Promise<T[]> {
    const rows = await db.getAll(sql, parameters);
    return rows as T[];
}

function mapProductRow(row: ProductRow): InventoryRuntimeProduct {
    return {
        id: row.id,
        code: row.id.slice(-6).toUpperCase(),
        name: row.name,
        quickCreated: toBoolean(row.quickCreated),
        pendingReview: toBoolean(row.pendingReview),
        quickCreatedAt: row.quickCreatedAt ?? undefined,
        quickCreatedByName: row.quickCreatedByName ?? undefined,
        quickCreatedByRole: row.quickCreatedByRole ?? undefined,
        reviewedAt: row.reviewedAt ?? undefined,
        reviewedByName: row.reviewedByName ?? undefined,
        price: toNumber(row.priceNormal),
        wholesalePrice: toNumber(row.priceWholesale),
        costPrice: row.costPrice == null ? undefined : toNumber(row.costPrice),
        stock: toNumber(row.stock),
    };
}

async function getLocalInventoryData(): Promise<InventoryDataResult> {
    const rows = await queryRows<ProductRow>(
        `
            SELECT
                p.id,
                p.name,
                p.quickCreated,
                p.pendingReview,
                p.quickCreatedAt,
                p.quickCreatedByName,
                p.quickCreatedByRole,
                p.reviewedAt,
                p.reviewedByName,
                p.priceNormal,
                p.priceWholesale,
                p.costPrice,
                COALESCE(SUM(pv.stock), 0) AS stock
            FROM "Product" p
            LEFT JOIN "ProductVariant" pv
                ON pv.productId = p.id
               AND pv.deletedAt IS NULL
            WHERE p.deletedAt IS NULL
            GROUP BY
                p.id,
                p.name,
                p.quickCreated,
                p.pendingReview,
                p.quickCreatedAt,
                p.quickCreatedByName,
                p.quickCreatedByRole,
                p.reviewedAt,
                p.reviewedByName,
                p.priceNormal,
                p.priceWholesale,
                p.costPrice,
                p.createdAt
            ORDER BY p.createdAt DESC
        `
    );

    return {
        products: rows.map(mapProductRow),
    };
}

async function withFallback<T>(label: string, local: () => Promise<T>, server: () => Promise<T>) {
    return withOfflineMutationFallback({
        label,
        logPrefix: "inventory",
        ensureReady: ensurePowerSyncReady,
        local,
        server,
    });
}

const serverRuntime: InventoryRuntime = {
    async getInventoryData() {
        return (await getInventoryData()) as InventoryDataResult;
    },
    async createProduct(input) {
        const created = await createProduct(input);
        return {
            id: created.id,
            code: created.id.slice(-6).toUpperCase(),
            name: created.name,
            quickCreated: created.quickCreated,
            pendingReview: created.pendingReview,
            quickCreatedAt: created.quickCreatedAt,
            quickCreatedByName: created.quickCreatedByName,
            quickCreatedByRole: created.quickCreatedByRole,
            reviewedAt: created.reviewedAt,
            reviewedByName: created.reviewedByName,
            price: created.priceNormal,
            wholesalePrice: created.priceWholesale,
            costPrice: created.costPrice,
            stock: 0,
        };
    },
    async updateProduct(id, input) {
        const updated = await updateProduct(id, input);
        return {
            id: updated.id,
            code: updated.id.slice(-6).toUpperCase(),
            name: updated.name,
            quickCreated: updated.quickCreated,
            pendingReview: updated.pendingReview,
            quickCreatedAt: updated.quickCreatedAt,
            quickCreatedByName: updated.quickCreatedByName,
            quickCreatedByRole: updated.quickCreatedByRole,
            reviewedAt: updated.reviewedAt,
            reviewedByName: updated.reviewedByName,
            price: updated.priceNormal,
            wholesalePrice: updated.priceWholesale,
            costPrice: updated.costPrice,
            stock: 0,
        };
    },
    async deleteProduct(id) {
        await deleteProduct(id);
    },
    async markProductReviewed(id) {
        const reviewed = await markProductReviewed(id);
        return {
            id: reviewed.id,
            code: reviewed.id.slice(-6).toUpperCase(),
            name: reviewed.name,
            quickCreated: reviewed.quickCreated,
            pendingReview: reviewed.pendingReview,
            quickCreatedAt: reviewed.quickCreatedAt,
            quickCreatedByName: reviewed.quickCreatedByName,
            quickCreatedByRole: reviewed.quickCreatedByRole,
            reviewedAt: reviewed.reviewedAt,
            reviewedByName: reviewed.reviewedByName,
            price: reviewed.priceNormal,
            wholesalePrice: reviewed.priceWholesale,
            costPrice: reviewed.costPrice,
            stock: 0,
        };
    },
};

const powerSyncRuntime: InventoryRuntime = {
    async getInventoryData() {
        return withOfflineReadFallback({
            label: "getInventoryData",
            logPrefix: "inventory",
            ensureReady: ensurePowerSyncReady,
            local: getLocalInventoryData,
            server: () => serverRuntime.getInventoryData(),
            hasUsableLocalData: (result) => result.products.length > 0,
        });
    },
    async createProduct(input) {
        return withFallback(
            "createProduct",
            async () => {
                const timestamp = new Date().toISOString();
                const productId = crypto.randomUUID();
                const variantId = crypto.randomUUID();
                const defaultSku = `${productId.slice(-6).toUpperCase()}-UNI`;

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
                            input.name,
                            0,
                            0,
                            null,
                            null,
                            null,
                            1,
                            null,
                            null,
                            input.price,
                            input.wholesalePrice,
                            input.costPrice ?? null,
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
                            defaultSku,
                            0,
                            timestamp,
                            timestamp,
                            null,
                        ]
                    );
                });

                const createdProduct: InventoryRuntimeProduct = {
                    id: productId,
                    code: productId.slice(-6).toUpperCase(),
                    name: input.name,
                    quickCreated: false,
                    pendingReview: false,
                    price: input.price,
                    wholesalePrice: input.wholesalePrice,
                    costPrice: input.costPrice,
                    stock: 0,
                };

                return createdProduct;
            },
            () => serverRuntime.createProduct(input)
        );
    },
    async updateProduct(id, input) {
        return withFallback(
            "updateProduct",
            async () => {
                const timestamp = new Date().toISOString();

                await db.execute(
                    `
                        UPDATE "Product"
                        SET
                            name = ?,
                            priceNormal = ?,
                            priceWholesale = ?,
                            costPrice = ?,
                            pendingReview = 0,
                            reviewedAt = ?,
                            reviewedByName = ?,
                            updatedAt = ?
                        WHERE id = ?
                    `,
                    [
                        input.name,
                        input.price,
                        input.wholesalePrice,
                        input.costPrice ?? null,
                        timestamp,
                        "Sistema local",
                        timestamp,
                        id,
                    ]
                );

                const data = await getLocalInventoryData();
                const product = data.products.find((item) => item.id === id);

                if (!product) {
                    throw new Error("Producto no encontrado en la base local");
                }

                return product;
            },
            () => serverRuntime.updateProduct(id, input)
        );
    },
    async deleteProduct(id) {
        return withFallback(
            "deleteProduct",
            async () => {
                const timestamp = new Date().toISOString();

                await db.writeTransaction(async (tx) => {
                    await tx.execute(
                        `UPDATE "Product" SET deletedAt = ?, updatedAt = ? WHERE id = ?`,
                        [timestamp, timestamp, id]
                    );
                    await tx.execute(
                        `UPDATE "ProductVariant" SET deletedAt = ?, updatedAt = ? WHERE productId = ?`,
                        [timestamp, timestamp, id]
                    );
                    return Promise.resolve();
                });
            },
            () => serverRuntime.deleteProduct(id)
        );
    },
    async markProductReviewed(id) {
        return withFallback(
            "markProductReviewed",
            async () => {
                const timestamp = new Date().toISOString();

                await db.execute(
                    `
                        UPDATE "Product"
                        SET
                            pendingReview = 0,
                            quickNotificationSeen = 1,
                            reviewedAt = ?,
                            reviewedByName = ?,
                            updatedAt = ?
                        WHERE id = ?
                    `,
                    [timestamp, "Sistema local", timestamp, id]
                );

                const data = await getLocalInventoryData();
                const product = data.products.find((item) => item.id === id);

                if (!product) {
                    throw new Error("Producto no encontrado en la base local");
                }

                return product;
            },
            () => serverRuntime.markProductReviewed(id)
        );
    },
};

export function getInventoryRuntime(): InventoryRuntime {
    if (isOfflineModeEnabled()) {
        return powerSyncRuntime;
    }

    return serverRuntime;
}
