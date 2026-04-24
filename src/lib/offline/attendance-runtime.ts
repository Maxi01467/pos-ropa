"use client";

import {
    checkInUser,
    checkOutUser,
    getAttendanceBoard,
    getAttendanceDashboard,
    getAttendanceEmployees,
} from "@/app/actions/attendance/attendance-actions";
import { isOfflineModeEnabled } from "@/lib/offline-config";
import { withOfflineMutationFallback, withOfflineReadFallback } from "@/lib/offline/runtime-fallback";
import { db, initPowerSync } from "@/lib/powersync/db";

export type RuntimeAttendanceEmployee = {
    id: string;
    name: string;
    role: string;
};

export type RuntimeAttendanceShift = {
    id: string;
    checkIn: string;
    checkOut: string | null;
    totalHours: number | null;
    notes: string | null;
};

export type RuntimeAttendanceDashboard = {
    user: RuntimeAttendanceEmployee;
    activeShift: RuntimeAttendanceShift | null;
    todayShifts: RuntimeAttendanceShift[];
    todayWorkedHours: number;
};

export type RuntimeAttendanceBoard = {
    cashSession: {
        id: string;
        status: string;
        openingDate: string;
        closingDate: string | null;
    } | null;
    shifts: Array<{
        id: string;
        userId: string;
        userName: string;
        checkIn: string;
        checkOut: string | null;
        totalHours: number | null;
        status: "ACTIVE" | "FINISHED";
    }>;
};

type UserRow = {
    id: string;
    name: string;
    role: string;
};

type ShiftRow = {
    id: string;
    userId: string;
    userName: string;
    checkIn: string;
    checkOut: string | null;
    totalHours: number | string | null;
    notes: string | null;
};

type CashSessionRow = {
    id: string;
    status: string;
    openingDate: string;
    closingDate: string | null;
};

export interface AttendanceRuntime {
    getAttendanceEmployees(): Promise<RuntimeAttendanceEmployee[]>;
    getAttendanceDashboard(userId: string): Promise<RuntimeAttendanceDashboard>;
    getAttendanceBoard(): Promise<RuntimeAttendanceBoard>;
    checkInUser(userId: string): Promise<RuntimeAttendanceShift>;
    checkOutUser(userId: string): Promise<RuntimeAttendanceShift>;
}

let powerSyncInitPromise: Promise<void> | null = null;

async function ensurePowerSyncReady() {
    if (!powerSyncInitPromise) {
        powerSyncInitPromise = initPowerSync();
    }

    await powerSyncInitPromise;
}

function getStartOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.toISOString();
}

function getEndOfToday() {
    const end = new Date();
    end.setHours(24, 0, 0, 0);
    return end.toISOString();
}

function roundHours(hours: number) {
    return Number(hours.toFixed(2));
}

function toNumber(value: number | string | null | undefined): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function serializeShift(row: ShiftRow): RuntimeAttendanceShift {
    return {
        id: row.id,
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        totalHours: row.totalHours == null ? null : toNumber(row.totalHours),
        notes: row.notes,
    };
}

async function queryRows<T extends object>(sql: string, parameters: unknown[] = []): Promise<T[]> {
    const rows = await db.getAll(sql, parameters);
    return rows as T[];
}

async function getLocalActiveUser(userId: string): Promise<RuntimeAttendanceEmployee> {
    const rows = await queryRows<UserRow>(
        `
            SELECT id, name, role
            FROM "User"
            WHERE deletedAt IS NULL
              AND active = 1
              AND id = ?
            LIMIT 1
        `,
        [userId]
    );

    const user = rows[0];
    if (!user) {
        throw new Error("No encontramos al empleado activo para registrar asistencia");
    }

    return user;
}

async function getLocalAttendanceEmployees(): Promise<RuntimeAttendanceEmployee[]> {
    return queryRows<UserRow>(
        `
            SELECT id, name, role
            FROM "User"
            WHERE deletedAt IS NULL
              AND active = 1
              AND role = 'STAFF'
            ORDER BY name ASC
        `
    );
}

