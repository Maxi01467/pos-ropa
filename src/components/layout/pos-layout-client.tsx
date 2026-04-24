"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { Sidebar } from "@/components/layout/sidebar";
import { canAccessPath, type SessionRole } from "@/lib/core/permissions";
import { setLocalSession, useSessionSnapshot } from "@/lib/session/session-client";
import type { AuthSession } from "@/lib/auth/auth-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import {
    getOfflineBootstrapRequiredMessage,
    refreshOfflineBootstrapState,
    useOfflineBootstrap,
} from "@/lib/offline/offline-bootstrap";
import {
    isTerminalConfigured,
    refreshTerminalSnapshot,
    requiresTerminalConfiguration,
    saveTerminalSnapshot,
    useTerminalSnapshot,
} from "@/lib/terminal/terminal-client";
import { findTerminalByDeviceId, registerTerminal } from "@/app/actions/terminal/terminal-actions";
import { toast } from "sonner";

export function POSLayoutClient({
    children,
    initialSession,
}: {
    children: React.ReactNode;
    initialSession: AuthSession | null;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const session = useSessionSnapshot();
    const bootstrap = useOfflineBootstrap();
    const terminal = useTerminalSnapshot();
    const [collapsed, setCollapsed] = useState(false);
    const [terminalPrefix, setTerminalPrefix] = useState("C1");
    const [terminalName, setTerminalName] = useState("Caja principal");
    const [isSavingTerminal, setIsSavingTerminal] = useState(false);
    const [isSyncingTerminal, setIsSyncingTerminal] = useState(false);
    const effectiveSession = session.hasSession
        ? session
        : {
            hasSession: Boolean(initialSession),
            role: initialSession?.role ?? null,
            userId: initialSession?.userId ?? null,
            userName: initialSession?.userName ?? null,
        };
    const isDesktopClient = terminal.isDesktop || initialSession?.clientType === "desktop";

    useEffect(() => {
        void refreshOfflineBootstrapState().catch((error) => {
            console.warn("No se pudo refrescar el bootstrap offline en el layout POS", error);
        });
        void refreshTerminalSnapshot().catch((error) => {
            console.warn("No se pudo leer la configuración local de terminal", error);
        });
    }, []);

    useEffect(() => {
        if (!terminal.terminalPrefix) {
            return;
        }

        setTerminalPrefix(terminal.terminalPrefix);
    }, [terminal.terminalPrefix]);

    useEffect(() => {
        if (!terminal.terminalName) {
            return;
        }

        setTerminalName(terminal.terminalName);
    }, [terminal.terminalName]);

    useEffect(() => {
        if (
            !terminal.isDesktop ||
            terminal.isLoading ||
            isTerminalConfigured(terminal) ||
            !terminal.deviceId ||
            bootstrap.isOnline === false
        ) {
            return;
        }

        let cancelled = false;
        const deviceId = terminal.deviceId;
        setIsSyncingTerminal(true);

        void findTerminalByDeviceId(deviceId)
            .then(async (existingTerminal) => {
                if (!existingTerminal || cancelled) {
                    return;
                }

                await saveTerminalSnapshot({
                    deviceId,
                    terminalId: existingTerminal.id,
                    terminalPrefix: existingTerminal.prefix,
                    terminalName: existingTerminal.name,
                });
            })
            .catch((error) => {
                console.warn("No se pudo verificar la terminal registrada para esta PC", error);
            })
            .finally(() => {
                if (!cancelled) {
                    setIsSyncingTerminal(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [bootstrap.isOnline, terminal]);

    useEffect(() => {
        if (session.hasSession || !initialSession) {
            return;
        }

        setLocalSession({
            userId: initialSession.userId,
            userName: initialSession.userName,
            role: initialSession.role,
        });
    }, [initialSession, session.hasSession]);

    useEffect(() => {
        if (bootstrap.isOnline === false && bootstrap.state === "requires_initial_sync") {
            return;
        }

        if (!effectiveSession.hasSession || !effectiveSession.role) {
            if (pathname !== "/login") {
                router.replace("/login");
            }
            return;
        }

        if (!canAccessPath(effectiveSession.role, pathname, { isDesktop: isDesktopClient })) {
            const destination = effectiveSession.role === "ADMIN" ? "/" : "/nueva-venta";
            if (pathname !== destination) {
                router.replace(destination);
            }
        }
    }, [
        bootstrap.isOnline,
        bootstrap.state,
        effectiveSession.hasSession,
        effectiveSession.role,
        pathname,
        router,
        isDesktopClient,
    ]);

    if (bootstrap.isOnline === false && bootstrap.state === "requires_initial_sync") {
        return (
            <div className="flex min-h-screen items-center justify-center p-6">
                <section className="w-full max-w-2xl rounded-3xl border border-amber-700/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(251,191,36,0.04))] p-8 shadow-xl">
                    <h1 className="text-2xl font-semibold text-amber-100">
                        Sincronización inicial requerida
                    </h1>
                    <p className="mt-3 text-sm text-amber-50/80">
                        {getOfflineBootstrapRequiredMessage()}
                    </p>
                    <p className="mt-3 text-sm text-amber-50/70">
                        Conectá esta PC a internet una vez, dejá que sincronice usuarios y datos base,
                        y después ya podrá volver a abrir sin red.
                    </p>
                </section>
            </div>
        );
    }

    if (!effectiveSession.hasSession || !effectiveSession.role || !effectiveSession.userName) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="size-10 animate-spin text-emerald-700" />
            </div>
        );
    }

    const needsTerminalSetup =
        terminal.isDesktop &&
        requiresTerminalConfiguration(pathname) &&
        !isTerminalConfigured(terminal);

    const handleRegisterTerminal = async () => {
        if (!terminal.deviceId) {
            toast.error("No se pudo identificar esta PC. Reiniciá la app de escritorio.");
            return;
        }

        if (!bootstrap.isOnline) {
            toast.error("Conectá esta PC a internet para registrar la terminal por primera vez.");
            return;
        }

        setIsSavingTerminal(true);
        try {
            const registered = await registerTerminal({
                deviceId: terminal.deviceId,
                prefix: terminalPrefix,
                name: terminalName,
            });

            await saveTerminalSnapshot({
                deviceId: terminal.deviceId,
                terminalId: registered.id,
                terminalPrefix: registered.prefix,
                terminalName: registered.name,
            });

            toast.success(`Terminal ${registered.prefix} configurada`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo registrar la terminal");
        } finally {
            setIsSavingTerminal(false);
        }
    };

    if (needsTerminalSetup && (terminal.isLoading || isSyncingTerminal)) {
        return (
            <div className="flex min-h-screen items-center justify-center p-6">
                <section className="w-full max-w-xl rounded-3xl border border-border/70 bg-card/90 p-8 shadow-xl">
                    <div className="flex items-center gap-4">
                        <Loader2 className="size-6 animate-spin text-emerald-700" />
                        <div>
                            <h1 className="text-xl font-semibold">Preparando terminal</h1>
                            <p className="text-sm text-muted-foreground">
                                Estamos verificando si esta PC ya tiene una caja asignada.
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        );
    }

    if (needsTerminalSetup) {
        return (
            <div className="flex min-h-screen items-center justify-center p-6">
                <section className="w-full max-w-xl rounded-3xl border border-border/70 bg-card/90 p-8 shadow-xl">
                    <h1 className="text-2xl font-semibold text-foreground">
                        Configuración inicial de terminal
                    </h1>
                    <p className="mt-3 text-sm text-muted-foreground">
                        Esta PC necesita una terminal asignada antes de registrar ventas o usar caja.
                    </p>
                    <div className="mt-6 grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="terminal-name">Nombre de la terminal</Label>
                            <Input
                                id="terminal-name"
                                value={terminalName}
                                onChange={(event) => setTerminalName(event.target.value)}
                                placeholder="Caja principal"
                                disabled={isSavingTerminal}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="terminal-prefix">Prefijo</Label>
                            <Input
                                id="terminal-prefix"
                                value={terminalPrefix}
                                onChange={(event) => setTerminalPrefix(event.target.value.toUpperCase())}
                                placeholder="C1"
                                disabled={isSavingTerminal}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Esta asignación queda guardada localmente en esta PC y se usará para generar
                            boletas como <span className="font-mono">C1-00001</span>.
                        </p>
                    </div>
                    <div className="mt-6 flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                            {bootstrap.isOnline
                                ? "Conexión lista para registrar la terminal."
                                : "Necesitás internet una vez para registrar esta terminal."}
                        </p>
                        <Button
                            type="button"
                            onClick={() => void handleRegisterTerminal()}
                            disabled={isSavingTerminal || !bootstrap.isOnline}
                        >
                            {isSavingTerminal ? "Guardando..." : "Registrar terminal"}
                        </Button>
                    </div>
                </section>
            </div>
        );
    }

    const role: SessionRole = effectiveSession.role;
    const userName = effectiveSession.userName;

    return (
        <div className="flex min-h-screen bg-transparent">
            <Sidebar
                role={role}
                userName={userName}
                isDesktopClient={isDesktopClient}
                collapsed={collapsed}
                onToggleCollapse={() => setCollapsed((c) => !c)}
            />
            <main className="relative flex min-h-screen flex-1 flex-col overflow-hidden">
                <AppHeader
                    userName={userName}
                    role={role}
                />
                <div className="flex-1 overflow-auto bg-transparent">
                    {children}
                </div>
            </main>
        </div>
    );
}
