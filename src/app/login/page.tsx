// src/app/login/page.tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Store, Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { authenticatePosUser } from "@/lib/offline/auth-client";
import { clearLocalSession, setLocalSession, useSessionSnapshot, isSessionEstablishedThisRun } from "@/lib/session/session-client";
import { useRouter, useSearchParams } from "next/navigation";
import {
    getOfflineBootstrapRequiredMessage,
    refreshOfflineBootstrapState,
    useOfflineBootstrap,
} from "@/lib/offline/offline-bootstrap";
import { getDefaultPathForRole } from "@/lib/core/permissions";
import { refreshTerminalSnapshot, useTerminalSnapshot } from "@/lib/terminal/terminal-client";


function LoginPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const session = useSessionSnapshot();
    const bootstrap = useOfflineBootstrap();
    const terminal = useTerminalSnapshot();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const isLoggedOutNavigation = searchParams.get("logged_out") === "1";

    useEffect(() => {
        if (isLoggedOutNavigation) {
            clearLocalSession();
        }
    }, [isLoggedOutNavigation]);

    useEffect(() => {
        if (isLoggedOutNavigation) {
            return;
        }

        if (!session.hasSession || !session.role) {
            return;
        }

        // Capa 1 de seguridad: si el sessionStorage tiene datos de una sesión anterior
        // (crash, corte de corriente, etc.) pero el flag en RAM no fue activado en este
        // proceso, significa que son datos "fantasma". Se limpian y se muestra el login.
        if (!isSessionEstablishedThisRun()) {
            clearLocalSession();
            return;
        }

        const isDesktopRuntime =
            terminal.isDesktop ||
            (typeof window !== "undefined" && Boolean(window.posDesktop));

        router.replace(getDefaultPathForRole(session.role, { isDesktop: isDesktopRuntime }));
    }, [isLoggedOutNavigation, router, session.hasSession, session.role, terminal.isDesktop]);

    useEffect(() => {
        void refreshOfflineBootstrapState().catch((error) => {
            console.warn("No se pudo calcular el bootstrap offline en login", error);
        });
        void refreshTerminalSnapshot().catch((error) => {
            console.warn("No se pudo leer la configuración local de terminal en login", error);
        });
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const result = await authenticatePosUser(username, password);

            if (!result.success || !result.user) {
                toast.error(result.error || "No se pudo iniciar sesión");
                setIsLoading(false);
                return;
            }

            const user = result.user;
            const isDesktopRuntime =
                terminal.isDesktop ||
                (typeof window !== "undefined" && Boolean(window.posDesktop));
            const destination = getDefaultPathForRole(user.role, { isDesktop: isDesktopRuntime });

            setLocalSession({
                userId: user.id,
                userName: user.name,
                role: user.role,
            });

            toast.success(
                result.source === "local" ? "Acceso offline concedido" : "¡Acceso concedido!"
            );
            setIsRedirecting(true);
            window.location.assign(destination);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "No se pudo iniciar sesión";
            toast.error(message);
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4 relative overflow-hidden">
            {/* Fondo decorativo sutil */}
            <div className="absolute inset-0 z-0 bg-grid-black/[0.02] bg-[size:20px_20px]" />
            
            <AnimatePresence>
                {isRedirecting && (
                    <motion.div
                        key="login-welcome-loader"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="fixed inset-0 z-50"
                    >
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
                            <Loader2 className="size-8 animate-spin text-rose-500" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <Card className="z-10 w-full max-w-[400px] shadow-2xl border-border/50">
                <CardHeader className="space-y-3 pb-6 text-center">
                    <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,#EC4899_0%,#BE185D_100%)] text-white shadow-[0_18px_28px_-18px_rgba(236,72,153,0.75)]">
                        <Store className="size-8" />
                    </div>
                    <div>
                        <CardTitle className="text-2xl font-bold tracking-tight uppercase">
                            Mi Tienda de Ropa
                        </CardTitle>
                        <CardDescription className="text-base mt-1">
                            Ingresá tus credenciales para acceder
                        </CardDescription>
                    </div>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-2 group">
                            <Label htmlFor="username" className="transition-colors duration-200 group-focus-within:text-rose-600 dark:group-focus-within:text-rose-400">Usuario</Label>
                            <Input 
                                id="username" 
                                placeholder="Ej: admin" 
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                autoFocus
                                className="h-11 text-base transition-all duration-200 focus:shadow-[0_8px_30px_rgba(244,63,94,0.04)]"
                            />
                        </div>
                        <div className="space-y-2 group">
                            <Label htmlFor="password" className="transition-colors duration-200 group-focus-within:text-rose-600 dark:group-focus-within:text-rose-400">Contraseña</Label>
                            <Input 
                                id="password" 
                                type="password" 
                                placeholder="Contraseña" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="h-11 text-base transition-all duration-200 focus:shadow-[0_8px_30px_rgba(244,63,94,0.04)]"
                            />
                        </div>

                        {bootstrap.isOnline === false &&
                            bootstrap.state === "requires_initial_sync" && (
                                <div className="rounded-2xl border border-amber-600/40 bg-amber-500/8 p-4 text-left">
                                    <p className="text-sm font-semibold text-amber-200">
                                        Sincronización inicial requerida
                                    </p>
                                    <p className="mt-1 text-sm text-amber-100/85">
                                        {getOfflineBootstrapRequiredMessage()}
                                    </p>
                                </div>
                            )}
                        
                        <Button
                            type="submit"
                            className="h-12 w-full rounded-2xl border-0 bg-[linear-gradient(135deg,#EC4899_0%,#BE185D_100%)] text-white text-base font-bold gap-2 mt-2 shadow-[0_10px_24px_-8px_rgba(236,72,153,0.4)] hover:shadow-[0_14px_32px_-8px_rgba(236,72,153,0.55)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 cursor-pointer"
                            disabled={
                                isLoading ||
                                !username ||
                                !password ||
                                (bootstrap.isOnline === false &&
                                    bootstrap.state === "requires_initial_sync")
                            }
                        >
                            {isLoading ? <Loader2 className="size-5 animate-spin" /> : <KeyRound className="size-5" />}
                            Ingresar al Sistema
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
                    <Loader2 className="size-8 animate-spin text-rose-600 dark:text-rose-400" />
                </div>
            }
        >
            <LoginPageContent />
        </Suspense>
    );
}
