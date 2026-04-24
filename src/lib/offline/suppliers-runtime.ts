"use client";

import {
    createSupplier,
    deleteSupplier,
    getSuppliers,
    updateSupplier,
} from "@/app/actions/suppliers/supplier-actions";
import { isOfflineModeEnabled } from "@/lib/offline-config";
import { withOfflineMutationFallback, withOfflineReadFallback } from "@/lib/offline/runtime-fallback";
import { db, initPowerSync } from "@/lib/powersync/db";

export type RuntimeSupplier = {
    id: string;
    name: string;
    phone: string | null;
    notes: string | null;
};

type SupplierInput = {
    name: string;
    phone?: string;
    notes?: string;
};

type SupplierRow = {
    id: string;
    name: string;
    phone: string | null;
    notes: string | null;
};

export interface SuppliersRuntime {
    getSuppliers(): Promise<RuntimeSupplier[]>;
    createSupplier(input: SupplierInput): Promise<RuntimeSupplier>;
    updateSupplier(id: string, input: SupplierInput): Promise<RuntimeSupplier>;
    deleteSupplier(id: string): Promise<void>;
}

let powerSyncInitPromise: Promise<void> | null = null;

async function ensurePowerSyncReady() {
    if (!powerSyncInitPromise) {
        powerSyncInitPromise = initPowerSync();
    }

    await powerSyncInitPromise;
}

async function queryRows<T extends object>(sql: string, parameters: unknown[] = []): Promise<T[]> {
    const rows = await db.getAll(sql, parameters);
    return rows as T[];
}

async function withReadFallback<T>(
    label: string,
    local: () => Promise<T>,
    server: () => Promise<T>,
    hasData: (result: T) => boolean
) {
    return withOfflineReadFallback({
        label,
        logPrefix: "suppliers",
        ensureReady: ensurePowerSyncReady,
        local,
        server,
        hasUsableLocalData: hasData,
    });
}

async function withMutationFallback<T>(label: string, local: () => Promise<T>, server: () => Promise<T>) {
    return withOfflineMutationFallback({
        label,
        logPrefix: "suppliers",
        ensureReady: ensurePowerSyncReady,
        local,
        server,
    });
}

async function getLocalSuppliers(): Promise<RuntimeSupplier[]> {
    return queryRows<SupplierRow>(
        `
            SELECT id, name, phone, notes
            FROM "Supplier"
            WHERE deletedAt IS NULL
            ORDER BY name ASC
        `
    );
}

const serverRuntime: SuppliersRuntime = {
    async getSuppliers() {
        return (await getSuppliers()) as RuntimeSupplier[];
    },
    async createSupplier(input) {
        return (await createSupplier(input)) as RuntimeSupplier;
    },
    async updateSupplier(id, input) {
        return (await updateSupplier(id, input)) as RuntimeSupplier;
    },
    async deleteSupplier(id) {
        await deleteSupplier(id);
    },
};

const powerSyncRuntime: SuppliersRuntime = {
    async getSuppliers() {
        return withReadFallback(
            "getSuppliers",
            () => getLocalSuppliers(),
            () => serverRuntime.getSuppliers(),
            (suppliers) => suppliers.length > 0
        );
    },
    async createSupplier(input) {
        return withMutationFallback(
            "createSupplier",
            async () => {
                const supplierId = crypto.randomUUID();
                const timestamp = new Date().toISOString();
                const supplier: RuntimeSupplier = {
                    id: supplierId,
                    name: input.name,
                    phone: input.phone?.trim() || null,
                    notes: input.notes?.trim() || null,
                };

                await db.execute(
                    `
                        INSERT INTO "Supplier" (
                            id,
                            name,
                            phone,
                            notes,
                            createdAt,
                            updatedAt,
                            deletedAt
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    `,
                    [
                        supplier.id,
                        supplier.name,
                        supplier.phone,
                        supplier.notes,
                        timestamp,
                        timestamp,
                        null,
                    ]
                );

                return supplier;
            },
            () => serverRuntime.createSupplier(input)
        );
    },
    async updateSupplier(id, input) {
        return withMutationFallback(
            "updateSupplier",
            async () => {
                const timestamp = new Date().toISOString();
                const supplier: RuntimeSupplier = {
                    id,
                    name: input.name,
                    phone: input.phone?.trim() || null,
                    notes: input.notes?.trim() || null,
                };

                await db.execute(
                    `
                        UPDATE "Supplier"
                        SET
                            name = ?,
                            phone = ?,
                            notes = ?,
                            updatedAt = ?
                        WHERE id = ?
                    `,
                    [supplier.name, supplier.phone, supplier.notes, timestamp, id]
                );

                return supplier;
            },
            () => serverRuntime.updateSupplier(id, input)
        );
    },
    async deleteSupplier(id) {
        return withMutationFallback(
            "deleteSupplier",
            async () => {
                const variants = await queryRows<{ count: number | string | null }>(
                    `
                        SELECT COUNT(*) AS count
                        FROM "StockMovement"
                        WHERE deletedAt IS NULL
                          AND supplierId = ?
                    `,
                    [id]
                );

                if (Number(variants[0]?.count ?? 0) > 0) {
                    throw new Error("Este proveedor tiene productos asociados");
                }

                const timestamp = new Date().toISOString();
                await db.execute(
                    `
                        UPDATE "Supplier"
                        SET
                            deletedAt = ?,
                            updatedAt = ?
                        WHERE id = ?
                    `,
                    [timestamp, timestamp, id]
                );
            },
            () => serverRuntime.deleteSupplier(id)
        );
    },
};

export function getSuppliersRuntime(): SuppliersRuntime {
    if (isOfflineModeEnabled()) {
        return powerSyncRuntime;
    }

    return serverRuntime;
}
