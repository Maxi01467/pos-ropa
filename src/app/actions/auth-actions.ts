"use server";

import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
            active: true,
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

    const role = user.role === "ADMIN" ? "ADMIN" : "STAFF";

    const cookieStore = await cookies();
    const token = await createSessionToken({
        userId: user.id,
        userName: user.name,
        role,
    });

    cookieStore.set(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
    });

    return user;
}

export async function logoutUser() {
    const cookieStore = await cookies();
    cookieStore.delete(AUTH_COOKIE_NAME);
}
