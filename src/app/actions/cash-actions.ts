// src/app/actions/cash-actions.ts
"use server";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function serializeCashMovement(movement: {
    id: string;
    sessionId: string;
    amount: unknown;
    type: string;
    reason: string;
    createdAt: Date;
}) {
    return {
        id: movement.id,
        sessionId: movement.sessionId,
        amount: Number(movement.amount),
        type: movement.type,
        reason: movement.reason,
        createdAt: movement.createdAt.toISOString(),
    };
}

function serializeCashSession(session: {
    id: string;
    openedById: string;
    closedById: string | null;
    status: string;
    openingDate: Date;
    closingDate: Date | null;
    initialAmount: unknown;
    expectedAmount: unknown;
    actualAmount: unknown;
    difference: unknown;
    openedBy?: { id: string; name: string; role: string } | null;
    closedBy?: { id: string; name: string; role: string } | null;
    movements?: Array<{
        id: string;
        sessionId: string;
        amount: unknown;
        type: string;
        reason: string;
        createdAt: Date;
    }>;
    sales?: Array<{
        id: string;
        ticketNumber: number;
        total: unknown;
        paymentMethod: string;
        cashAmount: unknown;
        transferAmount: unknown;
        createdAt: Date;
        userId: string;
    }>;
}) {
    return {
        id: session.id,
        openedById: session.openedById,
        closedById: session.closedById,
        status: session.status,
        openingDate: session.openingDate.toISOString(),
        closingDate: session.closingDate?.toISOString() ?? null,
        initialAmount: Number(session.initialAmount),
        expectedAmount: session.expectedAmount == null ? null : Number(session.expectedAmount),
        actualAmount: session.actualAmount == null ? null : Number(session.actualAmount),
        difference: session.difference == null ? null : Number(session.difference),
        openedBy: session.openedBy ?? null,
        closedBy: session.closedBy ?? null,
        movements: session.movements?.map(serializeCashMovement) ?? [],
        sales: session.sales?.map((sale) => ({
            id: sale.id,
            ticketNumber: sale.ticketNumber,
            total: Number(sale.total),
            paymentMethod: sale.paymentMethod,
            cashAmount: sale.cashAmount == null ? null : Number(sale.cashAmount),
            transferAmount: sale.transferAmount == null ? null : Number(sale.transferAmount),
            createdAt: sale.createdAt.toISOString(),
            userId: sale.userId,
        })) ?? [],
    };
}

// 1. Obtener la caja que está actualmente abierta
export async function getCurrentSession() {
    const session = await prisma.cashSession.findFirst({
        where: {
            status: "OPEN",
        },
        include: {
            openedBy: true,
            movements: {
                orderBy: { createdAt: "desc" },
            },
            sales: true,
        },
    });

    return session ? serializeCashSession(session) : null;
}

// 2. Abrir una nueva caja al inicio del día
export async function openCashSession(initialAmount: number, userId: string) {
    // Primero verificamos que no haya ya una caja abierta
    const existingSession = await prisma.cashSession.findFirst({
        where: { status: "OPEN" }
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
    });

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
        data: {
            sessionId,
            amount,
            type,
            reason,
        },
    });

    return serializeCashMovement(movement);
}

// 4. Cerrar la caja y calcular si sobra o falta plata
export async function closeCashSession(sessionId: string, actualAmount: number, userId: string) {
    // Buscamos la sesión con todas sus ventas y movimientos
    const session = await prisma.cashSession.findUnique({
        where: { id: sessionId },
        include: {
            sales: true,
            movements: true,
        },
    });

    if (!session) throw new Error("Sesión no encontrada");
    if (session.status === "CLOSED") throw new Error("Esta caja ya fue cerrada");

    // Calculamos el efectivo de las ventas (solo lo que se pagó en EFECTIVO o la parte en efectivo de pagos MIXTOS)
    const cashFromSales = session.sales.reduce((sum, sale) => {
        return sum + Number(sale.cashAmount || 0);
    }, 0);

    // Calculamos los movimientos manuales
    const manualCashIn = session.movements
        .filter((m) => m.type === "INGRESO")
        .reduce((sum, m) => sum + Number(m.amount), 0);

    const manualCashOut = session.movements
        .filter((m) => m.type === "EGRESO")
        .reduce((sum, m) => sum + Number(m.amount), 0);

    // Lo que el sistema DICE que debería haber en el cajón
    const expectedAmount = Number(session.initialAmount) + cashFromSales + manualCashIn - manualCashOut;
    
    // La diferencia (Positiva si sobra, Negativa si falta)
    const difference = actualAmount - expectedAmount;

    // Actualizamos la base de datos cerrando la caja
    const closedSession = await prisma.cashSession.update({
        where: { id: sessionId },
        data: {
            status: "CLOSED",
            closingDate: new Date(),
            closedById: userId,
            expectedAmount,
            actualAmount,
            difference,
        },
    });

    return serializeCashSession(closedSession);
}
