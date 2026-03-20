import Link from "next/link";
import {
    ArrowRight,
    CalendarCheck,
    Clock3,
    Package,
    ReceiptText,
    ShoppingCart,
    TrendingUp,
    UserPlus,
    Users,
    Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const teamMembers = [
    { name: "Brenda", initials: "BR" },
    { name: "Lucia", initials: "LU" },
    { name: "Mica", initials: "MI" },
    { name: "Sofi", initials: "SO" },
];

const boardColumns = [
    {
        title: "Prioridad de hoy",
        badge: "3",
        items: [
            {
                title: "Abrir caja",
                description: "Definir fondo inicial y habilitar ventas.",
                icon: Wallet,
                href: "/caja",
                gradient: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
            },
            {
                title: "Revisar stock critico",
                description: "Controlar faltantes antes de arrancar.",
                icon: Package,
                href: "/stock",
                gradient: "linear-gradient(135deg, #6d28d9 0%, #4338ca 100%)",
            },
        ],
    },
    {
        title: "En curso",
        badge: "2",
        items: [
            {
                title: "Ventas en mostrador",
                description: "Cobros rapidos y emision de tickets.",
                icon: ShoppingCart,
                href: "/nueva-venta",
                gradient: "linear-gradient(135deg, #059669 0%, #065f46 100%)",
            },
            {
                title: "Asistencia del turno",
                description: "Validar quienes ya ficharon ingreso.",
                icon: Clock3,
                href: "/asistencia",
                gradient: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)",
            },
        ],
    },
    {
        title: "Control",
        badge: "2",
        items: [
            {
                title: "Historial de caja",
                description: "Ver tickets y movimientos del dia.",
                icon: ReceiptText,
                href: "/boletas",
                gradient: "linear-gradient(135deg, #e11d48 0%, #9f1239 100%)",
            },
            {
                title: "Equipo",
                description: "Altas, bajas y permisos de usuarios.",
                icon: Users,
                href: "/empleados",
                gradient: "linear-gradient(135deg, #334155 0%, #0f172a 100%)",
            },
        ],
    },
];

const miniWidgets = [
    {
        title: "Caja",
        value: "Cerrada",
        detail: "Abrila para habilitar ventas",
    },
    {
        title: "Ventas hoy",
        value: "$0",
        detail: "Sin operaciones registradas",
    },
    {
        title: "Asistencia",
        value: "0/0",
        detail: "Todavia sin fichajes activos",
    },
    {
        title: "Pendientes",
        value: "2",
        detail: "Stock y apertura de caja",
    },
];

const quickLinks = [
    {
        href: "/nueva-venta",
        label: "Nueva venta",
        description: "Cobro rapido en mostrador",
        icon: ShoppingCart,
        gradient: "linear-gradient(135deg, #059669 0%, #065f46 100%)",
    },
    {
        href: "/inventario",
        label: "Inventario",
        description: "Productos y precios",
        icon: Package,
        gradient: "linear-gradient(135deg, #6d28d9 0%, #4338ca 100%)",
    },
    {
        href: "/arqueos",
        label: "Arqueos",
        description: "Cierres y diferencias",
        icon: CalendarCheck,
        gradient: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)",
    },
];

