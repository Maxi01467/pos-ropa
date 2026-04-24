"use client";

import {
    addCashMovement,
    closeCashSession,
    closeCashSessionWithoutCount,
    getCurrentSession,
    openCashSession,
} from "@/app/actions/cash/cash-actions";
import { getSellers } from "@/app/actions/pos/pos-actions";
import { isOfflineModeEnabled } from "@/lib/offline-config";
import { withOfflineMutationFallback, withOfflineReadFallback } from "@/lib/offline/runtime-fallback";
import { db, initPowerSync } from "@/lib/powersync/db";

export type RuntimeSeller = {
    id: string;
    name: string;
    role: string;
};

export type RuntimeCashSale = {
    id: string;
    ticketNumber: string;
    total: number;
    paymentMethod: string;
    cashAmount: number | null;
    transferAmount: number | null;
    createdAt: string;
    userId: string;
};

export type RuntimeCashMovement = {
    id: string;
    sessionId: string;
    amount: number;
    type: string;
    reason: string;
    createdAt: string;
};

export type RuntimeCashSession = {
    id: string;
    openedById: string;
    closedById: string | null;
    countedById?: string | null;
    status: string;
    openingDate: string;
    closingDate: string | null;
    countingDate?: string | null;
    initialAmount: number;
    expectedAmount: number | null;
    actualAmount: number | null;
    difference: number | null;
    openedBy: { id: string; name: string; role: string } | null;
    closedBy: { id: string; name: string; role: string } | null;
    countedBy?: { id: string; name: string; role: string } | null;
    movements: RuntimeCashMovement[];
    sales: RuntimeCashSale[];
};

type SessionRow = {
    id: string;
    openedById: string;
    closedById: string | null;
    countedById: string | null;
    status: string;
    openingDate: string;
    closingDate: string | null;
    countingDate: string | null;
    initialAmount: number | string | null;
    expectedAmount: number | string | null;
    actualAmount: number | string | null;
    difference: number | string | null;
    openedByName: string | null;
    openedByRole: string | null;
    closedByName: string | null;
    closedByRole: string | null;
    countedByName: string | null;
    countedByRole: string | null;
};

type MovementRow = {
    id: string;
    sessionId: string;
    amount: number | string | null;
    type: string;
    reason: string;
    createdAt: string;
};

type SaleRow = {
    id: string;
    ticketNumber: string | number | null;
    total: number | string | null;
    paymentMethod: string;
    cashAmount: number | string | null;
    transferAmount: number | string | null;
    createdAt: string;
    userId: string;
};

type UserRow = {
    id: string;
    name: string;
    role: string;
};

type CurrentSessionResult = RuntimeCashSession | null;

