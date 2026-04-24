"use client";

import { useSyncExternalStore } from "react";

const TERMINAL_EVENT = "pos-terminal-config-updated";

export type TerminalSnapshot = {
    isDesktop: boolean;
    isLoading: boolean;
    deviceId: string | null;
    terminalId: string | null;
    terminalPrefix: string | null;
    terminalName: string | null;
};

type TerminalStoragePayload = {
    deviceId?: string | null;
    terminalId?: string | null;
    terminalPrefix?: string | null;
    terminalName?: string | null;
};

const DEFAULT_TERMINAL_SNAPSHOT: TerminalSnapshot = {
    isDesktop: false,
    isLoading: false,
    deviceId: null,
    terminalId: null,
    terminalPrefix: null,
    terminalName: null,
};

let currentSnapshot: TerminalSnapshot = DEFAULT_TERMINAL_SNAPSHOT;

function emitTerminalUpdated() {
    if (typeof window === "undefined") {
        return;
    }

    window.dispatchEvent(new Event(TERMINAL_EVENT));
}

function setSnapshot(next: TerminalSnapshot) {
    currentSnapshot = next;
    emitTerminalUpdated();
    return currentSnapshot;
}

function getSnapshot() {
    return currentSnapshot;
}

function subscribe(callback: () => void) {
    if (typeof window === "undefined") {
        return () => {};
    }

    window.addEventListener(TERMINAL_EVENT, callback);
    return () => {
        window.removeEventListener(TERMINAL_EVENT, callback);
    };
}

function normalizeDesktopPayload(payload: TerminalStoragePayload | null | undefined): TerminalSnapshot {
    return {
        isDesktop: true,
        isLoading: false,
        deviceId: payload?.deviceId?.trim() || null,
        terminalId: payload?.terminalId?.trim() || null,
        terminalPrefix: payload?.terminalPrefix?.trim() || null,
        terminalName: payload?.terminalName?.trim() || null,
    };
}

export function useTerminalSnapshot() {
    return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_TERMINAL_SNAPSHOT);
}

export function requiresTerminalConfiguration(pathname: string) {
    return pathname.startsWith("/nueva-venta") || pathname.startsWith("/caja");
}

export function isTerminalConfigured(snapshot: TerminalSnapshot) {
    return Boolean(snapshot.deviceId && snapshot.terminalId && snapshot.terminalPrefix);
}

export async function refreshTerminalSnapshot() {
    if (typeof window === "undefined" || !window.posDesktop?.getTerminalConfig) {
        return setSnapshot(DEFAULT_TERMINAL_SNAPSHOT);
    }

    setSnapshot({
        ...currentSnapshot,
        isDesktop: true,
        isLoading: true,
    });

    try {
        const payload = await window.posDesktop.getTerminalConfig();
        return setSnapshot({
            ...normalizeDesktopPayload(payload),
            isLoading: false,
        });
    } catch (error) {
        console.warn("No se pudo leer la configuración local de terminal", error);
        return setSnapshot({
            isDesktop: true,
            isLoading: false,
            deviceId: null,
            terminalId: null,
            terminalPrefix: null,
            terminalName: null,
        });
    }
}

export async function saveTerminalSnapshot(input: {
    deviceId: string;
    terminalId: string;
    terminalPrefix: string;
    terminalName: string;
}) {
    if (typeof window === "undefined" || !window.posDesktop?.setTerminalConfig) {
        throw new Error("La configuración de terminal solo está disponible en la app de escritorio.");
    }

    const payload = await window.posDesktop.setTerminalConfig(input);
    return setSnapshot(normalizeDesktopPayload(payload));
}
