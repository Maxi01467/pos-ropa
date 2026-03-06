import { ShoppingCart, Package, Wallet, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

const quickLinks = [
    {
        href: "/nueva-venta",
        label: "Nueva Venta",
        description: "Iniciar una venta",
        icon: ShoppingCart,
        color: "text-emerald-600",
        bg: "bg-emerald-50",
    },
    {
        href: "/inventario",
        label: "Inventario",
        description: "Gestionar productos",
        icon: Package,
        color: "text-blue-600",
        bg: "bg-blue-50",
    },
    {
        href: "/caja",
        label: "Caja",
        description: "Flujo de dinero",
        icon: Wallet,
        color: "text-amber-600",
        bg: "bg-amber-50",
    },
];

export default function InicioPage() {
    return (
        <div className="p-6 lg:p-10">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">
                    ¡Buen día! 👋
                </h1>
                <p className="mt-1 text-lg text-muted-foreground">
                    Bienvenida a tu Punto de Venta
                </p>
            </div>

            {/* Quick Stats */}
            <div className="mb-8 grid gap-4 sm:grid-cols-3">
                <Card>
                    <CardContent className="flex items-center gap-4 p-5">
                        <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-50">
                            <TrendingUp className="size-6 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Ventas hoy</p>
                            <p className="text-2xl font-bold">$0</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-5">
                        <div className="flex size-12 items-center justify-center rounded-xl bg-blue-50">
                            <ShoppingCart className="size-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Operaciones</p>
                            <p className="text-2xl font-bold">0</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-5">
                        <div className="flex size-12 items-center justify-center rounded-xl bg-amber-50">
                            <Wallet className="size-6 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Caja</p>
                            <p className="text-lg font-semibold text-muted-foreground">Cerrada</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Access */}
            <h2 className="mb-4 text-xl font-semibold">Accesos rápidos</h2>
            <div className="grid gap-4 sm:grid-cols-3">
                {quickLinks.map((link) => {
                    const Icon = link.icon;
                    return (
                        <Link key={link.href} href={link.href}>
                            <Card className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30">
                                <CardContent className="flex items-center gap-4 p-6">
                                    <div
                                        className={`flex size-14 items-center justify-center rounded-xl ${link.bg}`}
                                    >
                                        <Icon className={`size-7 ${link.color}`} />
                                    </div>
                                    <div>
                                        <p className="text-lg font-semibold">{link.label}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {link.description}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
