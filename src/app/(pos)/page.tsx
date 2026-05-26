"use client";

import { useMemo, useEffect, useState } from "react";
import Link from "next/link";
import {
    AlertTriangle,
    ArrowRight,
    CalendarCheck,
    ClipboardList,
    Package,
    ReceiptText,
    Shirt,
    ShoppingCart,
    Users,
    Wallet,
    TrendingUp,
    TrendingDown,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCashSessionStatus } from "@/lib/session/cash-session-client";
import { canAccessPath } from "@/lib/core/permissions";
import { formatArgentinaDateTime } from "@/lib/core/datetime";
import { useSessionSnapshot } from "@/lib/session/session-client";
import { useTerminalSnapshot } from "@/lib/terminal/terminal-client";
import { getDashboardData } from "@/app/actions/dashboard";

const defaultKpis = [
    {
        title: "Ventas de hoy",
        value: "$0",
        detail: "Sin ventas registradas",
        icon: ReceiptText,
        trend: "+0%",
        trendUp: true,
    },
    {
        title: "Articulos vendidos",
        value: "0",
        detail: "Unidades del dia",
        icon: Shirt,
        trend: "+0%",
        trendUp: true,
    },
    {
        title: "Ticket promedio",
        value: "$0",
        detail: "Promedio por venta",
        icon: ClipboardList,
        trend: "+0%",
        trendUp: true,
    },
    {
        title: "Estado de asistencia",
        value: "Pendiente",
        detail: "Revisar fichajes del turno",
        icon: CalendarCheck,
    },
];

const quickActions = [
    {
        href: "/nueva-venta",
        label: "Nueva Venta",
        description: "Registrar una venta en mostrador",
        icon: ShoppingCart,
        primary: true,
    },
    {
        href: "/caja",
        label: "Caja",
        description: "Abrir, cerrar o revisar la caja",
        icon: Wallet,
        primary: false,
    },
    {
        href: "/asistencia",
        label: "Asistencia",
        description: "Fichajes y equipo del turno",
        icon: Users,
        primary: false,
    },
    {
        href: "/inventario",
        label: "Inventario",
        description: "Productos, precios y codigos",
        icon: Package,
        primary: false,
    },
    {
        href: "/stock",
        label: "Stock",
        description: "Movimientos y faltantes",
        icon: Shirt,
        primary: false,
    },
    {
        href: "/caja?tab=historial",
        label: "Boletas",
        description: "Tickets y operaciones recientes",
        icon: ReceiptText,
        primary: false,
    },
] as const;

const alerts = [
    {
        title: "Stock critico de remeras",
        detail: "Revisar talles S y M antes del cierre.",
        tone: "warning",
    },
    {
        title: "Caja pendiente",
        detail: "Confirmar fondo inicial al iniciar el turno.",
        tone: "neutral",
    },
] as const;

const shiftNotes = [
    "Separar pedidos pendientes antes de las 18:00.",
    "Controlar percheros de temporada y completar talles visibles.",
    "Verificar que todas las ventas queden con medio de pago correcto.",
] as const;

function capitalize(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

const compactCurrencyFormatter = new Intl.NumberFormat("es-AR", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
});

