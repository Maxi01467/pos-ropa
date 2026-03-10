"use server";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function authenticateUser(name: string, pin: string) {
    const normalizedName = name.trim();
    const normalizedPin = pin.trim();

    if (!normalizedName || !normalizedPin) {
        throw new Error("Ingresá usuario y contraseña");
    }

    const user = await prisma.user.findFirst({
        where: {
            name: {
                equals: normalizedName,
                mode: "insensitive",
            },
            pin: normalizedPin,
        },
        select: {
            id: true,
            name: true,
            role: true,
        },
    });

    if (!user) {
        throw new Error("Usuario o contraseña incorrectos");
    }

    return user;
}
