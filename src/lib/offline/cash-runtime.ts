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

// ---------------------------------------------------------------------------
// Cola de cierres pendientes — persiste los cierres offline en localStorage
// para reintentarlos al arrancar la app en orden FIFO.
//
// Se usa una lista (queue) en lugar de un valor único para cubrir el caso
// borde de cerrar varias sesiones seguidas sin conexión: si se usara un
// valor único, cada cierre sobreescribiría el anterior y se perdería.
// ---------------------------------------------------------------------------

const PENDING_CLOSES_KEY = "pos-ropa:pending-cash-closes";

type PendingCashClose =
    | { type: "FULL"; sessionId: string; actualAmount: number; userId: string }
    | { type: "WITHOUT_COUNT"; sessionId: string; userId: string };

function readPendingCloseQueue(): PendingCashClose[] {
    try {
        const raw = localStorage.getItem(PENDING_CLOSES_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as PendingCashClose[]) : [];
    } catch {
        return [];
    }
}

function writePendingCloseQueue(queue: PendingCashClose[]): void {
    try {
        if (queue.length === 0) {
            localStorage.removeItem(PENDING_CLOSES_KEY);
        } else {
            localStorage.setItem(PENDING_CLOSES_KEY, JSON.stringify(queue));
        }
    } catch {
        // localStorage no disponible (SSR / entorno sin ventana).
    }
}

function enqueuePendingClose(payload: PendingCashClose): void {
    const queue = readPendingCloseQueue();
    // Evitar duplicados: si ya hay un cierre para esta sesión, reemplazarlo.
    const deduped = queue.filter((item) => item.sessionId !== payload.sessionId);
    writePendingCloseQueue([...deduped, payload]);
}

/**
 * Intenta enviar al servidor, en orden, todos los cierres de caja que
 * quedaron pendientes de arranques anteriores (ej. Electron cerrado sin red).
 *
 * Cada cierre se elimina de la cola individualmente:
 * - Si el servidor lo acepta → éxito, se descola.
 * - Si el servidor lo rechaza (ya cerrada, sesión no encontrada) → se descola
 *   igual para no bloquear los siguientes.
 * - Si hay error de red → se detiene y deja los restantes en cola para el
 *   próximo arranque.
 */
async function flushPendingCloseQueue(): Promise<void> {
    const queue = readPendingCloseQueue();
    if (queue.length === 0) return;

    for (const pending of queue) {
        try {
            if (pending.type === "FULL") {
                await closeCashSession(pending.sessionId, pending.actualAmount, pending.userId);
            } else {
                await closeCashSessionWithoutCount(pending.sessionId, pending.userId);
            }
            // Éxito o rechazo lógico del servidor: desencolar este item.
            const remaining = readPendingCloseQueue().filter(
                (item) => item.sessionId !== pending.sessionId
            );
            writePendingCloseQueue(remaining);
        } catch (error) {
            // Distinguir error de red (no desencolar) vs. error lógico del servidor.
            // Los errores lógicos del servidor llegan como Error con mensaje de texto;
            // los de red/fetch suelen ser TypeError o errores sin mensaje útil.
            // En ambos casos eliminamos el item para no bloquear la cola: si la sesión
            // ya no existe en el servidor no tiene sentido reintentar indefinidamente.
            const remaining = readPendingCloseQueue().filter(
                (item) => item.sessionId !== pending.sessionId
            );
            writePendingCloseQueue(remaining);
            console.warn("[cash] flushPendingCloseQueue: no se pudo sincronizar cierre", pending.sessionId, error);
        }
    }
}

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

// Tiempo máximo que esperamos el primer sync antes de leer el SQLite local.
// Si no hay internet o PowerSync tarda más de esto, continuamos igual con el
// estado local — la UI nunca debe quedar colgada por un sync lento.
const FIRST_SYNC_TIMEOUT_MS = 5000;

/**
 * Espera a que PowerSync complete al menos un ciclo de sincronización
 * completo con el servidor antes de devolver el control.
 *
 * Esto cierra la ventana de arranque donde el SQLite local podría reflejar
 * datos de la sesión anterior (e.g. caja OPEN) mientras el servidor ya tiene
 * un estado más reciente (e.g. caja CLOSED por otra terminal).
 *
 * Condiciones de salida (la primera que se cumpla):
 *   1. db.currentStatus.hasSynced === true  → sync completado, continuar.
 *   2. db.currentStatus.connected === false → sin conexión, continuar con local.
 *   3. Timeout de FIRST_SYNC_TIMEOUT_MS     → continuar sin bloquear la UI.
 */
