import {
    AlertTriangle,
    CalendarCheck,
    ClipboardList,
    ReceiptText,
    Shirt,
    TrendingDown,
    TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatArgentinaDateTime } from "@/lib/core/datetime";
import { getDashboardData } from "@/app/actions/dashboard";
import { CashStatusBanner } from "@/components/dashboard/cash-status-banner";
import { QuickActionsGrid } from "@/components/dashboard/quick-actions-grid";
import SalesChart from "@/components/dashboard/sales-chart";

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

export default async function InicioPage() {
    const data = await getDashboardData();
    
    const dateLabel = (() => {
        const formatted = formatArgentinaDateTime(new Date(), {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: undefined,
            minute: undefined,
        });

        return capitalize(formatted);
    })();

    const kpis = [
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
            detail: "Unidades del dia",
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
    ];

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

                        {/* Banner reactivo cliente (Caja abierta/cerrada) */}
                        <CashStatusBanner />
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
                                    <SalesChart salesData={data.chartData} />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="relative overflow-hidden rounded-3xl border-border/70 bg-gradient-to-br from-primary/5 via-card/88 to-card/88 shadow-[0_20px_60px_-42px_rgba(0,0,0,0.35)]">
                            <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
                            <CardHeader className="relative z-10 pb-3">
                                <CardTitle className="text-xl">Acciones rapidas</CardTitle>
                            </CardHeader>
                            <CardContent className="relative z-10">
                                {/* Grid de acciones rápidas cliente filtradas por permisos */}
                                <QuickActionsGrid />
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
