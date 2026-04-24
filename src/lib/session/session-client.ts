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

let lastSnapshot: SessionSnapshot = EMPTY_SESSION_SNAPSHOT;
let lastSnapshotKey = "false:";

function getSnapshot(): SessionSnapshot {
    if (typeof window === "undefined") {
        return EMPTY_SESSION_SNAPSHOT;
    }

    const hasSession = localStorage.getItem("pos_session") === "true";
    const storedUser = localStorage.getItem("pos_user");
    const storedUserId = localStorage.getItem("pos_user_id");
    const storedRole = localStorage.getItem("pos_role");
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
    window.addEventListener("storage", callback);
    window.addEventListener(SESSION_STORAGE_EVENT, callback);
    return () => {
        window.removeEventListener("storage", callback);
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
    localStorage.setItem("pos_session", "true");
    localStorage.setItem("pos_user", session.userName);
    localStorage.setItem("pos_user_id", session.userId);
    localStorage.setItem("pos_role", session.role);
    notifySessionUpdated();
}

export function clearLocalSession() {
    localStorage.removeItem("pos_session");
    localStorage.removeItem("pos_user");
    localStorage.removeItem("pos_user_id");
    localStorage.removeItem("pos_role");
    notifySessionUpdated();
}
