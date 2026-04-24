"use client";

import { getSellers } from "@/app/actions/pos/pos-actions";
import {
    getCashSessionsHistory,
    getClosedSessions,
    getPendingCountSessions,
    submitArqueo,
} from "@/app/actions/cash/cash-actions";
import { isOfflineModeEnabled } from "@/lib/offline-config";
import { withOfflineMutationFallback, withOfflineReadFallback } from "@/lib/offline/runtime-fallback";
import { db, initPowerSync } from "@/lib/powersync/db";

export type CashHistorySeller = {
    id: string;
    name: string;
    role: string;
};

export type CashHistorySale = {
    id: string;
    ticketNumber: string;
    total: number;
    paymentMethod: string;
    cashAmount: number | null;
    transferAmount: number | null;
    createdAt: string;
    sellerName: string;
};

export type CashHistoryMovement = {
    id: string;
    amount: number;
    type: string;
    reason: string;
    createdAt: string;
};

export type CashHistorySession = {
    id: string;
    status: string;
    openingDate: string;
    closingDate: string | null;
    countingDate: string | null;
    initialAmount: number;
    expectedAmount: number | null;
    actualAmount: number | null;
    difference: number | null;
    openedBy: CashHistorySeller | null;
    closedBy: CashHistorySeller | null;
    countedBy: CashHistorySeller | null;
    movements: CashHistoryMovement[];
    sales: CashHistorySale[];
};

type SessionRow = {
    id: string;
    status: string;
    openingDate: string;
    closingDate: string | null;
    countingDate: string | null;
    initialAmount: number | string | null;
    expectedAmount: number | string | null;
    actualAmount: number | string | null;
    difference: number | string | null;
    openedById: string | null;
    openedByName: string | null;
    openedByRole: string | null;
    closedById: string | null;
    closedByName: string | null;
    closedByRole: string | null;
    countedById: string | null;
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
    sessionId: string;
    ticketNumber: number | string | null;
    total: number | string | null;
    paymentMethod: string;
    cashAmount: number | string | null;
    transferAmount: number | string | null;
    createdAt: string;
    sellerName: string | null;
};

type UserRow = {
    id: string;
    name: string;
    role: string;
};

export interface CashHistoryRuntime {
    getCashSessionsHistory(): Promise<CashHistorySession[]>;
    getPendingCountSessions(): Promise<CashHistorySession[]>;
    getClosedSessions(limit?: number): Promise<CashHistorySession[]>;
    getSellers(): Promise<CashHistorySeller[]>;
    submitArqueo(
        sessionId: string,
        actualAmount: number,
        countedByUserId: string
    ): Promise<CashHistorySession>;
}

type ServerCashSession = {
    id: string;
    status: string;
    openingDate: string;
    closingDate: string | null;
    countingDate: string | null;
    initialAmount: number;
    expectedAmount: number | null;
    actualAmount: number | null;
    difference: number | null;
    openedBy: CashHistorySeller | null;
    closedBy: CashHistorySeller | null;
    countedBy: CashHistorySeller | null;
    movements?: Array<{
        id: string;
        amount: number;
        type: string;
        reason: string;
        createdAt: string;
    }>;
    sales: Array<{
        id: string;
        ticketNumber: string;
        total: number;
        paymentMethod: string;
        cashAmount: number | null;
        transferAmount: number | null;
        createdAt: string;
        sellerName?: string;
    }>;
};

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

function toSeller(
    id: string | null,
    name: string | null,
    role: string | null
): CashHistorySeller | null {
    if (!id || !name) {
        return null;
    }

    return {
        id,
        name,
        role: role ?? "STAFF",
    };
}

async function queryRows<T extends object>(sql: string, parameters: unknown[] = []): Promise<T[]> {
    const rows = await db.getAll(sql, parameters);
    return rows as T[];
}

function buildPlaceholders(count: number) {
    return Array.from({ length: count }, () => "?").join(", ");
}

async function getLocalSellers(): Promise<CashHistorySeller[]> {
    return queryRows<UserRow>(
        `
            SELECT id, name, role
            FROM "User"
            WHERE deletedAt IS NULL
              AND active = 1
            ORDER BY name ASC
        `
    );
}

async function getLocalSessionRows(
    whereSql = "",
    parameters: unknown[] = [],
    orderBySql = `ORDER BY cs.openingDate DESC`,
    limit?: number
): Promise<SessionRow[]> {
    const limitSql = limit ? `LIMIT ${limit}` : "";

    return queryRows<SessionRow>(
        `
            SELECT
                cs.id,
                cs.status,
                cs.openingDate,
                cs.closingDate,
                cs.countingDate,
                cs.initialAmount,
                cs.expectedAmount,
                cs.actualAmount,
                cs.difference,
                openedBy.id AS openedById,
                openedBy.name AS openedByName,
                openedBy.role AS openedByRole,
                closedBy.id AS closedById,
                closedBy.name AS closedByName,
                closedBy.role AS closedByRole,
                countedBy.id AS countedById,
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
            ${whereSql}
            ${orderBySql}
            ${limitSql}
        `,
        parameters
    );
}

