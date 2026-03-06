import { Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InventarioPage() {
    return (
        <div className="p-6 lg:p-10">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
                        Inventario
                    </h1>
                    <p className="mt-1 text-muted-foreground">
                        Gestioná tus productos y stock
                    </p>
                </div>
                <Button size="lg" className="gap-2">
                    <Plus className="size-5" />
                    Nuevo Producto
                </Button>
            </div>

            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-20 text-center">
                <Package className="mb-4 size-16 text-muted-foreground/30" />
                <p className="text-xl font-medium text-muted-foreground">
                    Próximamente
                </p>
                <p className="mt-1 text-sm text-muted-foreground/70">
                    Acá vas a poder agregar, editar y gestionar todos tus productos
                </p>
            </div>
        </div>
    );
}
