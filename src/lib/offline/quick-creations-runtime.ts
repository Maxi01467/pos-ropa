"use client";

import {
    getQuickCreationNotifications,
    markQuickCreationNotificationsSeen,
} from "@/app/actions/inventory/inventory-actions";
import { isOfflineModeEnabled } from "@/lib/offline-config";
import { withOfflineMutationFallback, withOfflineReadFallback } from "@/lib/offline/runtime-fallback";
import { db, initPowerSync } from "@/lib/powersync/db";

export type QuickCreationNotification = {
    id: string;
    name: string;
    quickCreatedAt: string | null;
    quickCreatedByName: string;
    quickCreatedByRole: string;
    pendingReview: boolean;
};

type NotificationRow = {
    id: string;
    name: string;
    quickCreatedAt: string | null;
    quickCreatedByName: string | null;
    quickCreatedByRole: string | null;
    pendingReview: number | string | null;
};

export interface QuickCreationsRuntime {
    getNotifications(): Promise<QuickCreationNotification[]>;
    markSeen(productIds: string[]): Promise<void>;
}

let powerSyncInitPromise: Promise<void> | null = null;

async function ensurePowerSyncReady() {
    if (!powerSyncInitPromise) {
        powerSyncInitPromise = initPowerSync();
    }

    await powerSyncInitPromise;
}

function toBoolean(value: number | string | null | undefined) {
    return Number(value) === 1;
}

async function queryRows<T extends object>(sql: string, parameters: unknown[] = []): Promise<T[]> {
    const rows = await db.getAll(sql, parameters);
    return rows as T[];
}

async function getLocalNotifications(): Promise<QuickCreationNotification[]> {
    const rows = await queryRows<NotificationRow>(
        `
            SELECT
                id,
                name,
                quickCreatedAt,
                quickCreatedByName,
                quickCreatedByRole,
                pendingReview
            FROM "Product"
            WHERE deletedAt IS NULL
              AND quickCreated = 1
              AND quickNotificationSeen = 0
            ORDER BY quickCreatedAt DESC
            LIMIT 20
        `
    );

    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        quickCreatedAt: row.quickCreatedAt,
        quickCreatedByName: row.quickCreatedByName ?? "Sistema",
        quickCreatedByRole: row.quickCreatedByRole ?? "STAFF",
        pendingReview: toBoolean(row.pendingReview),
    }));
}

async function withFallback<T>(label: string, local: () => Promise<T>, server: () => Promise<T>) {
    return withOfflineMutationFallback({
        label,
        logPrefix: "quick-creations",
        ensureReady: ensurePowerSyncReady,
        local,
        server,
    });
}

const serverRuntime: QuickCreationsRuntime = {
    async getNotifications() {
        return (await getQuickCreationNotifications()) as QuickCreationNotification[];
    },
    async markSeen(productIds) {
        await markQuickCreationNotificationsSeen(productIds);
    },
};

const powerSyncRuntime: QuickCreationsRuntime = {
    async getNotifications() {
        return withOfflineReadFallback({
            label: "getNotifications",
            logPrefix: "quick-creations",
            ensureReady: ensurePowerSyncReady,
            local: getLocalNotifications,
            server: () => serverRuntime.getNotifications(),
            hasUsableLocalData: (notifications) => notifications.length > 0,
        });
    },
    async markSeen(productIds) {
        return withFallback(
            "markSeen",
            async () => {
                if (productIds.length === 0) {
                    return;
                }

                const timestamp = new Date().toISOString();
                await db.writeTransaction(async (tx) => {
                    for (const productId of productIds) {
                        await tx.execute(
                            `
                                UPDATE "Product"
                                SET
                                    quickNotificationSeen = 1,
                                    updatedAt = ?
                                WHERE id = ?
                                  AND deletedAt IS NULL
                            `,
                            [timestamp, productId]
                        );
                    }
                });
            },
            () => serverRuntime.markSeen(productIds)
        );
    },
};

export function getQuickCreationsRuntime(): QuickCreationsRuntime {
    if (isOfflineModeEnabled()) {
        return powerSyncRuntime;
    }

    return serverRuntime;
}
