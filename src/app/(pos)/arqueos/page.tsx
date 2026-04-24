"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ClipboardList,
    Loader2,
    CheckCircle2,
    Clock,
    DollarSign,
    BadgeCheck,
    CircleAlert,
    TrendingUp,
    CalendarDays,
    User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/core/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CACHE_TAGS } from "@/lib/core/cache-tags";
import { notifyDataUpdated, useDataRefresh } from "@/lib/sync/data-sync-client";
import {
    getCashHistoryRuntime,
    type CashHistorySeller as Seller,
    type CashHistorySession as CashSession,
} from "@/lib/offline/cash-history-runtime";

const CLOSED_ARQUEOS_PER_PAGE = 8;

function formatCurrency(amount: number | null | undefined): string {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 0,
    }).format(Number(amount) || 0);
}

function calcCashTotals(session: CashSession) {
    const cashFromSales = session.sales.reduce((s, sale) => s + (sale.cashAmount ?? 0), 0);
    const manualIn = session.movements.filter((m) => m.type === "INGRESO").reduce((s, m) => s + m.amount, 0);
    const manualOut = session.movements.filter((m) => m.type === "EGRESO").reduce((s, m) => s + m.amount, 0);
    return { cashFromSales, manualIn, manualOut };
}

export default function ArqueosPage() {
    const cashHistoryRuntime = useMemo(() => getCashHistoryRuntime(), []);
    const [pending, setPending] = useState<CashSession[]>([]);
    const [closed, setClosed] = useState<CashSession[]>([]);
    const [sellers, setSellers] = useState<Seller[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentClosedPage, setCurrentClosedPage] = useState(1);

    // Dialog state
    const [arqueoDialogSession, setArqueoDialogSession] = useState<CashSession | null>(null);
    const [actualAmount, setActualAmount] = useState("");
    const [countedById, setCountedById] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [p, c, s] = await Promise.all([
                cashHistoryRuntime.getPendingCountSessions(),
                cashHistoryRuntime.getClosedSessions(20),
                cashHistoryRuntime.getSellers(),
            ]);
            setPending(p);
            setClosed(c);
            setSellers(s);
            if (s.length > 0) setCountedById(s[0].id);
        } catch {
            toast.error("Error al cargar los arqueos");
        } finally {
            setIsLoading(false);
        }
    }, [cashHistoryRuntime]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useDataRefresh([CACHE_TAGS.cash, CACHE_TAGS.sales, CACHE_TAGS.employees], loadData, {
        pollIntervalMs: false,
    });

    const totalClosedPages = Math.max(1, Math.ceil(closed.length / CLOSED_ARQUEOS_PER_PAGE));
    const paginatedClosed = useMemo(() => {
        const start = (currentClosedPage - 1) * CLOSED_ARQUEOS_PER_PAGE;
        return closed.slice(start, start + CLOSED_ARQUEOS_PER_PAGE);
    }, [closed, currentClosedPage]);

    useEffect(() => {
        if (currentClosedPage > totalClosedPages) {
            setCurrentClosedPage(totalClosedPages);
        }
    }, [currentClosedPage, totalClosedPages]);

    const handleOpenArqueoDialog = (session: CashSession) => {
        setArqueoDialogSession(session);
        setActualAmount("");
    };

    const handleSubmitArqueo = useCallback(async () => {
        if (!arqueoDialogSession) return;
        if (actualAmount === "" || isNaN(Number(actualAmount))) {
            return toast.error("Ingresá el monto real que contaste");
        }
        if (!countedById) {
            return toast.error("Seleccioná quien realizó el arqueo");
        }
        setIsSaving(true);
        try {
            await cashHistoryRuntime.submitArqueo(
                arqueoDialogSession.id,
                Number(actualAmount),
                countedById
            );
            notifyDataUpdated(CACHE_TAGS.cash);
            toast.success("Arqueo registrado correctamente");
            setArqueoDialogSession(null);
            setActualAmount("");
            await loadData();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al registrar el arqueo");
        } finally {
            setIsSaving(false);
        }
    }, [actualAmount, arqueoDialogSession, cashHistoryRuntime, countedById, loadData]);

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-6">
                <div className="rounded-[1.75rem] border border-border/70 bg-card/90 px-10 py-8 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="rounded-2xl bg-[linear-gradient(135deg,#ea580c_0%,#c2410c_100%)] p-3 text-orange-50">
                            <Loader2 className="size-6 animate-spin" />
                        </div>
                        <div>
                            <p className="text-base font-semibold text-foreground">Cargando arqueos</p>
                            <p className="text-sm text-muted-foreground">
                                Estamos trayendo pendientes e historial.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in p-4 duration-300 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-orange-900/25 bg-[linear-gradient(135deg,rgba(234,88,12,0.18),rgba(194,65,12,0.08))] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-800 dark:text-orange-100">
                            <ClipboardList className="size-3.5" />
                            Arqueos
                        </div>
                        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-3xl">
                            Cierre y conteo
                        </h1>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <div className="rounded-[1.1rem] border border-orange-900/20 bg-[linear-gradient(135deg,rgba(234,88,12,0.14),rgba(194,65,12,0.04))] px-4 py-3 shadow-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-800/80 dark:text-orange-100/80">
                                Pendientes
                            </p>
                            <p className="mt-1 text-xl font-semibold text-foreground">{pending.length}</p>
                        </div>
                        <div className="rounded-[1.1rem] border border-border/70 bg-card/90 px-4 py-3 shadow-sm">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                                Cerrados
                            </p>
                            <p className="mt-1 text-xl font-semibold text-foreground">{closed.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Pendientes ─── */}
            <section className="mb-10 mt-5">
                <div className="mb-4 flex items-center gap-3">
                    <h2 className="text-xl font-semibold">Pendientes de arqueo</h2>
                    {pending.length > 0 && (
                        <Badge className="border-orange-900/25 bg-orange-900 text-orange-100 hover:bg-orange-900">
                            {pending.length} pendiente{pending.length !== 1 ? "s" : ""}
                        </Badge>
                    )}
                </div>

                {pending.length === 0 ? (
                    <Card className="rounded-[1.5rem] border-dashed border-border/80 bg-card/92 shadow-sm">
                        <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                            <CheckCircle2 className="mb-3 size-10 text-emerald-400" />
                            <p className="font-medium">Todo al día</p>
                            <p className="text-sm">No hay cajas pendientes de arqueo.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {pending.map((s) => {
                            const { cashFromSales, manualIn, manualOut } = calcCashTotals(s);
                            return (
                                <Card
                                    key={s.id}
                                    className="rounded-[1.5rem] border-orange-900/20 bg-[linear-gradient(135deg,rgba(234,88,12,0.12),rgba(194,65,12,0.04))] shadow-sm transition-shadow hover:shadow-md"
                                >
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <CardTitle className="text-base">
                                                    {format(new Date(s.openingDate), "EEEE d 'de' MMMM", { locale: es })}
                                                </CardTitle>
                                                <CardDescription className="mt-1 flex items-center gap-1 text-xs">
                                                    <Clock className="size-3" />
                                                    {format(new Date(s.openingDate), "HH:mm")} →{" "}
                                                    {s.closingDate
                                                        ? format(new Date(s.closingDate), "HH:mm")
                                                        : "?"}
                                                </CardDescription>
                                            </div>
                                            <Badge className="border-orange-900/25 bg-orange-900 text-orange-100 hover:bg-orange-900 text-xs">
                                                Sin arquear
                                            </Badge>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="rounded-lg bg-white border p-3 space-y-1.5 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Ventas en efectivo</span>
                                                <span className="font-medium">{formatCurrency(cashFromSales)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Ingresos manuales</span>
                                                <span className="font-medium text-emerald-600">+{formatCurrency(manualIn)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Retiros manuales</span>
                                                <span className="font-medium text-rose-600">-{formatCurrency(manualOut)}</span>
                                            </div>
                                            <div className="flex justify-between border-t pt-1.5 font-semibold">
                                                <span>Efectivo esperado</span>
                                                <span className="text-emerald-700">{formatCurrency(s.expectedAmount)}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <User className="size-3" />
                                            Cerrada por {s.closedBy?.name ?? "—"}
                                        </div>
                                        <Button
                                            className="w-full bg-orange-700 hover:bg-orange-800 text-white"
                                            onClick={() => handleOpenArqueoDialog(s)}
                                        >
                                            Hacer Arqueo
                                        </Button>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* ─── Historial ─── */}
            <section>
                <h2 className="mb-4 text-xl font-semibold">Historial de arqueos</h2>
                {closed.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay arqueos completados aún.</p>
                ) : (
                    <div className="space-y-3">
                        {paginatedClosed.map((s) => {
                            const diff = s.difference ?? 0;
                            const isExact = diff === 0;
                            const isSurplus = diff > 0;
                            return (
                                <Card key={s.id} className="rounded-[1.5rem] border-border/70 bg-card/92 shadow-sm">
                                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-center gap-4">
                                            <div
                                                className={cn(
                                                    "flex size-10 shrink-0 items-center justify-center rounded-full",
                                                    isExact
                                                        ? "bg-emerald-900 text-emerald-100"
                                                        : isSurplus
                                                          ? "bg-orange-900 text-orange-100"
                                                          : "bg-rose-900 text-rose-100"
                                                )}
                                            >
                                                {isExact ? (
                                                    <BadgeCheck className="size-5" />
                                                ) : isSurplus ? (
                                                    <TrendingUp className="size-5" />
                                                ) : (
                                                    <CircleAlert className="size-5" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-sm">
                                                    {format(new Date(s.openingDate), "EEEE d/MM/yyyy", { locale: es })}
                                                </p>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <CalendarDays className="size-3" />
                                                    Arqueo:{" "}
                                                    {s.countingDate
                                                        ? format(new Date(s.countingDate), "dd/MM HH:mm")
                                                        : "—"}
                                                    {s.countedBy && ` · por ${s.countedBy.name}`}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6 sm:gap-8">
                                            <div className="text-right">
                                                <p className="text-xs text-muted-foreground">Esperado</p>
                                                <p className="font-semibold text-sm">{formatCurrency(s.expectedAmount)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-muted-foreground">Contado</p>
                                                <p className="font-semibold text-sm">{formatCurrency(s.actualAmount)}</p>
                                            </div>
                                            <div className="text-right min-w-[80px]">
                                                <p className="text-xs text-muted-foreground">Diferencia</p>
                                                <p
                                                    className={cn(
                                                        "font-bold text-sm",
                                                        isExact
                                                            ? "text-emerald-800 dark:text-emerald-100"
                                                            : isSurplus
                                                              ? "text-orange-800 dark:text-orange-100"
                                                              : "text-rose-800 dark:text-rose-100"
                                                    )}
                                                >
                                                    {isExact
                                                        ? "Exacto"
                                                        : `${isSurplus ? "+" : "-"}${formatCurrency(Math.abs(diff))}`}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                        <div className="flex flex-col gap-3 rounded-[1.25rem] border border-border/70 bg-card/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm text-muted-foreground">
                                Página {currentClosedPage} de {totalClosedPages} · {closed.length} arqueo(s)
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setCurrentClosedPage((page) => Math.max(1, page - 1))}
                                    disabled={currentClosedPage === 1}
                                >
                                    Anterior
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setCurrentClosedPage((page) => Math.min(totalClosedPages, page + 1))}
                                    disabled={currentClosedPage === totalClosedPages}
                                >
                                    Siguiente
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* ─── Dialog de Arqueo ─── */}
            <Dialog
                open={Boolean(arqueoDialogSession)}
                onOpenChange={(open) => !open && setArqueoDialogSession(null)}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Registrar Arqueo</DialogTitle>
                        <DialogDescription>
                            {arqueoDialogSession && (
                                <>
                                    Caja del{" "}
                                    {format(
                                        new Date(arqueoDialogSession.openingDate),
                                        "EEEE d 'de' MMMM",
                                        { locale: es }
                                    )}
                                    . Contá los billetes de la bolsita y escribí el total.
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {arqueoDialogSession && (
                        <div className="space-y-5 py-2">
                            <div className="rounded-lg border border-emerald-800/20 bg-[linear-gradient(135deg,rgba(5,150,105,0.14),rgba(6,95,70,0.04))] p-4 flex justify-between items-center">
                                <span className="text-emerald-900 dark:text-emerald-100 font-medium text-sm">El sistema espera:</span>
                                <span className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                                    {formatCurrency(arqueoDialogSession.expectedAmount)}
                                </span>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-base font-semibold">Efectivo Real (Contado)</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        type="number"
                                        placeholder="Ej: 24500"
                                        className="h-14 pl-10 text-xl font-medium border-2 focus-visible:ring-amber-400"
                                        value={actualAmount}
                                        onChange={(e) => setActualAmount(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>¿Quién realizó el arqueo?</Label>
                                <Select value={countedById} onValueChange={setCountedById}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccioná una persona" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sellers.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setArqueoDialogSession(null)}>
                            Cancelar
                        </Button>
                        <Button
                            className="bg-orange-700 hover:bg-orange-800 text-white"
                            onClick={handleSubmitArqueo}
                            disabled={isSaving}
                        >
                            {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                            Confirmar Arqueo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