export interface CashRuntime {
    getCurrentSession(): Promise<CurrentSessionResult>;
    getSellers(): Promise<RuntimeSeller[]>;
    openCashSession(initialAmount: number, userId: string): Promise<RuntimeCashSession>;
    addCashMovement(
        sessionId: string,
        amount: number,
        type: "INGRESO" | "EGRESO",
        reason: string
    ): Promise<RuntimeCashMovement>;
    closeCashSession(
        sessionId: string,
        actualAmount: number,
        userId: string
    ): Promise<RuntimeCashSession>;
    closeCashSessionWithoutCount(sessionId: string, userId: string): Promise<RuntimeCashSession>;
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

function toTicketNumber(value: string | number | null | undefined): string { return String(value || ""); }

async function queryRows<T extends object>(sql: string, parameters: unknown[] = []): Promise<T[]> {
    const rows = await db.getAll(sql, parameters);
    return rows as T[];
}

async function getLocalUsers(): Promise<RuntimeSeller[]> {
    const rows = await queryRows<UserRow>(
        `
            SELECT id, name, role
            FROM "User"
            WHERE deletedAt IS NULL
              AND (active = 1 OR active = '1' OR active = 'true' OR active = 't')
            ORDER BY name ASC
        `
    );

    return rows;
}

async function getLocalCurrentSession(): Promise<CurrentSessionResult> {
    const session = await db.getOptional<SessionRow>(
        `
            SELECT
                cs.id,
                cs.openedById,
                cs.closedById,
                cs.countedById,
                cs.status,
                cs.openingDate,
                cs.closingDate,
                cs.countingDate,
                cs.initialAmount,
                cs.expectedAmount,
                cs.actualAmount,
                cs.difference,
                openedBy.name AS openedByName,
                openedBy.role AS openedByRole,
                closedBy.name AS closedByName,
                closedBy.role AS closedByRole,
                countedBy.name AS countedByName,
                countedBy.role AS countedByRole
            FROM "CashSession" cs
            LEFT JOIN "User" openedBy
                ON openedBy.id = cs.openedById
            LEFT JOIN "User" closedBy
                ON closedBy.id = cs.closedById
            LEFT JOIN "User" countedBy
                ON countedBy.id = cs.countedById
            WHERE cs.deletedAt IS NULL
              AND cs.status = 'OPEN'
            ORDER BY cs.openingDate DESC
            LIMIT 1
        `
    );

    if (!session) {
        return null;
    }

    const [movements, sales] = await Promise.all([
        queryRows<MovementRow>(
            `
                SELECT id, sessionId, amount, type, reason, createdAt
                FROM "CashMovement"
                WHERE deletedAt IS NULL
                  AND sessionId = ?
                ORDER BY createdAt DESC
            `,
            [session.id]
        ),
        queryRows<SaleRow>(
            `
                SELECT id, ticketNumber, total, paymentMethod, cashAmount, transferAmount, createdAt, userId
                FROM "Sale"
                WHERE deletedAt IS NULL
                  AND cashSessionId = ?
                ORDER BY createdAt DESC
            `,
            [session.id]
        ),
    ]);

    return {
        id: session.id,
        openedById: session.openedById,
        closedById: session.closedById,
        countedById: session.countedById,
        status: session.status,
        openingDate: session.openingDate,
        closingDate: session.closingDate,
        countingDate: session.countingDate,
        initialAmount: toNumber(session.initialAmount),
        expectedAmount:
            session.expectedAmount == null ? null : toNumber(session.expectedAmount),
        actualAmount: session.actualAmount == null ? null : toNumber(session.actualAmount),
        difference: session.difference == null ? null : toNumber(session.difference),
        openedBy: session.openedByName
            ? {
                  id: session.openedById,
                  name: session.openedByName,
                  role: session.openedByRole ?? "STAFF",
              }
            : null,
        closedBy: session.closedById && session.closedByName
            ? {
                  id: session.closedById,
                  name: session.closedByName,
                  role: session.closedByRole ?? "STAFF",
              }
            : null,
        countedBy: session.countedById && session.countedByName
            ? {
                  id: session.countedById,
                  name: session.countedByName,
                  role: session.countedByRole ?? "STAFF",
              }
            : null,
        movements: movements.map((movement) => ({
            id: movement.id,
            sessionId: movement.sessionId,
            amount: toNumber(movement.amount),
            type: movement.type,
            reason: movement.reason,
            createdAt: movement.createdAt,
        })),
        sales: sales.map((sale) => ({
            id: sale.id,
            ticketNumber: toTicketNumber(sale.ticketNumber),
            total: toNumber(sale.total),
            paymentMethod: sale.paymentMethod,
            cashAmount: sale.cashAmount == null ? null : toNumber(sale.cashAmount),
            transferAmount:
                sale.transferAmount == null ? null : toNumber(sale.transferAmount),
            createdAt: sale.createdAt,
            userId: sale.userId,
        })),
    };
}

function calculateExpectedAmount(session: RuntimeCashSession): number {
    const cashFromSales = session.sales.reduce(
        (sum, sale) => sum + Number(sale.cashAmount || 0),
        0
    );

    const manualCashIn = session.movements
        .filter((movement) => movement.type === "INGRESO")
        .reduce((sum, movement) => sum + Number(movement.amount), 0);

    const manualCashOut = session.movements
        .filter((movement) => movement.type === "EGRESO")
        .reduce((sum, movement) => sum + Number(movement.amount), 0);

    return Number(session.initialAmount) + cashFromSales + manualCashIn - manualCashOut;
}

async function withFallback<T>(label: string, local: () => Promise<T>, server: () => Promise<T>) {
    return withOfflineMutationFallback({
        label,
        logPrefix: "cash",
        ensureReady: ensurePowerSyncReady,
        local,
        server,
    });
}

const serverRuntime: CashRuntime = {
    async getCurrentSession() {
        return (await getCurrentSession()) as CurrentSessionResult;
    },
    async getSellers() {
        return (await getSellers()) as RuntimeSeller[];
    },
    async openCashSession(initialAmount, userId) {
        return (await openCashSession(initialAmount, userId)) as RuntimeCashSession;
    },
    async addCashMovement(sessionId, amount, type, reason) {
        return (await addCashMovement(sessionId, amount, type, reason)) as RuntimeCashMovement;
    },
    async closeCashSession(sessionId, actualAmount, userId) {
        return (await closeCashSession(sessionId, actualAmount, userId)) as RuntimeCashSession;
    },
    async closeCashSessionWithoutCount(sessionId, userId) {
        return (await closeCashSessionWithoutCount(sessionId, userId)) as RuntimeCashSession;
    },
};

const powerSyncRuntime: CashRuntime = {
    async getCurrentSession() {
        return withOfflineReadFallback({
            label: "getCurrentSession",
            logPrefix: "cash",
            ensureReady: ensurePowerSyncReady,
            local: getLocalCurrentSession,
            server: () => serverRuntime.getCurrentSession(),
            hasUsableLocalData: (result) => result !== null,
        });
    },
    async getSellers() {
        return withOfflineReadFallback({
            label: "getSellers",
            logPrefix: "cash",
            ensureReady: ensurePowerSyncReady,
            local: getLocalUsers,
            server: () => serverRuntime.getSellers(),
            hasUsableLocalData: (users) => users.length > 0,
        });
    },
    async openCashSession(initialAmount, userId) {
        return withFallback(
            "openCashSession",
            async () => {
                if (!Number.isFinite(initialAmount) || initialAmount < 0) {
                    throw new Error("El monto inicial debe ser un número mayor o igual a 0");
                }

                const existingSession = await getLocalCurrentSession();
                if (existingSession) {
                    throw new Error("Ya hay una caja abierta actualmente.");
                }

                const timestamp = new Date().toISOString();
                const sessionId = crypto.randomUUID();

                await db.execute(
                    `
                        INSERT INTO "CashSession" (
                            id,
                            openedById,
                            closedById,
                            status,
                            openingDate,
                            closingDate,
                            countedById,
                            countingDate,
                            initialAmount,
                            expectedAmount,
                            actualAmount,
                            difference,
                            createdAt,
                            updatedAt,
                            deletedAt
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `,
                    [
                        sessionId,
                        userId,
                        null,
                        "OPEN",
                        timestamp,
                        null,
                        null,
                        null,
                        initialAmount,
                        null,
                        null,
                        null,
                        timestamp,
                        timestamp,
                        null,
                    ]
                );

                const session = await getLocalCurrentSession();
                if (!session) {
                    throw new Error("No se pudo abrir la caja local");
                }

                return session;
            },
            () => serverRuntime.openCashSession(initialAmount, userId)
        );
    },
    async addCashMovement(sessionId, amount, type, reason) {
        return withFallback(
            "addCashMovement",
            async () => {
                const timestamp = new Date().toISOString();
                const movementId = crypto.randomUUID();

                await db.execute(
                    `
                        INSERT INTO "CashMovement" (
                            id,
                            sessionId,
                            amount,
                            type,
                            reason,
                            createdAt,
                            updatedAt,
                            deletedAt
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `,
                    [movementId, sessionId, amount, type, reason, timestamp, timestamp, null]
                );

                return {
                    id: movementId,
                    sessionId,
                    amount,
                    type,
                    reason,
                    createdAt: timestamp,
                };
            },
            () => serverRuntime.addCashMovement(sessionId, amount, type, reason)
        );
    },
    async closeCashSession(sessionId, actualAmount, userId) {
        return withFallback(
            "closeCashSession",
            async () => {
                const session = await getLocalCurrentSession();

                if (!session || session.id !== sessionId) {
                    throw new Error("Sesión no encontrada");
                }

                if (session.status === "CLOSED") {
                    throw new Error("Esta caja ya fue cerrada");
                }

                const expectedAmount = calculateExpectedAmount(session);
                const difference = actualAmount - expectedAmount;
                const timestamp = new Date().toISOString();

                await db.execute(
                    `
                        UPDATE "CashSession"
                        SET
                            status = ?,
                            closingDate = ?,
                            closedById = ?,
                            expectedAmount = ?,
                            actualAmount = ?,
                            difference = ?,
                            countedById = ?,
                            countingDate = ?,
                            updatedAt = ?
                        WHERE id = ?
                          AND deletedAt IS NULL
                    `,
                    [
                        "CLOSED",
                        timestamp,
                        userId,
                        expectedAmount,
                        actualAmount,
                        difference,
                        userId,
                        timestamp,
                        timestamp,
                        sessionId,
                    ]
                );

                const updated = await queryRows<SessionRow>(
                    `
                        SELECT
                            cs.id,
                            cs.openedById,
                            cs.closedById,
                            cs.countedById,
                            cs.status,
                            cs.openingDate,
                            cs.closingDate,
                            cs.countingDate,
                            cs.initialAmount,
                            cs.expectedAmount,
                            cs.actualAmount,
                            cs.difference,
                            openedBy.name AS openedByName,
                            openedBy.role AS openedByRole,
                            closedBy.name AS closedByName,
                            closedBy.role AS closedByRole,
                            countedBy.name AS countedByName,
                            countedBy.role AS countedByRole
                        FROM "CashSession" cs
                        LEFT JOIN "User" openedBy ON openedBy.id = cs.openedById
                        LEFT JOIN "User" closedBy ON closedBy.id = cs.closedById
                        LEFT JOIN "User" countedBy ON countedBy.id = cs.countedById
                        WHERE cs.id = ?
                          AND cs.deletedAt IS NULL
                    `,
                    [sessionId]
                );

                const closedSession = updated[0];
                if (!closedSession) {
                    throw new Error("No se pudo cerrar la caja local");
                }

                return {
                    ...session,
                    status: "CLOSED",
                    closedById: userId,
                    countedById: userId,
                    closingDate: timestamp,
                    countingDate: timestamp,
                    expectedAmount,
                    actualAmount,
                    difference,
                    closedBy: closedSession.closedByName
                        ? {
                              id: userId,
                              name: closedSession.closedByName,
                              role: closedSession.closedByRole ?? "STAFF",
                          }
                        : null,
                    countedBy: closedSession.countedByName
                        ? {
                              id: userId,
                              name: closedSession.countedByName,
                              role: closedSession.countedByRole ?? "STAFF",
                          }
                        : null,
                };
            },
            () => serverRuntime.closeCashSession(sessionId, actualAmount, userId)
        );
    },
    async closeCashSessionWithoutCount(sessionId, userId) {
        return withFallback(
            "closeCashSessionWithoutCount",
            async () => {
                const session = await getLocalCurrentSession();

                if (!session || session.id !== sessionId) {
                    throw new Error("Sesión no encontrada");
                }

                const expectedAmount = calculateExpectedAmount(session);
                const timestamp = new Date().toISOString();

                await db.execute(
                    `
                        UPDATE "CashSession"
                        SET
                            status = ?,
                            closingDate = ?,
                            closedById = ?,
                            expectedAmount = ?,
                            updatedAt = ?
                        WHERE id = ?
                          AND deletedAt IS NULL
                    `,
                    ["PENDING_COUNT", timestamp, userId, expectedAmount, timestamp, sessionId]
                );

                return {
                    ...session,
                    status: "PENDING_COUNT",
                    closedById: userId,
                    closingDate: timestamp,
                    expectedAmount,
                };
            },
            () => serverRuntime.closeCashSessionWithoutCount(sessionId, userId)
        );
    },
};

export function getCashRuntime(): CashRuntime {
    if (isOfflineModeEnabled()) {
        return powerSyncRuntime;
    }

    return serverRuntime;
}
