// src/app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Store, Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        // Simulamos la consulta a la base de datos (luego lo conectamos con Prisma)
        setTimeout(() => {
            // Por ahora, el usuario es "admin" y la contra "1234"
            if (username.toLowerCase().trim() === "admin" && password === "1234") {
                // Guardamos una "llave" temporal en el navegador
                localStorage.setItem("pos_session", "true");
                localStorage.setItem("pos_user", username);
                
                toast.success("¡Acceso concedido!");
                router.push("/"); // Redirigimos al sistema
            } else {
                toast.error("Usuario o contraseña incorrectos");
                setIsLoading(false);
            }
        }, 800);
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
            {/* Fondo decorativo sutil */}
            <div className="absolute inset-0 z-0 bg-grid-black/[0.02] bg-[size:20px_20px]" />
            
            <Card className="z-10 w-full max-w-[400px] shadow-2xl border-border/50">
                <CardHeader className="space-y-3 pb-6 text-center">
                    <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
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
                                placeholder="••••" 
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