async function getLocalAttendanceDashboard(userId: string): Promise<RuntimeAttendanceDashboard> {
    if (!userId) {
        throw new Error("Falta identificar al usuario actual");
    }

    const user = await getLocalActiveUser(userId);
    const [activeRows, todayRows] = await Promise.all([
        queryRows<ShiftRow>(
            `
                SELECT
                    s.id,
                    s.userId,
                    u.name AS userName,
                    s.checkIn,
                    s.checkOut,
                    s.totalHours,
                    s.notes
                FROM "Shift" s
                INNER JOIN "User" u
                    ON u.id = s.userId
                WHERE s.deletedAt IS NULL
                  AND s.userId = ?
                  AND s.checkOut IS NULL
                ORDER BY s.checkIn DESC
                LIMIT 1
            `,
            [userId]
        ),
        queryRows<ShiftRow>(
            `
                SELECT
                    s.id,
                    s.userId,
                    u.name AS userName,
                    s.checkIn,
                    s.checkOut,
                    s.totalHours,
                    s.notes
                FROM "Shift" s
                INNER JOIN "User" u
                    ON u.id = s.userId
                WHERE s.deletedAt IS NULL
                  AND s.userId = ?
                  AND s.checkIn >= ?
                  AND s.checkIn < ?
                ORDER BY s.checkIn DESC
            `,
            [userId, getStartOfToday(), getEndOfToday()]
        ),
    ]);

    const todayWorkedHours = roundHours(
        todayRows.reduce((acc, shift) => {
            const checkInTime = new Date(shift.checkIn).getTime();
            const checkOutTime = shift.checkOut
                ? new Date(shift.checkOut).getTime()
                : Date.now();
            return acc + (checkOutTime - checkInTime) / 3_600_000;
        }, 0)
    );

    return {
        user,
        activeShift: activeRows[0] ? serializeShift(activeRows[0]) : null,
        todayShifts: todayRows.map(serializeShift),
        todayWorkedHours,
    };
}

async function getLocalAttendanceBoard(): Promise<RuntimeAttendanceBoard> {
    const sessions = await queryRows<CashSessionRow>(
        `
            SELECT id, status, openingDate, closingDate
            FROM "CashSession"
            WHERE deletedAt IS NULL
              AND status = 'OPEN'
            ORDER BY openingDate DESC
            LIMIT 1
        `
    );

    const cashSession = sessions[0];
    if (!cashSession) {
        return {
            cashSession: null,
            shifts: [],
        };
    }

    const rangeEnd = cashSession.closingDate ?? new Date().toISOString();
    const shifts = await queryRows<ShiftRow>(
        `
            SELECT
                s.id,
                s.userId,
                u.name AS userName,
                s.checkIn,
                s.checkOut,
                s.totalHours,
                s.notes
            FROM "Shift" s
            INNER JOIN "User" u
                ON u.id = s.userId
            WHERE s.deletedAt IS NULL
              AND s.checkIn >= ?
              AND s.checkIn <= ?
            ORDER BY
                CASE WHEN s.checkOut IS NULL THEN 0 ELSE 1 END ASC,
                s.checkIn DESC
        `,
        [cashSession.openingDate, rangeEnd]
    );

    return {
        cashSession: {
            id: cashSession.id,
            status: cashSession.status,
            openingDate: cashSession.openingDate,
            closingDate: cashSession.closingDate,
        },
        shifts: shifts.map((shift) => ({
            id: shift.id,
            userId: shift.userId,
            userName: shift.userName,
            checkIn: shift.checkIn,
            checkOut: shift.checkOut,
            totalHours: shift.totalHours == null ? null : toNumber(shift.totalHours),
            status: shift.checkOut ? "FINISHED" : "ACTIVE",
        })),
    };
}

async function withReadFallback<T>(
    label: string,
    local: () => Promise<T>,
    server: () => Promise<T>,
    hasData: (result: T) => boolean
) {
    return withOfflineReadFallback({
        label,
        logPrefix: "attendance",
        ensureReady: ensurePowerSyncReady,
        local,
        server,
        hasUsableLocalData: hasData,
    });
}

async function withMutationFallback<T>(label: string, local: () => Promise<T>, server: () => Promise<T>) {
    return withOfflineMutationFallback({
        label,
        logPrefix: "attendance",
        ensureReady: ensurePowerSyncReady,
        local,
        server,
    });
}

const serverRuntime: AttendanceRuntime = {
    async getAttendanceEmployees() {
        return (await getAttendanceEmployees()) as RuntimeAttendanceEmployee[];
    },
    async getAttendanceDashboard(userId) {
        return (await getAttendanceDashboard(userId)) as RuntimeAttendanceDashboard;
    },
    async getAttendanceBoard() {
        return (await getAttendanceBoard()) as RuntimeAttendanceBoard;
    },
    async checkInUser(userId) {
        return (await checkInUser(userId)) as RuntimeAttendanceShift;
    },
    async checkOutUser(userId) {
        return (await checkOutUser(userId)) as RuntimeAttendanceShift;
    },
};

