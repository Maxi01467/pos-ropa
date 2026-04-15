// src/app/login/page.tsx
"use client";

import { useState } from "react";
import { Store, Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { authenticateUser } from "@/app/actions/auth-actions";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const result = await authenticateUser(username, password);

            if (!result.success || !result.user) {
                toast.error(result.error || "No se pudo iniciar sesión");
                setIsLoading(false);
                return;
            }

            const user = result.user;
            const destination = user.role === "ADMIN" ? "/" : "/nueva-venta";

            localStorage.setItem("pos_session", "true");
            localStorage.setItem("pos_user", user.name);
            localStorage.setItem("pos_user_id", user.id);
            localStorage.setItem("pos_role", user.role);

            toast.success("¡Acceso concedido!");
            window.location.assign(destination);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "No se pudo iniciar sesión";
            toast.error(message);
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
            {/* Fondo decorativo sutil */}
            <div className="absolute inset-0 z-0 bg-grid-black/[0.02] bg-[size:20px_20px]" />
            
            <Card className="z-10 w-full max-w-[400px] shadow-2xl border-border/50">
                <CardHeader className="space-y-3 pb-6 text-center">
                    <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ea580c_0%,#c2410c_100%)] text-orange-50 shadow-[0_18px_28px_-18px_rgba(194,65,12,0.7)]">
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
                        <div className="space-y-2">
                            <Label htmlFor="username">Usuario</Label>
                            <Input 
                                id="username" 
                                placeholder="Ej: admin" 
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                autoFocus
                                className="h-11 text-base"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <Input 
                                id="password" 
                                type="password" 
                                placeholder="PIN" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="h-11 text-base tracking-widest"
                            />
                        </div>
                        
                        <Button
                            type="submit"
                            className="h-12 w-full bg-emerald-600 hover:bg-emerald-700 text-base font-bold gap-2 mt-2 shadow-md transition-all hover:shadow-lg"
                            disabled={isLoading || !username || !password}
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
