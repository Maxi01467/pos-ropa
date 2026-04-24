"use client";

import {
    createEmployee,
    deleteEmployee,
    getEmployees,
    setEmployeeStatus,
    updateEmployee,
} from "@/app/actions/employees/employee-actions";
import { isOfflineModeEnabled } from "@/lib/offline-config";
import { type SessionRole } from "@/lib/core/permissions";
import { withOfflineMutationFallback, withOfflineReadFallback } from "@/lib/offline/runtime-fallback";
import { db, initPowerSync } from "@/lib/powersync/db";

export type RuntimeEmployee = {
    id: string;
    name: string;
    pin: string;
    role: SessionRole;
    active: boolean;
    createdAt: string;
};

type EmployeeInput = {
    name: string;
    pin: string;
    role: SessionRole;
};

type EmployeeRow = {
    id: string;
    name: string;
    pin: string;
    role: string;
    active: number | string | null;
    createdAt: string;
};

export interface EmployeesRuntime {
    getEmployees(): Promise<RuntimeEmployee[]>;
    createEmployee(input: EmployeeInput): Promise<RuntimeEmployee>;
    updateEmployee(employeeId: string, input: EmployeeInput): Promise<RuntimeEmployee>;
    setEmployeeStatus(employeeId: string, active: boolean): Promise<RuntimeEmployee>;
    deleteEmployee(employeeId: string): Promise<void>;
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

function normalizeRole(role: string): SessionRole {
    return role === "ADMIN" ? "ADMIN" : "STAFF";
}

function mapEmployeeRow(row: EmployeeRow): RuntimeEmployee {
    return {
        id: row.id,
        name: row.name,
        pin: row.pin,
        role: normalizeRole(row.role),
        active: toBoolean(row.active),
        createdAt: row.createdAt,
    };
}

async function queryRows<T extends object>(sql: string, parameters: unknown[] = []): Promise<T[]> {
    const rows = await db.getAll(sql, parameters);
    return rows as T[];
}

function validateEmployeeInput(input: EmployeeInput) {
    const name = input.name.trim();
    const pin = input.pin.trim();

    if (!name) {
        throw new Error("Ingresá el nombre del empleado");
    }

    if (!pin) {
        throw new Error("Ingresá la contraseña del empleado");
    }

    if (pin.length > 128) {
        throw new Error("La contraseña no puede superar los 128 caracteres");
    }

    if (input.role !== "ADMIN" && input.role !== "STAFF") {
        throw new Error("Seleccioná un rol válido");
    }

    return { name, pin, role: input.role };
}

async function ensureUniqueEmployeeName(name: string, excludeId?: string) {
    const existing = await db.getOptional<{ id: string }>(
        `
            SELECT id
            FROM "User"
            WHERE deletedAt IS NULL
              AND LOWER(name) = LOWER(?)
              ${excludeId ? "AND id <> ?" : ""}
            LIMIT 1
        `,
        excludeId ? [name, excludeId] : [name]
    );

    if (existing) {
        throw new Error("Ya existe un usuario con ese nombre");
    }
}

async function getLocalEmployees(): Promise<RuntimeEmployee[]> {
    const rows = await queryRows<EmployeeRow>(
        `
            SELECT id, name, pin, role, active, createdAt
            FROM "User"
            WHERE deletedAt IS NULL
            ORDER BY active DESC, name ASC
        `
    );

    return rows.map(mapEmployeeRow);
}

async function getLocalEmployeeById(employeeId: string): Promise<RuntimeEmployee> {
    const row = await db.getOptional<EmployeeRow>(
        `
            SELECT id, name, pin, role, active, createdAt
            FROM "User"
            WHERE deletedAt IS NULL
              AND id = ?
            LIMIT 1
        `,
        [employeeId]
    );

    if (!row) {
        throw new Error("El empleado no existe");
    }

    return mapEmployeeRow(row);
}

async function withFallback<T>(label: string, local: () => Promise<T>, server: () => Promise<T>) {
    return withOfflineMutationFallback({
        label,
        logPrefix: "employees",
        ensureReady: ensurePowerSyncReady,
        local,
        server,
    });
}

const serverRuntime: EmployeesRuntime = {
    async getEmployees() {
        return (await getEmployees()) as RuntimeEmployee[];
    },
    async createEmployee(input) {
        return (await createEmployee(input)) as RuntimeEmployee;
    },
    async updateEmployee(employeeId, input) {
        return (await updateEmployee(employeeId, input)) as RuntimeEmployee;
    },
    async setEmployeeStatus(employeeId, active) {
        return (await setEmployeeStatus(employeeId, active)) as RuntimeEmployee;
    },
    async deleteEmployee(employeeId) {
        await deleteEmployee(employeeId);
    },
};

const powerSyncRuntime: EmployeesRuntime = {
    async getEmployees() {
        return withOfflineReadFallback({
            label: "getEmployees",
            logPrefix: "employees",
            ensureReady: ensurePowerSyncReady,
            local: getLocalEmployees,
            server: () => serverRuntime.getEmployees(),
            hasUsableLocalData: (employees) => employees.length > 0,
        });
    },
    async createEmployee(input) {
        return withFallback(
            "createEmployee",
            async () => {
                const validated = validateEmployeeInput(input);
                await ensureUniqueEmployeeName(validated.name);

                const timestamp = new Date().toISOString();
                const employeeId = crypto.randomUUID();

                await db.writeTransaction(async (tx) => {
                    await tx.execute(
                        `
                            INSERT INTO "User" (
                                id,
                                name,
                                pin,
                                role,
                                active,
                                deviceId,
                                createdAt,
                                updatedAt,
                                deletedAt
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        `,
                        [
                            employeeId,
                            validated.name,
                            validated.pin,
                            validated.role,
                            1,
                            null,
                            timestamp,
                            timestamp,
                            null,
                        ]
                    );
                });

                return getLocalEmployeeById(employeeId);
            },
            () => serverRuntime.createEmployee(input)
        );
    },
    async updateEmployee(employeeId, input) {
        return withFallback(
            "updateEmployee",
            async () => {
                const validated = validateEmployeeInput(input);
                await ensureUniqueEmployeeName(validated.name, employeeId);

                await db.execute(
                    `
                        UPDATE "User"
                        SET
                            name = ?,
                            pin = ?,
                            role = ?,
                            updatedAt = ?
                        WHERE id = ?
                          AND deletedAt IS NULL
                    `,
                    [validated.name, validated.pin, validated.role, new Date().toISOString(), employeeId]
                );

                return getLocalEmployeeById(employeeId);
            },
            () => serverRuntime.updateEmployee(employeeId, input)
        );
    },
    async setEmployeeStatus(employeeId, active) {
        return withFallback(
            "setEmployeeStatus",
            async () => {
                await db.execute(
                    `
                        UPDATE "User"
                        SET
                            active = ?,
                            updatedAt = ?
                        WHERE id = ?
                          AND deletedAt IS NULL
                    `,
                    [active ? 1 : 0, new Date().toISOString(), employeeId]
                );

                return getLocalEmployeeById(employeeId);
            },
            () => serverRuntime.setEmployeeStatus(employeeId, active)
        );
    },
    async deleteEmployee(employeeId) {
        return withFallback(
            "deleteEmployee",
            async () => {
                const timestamp = new Date().toISOString();
                await db.execute(
                    `
                        UPDATE "User"
                        SET
                            deletedAt = ?,
                            updatedAt = ?
                        WHERE id = ?
                    `,
                    [timestamp, timestamp, employeeId]
                );
            },
            () => serverRuntime.deleteEmployee(employeeId)
        );
    },
};

export function getEmployeesRuntime(): EmployeesRuntime {
    if (isOfflineModeEnabled()) {
        return powerSyncRuntime;
    }

    return serverRuntime;
}
