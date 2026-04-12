"use client";

import { useEffect, useRef } from "react";
import { CACHE_TAGS } from "@/lib/cache-tags";

export type DataSyncDomain = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

type DataSyncPayload = {
    domains: DataSyncDomain[];
    at: number;
};

const DATA_SYNC_EVENT = "pos-data-updated";
const DATA_SYNC_STORAGE_KEY = "pos-data-updated";
const DATA_SYNC_CHANNEL = "pos-data-updated";

let broadcastChannel: BroadcastChannel | null = null;

function getBroadcastChannel() {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
        return null;
    }

    broadcastChannel ??= new BroadcastChannel(DATA_SYNC_CHANNEL);
    return broadcastChannel;
}

function normalizeDomains(domains: DataSyncDomain | DataSyncDomain[]) {
    return Array.from(new Set(Array.isArray(domains) ? domains : [domains]));
}

function matchesDomains(
    subscribedDomains: DataSyncDomain[],
    payload: DataSyncPayload | null | undefined
) {
    if (!payload) return false;
    return payload.domains.some((domain) => subscribedDomains.includes(domain));
}

export function notifyDataUpdated(domains: DataSyncDomain | DataSyncDomain[]) {
    if (typeof window === "undefined") return;

    const payload: DataSyncPayload = {
        domains: normalizeDomains(domains),
        at: Date.now(),
    };

    window.dispatchEvent(new CustomEvent<DataSyncPayload>(DATA_SYNC_EVENT, { detail: payload }));
    getBroadcastChannel()?.postMessage(payload);

    try {
        window.localStorage.setItem(DATA_SYNC_STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // Ignoramos errores de almacenamiento porque el evento local ya fue emitido.
    }
}

export function useDataRefresh(
    domains: DataSyncDomain | DataSyncDomain[],
    refresh: () => void | Promise<void>
) {
    const refreshRef = useRef(refresh);
    const domainsKey = normalizeDomains(domains).join(":");

    useEffect(() => {
        refreshRef.current = refresh;
    }, [refresh]);

    useEffect(() => {
        const subscribedDomains = domainsKey
            .split(":")
            .filter(Boolean) as DataSyncDomain[];

        const runRefresh = () => {
            void refreshRef.current();
        };

        const handlePayload = (payload: DataSyncPayload | null | undefined) => {
            if (!matchesDomains(subscribedDomains, payload)) return;
            runRefresh();
        };

        const handleEvent = (event: Event) => {
            handlePayload((event as CustomEvent<DataSyncPayload>).detail);
        };

        const handleStorage = (event: StorageEvent) => {
            if (event.key !== DATA_SYNC_STORAGE_KEY || !event.newValue) return;

            try {
                handlePayload(JSON.parse(event.newValue) as DataSyncPayload);
            } catch {
                // Ignoramos payloads inválidos.
            }
        };

        const handleBroadcast = (event: MessageEvent<DataSyncPayload>) => {
            handlePayload(event.data);
        };

        window.addEventListener(DATA_SYNC_EVENT, handleEvent as EventListener);
        window.addEventListener("storage", handleStorage);
        window.addEventListener("focus", runRefresh);

        const channel = getBroadcastChannel();
        channel?.addEventListener("message", handleBroadcast);

        return () => {
            window.removeEventListener(DATA_SYNC_EVENT, handleEvent as EventListener);
            window.removeEventListener("storage", handleStorage);
            window.removeEventListener("focus", runRefresh);
            channel?.removeEventListener("message", handleBroadcast);
        };
    }, [domainsKey]);
}
