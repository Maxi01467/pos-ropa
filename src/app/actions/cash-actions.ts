// src/app/actions/cash-actions.ts
"use server";

import { Prisma } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS, unstable_cache } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";

const SESSION_INCLUDE = {
    openedBy: true,
    closedBy: true,
    countedBy: true,
    movements: {
        orderBy: { createdAt: "desc" as const },
    },
    sales: true,
} satisfies Prisma.CashSessionInclude;

type CashSessionWithIncludes = Prisma.CashSessionGetPayload<{
    include: typeof SESSION_INCLUDE;
}>;

function serializeCashSession(session: CashSessionWithIncludes) {
    return {
        id: session.id,
        openedById: session.openedById,
        closedById: session.closedById,
        countedById: session.countedById,
        status: session.status,
        openingDate: session.openingDate.toISOString(),
        closingDate: session.closingDate?.toISOString() ?? null,
        countingDate: session.countingDate?.toISOString() ?? null,
        initialAmount: Number(session.initialAmount),
        expectedAmount: session.expectedAmount == null ? null : Number(session.expectedAmount),
        actualAmount: session.actualAmount == null ? null : Number(session.actualAmount),
        difference: session.difference == null ? null : Number(session.difference),
        openedBy: session.openedBy
            ? { id: session.openedBy.id, name: session.openedBy.name, role: session.openedBy.role }
            : null,
        closedBy: session.closedBy
            ? { id: session.closedBy.id, name: session.closedBy.name, role: session.closedBy.role }
            : null,
        countedBy: session.countedBy
            ? { id: session.countedBy.id, name: session.countedBy.name, role: session.countedBy.role }
            : null,
        movements: session.movements.map((m) => ({
            id: m.id,
            sessionId: m.sessionId,
            amount: Number(m.amount),
            type: m.type,
            reason: m.reason,
            createdAt: m.createdAt.toISOString(),
        })),
        sales: session.sales.map((sale) => ({
            id: sale.id,
            ticketNumber: sale.ticketNumber,
            total: Number(sale.total),
            paymentMethod: sale.paymentMethod,
            cashAmount: sale.cashAmount == null ? null : Number(sale.cashAmount),
            transferAmount: sale.transferAmount == null ? null : Number(sale.transferAmount),
            createdAt: sale.createdAt.toISOString(),
            userId: sale.userId,
        })),
    };
}



// 1. Obtener la caja que está actualmente abierta
export async function getCurrentSession() {
    const session = await prisma.cashSession.findFirst({
        where: { status: "OPEN" },
        include: SESSION_INCLUDE,
    });

    return session ? serializeCashSession(session) : null;
}

// 2. Abrir una nueva caja al inicio del día
export async function openCashSession(initialAmount: number, userId: string) {
    const existingSession = await prisma.cashSession.findFirst({
        where: { status: "OPEN" },
    });

    if (existingSession) {
        throw new Error("Ya hay una caja abierta actualmente.");
    }

    const session = await prisma.cashSession.create({
        data: {
            initialAmount,
            openedById: userId,
            status: "OPEN",
        },
        include: SESSION_INCLUDE,
    });

    revalidateTag(CACHE_TAGS.cash, "max");
    revalidateTag(CACHE_TAGS.attendance, "max");

    return serializeCashSession(session);
}

// 3. Registrar un ingreso o retiro manual de dinero (ej: pago a proveedores, flete)
export async function addCashMovement(
    sessionId: string,
    amount: number,
    type: "INGRESO" | "EGRESO",
    reason: string
) {
    const movement = await prisma.cashMovement.create({
        data: { sessionId, amount, type, reason },
    });

    revalidateTag(CACHE_TAGS.cash, "max");

    return {
        id: movement.id,
        sessionId: movement.sessionId,
        amount: Number(movement.amount),
        type: movement.type,
        reason: movement.reason,
        createdAt: movement.createdAt.toISOString(),
    };
}

// Función interna para calcular el monto esperado de una sesión
async function calculateExpectedAmount(sessionId: string) {
    const session = await prisma.cashSession.findUnique({
        where: { id: sessionId },
        include: { sales: true, movements: true },
    });

    if (!session) throw new Error("Sesión no encontrada");
    if (session.status === "CLOSED") throw new Error("Esta caja ya fue cerrada");

    const cashFromSales = session.sales.reduce((sum, sale) => {
        return sum + Number(sale.cashAmount || 0);
    }, 0);

    const manualCashIn = session.movements
        .filter((m) => m.type === "INGRESO")
        .reduce((sum, m) => sum + Number(m.amount), 0);

    const manualCashOut = session.movements
        .filter((m) => m.type === "EGRESO")
        .reduce((sum, m) => sum + Number(m.amount), 0);

    return Number(session.initialAmount) + cashFromSales + manualCashIn - manualCashOut;
}

// 4a. Cerrar la caja CON arqueo inmediato (flujo estándar - usado por STAFF y ADMIN)
export async function closeCashSession(sessionId: string, actualAmount: number, userId: string) {
    const expectedAmount = await calculateExpectedAmount(sessionId);
    const difference = actualAmount - expectedAmount;

    const closedSession = await prisma.cashSession.update({
        where: { id: sessionId },
        data: {
            status: "CLOSED",
            closingDate: new Date(),
            closedById: userId,
            expectedAmount,
            actualAmount,
            difference,
            countedById: userId,
            countingDate: new Date(),
        },
        include: SESSION_INCLUDE,
    });

    revalidateTag(CACHE_TAGS.cash, "max");
    revalidateTag(CACHE_TAGS.attendance, "max");

    return serializeCashSession(closedSession);
}