async function hydrateLocalSessions(sessionRows: SessionRow[]): Promise<CashHistorySession[]> {
    if (sessionRows.length === 0) {
        return [];
    }

    const sessionIds = sessionRows.map((row) => row.id);
    const placeholders = buildPlaceholders(sessionIds.length);

    const [movementRows, saleRows] = await Promise.all([
        queryRows<MovementRow>(
            `
                SELECT
                    id,
                    sessionId,
                    amount,
                    type,
                    reason,
                    createdAt
                FROM "CashMovement"
                WHERE deletedAt IS NULL
                  AND sessionId IN (${placeholders})
                ORDER BY createdAt DESC
            `,
            sessionIds
        ),
        queryRows<SaleRow>(
            `
                SELECT
                    s.id,
                    s.cashSessionId AS sessionId,
                    s.ticketNumber,
                    s.total,
                    s.paymentMethod,
                    s.cashAmount,
                    s.transferAmount,
                    s.createdAt,
                    u.name AS sellerName
                FROM "Sale" s
                LEFT JOIN "User" u
                    ON u.id = s.userId
                WHERE s.deletedAt IS NULL
                  AND s.cashSessionId IN (${placeholders})
                ORDER BY s.createdAt DESC
            `,
            sessionIds
        ),
    ]);

    const movementMap = new Map<string, CashHistoryMovement[]>();
    movementRows.forEach((movement) => {
        const list = movementMap.get(movement.sessionId) ?? [];
        list.push({
            id: movement.id,
            amount: toNumber(movement.amount),
            type: movement.type,
            reason: movement.reason,
            createdAt: movement.createdAt,
        });
        movementMap.set(movement.sessionId, list);
    });

    const salesMap = new Map<string, CashHistorySale[]>();
    saleRows.forEach((sale) => {
        const list = salesMap.get(sale.sessionId) ?? [];
        list.push({
            id: sale.id,
            ticketNumber: toTicketNumber(sale.ticketNumber),
            total: toNumber(sale.total),
            paymentMethod: sale.paymentMethod,
            cashAmount: sale.cashAmount == null ? null : toNumber(sale.cashAmount),
            transferAmount: sale.transferAmount == null ? null : toNumber(sale.transferAmount),
            createdAt: sale.createdAt,
            sellerName: sale.sellerName ?? "Sin vendedor",
        });
        salesMap.set(sale.sessionId, list);
    });

    return sessionRows.map((session) => ({
        id: session.id,
        status: session.status,
        openingDate: session.openingDate,
        closingDate: session.closingDate,
        countingDate: session.countingDate,
        initialAmount: toNumber(session.initialAmount),
        expectedAmount: session.expectedAmount == null ? null : toNumber(session.expectedAmount),
        actualAmount: session.actualAmount == null ? null : toNumber(session.actualAmount),
        difference: session.difference == null ? null : toNumber(session.difference),
        openedBy: toSeller(session.openedById, session.openedByName, session.openedByRole),
        closedBy: toSeller(session.closedById, session.closedByName, session.closedByRole),
        countedBy: toSeller(session.countedById, session.countedByName, session.countedByRole),
        movements: movementMap.get(session.id) ?? [],
        sales: salesMap.get(session.id) ?? [],
    }));
}

async function getLocalSessions(
    whereSql = "",
    parameters: unknown[] = [],
    orderBySql = `ORDER BY cs.openingDate DESC`,
    limit?: number
) {
    const rows = await getLocalSessionRows(whereSql, parameters, orderBySql, limit);
    return hydrateLocalSessions(rows);
}

async function withReadFallback<T>(
    label: string,
    local: () => Promise<T>,
    server: () => Promise<T>,
    hasData: (result: T) => boolean
) {
    return withOfflineReadFallback({
        label,
        logPrefix: "cash history",
        ensureReady: ensurePowerSyncReady,
        local,
        server,
        hasUsableLocalData: hasData,
    });
}

async function withMutationFallback<T>(label: string, local: () => Promise<T>, server: () => Promise<T>) {
    return withOfflineMutationFallback({
        label,
        logPrefix: "cash history",
        ensureReady: ensurePowerSyncReady,
        local,
        server,
    });
}

