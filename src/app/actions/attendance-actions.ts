"use server";

import { revalidateTag } from "next/cache";
import { CACHE_TAGS, unstable_cache } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";

type AttendanceShift = {
    id: string;
    checkIn: string;
    checkOut: string | null;
    totalHours: number | null;
    notes: string | null;
};

type AttendanceDashboard = {
    user: {
        id: string;
        name: string;
        role: string;
    };
    activeShift: AttendanceShift | null;
    todayShifts: AttendanceShift[];
    todayWorkedHours: number;
};

type AttendanceEmployee = {
    id: string;
    name: string;
    role: string;
};

type AttendanceBoardShift = {
    id: string;
    userId: string;
    userName: string;
    checkIn: string;
    checkOut: string | null;
    totalHours: number | null;
    status: "ACTIVE" | "FINISHED";
};

type AttendanceBoard = {
    cashSession: {
        id: string;
        status: string;
        openingDate: string;
        closingDate: string | null;
    } | null;
    shifts: AttendanceBoardShift[];
};

function getStartOfToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

function getEndOfToday() {
    const today = getStartOfToday();
    today.setDate(today.getDate() + 1);
    return today;
}

function roundHours(hours: number) {
    return Number(hours.toFixed(2));
}

function serializeShift(shift: {
    id: string;
    checkIn: Date;
    checkOut: Date | null;
    totalHours: unknown;
    notes: string | null;
}): AttendanceShift {
    const totalHours =
        shift.totalHours == null ? null : Number(shift.totalHours);

    return {
        id: shift.id,
        checkIn: shift.checkIn.toISOString(),
        checkOut: shift.checkOut?.toISOString() ?? null,
        totalHours,
        notes: shift.notes,
    };
}

async function getActiveUser(userId: string) {
    const user = await prisma.user.findFirst({
        where: {
            id: userId,
            active: true,
        },
        select: {
            id: true,
            name: true,
            role: true,
        },
    });

    if (!user) {
        throw new Error("No encontramos al empleado activo para registrar asistencia");
    }

    return user;
}

export async function getAttendanceEmployees(): Promise<AttendanceEmployee[]> {
    return getAttendanceEmployeesCached();
}

export async function getAttendanceDashboard(userId: string): Promise<AttendanceDashboard> {
    if (!userId) {
        throw new Error("Falta identificar al usuario actual");
    }

    const user = await getActiveUser(userId);
    const [activeShift, todayShifts] = await Promise.all([
        prisma.shift.findFirst({
            where: {
                userId,
                checkOut: null,
            },
            orderBy: {
                checkIn: "desc",
            },
        }),
        prisma.shift.findMany({
            where: {
                userId,
                checkIn: {
                    gte: getStartOfToday(),
                    lt: getEndOfToday(),
                },
            },
            orderBy: {
                checkIn: "desc",
            },
        }),
    ]);

    const todayWorkedHours = roundHours(
        todayShifts.reduce((acc, shift) => {
            if (shift.checkOut) {
                return acc + (shift.checkOut.getTime() - shift.checkIn.getTime()) / 3_600_000;
            }

            return acc + (Date.now() - shift.checkIn.getTime()) / 3_600_000;
        }, 0)
    );

    return {
        user,
        activeShift: activeShift ? serializeShift(activeShift) : null,
        todayShifts: todayShifts.map(serializeShift),
        todayWorkedHours,
    };
}

export async function getAttendanceBoard(): Promise<AttendanceBoard> {
    return getAttendanceBoardCached();
}

export async function checkInUser(userId: string) {
    if (!userId) {
        throw new Error("Falta identificar al usuario actual");
    }

    await getActiveUser(userId);

    const existingOpenShift = await prisma.shift.findFirst({
        where: {
            userId,
            checkOut: null,
        },
        select: {
            id: true,
        },
    });

    if (existingOpenShift) {
        throw new Error("Ya tenés una jornada abierta");
    }

    const shift = await prisma.shift.create({
        data: {
            userId,
        },
    });

    revalidateTag(CACHE_TAGS.attendance, "max");

    return serializeShift(shift);
}

export async function checkOutUser(userId: string) {
    if (!userId) {
        throw new Error("Falta identificar al usuario actual");
    }

    await getActiveUser(userId);

    const activeShift = await prisma.shift.findFirst({
        where: {
            userId,
            checkOut: null,
        },
        orderBy: {
            checkIn: "desc",
        },
    });

    if (!activeShift) {
        throw new Error("No hay una jornada abierta para cerrar");
    }

    const checkOut = new Date();
    const totalHours = roundHours(
        (checkOut.getTime() - activeShift.checkIn.getTime()) / 3_600_000
    );

    const updatedShift = await prisma.shift.update({
        where: {
            id: activeShift.id,
        },
        data: {
            checkOut,
            totalHours,
        },
    });

    revalidateTag(CACHE_TAGS.attendance, "max");

    return serializeShift(updatedShift);
}
const getAttendanceEmployeesCached = unstable_cache(
    async (): Promise<AttendanceEmployee[]> =>
        prisma.user.findMany({
            where: {
                active: true,
                role: "STAFF",
            },
            select: {
                id: true,
                name: true,
                role: true,
            },
            orderBy: {
                name: "asc",
            },
        }),
    ["attendance-employees"],
    { revalidate: 300, tags: [CACHE_TAGS.attendance, CACHE_TAGS.employees] }
);

const getAttendanceBoardCached = unstable_cache(
    async (): Promise<AttendanceBoard> => {
        const cashSession = await prisma.cashSession.findFirst({
            where: {
                status: "OPEN",
            },
            select: {
                id: true,
                status: true,
                openingDate: true,
                closingDate: true,
            },
            orderBy: {
                openingDate: "desc",
            },
        });

        if (!cashSession) {
            return {
                cashSession: null,
                shifts: [],
            };
        }

        const rangeEnd = cashSession.closingDate ?? new Date();
        const shifts = await prisma.shift.findMany({
            where: {
                checkIn: {
                    gte: cashSession.openingDate,
                    lte: rangeEnd,
                },
            },
            select: {
                id: true,
                userId: true,
                checkIn: true,
                checkOut: true,
                totalHours: true,
                user: {
                    select: {
                        name: true,
                    },
                },
            },
            orderBy: [
                { checkOut: "asc" },
                { checkIn: "desc" },
            ],
        });

        return {
            cashSession: {
                id: cashSession.id,
                status: cashSession.status,
                openingDate: cashSession.openingDate.toISOString(),
                closingDate: cashSession.closingDate?.toISOString() ?? null,
            },
            shifts: shifts.map((shift) => ({
                id: shift.id,
                userId: shift.userId,
                userName: shift.user.name,
                checkIn: shift.checkIn.toISOString(),
                checkOut: shift.checkOut?.toISOString() ?? null,
                totalHours: shift.totalHours == null ? null : Number(shift.totalHours),
                status: shift.checkOut ? "FINISHED" : "ACTIVE",
            })),
        };
    },
    ["attendance-board"],
    { revalidate: 60, tags: [CACHE_TAGS.attendance, CACHE_TAGS.cash] }
);
