"use server";

import { prisma } from "@/lib/prisma";
import { normalizeTerminalPrefix } from "@/lib/terminal/tickets";

export type TerminalAssignment = {
    id: string;
    name: string;
    prefix: string;
    deviceId: string;
    active: boolean;
};

type RegisterTerminalInput = {
    deviceId: string;
    prefix: string;
    name: string;
};

function serializeTerminal(terminal: {
    id: string;
    name: string;
    prefix: string;
    deviceId: string;
    active: boolean;
}): TerminalAssignment {
    return {
        id: terminal.id,
        name: terminal.name,
        prefix: terminal.prefix,
        deviceId: terminal.deviceId,
        active: terminal.active,
    };
}

export async function findTerminalByDeviceId(deviceId: string): Promise<TerminalAssignment | null> {
    const normalizedDeviceId = deviceId.trim();
    if (!normalizedDeviceId) {
        return null;
    }

    const terminal = await prisma.terminal.findUnique({
        where: { deviceId: normalizedDeviceId },
        select: {
            id: true,
            name: true,
            prefix: true,
            deviceId: true,
            active: true,
        },
    });

    return terminal ? serializeTerminal(terminal) : null;
}

export async function registerTerminal(input: RegisterTerminalInput): Promise<TerminalAssignment> {
    const deviceId = input.deviceId.trim();
    const name = input.name.trim();
    const prefix = normalizeTerminalPrefix(input.prefix);

    if (!deviceId) {
        throw new Error("No se recibió el identificador local de esta PC.");
    }

    if (!name) {
        throw new Error("Ingresá un nombre para la terminal.");
    }

    const existingByDevice = await prisma.terminal.findUnique({
        where: { deviceId },
        select: {
            id: true,
            name: true,
            prefix: true,
            deviceId: true,
            active: true,
        },
    });

    if (existingByDevice) {
        return serializeTerminal(existingByDevice);
    }

    const existingByPrefix = await prisma.terminal.findUnique({
        where: { prefix },
        select: { id: true },
    });

    if (existingByPrefix) {
        throw new Error(`El prefijo ${prefix} ya está asignado a otra terminal.`);
    }

    const created = await prisma.terminal.create({
        data: {
            name,
            prefix,
            deviceId,
        },
        select: {
            id: true,
            name: true,
            prefix: true,
            deviceId: true,
            active: true,
        },
    });

    return serializeTerminal(created);
}
