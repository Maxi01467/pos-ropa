"use client";

import { useEffect, useRef } from "react";
import { CACHE_TAGS } from "@/lib/cache-tags";

export type DataSyncDomain = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

type DataSyncPayload = {
    domains: DataSyncDomain[];
    at: number;
    sourceId: string;
};

const DATA_SYNC_EVENT = "pos-data-updated";
const DATA_SYNC_STORAGE_KEY = "pos-data-updated";
const DATA_SYNC_CHANNEL = "pos-data-updated";

let broadcastChannel: BroadcastChannel | null = null;
const TAB_SOURCE_ID =
    typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `tab-${Math.random().toString(36).slice(2)}`;

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
        sourceId: TAB_SOURCE_ID,
    };

    console.log(
        `[data-sync] notify source=${payload.sourceId} domains=${payload.domains.join(",")}`
    );

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
    refresh: () => void | Promise<void>,
    options?: {
        refreshOnFocus?: boolean;
        debugLabel?: string;
        pollIntervalMs?: number | false;
    }
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
        const debugLabel = options?.debugLabel || "anonymous";

        const runRefresh = () => {
            console.log(`[data-sync] refresh label=${debugLabel}`);
            void refreshRef.current();
        };

        const handlePayload = (payload: DataSyncPayload | null | undefined) => {
            if (!matchesDomains(subscribedDomains, payload)) return;
            if (!payload) return;
            if (payload.sourceId === TAB_SOURCE_ID) {
                console.log(
                    `[data-sync] ignore-self label=${debugLabel} source=${payload.sourceId}`
                );
                return;
            }
            console.log(
                `[data-sync] event label=${debugLabel} source=${payload.sourceId} domains=${payload.domains.join(",")}`
            );
            runRefresh();
        };

        const handleEvent = (event: Event) => {
            handlePayload((event as CustomEvent<DataSyncPayload>).detail);
        };

        const handleStorage = (event: StorageEvent) => {
            if (event.key !== DATA_SYNC_STORAGE_KEY || !event.newValue) return;

            try {
                console.log(`[data-sync] storage-event label=${debugLabel}`);
                handlePayload(JSON.parse(event.newValue) as DataSyncPayload);
            } catch {
                // Ignoramos payloads inválidos.
            }
        };

        const handleBroadcast = (event: MessageEvent<DataSyncPayload>) => {
            console.log(`[data-sync] broadcast-event label=${debugLabel}`);
            handlePayload(event.data);
        };

        window.addEventListener(DATA_SYNC_EVENT, handleEvent as EventListener);
        window.addEventListener("storage", handleStorage);
        if (options?.refreshOnFocus !== false) {
            window.addEventListener("focus", runRefresh);
        }

        const channel = getBroadcastChannel();
        channel?.addEventListener("message", handleBroadcast);

        const pollIntervalMs =
            options?.pollIntervalMs === false ? null : (options?.pollIntervalMs ?? 30000);
        const intervalId =
            pollIntervalMs == null ? null : window.setInterval(runRefresh, pollIntervalMs);

        return () => {
            window.removeEventListener(DATA_SYNC_EVENT, handleEvent as EventListener);
            window.removeEventListener("storage", handleStorage);
            if (options?.refreshOnFocus !== false) {
                window.removeEventListener("focus", runRefresh);
            }
            channel?.removeEventListener("message", handleBroadcast);
            if (intervalId != null) {
                window.clearInterval(intervalId);
            }
        };
    }, [domainsKey, options?.pollIntervalMs, options?.refreshOnFocus]);
}
