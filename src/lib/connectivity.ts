"use client";

/**
 * Detecta si el servidor es realmente alcanzable haciendo un fetch real
 * con un timeout corto. Mucho más confiable que navigator.onLine, que solo
 * indica si hay red local (WiFi/ethernet) pero no si hay internet de verdad.
 *
 * Uso:
 *   const online = await checkRealConnectivity();
 *   if (!online) { ... modo offline ... }
 */

const HEALTH_ENDPOINT = "/api/health";
const CONNECTIVITY_TIMEOUT_MS = 3000;

export async function checkRealConnectivity(): Promise<boolean> {
    // Atajo rápido: si el browser ya sabe que no hay red, no tiene sentido hacer fetch.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
        return false;
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONNECTIVITY_TIMEOUT_MS);

        const response = await fetch(HEALTH_ENDPOINT, {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response.ok;
    } catch {
        // AbortError (timeout), TypeError (sin red), cualquier error de fetch → offline.
        return false;
    }
}