// 4b. Cerrar la caja SIN arqueo (queda en PENDING_COUNT) - solo ADMIN
export async function closeCashSessionWithoutCount(sessionId: string, userId: string) {
    const expectedAmount = await calculateExpectedAmount(sessionId);

    const closedSession = await prisma.cashSession.update({
        where: { id: sessionId },
        data: {
            status: "PENDING_COUNT",
            closingDate: new Date(),
            closedById: userId,
            expectedAmount,
            // actualAmount y difference quedan null hasta el arqueo diferido
        },
        include: SESSION_INCLUDE,
    });

    revalidateTag(CACHE_TAGS.cash, "max");
    revalidateTag(CACHE_TAGS.attendance, "max");

    return serializeCashSession(closedSession);
}

// 5. Hacer el arqueo diferido de una sesión PENDING_COUNT → CLOSED
export async function submitArqueo(
    sessionId: string,
    actualAmount: number,
    countedByUserId: string
) {
    const session = await prisma.cashSession.findUnique({
        where: { id: sessionId },
    });

    if (!session) throw new Error("Sesión no encontrada");
    if (session.status !== "PENDING_COUNT")
        throw new Error("Esta sesión no está pendiente de arqueo");
    if (session.expectedAmount == null)
        throw new Error("La sesión no tiene un monto esperado calculado");

    const difference = actualAmount - Number(session.expectedAmount);

    const updated = await prisma.cashSession.update({
        where: { id: sessionId },
        data: {
            status: "CLOSED",
            actualAmount,
            difference,
            countedById: countedByUserId,
            countingDate: new Date(),
        },
        include: SESSION_INCLUDE,
    });

    revalidateTag(CACHE_TAGS.cash, "max");

    return serializeCashSession(updated);
}

// 6. Listar todas las sesiones pendientes de arqueo (para la página /arqueos)
export async function getPendingCountSessions() {
    return getPendingCountSessionsCached();
}

// 7. Listar historial de cajas cerradas (para la página /arqueos y futuros reportes)
export async function getClosedSessions(limit = 30) {
    return getClosedSessionsCached(limit);
}

export async function getCashSessionsHistory() {
    return getCashSessionsHistoryCached();
}
const getPendingCountSessionsCached = unstable_cache(
    async () => {
        const sessions = await prisma.cashSession.findMany({
            where: { status: "PENDING_COUNT" },
            include: SESSION_INCLUDE,
            orderBy: { closingDate: "asc" },
        });

        return sessions.map(serializeCashSession);
    },
    ["cash-pending-count"],
    { revalidate: 120, tags: [CACHE_TAGS.cash] }
);

const getClosedSessionsCached = unstable_cache(
    async (limit: number) => {
        const sessions = await prisma.cashSession.findMany({
            where: { status: "CLOSED" },
            include: SESSION_INCLUDE,
            orderBy: { countingDate: "desc" },
            take: limit,
        });

        return sessions.map(serializeCashSession);
    },
    ["cash-closed-sessions"],
    { revalidate: 300, tags: [CACHE_TAGS.cash] }
);

const getCashSessionsHistoryCached = unstable_cache(
    async () => {
        const sessions = await prisma.cashSession.findMany({
            orderBy: { openingDate: "desc" },
            include: {
                openedBy: {
                    select: { id: true, name: true, role: true },
                },
                closedBy: {
                    select: { id: true, name: true, role: true },
                },
                countedBy: {
                    select: { id: true, name: true, role: true },
                },
                movements: {
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true,
                        amount: true,
                        type: true,
                        reason: true,
                        createdAt: true,
                    },
                },
                sales: {
                    orderBy: { createdAt: "desc" },
                    include: {
                        user: {
                            select: { name: true },
                        },
                    },
                },
            },
        });

        return sessions.map((session) => ({
            id: session.id,
            status: session.status,
            openingDate: session.openingDate.toISOString(),
            closingDate: session.closingDate?.toISOString() ?? null,
            countingDate: session.countingDate?.toISOString() ?? null,
            initialAmount: Number(session.initialAmount),
            expectedAmount: session.expectedAmount == null ? null : Number(session.expectedAmount),
            actualAmount: session.actualAmount == null ? null : Number(session.actualAmount),
            difference: session.difference == null ? null : Number(session.difference),
            openedBy: session.openedBy
                ? { id: session.openedBy.id, name: session.openedBy.name, role: session.openedBy.role }
                : null,
            closedBy: session.closedBy
                ? { id: session.closedBy.id, name: session.closedBy.name, role: session.closedBy.role }
                : null,
            countedBy: session.countedBy
                ? { id: session.countedBy.id, name: session.countedBy.name, role: session.countedBy.role }
                : null,
            movements: session.movements.map((movement) => ({
                id: movement.id,
                amount: Number(movement.amount),
                type: movement.type,
                reason: movement.reason,
                createdAt: movement.createdAt.toISOString(),
            })),
            sales: session.sales.map((sale) => ({
                id: sale.id,
                ticketNumber: sale.ticketNumber,
                total: Number(sale.total),
                paymentMethod: sale.paymentMethod,
                cashAmount: sale.cashAmount == null ? null : Number(sale.cashAmount),
                transferAmount: sale.transferAmount == null ? null : Number(sale.transferAmount),
                createdAt: sale.createdAt.toISOString(),
                sellerName: sale.user.name,
            })),
        }));
    },
    ["cash-sessions-history"],
    { revalidate: 300, tags: [CACHE_TAGS.cash, CACHE_TAGS.sales] }
);
