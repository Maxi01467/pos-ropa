"use client";

import { useEffect } from "react";
import { clearLocalSession } from "@/lib/session/session-client";

export function SessionCloseGuard() {
    useEffect(() => {
        let logoutSent = false;

        const closeSession = () => {
            if (logoutSent) {
                return;
            }

            logoutSent = true;
            clearLocalSession();

            if (navigator.sendBeacon) {
                const sent = navigator.sendBeacon("/api/auth/logout", new Blob([], { type: "text/plain" }));
                if (sent) {
                    return;
                }
            }

            void fetch("/api/auth/logout", {
                method: "POST",
                cache: "no-store",
                keepalive: true,
            }).catch(() => undefined);
        };

        window.addEventListener("pagehide", closeSession);
        window.addEventListener("beforeunload", closeSession);

        return () => {
            window.removeEventListener("pagehide", closeSession);
            window.removeEventListener("beforeunload", closeSession);
        };
    }, []);

    return null;
}
