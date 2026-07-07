"use client";

import { useSyncExternalStore } from "react";
import { getStoredRole, type SessionRole } from "@/lib/core/permissions";

type SessionSnapshot = {
    hasSession: boolean;
    role: SessionRole | null;
    userId: string | null;
    userName: string | null;
};

const EMPTY_SESSION_SNAPSHOT: SessionSnapshot = {
    hasSession: false,
    role: null,
    userId: null,
    userName: null,
};

const SESSION_STORAGE_EVENT = "pos-session-updated";
const SESSION_STORAGE_KEYS = ["pos_session", "pos_user", "pos_user_id", "pos_role"] as const;
const SESSION_LOGOUT_BROADCAST_KEY = "pos_session_logout_at";

let lastSnapshot: SessionSnapshot = EMPTY_SESSION_SNAPSHOT;
let lastSnapshotKey = "false:";

// Flag en memoria RAM: solo se activa cuando el usuario se loguea en el proceso
// actual. Al ser una variable de módulo (no storage), es imposible que sobreviva
// un reinicio, crash o corte de corriente. Esto evita el auto-redirect fantasma.
let sessionEstablishedThisRun = false;

export function isSessionEstablishedThisRun(): boolean {
    return sessionEstablishedThisRun;
}

function getSessionStorage() {
    if (typeof window === "undefined") {
        return null;
    }

    return window.sessionStorage;
}

function getSnapshot(): SessionSnapshot {
    const storage = getSessionStorage();

    if (!storage) {
        return EMPTY_SESSION_SNAPSHOT;
    }

    const hasSession = storage.getItem("pos_session") === "true";
    const storedUser = storage.getItem("pos_user");
    const storedUserId = storage.getItem("pos_user_id");
    const storedRole = storage.getItem("pos_role");
    const role = hasSession ? getStoredRole(storedRole, storedUser) : null;
    const snapshotKey = `${hasSession}:${role ?? ""}:${storedUserId ?? ""}:${storedUser ?? ""}`;

    if (snapshotKey === lastSnapshotKey) {
        return lastSnapshot;
    }

    lastSnapshotKey = snapshotKey;
    lastSnapshot = {
        hasSession,
        role,
        userId: hasSession ? storedUserId : null,
        userName: hasSession ? storedUser : null,
    };

    return lastSnapshot;
}

function subscribe(callback: () => void) {
    const handleStorage = (event: StorageEvent) => {
        if (event.key === SESSION_LOGOUT_BROADCAST_KEY) {
            const storage = getSessionStorage();
            SESSION_STORAGE_KEYS.forEach((key) => storage?.removeItem(key));
        }

        callback();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(SESSION_STORAGE_EVENT, callback);
    return () => {
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener(SESSION_STORAGE_EVENT, callback);
    };
}

export function useSessionSnapshot() {
    return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_SESSION_SNAPSHOT);
}

function notifySessionUpdated() {
    window.dispatchEvent(new Event(SESSION_STORAGE_EVENT));
}

export function setLocalSession(session: {
    userId: string;
    userName: string;
    role: SessionRole;
}) {
    const storage = getSessionStorage();

    if (!storage) {
        return;
    }

    // Marcar que la sesión fue establecida en este proceso (Capa 1 de seguridad).
    sessionEstablishedThisRun = true;

    SESSION_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    storage.setItem("pos_session", "true");
    storage.setItem("pos_user", session.userName);
    storage.setItem("pos_user_id", session.userId);
    storage.setItem("pos_role", session.role);
    notifySessionUpdated();
}

export function clearLocalSession() {
    const storage = getSessionStorage();

    SESSION_STORAGE_KEYS.forEach((key) => {
        storage?.removeItem(key);
        if (typeof window !== "undefined") {
            window.localStorage.removeItem(key);
        }
    });

    if (typeof window !== "undefined") {
        window.localStorage.setItem(SESSION_LOGOUT_BROADCAST_KEY, String(Date.now()));
    }

    notifySessionUpdated();
}