export default function InicioPage() {
    const { hasOpenCashSession } = useCashSessionStatus();
    const session = useSessionSnapshot();
    const terminal = useTerminalSnapshot();
    
    const [kpis, setKpis] = useState(defaultKpis);
    const [salesData, setSalesData] = useState<{ time: string; ventas: number }[]>([]);

    useEffect(() => {
        getDashboardData().then((data) => {
            setKpis([
                {
                    title: "Ventas de hoy",
                    value: "$" + data.kpis.revenueToday.toLocaleString("es-AR"),
                    detail: "Recaudación del día",
                    icon: ReceiptText,
                    trend: data.kpis.revenueTrend.value,
                    trendUp: data.kpis.revenueTrend.isUp,
                },
                {
                    title: "Articulos vendidos",
                    value: data.kpis.itemsToday.toString(),
                    detail: "Unidades del día",
                    icon: Shirt,
                    trend: data.kpis.itemsTrend.value,
                    trendUp: data.kpis.itemsTrend.isUp,
                },
                {
                    title: "Ticket promedio",
                    value: "$" + Math.round(data.kpis.ticketToday).toLocaleString("es-AR"),
                    detail: "Promedio por venta",
                    icon: ClipboardList,
                    trend: data.kpis.ticketTrend.value,
                    trendUp: data.kpis.ticketTrend.isUp,
                },
                {
                    title: "Estado de asistencia",
                    value: "Pendiente",
                    detail: "Revisar fichajes del turno",
                    icon: CalendarCheck,
                },
            ]);
            setSalesData(data.chartData);
        }).catch(console.error);
    }, []);
    const dateLabel = useMemo(() => {
        const formatted = formatArgentinaDateTime(new Date(), {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: undefined,
            minute: undefined,
        });

        return capitalize(formatted);
    }, []);

    const cashStatus = useMemo(() => {
        if (hasOpenCashSession === true) {
            return {
                label: "Caja abierta",
                detail: "Ventas habilitadas",
                className:
                    "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200",
                dotClassName: "bg-emerald-500",
            };
        }

        if (hasOpenCashSession === false) {
            return {
                label: "Caja cerrada",
                detail: "Abrir caja para vender",
                className:
                    "border-amber-500/30 bg-amber-500/12 text-amber-700 dark:text-amber-200",
                dotClassName: "bg-amber-500",
            };
        }

        return {
            label: "Verificando caja",
            detail: "Consultando estado",
            className: "border-border bg-muted/60 text-muted-foreground",
            dotClassName: "bg-muted-foreground",
        };
    }, [hasOpenCashSession]);

    const visibleQuickActions = useMemo(() => {
        if (!session.role) {
            return [];
        }

        const role = session.role;
        const isDesktop =
            terminal.isDesktop ||
            (typeof window !== "undefined" && Boolean(window.posDesktop));

        return quickActions.filter((action) =>
            canAccessPath(role, action.href, { isDesktop })
        );
    }, [session.role, terminal.isDesktop]);

    return (
        <main className="flex-1 overflow-auto p-4 sm:p-5 lg:p-6">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
                <section className="relative overflow-hidden flex flex-col gap-4 rounded-3xl border border-border/70 bg-gradient-to-br from-primary/5 via-card/88 to-card/88 p-5 shadow-[0_20px_60px_-42px_rgba(0,0,0,0.35)] sm:p-6">
                    <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
                    
                    <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">
                                {dateLabel}
                            </p>
                            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                                Hola, buen turno
                            </h1>
                        </div>

                        <div
                            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${cashStatus.className}`}
                        >
                            <span className={`size-3 rounded-full ${cashStatus.dotClassName}`} />
                            <div>
                                <p className="text-sm font-semibold">{cashStatus.label}</p>
                                <p className="text-xs opacity-80">{cashStatus.detail}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {kpis.map((item) => {
                            const Icon = item.icon;

                            return (
                                <Card key={item.title} className="rounded-2xl border-border/70 shadow-none">
                                    <CardContent className="flex min-h-[132px] flex-col justify-between p-5">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-medium text-muted-foreground">
                                                {item.title}
                                            </p>
                                            <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-foreground">
                                                <Icon className="size-4.5" />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex items-baseline gap-2">
                                                <p className="text-3xl font-semibold tracking-tight">
                                                    {item.value}
                                                </p>
                                                {'trend' in item && (
                                                    <span className={`flex items-center text-xs font-semibold ${item.trendUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                                        {item.trendUp ? <TrendingUp className="mr-1 size-3" /> : <TrendingDown className="mr-1 size-3" />}
                                                        {item.trend}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                {item.detail}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </section>

                <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="flex flex-col gap-5">
                        <Card className="relative overflow-hidden rounded-3xl border-border/70 bg-gradient-to-br from-primary/5 via-card/88 to-card/88 shadow-[0_20px_60px_-42px_rgba(0,0,0,0.35)]">
                            <div className="absolute -bottom-24 -right-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
                            <CardHeader className="relative z-10 pb-3">
                                <CardTitle className="text-xl">Ventas por hora</CardTitle>
                            </CardHeader>
                            <CardContent className="relative z-10">
                                <div className="h-[240px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={salesData} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                                            <XAxis 
                                                dataKey="time" 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} 
                                                dy={10}
                                            />
                                            <YAxis 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} 
                                                tickFormatter={(value) => `$${compactCurrencyFormatter.format(Number(value))}`}
                                                tickMargin={8}
                                                width={72}
                                            />
                                            <Tooltip 
                                                contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
                                            />
                                            <Area 
                                                type="monotone" 
                                                dataKey="ventas" 
                                                stroke="var(--primary)" 
                                                strokeWidth={2}
                                                fillOpacity={1} 
                                                fill="url(#colorVentas)" 
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="relative overflow-hidden rounded-3xl border-border/70 bg-gradient-to-br from-primary/5 via-card/88 to-card/88 shadow-[0_20px_60px_-42px_rgba(0,0,0,0.35)]">
                            <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
                            <CardHeader className="relative z-10 pb-3">
                                <CardTitle className="text-xl">Acciones rapidas</CardTitle>
                            </CardHeader>
                            <CardContent className="relative z-10">
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {visibleQuickActions.map((action) => {
                                    const Icon = action.icon;

                                    return (
                                        <Link key={action.href} href={action.href} className="group">
                                            <div
                                                className={
                                                    action.primary
                                                        ? "flex min-h-[156px] flex-col justify-between rounded-2xl bg-foreground p-5 text-background shadow-[0_22px_42px_-30px_rgba(0,0,0,0.65)] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:shadow-foreground/20"
                                                        : "flex min-h-[156px] flex-col justify-between rounded-2xl border border-border/70 bg-background/85 p-5 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-foreground/15 hover:shadow-lg hover:shadow-foreground/5"
                                                }
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div
                                                        className={
                                                            action.primary
                                                                ? "flex size-12 items-center justify-center rounded-xl bg-background/14"
                                                                : "flex size-12 items-center justify-center rounded-xl bg-muted"
                                                        }
                                                    >
                                                        <Icon className="size-5" />
                                                    </div>
                                                    <ArrowRight className="size-5 transition group-hover:translate-x-1" />
                                                </div>
                                                <div>
                                                    <p className="text-lg font-semibold">{action.label}</p>
                                                    <p
                                                        className={
                                                            action.primary
                                                                ? "mt-2 text-sm leading-6 text-background/72"
                                                                : "mt-2 text-sm leading-6 text-muted-foreground"
                                                        }
                                                    >
                                                        {action.description}
                                                    </p>
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                    </div>

                    <aside className="flex flex-col gap-5">
                        <Card className="relative overflow-hidden rounded-3xl border-border/70 bg-gradient-to-br from-primary/5 via-card/88 to-card/88 shadow-[0_20px_60px_-42px_rgba(0,0,0,0.35)]">
                            <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
                            <CardHeader className="relative z-10 pb-3">
                                <div className="flex items-center justify-between gap-3">
                                    <CardTitle className="text-xl">Alertas</CardTitle>
                                    <Badge variant="secondary">{alerts.length}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="relative z-10 space-y-3">
                                {alerts.map((alert) => (
                                    <div
                                        key={alert.title}
                                        className="rounded-2xl border border-border/70 bg-background/85 p-4"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div
                                                className={
                                                    alert.tone === "warning"
                                                        ? "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/14 text-amber-700 dark:text-amber-200"
                                                        : "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
                                                }
                                            >
                                                <AlertTriangle className="size-4" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold">{alert.title}</p>
                                                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                                                    {alert.detail}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card className="relative overflow-hidden rounded-3xl border-border/70 bg-gradient-to-br from-primary/5 via-card/88 to-card/88 shadow-[0_20px_60px_-42px_rgba(0,0,0,0.35)]">
                            <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
                            <CardHeader className="relative z-10 pb-3">
                                <CardTitle className="text-xl">Notas del turno</CardTitle>
                            </CardHeader>
                            <CardContent className="relative z-10 space-y-3">
                                {shiftNotes.map((note) => (
                                    <div
                                        key={note}
                                        className="rounded-2xl border border-border/70 bg-background/85 p-4 text-sm leading-6 text-muted-foreground"
                                    >
                                        {note}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </aside>
                </section>
            </div>
        </main>
    );
}
