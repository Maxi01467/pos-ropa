"use server";

import { revalidateTag } from "next/cache";
import { CACHE_TAGS, unstable_cache } from "@/lib/cache-tags";
import type { SessionRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type EmployeeInput = {
    name: string;
    pin: string;
    role: SessionRole;
};

function normalizeName(name: string) {
    return name.trim();
}

function validateEmployeeInput(input: EmployeeInput) {
    const name = normalizeName(input.name);
    const pin = input.pin.trim();
    const role = input.role;

    if (!name) {
        throw new Error("Ingresá el nombre del empleado");
    }

    if (!pin) {
        throw new Error("Ingresá la contraseña del empleado");
    }

    if (pin.length > 128) {
        throw new Error("La contraseña no puede superar los 128 caracteres");
    }

    if (role !== "ADMIN" && role !== "STAFF") {
        throw new Error("Seleccioná un rol válido");
    }

    return { name, pin, role };
}

async function ensureUniqueEmployeeName(name: string, excludeId?: string) {
    const existing = await prisma.user.findFirst({
        where: {
            name: {
                equals: name,
                mode: "insensitive",
            },
            ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
        select: { id: true },
    });

    if (existing) {
        throw new Error("Ya existe un usuario con ese nombre");
    }
}

function serializeEmployee(user: {
    id: string;
    name: string;
    pin: string;
    role: string;
    active: boolean;
    createdAt: Date;
}) {
    return {
        id: user.id,
        name: user.name,
        pin: user.pin,
        role: user.role as SessionRole,
        active: user.active,
        createdAt: user.createdAt.toISOString(),
    };
}

export async function getEmployees() {
    return getEmployeesCached();
}

export async function createEmployee(input: EmployeeInput) {
    const { name, pin, role } = validateEmployeeInput(input);
    await ensureUniqueEmployeeName(name);

    const employee = await prisma.user.create({
        data: {
            name,
            pin,
            role,
            active: true,
        },
        select: {
            id: true,
            name: true,
            pin: true,
            role: true,
            active: true,
            createdAt: true,
        },
    });

    revalidateTag(CACHE_TAGS.employees, "max");
    revalidateTag(CACHE_TAGS.posSellers, "max");
    revalidateTag(CACHE_TAGS.attendance, "max");

    return serializeEmployee(employee);
}

export async function updateEmployee(employeeId: string, input: EmployeeInput) {
    const { name, pin, role } = validateEmployeeInput(input);
    await ensureUniqueEmployeeName(name, employeeId);

    const employee = await prisma.user.findFirst({
        where: {
            id: employeeId,
        },
        select: { id: true },
    });

    if (!employee) {
        throw new Error("El empleado no existe");
    }

    const updated = await prisma.user.update({
        where: { id: employeeId },
        data: {
            name,
            pin,
            role,
        },
        select: {
            id: true,
            name: true,
            pin: true,
            role: true,
            active: true,
            createdAt: true,
        },
    });

    revalidateTag(CACHE_TAGS.employees, "max");
    revalidateTag(CACHE_TAGS.posSellers, "max");
    revalidateTag(CACHE_TAGS.attendance, "max");

    return serializeEmployee(updated);
}

export async function setEmployeeStatus(employeeId: string, active: boolean) {
    const employee = await prisma.user.findFirst({
        where: {
            id: employeeId,
        },
        select: { id: true },
    });

    if (!employee) {
        throw new Error("El empleado no existe");
    }

    const updated = await prisma.user.update({
        where: { id: employeeId },
        data: { active },
        select: {
            id: true,
            name: true,
            pin: true,
            role: true,
            active: true,
            createdAt: true,
        },
    });

    revalidateTag(CACHE_TAGS.employees, "max");
    revalidateTag(CACHE_TAGS.posSellers, "max");
    revalidateTag(CACHE_TAGS.attendance, "max");

    return serializeEmployee(updated);
}

export async function deleteEmployee(employeeId: string) {
    const employee = await prisma.user.findFirst({
        where: {
            id: employeeId,
        },
        select: { id: true },
    });

    if (!employee) {
        throw new Error("El empleado no existe");
    }

    await prisma.user.delete({
        where: { id: employeeId },
    });

    revalidateTag(CACHE_TAGS.employees, "max");
    revalidateTag(CACHE_TAGS.posSellers, "max");
    revalidateTag(CACHE_TAGS.attendance, "max");

    return { success: true };
}
const getEmployeesCached = unstable_cache(
    async () => {
        const employees = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                pin: true,
                role: true,
                active: true,
                createdAt: true,
            },
            orderBy: [
                { active: "desc" },
                { name: "asc" },
            ],
        });

        return employees.map(serializeEmployee);
    },
    ["employees"],
    { revalidate: 300, tags: [CACHE_TAGS.employees, CACHE_TAGS.posSellers, CACHE_TAGS.attendance] }
);
