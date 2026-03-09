// src/components/route-guard.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

export function RouteGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        // Revisamos si existe la llave de sesión en el navegador
        const session = localStorage.getItem("pos_session");
        
        if (!session && pathname !== "/login") {
            // Si no hay sesión y no está en la página de login, lo pateamos afuera
            router.push("/login");
        } else {
            // Si todo está bien, lo dejamos pasar
            setIsAuthorized(true);
        }
    }, [router, pathname]);

    // Mientras revisa (que es instantáneo), mostramos un loader en vez de la pantalla
    if (!isAuthorized) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="size-10 animate-spin text-emerald-600" />
            </div>
        );
    }

    return <>{children}</>;
}