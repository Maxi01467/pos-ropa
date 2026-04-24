"use server";

import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, createSessionToken } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

export async function authenticateUser(name: string, pin: string) {
    try {
        const normalizedName = name.trim();
        const normalizedPin = pin.trim();
        const isDesktopApp = process.env.POS_DESKTOP === "1";

        if (!normalizedName || !normalizedPin) {
            return { success: false, error: "Ingresá usuario y contraseña" };
        }

        const user = await prisma.user.findFirst({
            where: {
                deletedAt: null,
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
            return { success: false, error: "Usuario o contraseña incorrectos" };
        }

        if (user.role === "STAFF" && !isDesktopApp) {
            return {
                success: false,
                error: "Los usuarios STAFF solo pueden ingresar desde la app de escritorio",
            };
        }

        const role = user.role === "ADMIN" ? "ADMIN" : "STAFF";
        const clientType = isDesktopApp ? "desktop" : "web";

        const cookieStore = await cookies();
        const token = await createSessionToken({
            userId: user.id,
            userName: user.name,
            role,
            clientType,
        });

        cookieStore.set(AUTH_COOKIE_NAME, token, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production" && !isDesktopApp,
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
        });

        return { success: true, user };
    } catch (err) {
        return { 
            success: false, 
            error: err instanceof Error ? err.message : String(err) 
        };
    }
}

export async function logoutUser() {
    const cookieStore = await cookies();
    cookieStore.delete(AUTH_COOKIE_NAME);
}