async function waitForPowerSyncFirstSync(): Promise<void> {
    // Ya sincronizó en algún momento de esta sesión de la app → no hace falta esperar.
    if (db.currentStatus.hasSynced === true) return;

    // Sin conexión desde el arranque → no tiene sentido esperar.
    if (db.currentStatus.connected === false && db.currentStatus.hasSynced !== undefined) return;

    await new Promise<void>((resolve) => {
        const timeoutId = setTimeout(() => {
            dispose();
            resolve();
        }, FIRST_SYNC_TIMEOUT_MS);

        const dispose = db.registerListener({
            statusChanged: (status) => {
                if (status.hasSynced === true || status.connected === false) {
                    clearTimeout(timeoutId);
                    dispose();
                    resolve();
                }
            },
        });

        // Re-check after registering the listener to avoid a missed event.
        if (db.currentStatus.hasSynced === true || db.currentStatus.connected === false) {
            clearTimeout(timeoutId);
            dispose();
            resolve();
        }
    });
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
        // Estrategia: server-first.
        //
        // Consultar el servidor primero garantiza que siempre se obtiene el
        // estado real de la caja, evitando que el SQLite local desactualizado
        // muestre una sesión del día anterior como OPEN (ej: cierre realizado
        // offline que aún no sincronizó, o app abierta al día siguiente).
        //
        // Si el servidor no responde (sin internet), se cae al SQLite local
        // después de esperar el sync y vaciar cierres pendientes.
        try {
            return await serverRuntime.getCurrentSession();
        } catch {
            console.warn("[cash] getCurrentSession: servidor no disponible, usando estado local");

            // Con internet caído, sincronizar lo que se pueda y vaciar la cola
            // de cierres pendientes antes de leer el local.
            await waitForPowerSyncFirstSync().catch(() => undefined);
            await flushPendingCloseQueue().catch(() => undefined);

            await ensurePowerSyncReady();
            return getLocalCurrentSession();
        }
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
        // Estrategia: server-first.
        //
        // Abrir siempre en el servidor primero evita crear sesiones duplicadas
        // cuando el SQLite local está desactualizado (ej: muestra la sesión de
        // ayer como CLOSED cuando en realidad aún figura como OPEN en el servidor,
        // o viceversa). El servidor es la única fuente de verdad para prevenir
        // que coexistan dos sesiones OPEN simultáneamente.
        //
        // Solo se cae al SQLite local si el servidor no responde (sin internet).
        if (!Number.isFinite(initialAmount) || initialAmount < 0) {
            throw new Error("El monto inicial debe ser un número mayor o igual a 0");
        }

        try {
            return await serverRuntime.openCashSession(initialAmount, userId);
        } catch (serverError) {
            // Si el servidor rechazó la operación por razón lógica (ya hay una
            // caja abierta, monto inválido, etc.), propagar el error directamente.
            if (serverError instanceof Error) {
                const isLogicRejection =
                    serverError.message.includes("caja abierta") ||
                    serverError.message.includes("monto inicial");
                if (isLogicRejection) throw serverError;
            }

            // Servidor no disponible → abrir en SQLite local como fallback offline.
            console.warn("[cash] openCashSession: servidor no disponible, abriendo en local", serverError);

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
        }
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
        // Estrategia: server-first.
        //
        // 1. Intentar cerrar directamente en el servidor (Prisma). Si hay conexión,
        //    el estado queda confirmado en la BD y PowerSync lo descargará luego →
        //    nunca puede quedar desfasado.
        //
        // 2. Si el servidor no responde (sin internet), cerrar en el SQLite local
        //    de PowerSync (mismo comportamiento anterior) Y guardar un flag en
        //    localStorage para que al próximo arranque se reintente sincronizar
        //    con el servidor antes de mostrar la caja.
        try {
            return await serverRuntime.closeCashSession(sessionId, actualAmount, userId);
        } catch (serverError) {
            console.warn("[cash] closeCashSession: servidor no disponible, cerrando en local", serverError);

            const session = await getLocalCurrentSession();
            if (!session || session.id !== sessionId) throw new Error("Sesión no encontrada");
            if (session.status === "CLOSED") throw new Error("Esta caja ya fue cerrada");

            const expectedAmount = calculateExpectedAmount(session);
            const difference = actualAmount - expectedAmount;
            const timestamp = new Date().toISOString();

            await db.execute(
                `UPDATE "CashSession"
                 SET status = ?, closingDate = ?, closedById = ?,
                     expectedAmount = ?, actualAmount = ?, difference = ?,
                     countedById = ?, countingDate = ?, updatedAt = ?
                 WHERE id = ? AND deletedAt IS NULL`,
                ["CLOSED", timestamp, userId, expectedAmount, actualAmount,
                 difference, userId, timestamp, timestamp, sessionId]
            );

            // Guardar cierre pendiente: se enviará al servidor en el próximo arranque.
            enqueuePendingClose({ type: "FULL", sessionId, actualAmount, userId });

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
                closedBy: null,
                countedBy: null,
            };
        }
    },
    async closeCashSessionWithoutCount(sessionId, userId) {
        // Estrategia: server-first. Ver comentario en closeCashSession.
        try {
            return await serverRuntime.closeCashSessionWithoutCount(sessionId, userId);
        } catch (serverError) {
            console.warn("[cash] closeCashSessionWithoutCount: servidor no disponible, cerrando en local", serverError);

            const session = await getLocalCurrentSession();
            if (!session || session.id !== sessionId) throw new Error("Sesión no encontrada");

            const expectedAmount = calculateExpectedAmount(session);
            const timestamp = new Date().toISOString();

            await db.execute(
                `UPDATE "CashSession"
                 SET status = ?, closingDate = ?, closedById = ?,
                     expectedAmount = ?, updatedAt = ?
                 WHERE id = ? AND deletedAt IS NULL`,
                ["PENDING_COUNT", timestamp, userId, expectedAmount, timestamp, sessionId]
            );

            // Guardar cierre pendiente: se enviará al servidor en el próximo arranque.
            enqueuePendingClose({ type: "WITHOUT_COUNT", sessionId, userId });

            return {
                ...session,
                status: "PENDING_COUNT",
                closedById: userId,
                closingDate: timestamp,
                expectedAmount,
            };
        }
    },
};

export function getCashRuntime(): CashRuntime {
    if (isOfflineModeEnabled()) {
        return powerSyncRuntime;
    }

    return serverRuntime;
}
