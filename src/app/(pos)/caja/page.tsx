import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CajaPage() {
    return (
        <div className="flex min-h-[80vh] flex-col items-center justify-center p-6 text-center">
            <div className="flex size-24 items-center justify-center rounded-2xl bg-emerald-50 mb-6">
                <Wallet className="size-12 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">
                Caja del Día
            </h1>
            <p className="mb-8 text-muted-foreground max-w-sm">
                La caja está cerrada. Abrila para empezar a registrar movimientos de
                dinero.
            </p>
            <Button
                size="lg"
                className="h-16 px-12 bg-emerald-600 text-xl font-bold hover:bg-emerald-700 shadow-lg"
            >
                ▶️ Abrir Caja del Día
            </Button>
        </div>
    );
}
