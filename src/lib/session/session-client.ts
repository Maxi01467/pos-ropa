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
    return () => {
        window.removeEventListener("storage", callback);
    };
}

export function useSessionSnapshot() {
    return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_SESSION_SNAPSHOT);
}