function mapServerSession(session: ServerCashSession): CashHistorySession {
    return {
        id: session.id,
        status: session.status,
        openingDate: session.openingDate,
        closingDate: session.closingDate,
        countingDate: session.countingDate,
        initialAmount: session.initialAmount,
        expectedAmount: session.expectedAmount,
        actualAmount: session.actualAmount,
        difference: session.difference,
        openedBy: session.openedBy,
        closedBy: session.closedBy,
        countedBy: session.countedBy,
        movements: (session.movements ?? []).map((movement) => ({
            id: movement.id,
            amount: movement.amount,
            type: movement.type,
            reason: movement.reason,
            createdAt: movement.createdAt,
        })),
        sales: session.sales.map((sale) => ({
            id: sale.id,
            ticketNumber: sale.ticketNumber,
            total: sale.total,
            paymentMethod: sale.paymentMethod,
            cashAmount: sale.cashAmount,
            transferAmount: sale.transferAmount,
            createdAt: sale.createdAt,
            sellerName: sale.sellerName ?? "Sin vendedor",
        })),
    };
}

const serverRuntime: CashHistoryRuntime = {
    async getCashSessionsHistory() {
        return ((await getCashSessionsHistory()) as ServerCashSession[]).map(mapServerSession);
    },
    async getPendingCountSessions() {
        return ((await getPendingCountSessions()) as ServerCashSession[]).map(mapServerSession);
    },
    async getClosedSessions(limit = 30) {
        return ((await getClosedSessions(limit)) as ServerCashSession[]).map(mapServerSession);
    },
    async getSellers() {
        return (await getSellers()) as CashHistorySeller[];
    },
    async submitArqueo(sessionId, actualAmount, countedByUserId) {
        return mapServerSession((await submitArqueo(
            sessionId,
            actualAmount,
            countedByUserId
        )) as ServerCashSession);
    },
};

const powerSyncRuntime: CashHistoryRuntime = {
    async getCashSessionsHistory() {
        return withReadFallback(
            "getCashSessionsHistory",
            () => getLocalSessions(),
            () => serverRuntime.getCashSessionsHistory(),
            (sessions) => sessions.length > 0
        );
    },
    async getPendingCountSessions() {
        return withReadFallback(
            "getPendingCountSessions",
            () =>
                getLocalSessions(
                    `AND cs.status = ?`,
                    ["PENDING_COUNT"],
                    `ORDER BY cs.closingDate ASC`
                ),
            () => serverRuntime.getPendingCountSessions(),
            (sessions) => sessions.length > 0
        );
    },
    async getClosedSessions(limit = 30) {
        return withReadFallback(
            "getClosedSessions",
            () =>
                getLocalSessions(
                    `AND cs.status = ?`,
                    ["CLOSED"],
                    `ORDER BY cs.countingDate DESC`,
                    limit
                ),
            () => serverRuntime.getClosedSessions(limit),
            (sessions) => sessions.length > 0
        );
    },
    async getSellers() {
        return withReadFallback(
            "getSellers",
            () => getLocalSellers(),
            () => serverRuntime.getSellers(),
            (sellers) => sellers.length > 0
        );
    },
    async submitArqueo(sessionId, actualAmount, countedByUserId) {
        return withMutationFallback(
            "submitArqueo",
            async () => {
                const sessions = await getLocalSessions(`AND cs.id = ?`, [sessionId]);
                const session = sessions[0];

                if (!session) {
                    throw new Error("Sesión no encontrada");
                }

                if (session.status !== "PENDING_COUNT") {
                    throw new Error("Esta sesión no está pendiente de arqueo");
                }

                if (session.expectedAmount == null) {
                    throw new Error("La sesión no tiene un monto esperado calculado");
                }

                const difference = actualAmount - session.expectedAmount;
                const timestamp = new Date().toISOString();

                await db.execute(
                    `
                        UPDATE "CashSession"
                        SET
                            status = ?,
                            actualAmount = ?,
                            difference = ?,
                            countedById = ?,
                            countingDate = ?,
                            updatedAt = ?
                        WHERE id = ?
                    `,
                    [
                        "CLOSED",
                        actualAmount,
                        difference,
                        countedByUserId,
                        timestamp,
                        timestamp,
                        sessionId,
                    ]
                );

                const updatedSessions = await getLocalSessions(`AND cs.id = ?`, [sessionId]);
                const updatedSession = updatedSessions[0];

                if (!updatedSession) {
                    throw new Error("No se pudo actualizar el arqueo local");
                }

                return updatedSession;
            },
            () => serverRuntime.submitArqueo(sessionId, actualAmount, countedByUserId)
        );
    },
};

export function getCashHistoryRuntime(): CashHistoryRuntime {
    if (isOfflineModeEnabled()) {
        return powerSyncRuntime;
    }

    return serverRuntime;
}