const powerSyncRuntime: AttendanceRuntime = {
    async getAttendanceEmployees() {
        return withReadFallback(
            "getAttendanceEmployees",
            () => getLocalAttendanceEmployees(),
            () => serverRuntime.getAttendanceEmployees(),
            (employees) => employees.length > 0
        );
    },
    async getAttendanceDashboard(userId) {
        return withReadFallback(
            "getAttendanceDashboard",
            () => getLocalAttendanceDashboard(userId),
            () => serverRuntime.getAttendanceDashboard(userId),
            () => Boolean(userId)
        );
    },
    async getAttendanceBoard() {
        return withReadFallback(
            "getAttendanceBoard",
            () => getLocalAttendanceBoard(),
            () => serverRuntime.getAttendanceBoard(),
            (board) => board.shifts.length > 0 || board.cashSession !== null
        );
    },
    async checkInUser(userId) {
        return withMutationFallback(
            "checkInUser",
            async () => {
                if (!userId) {
                    throw new Error("Falta identificar al usuario actual");
                }

                await getLocalActiveUser(userId);

                const existingShiftRows = await queryRows<ShiftRow>(
                    `
                        SELECT
                            s.id,
                            s.userId,
                            u.name AS userName,
                            s.checkIn,
                            s.checkOut,
                            s.totalHours,
                            s.notes
                        FROM "Shift" s
                        INNER JOIN "User" u
                            ON u.id = s.userId
                        WHERE s.deletedAt IS NULL
                          AND s.userId = ?
                          AND s.checkOut IS NULL
                        LIMIT 1
                    `,
                    [userId]
                );

                if (existingShiftRows[0]) {
                    throw new Error("Ya tenés una jornada abierta");
                }

                const shiftId = crypto.randomUUID();
                const timestamp = new Date().toISOString();
                await db.execute(
                    `
                        INSERT INTO "Shift" (
                            id,
                            userId,
                            checkIn,
                            checkOut,
                            totalHours,
                            notes,
                            createdAt,
                            updatedAt,
                            deletedAt
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `,
                    [shiftId, userId, timestamp, null, null, null, timestamp, timestamp, null]
                );

                return {
                    id: shiftId,
                    checkIn: timestamp,
                    checkOut: null,
                    totalHours: null,
                    notes: null,
                };
            },
            () => serverRuntime.checkInUser(userId)
        );
    },
    async checkOutUser(userId) {
        return withMutationFallback(
            "checkOutUser",
            async () => {
                if (!userId) {
                    throw new Error("Falta identificar al usuario actual");
                }

                await getLocalActiveUser(userId);

                const activeRows = await queryRows<ShiftRow>(
                    `
                        SELECT
                            s.id,
                            s.userId,
                            u.name AS userName,
                            s.checkIn,
                            s.checkOut,
                            s.totalHours,
                            s.notes
                        FROM "Shift" s
                        INNER JOIN "User" u
                            ON u.id = s.userId
                        WHERE s.deletedAt IS NULL
                          AND s.userId = ?
                          AND s.checkOut IS NULL
                        ORDER BY s.checkIn DESC
                        LIMIT 1
                    `,
                    [userId]
                );

                const activeShift = activeRows[0];
                if (!activeShift) {
                    throw new Error("No hay una jornada abierta para cerrar");
                }

                const checkOut = new Date();
                const totalHours = roundHours(
                    (checkOut.getTime() - new Date(activeShift.checkIn).getTime()) / 3_600_000
                );
                const checkOutIso = checkOut.toISOString();

                await db.execute(
                    `
                        UPDATE "Shift"
                        SET
                            checkOut = ?,
                            totalHours = ?,
                            updatedAt = ?
                        WHERE id = ?
                          AND deletedAt IS NULL
                    `,
                    [checkOutIso, totalHours, checkOutIso, activeShift.id]
                );

                return {
                    id: activeShift.id,
                    checkIn: activeShift.checkIn,
                    checkOut: checkOutIso,
                    totalHours,
                    notes: activeShift.notes,
                };
            },
            () => serverRuntime.checkOutUser(userId)
        );
    },
};

export function getAttendanceRuntime(): AttendanceRuntime {
    if (isOfflineModeEnabled()) {
        return powerSyncRuntime;
    }

    return serverRuntime;
}
