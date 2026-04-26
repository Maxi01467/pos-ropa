"use client";

import { authenticateUser, establishLocalStaffSessionCookie } from "@/app/actions/auth/auth-actions";
import { isOfflineModeEnabled } from "@/lib/offline-config";
import {
    getOfflineBootstrapRequiredMessage,
    refreshOfflineBootstrapState,
} from "@/lib/offline/offline-bootstrap";
import { type SessionRole } from "@/lib/core/permissions";
import { db, initPowerSync } from "@/lib/powersync/db";

type AuthenticatedUser = {
    id: string;
    name: string;
    role: SessionRole;
};

type LocalUserRow = {
    id: string;
    name: string;
    role: string;
};

type AuthResult = {
    success: boolean;
    user?: AuthenticatedUser;
    error?: string;
    source: "local" | "server";
};

type BootstrapSnapshot = Awaited<ReturnType<typeof refreshOfflineBootstrapState>>;

function normalizeRole(role: string): SessionRole {
    return role === "ADMIN" ? "ADMIN" : "STAFF";
}

function isLocalAuthReady(bootstrap: BootstrapSnapshot) {
    return bootstrap.state === "ready_offline" && bootstrap.minimumDatasetReady;
}

async function authenticateLocally(name: string, pin: string): Promise<AuthenticatedUser | null> {
    await initPowerSync();

    const normalizedName = name.trim();
    const normalizedPin = pin.trim();

    const user = await db.getOptional<LocalUserRow>(
        `
            SELECT id, name, role
            FROM "User"
            WHERE deletedAt IS NULL
              AND active = 1
              AND LOWER(name) = LOWER(?)
              AND pin = ?
            LIMIT 1
        `,
        [normalizedName, normalizedPin]
    );

    if (!user) {
        return null;
    }

    return {
        id: user.id,
        name: user.name,
        role: normalizeRole(user.role),
    };
}

export async function authenticatePosUser(name: string, pin: string): Promise<AuthResult> {
    if (isOfflineModeEnabled()) {
        const bootstrap = await refreshOfflineBootstrapState();
        const localAuthReady = isLocalAuthReady(bootstrap);

        try {
            if (localAuthReady) {
                const localUser = await authenticateLocally(name, pin);
                if (localUser) {
                    if (localUser.role === "STAFF") {
                        try {
                            await establishLocalStaffSessionCookie({
                                userId: localUser.id,
                                userName: localUser.name,
                            });
                        } catch (error) {
                            console.warn("[offline] could not establish staff session cookie", error);
                        }
                    }

                    return {
                        success: true,
                        user: localUser,
                        source: "local",
                    };
                }

                return {
                    success: false,
                    error: "Usuario o contraseña incorrectos",
                    source: "local",
                };
            }
        } catch (error) {
            console.warn("[offline] auth fallback to server", error);

            if (bootstrap.isOnline === false) {
                return {
                    success: false,
                    error: "No se pudo validar el acceso con los datos locales",
                    source: "local",
                };
            }
        }

        if (bootstrap.isOnline === false) {
            return {
                success: false,
                error:
                    bootstrap.state === "requires_initial_sync"
                        ? getOfflineBootstrapRequiredMessage()
                        : "Usuario o contraseña incorrectos en modo offline",
                source: "local",
            };
        }
    }

    const result = await authenticateUser(name, pin);
    if (!result.success || !result.user) {
        return {
            success: false,
            error: result.error || "No se pudo iniciar sesión",
            source: "server",
        };
    }

    return {
        success: true,
        user: {
            id: result.user.id,
            name: result.user.name,
            role: normalizeRole(result.user.role),
        },
        source: "server",
    };
}