export default function InicioPage() {
    return (
        <main className="flex-1 overflow-auto p-4 sm:p-5 lg:p-6">
            <div className="flex w-full flex-col gap-5">
                <section className="flex flex-col gap-5 rounded-[2rem] border border-border/70 bg-card/85 p-5 shadow-[0_20px_60px_-36px_rgba(0,0,0,0.32)] sm:p-6">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="space-y-3">
                            <div className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#ea580c_0%,#c2410c_100%)] px-3 py-1 text-xs font-medium text-orange-50 shadow-[0_12px_24px_-18px_rgba(194,65,12,0.8)]">
                                <TrendingUp className="size-3.5" />
                                Panel principal
                            </div>
                            <div className="space-y-2">
                                <h1 className="text-3xl font-semibold tracking-[-0.06em] sm:text-4xl">
                                    Dashboard GangaFits
                                </h1>
                                <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                                    Una vista de control para empezar el dia con foco en ventas,
                                    caja, equipo y tareas de operacion.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                            <div className="text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-2">
                                    <span className="size-2 rounded-full bg-emerald-500" />
                                    Ultima actualizacion hace instantes
                                </span>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex -space-x-2">
                                    {teamMembers.map((member) => (
                                        <Avatar
                                            key={member.name}
                                            className="size-9 border-2 border-background"
                                        >
                                            <AvatarFallback title={member.name}>
                                                {member.initials}
                                            </AvatarFallback>
                                        </Avatar>
                                    ))}
                                    <Avatar className="size-9 border-2 border-background bg-muted">
                                        <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
                                            +2
                                        </AvatarFallback>
                                    </Avatar>
                                </div>

                                <button
                                    className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium text-white shadow-[0_20px_34px_-22px_rgba(0,0,0,0.85)]"
                                    style={{
                                        background: "linear-gradient(135deg, #18181b 0%, #3f3f46 100%)",
                                    }}
                                    type="button"
                                >
                                    Accion rapida
                                    <UserPlus className="size-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-12 xl:col-span-7">
                            <Card className="h-full rounded-[1.75rem] border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(244,244,246,0.92))] shadow-none dark:bg-[linear-gradient(180deg,rgba(24,24,27,0.92),rgba(16,16,20,0.96))]">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                                                Operacion
                                            </p>
                                            <CardTitle className="mt-2 text-2xl font-semibold tracking-[-0.05em]">
                                                Tablero del turno
                                            </CardTitle>
                                        </div>
                                        <div className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs text-muted-foreground">
                                            7 items
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid gap-4 md:grid-cols-3">
                                        {boardColumns.map((column) => (
                                            <div
                                                key={column.title}
                                                className="rounded-[1.5rem] border border-border/70 bg-card/80 p-4"
                                            >
                                                <div className="mb-4 flex items-center justify-between">
                                                    <h3 className="text-sm font-semibold">
                                                        {column.title}
                                                    </h3>
                                                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                                        {column.badge}
                                                    </span>
                                                </div>

                                                <div className="space-y-3">
                                                    {column.items.map((item) => {
                                                        const Icon = item.icon;
                                                        return (
                                                            <Link key={item.title} href={item.href}>
                                                                <div className="group rounded-[1.25rem] border border-border/70 bg-background/85 p-4 transition hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-[0_18px_28px_-24px_rgba(0,0,0,0.4)]">
                                                                    <div className="mb-4 flex items-start justify-between gap-3">
                                                                        <div
                                                                            className="flex size-10 items-center justify-center rounded-2xl text-white"
                                                                            style={{ background: item.gradient }}
                                                                        >
                                                                            <Icon className="size-4.5" />
                                                                        </div>
                                                                        <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground" />
                                                                    </div>
                                                                    <h4 className="text-sm font-medium">
                                                                        {item.title}
                                                                    </h4>
                                                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                                                        {item.description}
                                                                    </p>
                                                                </div>
                                                            </Link>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="col-span-12 space-y-4 xl:col-span-5">
                            <Card className="rounded-[1.75rem] border-border/70 bg-neutral-950 text-white shadow-[0_24px_60px_-34px_rgba(0,0,0,0.65)]">
                                <CardContent className="p-6">
                                    <p className="text-xs uppercase tracking-[0.22em] text-white/55">
                                        Snapshot
                                    </p>
                                    <h3 className="mt-3 text-2xl font-semibold tracking-[-0.05em]">
                                        Todo listo para abrir y vender.
                                    </h3>
                                    <p className="mt-3 text-sm leading-6 text-white/65">
                                        Priorizá apertura de caja, asistencia y control rapido de
                                        stock antes de empezar la jornada.
                                    </p>

                                    <div className="mt-6 grid grid-cols-2 gap-3">
                                        {miniWidgets.map((widget) => (
                                            <div
                                                key={widget.title}
                                                className="rounded-[1.25rem] border border-white/10 bg-white/6 p-4"
                                            >
                                                <p className="text-xs uppercase tracking-[0.18em] text-white/45">
                                                    {widget.title}
                                                </p>
                                                <p className="mt-3 text-2xl font-semibold">
                                                    {widget.value}
                                                </p>
                                                <p className="mt-2 text-xs leading-5 text-white/60">
                                                    {widget.detail}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                                <Card className="rounded-[1.5rem] border-border/70 bg-card/90 shadow-none">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-lg">Accesos rapidos</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2">
                                        {quickLinks.map((link) => {
                                            const Icon = link.icon;
                                            return (
                                                <Link key={link.href} href={link.href}>
                                                    <div className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-background/85 px-4 py-3 transition hover:border-foreground/15 hover:shadow-[0_16px_28px_-24px_rgba(0,0,0,0.32)]">
                                                        <div
                                                            className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white"
                                                            style={{ background: link.gradient }}
                                                        >
                                                            <Icon className="size-4" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-medium">
                                                                {link.label}
                                                            </p>
                                                            <p className="text-sm text-muted-foreground">
                                                                {link.description}
                                                            </p>
                                                        </div>
                                                        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground" />
                                                    </div>
                                                </Link>
                                            );
                                        })}
                                    </CardContent>
                                </Card>

                                <Card className="rounded-[1.5rem] border-border/70 bg-card/90 shadow-none">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-lg">Notas del turno</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3 text-sm text-muted-foreground">
                                        <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
                                            Confirmar apertura de caja antes de habilitar ventas.
                                        </div>
                                        <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
                                            Revisar faltantes de temporada y ultimos ingresos.
                                        </div>
                                        <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
                                            Verificar fichajes del equipo del turno manana.
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}
