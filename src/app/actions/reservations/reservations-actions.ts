"use server";

import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/core/cache-tags";
import { prisma } from "@/lib/prisma";

const SHOULD_REVALIDATE_SERVER_CACHE = process.env.POS_DESKTOP !== "1";

function revalidateReservationTags() {
    if (!SHOULD_REVALIDATE_SERVER_CACHE) return;
    revalidateTag(CACHE_TAGS.reservations, "max" as never);
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type ReservationStatus =
    | "PENDING"
    | "IN_PROCESS"
    | "COMPLETED"
    | "CANCELLED"
    | "EXPIRED";

export type ReservationItemInput = {
    variantId: string;
    quantity: number;
    priceAtTime: number;
    priceType: "NORMAL" | "WHOLESALE";
    productName: string;
    variantLabel: string;
};

export type CreateReservationInput = {
    clientName: string;
    clientPhone?: string;
    depositAmount?: number;
    depositMethod?: "EFECTIVO" | "TRANSFERENCIA";
    userId: string;
    cashSessionId?: string;
    expiresInDays?: number; // undefined = sin vencimiento
    notes?: string;
    estimatedTotal: number;
    items: ReservationItemInput[];
};

export type ReservationWithItems = {
    id: string;
    reservationNumber: string;
    clientName: string;
    clientPhone: string | null;
    depositAmount: number | null;
    depositMethod: string | null;
    status: string;
    expiresAt: string | null;
    notes: string | null;
    estimatedTotal: number;
    createdAt: string;
    updatedAt: string;
    user: { id: string; name: string };
    items: {
        id: string;
        variantId: string;
        quantity: number;
        priceAtTime: number;
        priceType: string;
        variant: {
            id: string;
            sku: string;
            size: string;
            color: string;
            product: { id: string; name: string };
        };
    }[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function generateReservationNumber(): Promise<string> {
    const last = await prisma.reservation.findFirst({
        orderBy: { createdAt: "desc" },
        select: { reservationNumber: true },
    });

    let next = 1;
    if (last?.reservationNumber) {
        const match = last.reservationNumber.match(/^RES-(\d+)$/);
        if (match) next = parseInt(match[1], 10) + 1;
    }

    return `RES-${String(next).padStart(4, "0")}`;
}

function toPlain(reservation: {
    id: string;
    reservationNumber: string;
    clientName: string;
    clientPhone: string | null;
    depositAmount: { toNumber: () => number } | null;
    depositMethod: string | null;
    status: string;
    expiresAt: Date | null;
    notes: string | null;
    estimatedTotal: { toNumber: () => number };
    createdAt: Date;
    updatedAt: Date;
    user: { id: string; name: string };
    items: {
        id: string;
        variantId: string;
        quantity: number;
        priceAtTime: { toNumber: () => number };
        priceType: string;
        variant: {
            id: string;
            sku: string;
            size: string;
            color: string;
            product: { id: string; name: string };
        };
    }[];
}): ReservationWithItems {
    return {
        id: reservation.id,
        reservationNumber: reservation.reservationNumber,
        clientName: reservation.clientName,
        clientPhone: reservation.clientPhone,
        depositAmount: reservation.depositAmount?.toNumber() ?? null,
        depositMethod: reservation.depositMethod,
        status: reservation.status,
        expiresAt: reservation.expiresAt?.toISOString() ?? null,
        notes: reservation.notes,
        estimatedTotal: reservation.estimatedTotal.toNumber(),
        createdAt: reservation.createdAt.toISOString(),
        updatedAt: reservation.updatedAt.toISOString(),
        user: reservation.user,
        items: reservation.items.map((item) => ({
            id: item.id,
            variantId: item.variantId,
            quantity: item.quantity,
            priceAtTime: item.priceAtTime.toNumber(),
            priceType: item.priceType,
            variant: item.variant,
        })),
    };
}

const RESERVATION_INCLUDE = {
    user: { select: { id: true, name: true } },
    items: {
        include: {
            variant: {
                select: {
                    id: true,
                    sku: true,
                    size: true,
                    color: true,
                    product: { select: { id: true, name: true } },
                },
            },
        },
    },
} as const;

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Crea una nueva reserva desde el carrito de nueva venta.
 */
export async function createReservation(
    input: CreateReservationInput
): Promise<{ success: true; reservation: ReservationWithItems } | { success: false; error: string }> {
    try {
        const reservationNumber = await generateReservationNumber();

        const expiresAt =
            input.expiresInDays != null
                ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
                : null;

        const reservation = await prisma.reservation.create({
            data: {
                reservationNumber,
                clientName: input.clientName.trim(),
                clientPhone: input.clientPhone?.trim() || null,
                depositAmount: input.depositAmount ?? null,
                depositMethod: input.depositMethod ?? null,
                userId: input.userId,
                cashSessionId: input.cashSessionId ?? null,
                expiresAt,
                notes: input.notes?.trim() || null,
                estimatedTotal: input.estimatedTotal,
                items: {
                    create: input.items.map((item) => ({
                        variantId: item.variantId,
                        quantity: item.quantity,
                        priceAtTime: item.priceAtTime,
                        priceType: item.priceType,
                    })),
                },
            },
            include: RESERVATION_INCLUDE,
        });

        revalidateReservationTags();
        return { success: true, reservation: toPlain(reservation) };
    } catch (error) {
        console.error("[createReservation]", error);
        return { success: false, error: "No se pudo crear la reserva." };
    }
}

/**
 * Obtiene la lista de reservas con filtros opcionales.
 */
export async function getReservations(filters?: {
    status?: ReservationStatus | ReservationStatus[];
    search?: string;
}): Promise<ReservationWithItems[]> {
    const statusFilter = filters?.status
        ? { in: Array.isArray(filters.status) ? filters.status : [filters.status] }
        : undefined;

    const searchFilter = filters?.search?.trim()
        ? {
              OR: [
                  { clientName: { contains: filters.search, mode: "insensitive" as const } },
                  { reservationNumber: { contains: filters.search, mode: "insensitive" as const } },
                  { clientPhone: { contains: filters.search, mode: "insensitive" as const } },
              ],
          }
        : undefined;

    const reservations = await prisma.reservation.findMany({
        where: {
            deletedAt: null,
            ...(statusFilter ? { status: statusFilter } : {}),
            ...(searchFilter ?? {}),
        },
        orderBy: { createdAt: "desc" },
        include: RESERVATION_INCLUDE,
    });

    return reservations.map(toPlain);
}

/**
 * Busca una reserva por su número (ej: "RES-0042").
 */
export async function getReservationByNumber(
    number: string
): Promise<ReservationWithItems | null> {
    const reservation = await prisma.reservation.findFirst({
        where: {
            reservationNumber: { equals: number.toUpperCase(), mode: "insensitive" },
            deletedAt: null,
        },
        include: RESERVATION_INCLUDE,
    });

    return reservation ? toPlain(reservation) : null;
}

/**
 * Marca la reserva como IN_PROCESS y retorna sus datos para cargar al carrito.
 */
export async function applyReservation(
    id: string
): Promise<{ success: true; reservation: ReservationWithItems } | { success: false; error: string }> {
    try {
        const existing = await prisma.reservation.findUnique({
            where: { id },
            select: { status: true },
        });

        if (!existing) return { success: false, error: "Reserva no encontrada." };

        if (existing.status === "COMPLETED") {
            return { success: false, error: "Esta reserva ya fue completada." };
        }
        if (existing.status === "CANCELLED") {
            return { success: false, error: "Esta reserva fue cancelada." };
        }

        const reservation = await prisma.reservation.update({
            where: { id },
            data: { status: "IN_PROCESS" },
            include: RESERVATION_INCLUDE,
        });

        revalidateReservationTags();
        return { success: true, reservation: toPlain(reservation) };
    } catch (error) {
        console.error("[applyReservation]", error);
        return { success: false, error: "No se pudo aplicar la reserva." };
    }
}

/**
 * Marca la reserva como COMPLETED (llamada al finalizar el cobro).
 */
export async function completeReservation(
    id: string
): Promise<{ success: true } | { success: false; error: string }> {
    try {
        await prisma.reservation.update({
            where: { id },
            data: { status: "COMPLETED" },
        });
        revalidateReservationTags();
        return { success: true };
    } catch (error) {
        console.error("[completeReservation]", error);
        return { success: false, error: "No se pudo completar la reserva." };
    }
}

/**
 * Cancela una reserva. La seña no se devuelve.
 */
export async function cancelReservation(
    id: string,
    reason?: string
): Promise<{ success: true } | { success: false; error: string }> {
    try {
        await prisma.reservation.update({
            where: { id },
            data: {
                status: "CANCELLED",
                notes: reason
                    ? `[Cancelada] ${reason}`
                    : undefined,
            },
        });
        revalidateReservationTags();
        return { success: true };
    } catch (error) {
        console.error("[cancelReservation]", error);
        return { success: false, error: "No se pudo cancelar la reserva." };
    }
}

/**
 * Expira las reservas cuyo vencimiento ya pasó. Pensado para llamarse desde un cron.
 * Retorna la cantidad de reservas expiradas.
 */
export async function expireReservations(): Promise<{
    success: true;
    expiredCount: number;
    expiredNumbers: string[];
} | { success: false; error: string }> {
    try {
        const toExpire = await prisma.reservation.findMany({
            where: {
                status: { in: ["PENDING", "IN_PROCESS"] },
                expiresAt: { lte: new Date() },
                deletedAt: null,
            },
            select: { id: true, reservationNumber: true },
        });

        if (toExpire.length === 0) {
            return { success: true, expiredCount: 0, expiredNumbers: [] };
        }

        await prisma.reservation.updateMany({
            where: { id: { in: toExpire.map((r) => r.id) } },
            data: { status: "EXPIRED" },
        });

        revalidateReservationTags();
        return {
            success: true,
            expiredCount: toExpire.length,
            expiredNumbers: toExpire.map((r) => r.reservationNumber),
        };
    } catch (error) {
        console.error("[expireReservations]", error);
        return { success: false, error: "Error al expirar reservas." };
    }
}

/**
 * Obtiene reservas recientemente expiradas (para el polling de notificaciones admin).
 * Solo retorna las expiradas en los últimos N minutos.
 */
export async function getRecentlyExpiredReservations(sinceMinutes = 5): Promise<
    { id: string; reservationNumber: string; clientName: string; expiresAt: string }[]
> {
    const since = new Date(Date.now() - sinceMinutes * 60 * 1000);

    const reservations = await prisma.reservation.findMany({
        where: {
            status: "EXPIRED",
            updatedAt: { gte: since },
            deletedAt: null,
        },
        select: {
            id: true,
            reservationNumber: true,
            clientName: true,
            expiresAt: true,
        },
        orderBy: { updatedAt: "desc" },
    });

    return reservations.map((r) => ({
        id: r.id,
        reservationNumber: r.reservationNumber,
        clientName: r.clientName,
        expiresAt: r.expiresAt?.toISOString() ?? "",
    }));
}
