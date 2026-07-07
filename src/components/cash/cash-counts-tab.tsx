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
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScreenLoader } from "@/components/ui/screen-loader";
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
import { formatArgentinaDateTime, formatArgentinaTime } from "@/lib/core/datetime";
import { CACHE_TAGS } from "@/lib/core/cache-tags";
import { notifyDataUpdated, useDataRefresh } from "@/lib/sync/data-sync-client";
import {
    getCashHistoryRuntime,
    type CashHistorySeller as Seller,
    type CashHistorySession as CashSession,
} from "@/lib/offline/cash-history-runtime";
import { motion, AnimatePresence } from "motion/react";

const ARS_DENOMINATIONS = [
    { label: "$10.000", value: 10000, key: "d10k" },
    { label: "$2.000", value: 2000, key: "d2k" },
    { label: "$1.000", value: 1000, key: "d1k" },
    { label: "$500", value: 500, key: "d500" },
    { label: "$200", value: 200, key: "d200" },
    { label: "$100", value: 100, key: "d100" },
    { label: "$50", value: 50, key: "d50" },
    { label: "$20", value: 20, key: "d20" },
    { label: "$10", value: 10, key: "d10" },
] as const;

const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05
        }
    }
} as const;

const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 350, damping: 26 } }
} as const;

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

function formatArgentinaLongDate(date: string) {
    return formatArgentinaDateTime(date, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: undefined,
        hour: undefined,
        minute: undefined,
    });
}

function formatArgentinaWeekdayDate(date: string) {
    return formatArgentinaDateTime(date, {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: undefined,
        minute: undefined,
    });
}

function getPageNumbers(currentPage: number, totalPages: number) {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
        for (let i = 1; i <= totalPages; i++) {
            pages.push(i);
        }
    } else {
        pages.push(1);

        if (currentPage > 3) {
            pages.push("...");
        }

        const start = Math.max(2, currentPage - 1);
        const end = Math.min(totalPages - 1, currentPage + 1);

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }

        if (currentPage < totalPages - 2) {
            pages.push("...");
        }

        pages.push(totalPages);
    }

    return pages;
}

export function CashCountsTab() {
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

    // Bill calculator states
    const [showBillCalculator, setShowBillCalculator] = useState(false);
    const [billCounts, setBillCounts] = useState<Record<string, string>>({
        d10k: "", d2k: "", d1k: "", d500: "", d200: "", d100: "", d50: "", d20: "", d10: ""
    });

    const calculatedTotal = useMemo(() => {
        return ARS_DENOMINATIONS.reduce((sum, denom) => {
            const qty = Number(billCounts[denom.key]) || 0;
            return sum + qty * denom.value;
        }, 0);
    }, [billCounts]);

    useEffect(() => {
        if (showBillCalculator) {
            const timeoutId = setTimeout(() => {
                setActualAmount(calculatedTotal === 0 ? "" : calculatedTotal.toString());
            }, 0);
            return () => clearTimeout(timeoutId);
        }
    }, [calculatedTotal, showBillCalculator]);

    const difference = useMemo(() => {
        if (!arqueoDialogSession || actualAmount === "") return null;
        return Number(actualAmount) - (arqueoDialogSession.expectedAmount ?? 0);
    }, [actualAmount, arqueoDialogSession]);

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
            setIsLoading(false);
        } catch {
            toast.error("Error al cargar los arqueos");
            setIsLoading(false);
        }
    }, [cashHistoryRuntime]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            void loadData();
        }, 0);
        return () => clearTimeout(timeoutId);
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
            const timeoutId = setTimeout(() => {
                setCurrentClosedPage(totalClosedPages);
            }, 0);
            return () => clearTimeout(timeoutId);
        }
    }, [currentClosedPage, totalClosedPages]);

    const handleOpenArqueoDialog = (session: CashSession) => {
        setArqueoDialogSession(session);
        setActualAmount("");
        setShowBillCalculator(false);
        setBillCounts({
            d10k: "", d2k: "", d1k: "", d500: "", d200: "", d100: "", d50: "", d20: "", d10: ""
        });
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
            <ScreenLoader
                layout="centered"
                message="Cargando arqueos..."
                description="Estamos trayendo pendientes e historial."
            />
        );
    }

    return (
        <div className="animate-in fade-in duration-300">
            <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-stone-200/60 bg-stone-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-600 dark:border-stone-800/60 dark:bg-neutral-900 dark:text-neutral-400">
                            <ClipboardList className="size-3.5 text-neutral-500" />
                            Arqueos de Caja
                        </div>
                        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-3xl">
                            Cierre y Conteo
                        </h1>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <div className="rounded-[1.1rem] border border-stone-200 bg-stone-50/100 dark:border-stone-800/40 dark:bg-stone-900/20 px-4 py-3 shadow-none">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-400 dark:text-neutral-500">
                                Pendientes
                            </p>
                            <p className="mt-1 text-xl font-bold text-foreground">{pending.length}</p>
                        </div>
                        <div className="rounded-[1.1rem] border border-stone-200 bg-stone-50/100 dark:border-stone-800/40 dark:bg-stone-900/20 px-4 py-3 shadow-none">
                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-400 dark:text-neutral-500">
                                Cerrados
                            </p>
                            <p className="mt-1 text-xl font-bold text-foreground">{closed.length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Pendientes ─── */}
            <section className="mb-10 mt-6">
                <div className="mb-4 flex items-center gap-3">
                    <h2 className="text-lg font-bold text-foreground tracking-tight">Pendientes de arqueo</h2>
                    {pending.length > 0 && (
                        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/35">
                            {pending.length} pendiente{pending.length !== 1 ? "s" : ""}
                        </span>
                    )}
                </div>

                {pending.length === 0 ? (
                    <div className="rounded-3xl border border-stone-200/50 bg-background dark:border-stone-800/40 p-12 text-center shadow-sm">
                        <CheckCircle2 className="mx-auto mb-3 size-10 text-emerald-500" />
                        <p className="font-semibold text-foreground">Todo al día</p>
                        <p className="text-sm text-neutral-400 mt-1">No hay cajas pendientes de arqueo.</p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {pending.map((s) => (
                            <div
                                key={s.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 relative border-l-[3.5px] border-amber-500 rounded-r-2xl border-y border-r border-stone-200/50 bg-background/80 dark:border-stone-800/40 dark:bg-stone-900/20 hover:bg-stone-50/100 dark:hover:bg-stone-900/30 transition-all duration-200 shadow-sm"
                            >
                                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400">
                                        <Clock className="size-4.5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-baseline gap-x-2.5">
                                            <span className="font-bold text-sm text-foreground truncate">
                                                {formatArgentinaLongDate(s.openingDate)}
                                            </span>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                                Sin arquear
                                            </span>
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                                            <span className="flex items-center gap-1.5">
                                                <Clock className="size-3.5 text-neutral-400 shrink-0" />
                                                {formatArgentinaTime(s.openingDate)} →{" "}
                                                {s.closingDate ? formatArgentinaTime(s.closingDate) : "?"}
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <User className="size-3.5 text-neutral-400 shrink-0" />
                                                Cerrada por <span className="font-semibold text-foreground">{s.closedBy?.name ?? "—"}</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 border-t border-stone-200/40 pt-3 sm:border-t-0 sm:pt-0">
                                    <div className="text-left sm:text-right">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Esperado</p>
                                        <p className="font-extrabold text-sm text-cyan-600 dark:text-cyan-400 mt-0.5">
                                            {formatCurrency(s.expectedAmount)}
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        className="bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-stone-100 font-semibold text-xs h-9 rounded-xl transition-all duration-200 shadow-sm cursor-pointer px-4"
                                        onClick={() => handleOpenArqueoDialog(s)}
                                    >
                                        Hacer Arqueo
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* ─── Historial ─── */}
            <section className="mb-6">
                <h2 className="mb-4 text-lg font-bold text-foreground tracking-tight">Historial de arqueos</h2>
                {closed.length === 0 ? (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">No hay arqueos completados aún.</p>
                ) : (
                    <div className="space-y-4">
                        <div className="rounded-3xl border border-stone-200/50 bg-gradient-to-b from-white to-stone-50/30 overflow-hidden divide-y divide-stone-200/30 dark:border-stone-800/40 dark:bg-stone-900/10 shadow-sm">
                            {paginatedClosed.map((s) => {
                                const diff = s.difference ?? 0;
                                const isExact = diff === 0;
                                const isSurplus = diff > 0;
                                return (
                                    <div key={s.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between hover:bg-stone-50/100 dark:hover:bg-stone-900/30 transition-colors duration-200">
                                        <div className="flex items-center gap-4">
                                            <div
                                                className={cn(
                                                    "flex size-10 shrink-0 items-center justify-center rounded-full border",
                                                    isExact
                                                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400"
                                                        : isSurplus
                                                          ? "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400"
                                                          : "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400"
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
                                                <p className="font-bold text-sm text-foreground">
                                                    {formatArgentinaWeekdayDate(s.openingDate)}
                                                </p>
                                                <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium flex items-center gap-1.5 mt-0.5">
                                                    <CalendarDays className="size-3.5" />
                                                    Arqueo:{" "}
                                                    <span className="font-semibold text-foreground">
                                                        {s.countingDate
                                                            ? formatArgentinaDateTime(s.countingDate, { year: undefined })
                                                            : "—"}
                                                    </span>
                                                    {s.countedBy && <> · por <span className="font-semibold text-foreground">{s.countedBy.name}</span></>}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6 sm:gap-10">
                                            <div className="text-right">
                                                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Esperado</p>
                                                <p className="font-semibold text-sm text-foreground mt-0.5">{formatCurrency(s.expectedAmount)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Contado</p>
                                                <p className="font-semibold text-sm text-foreground mt-0.5">{formatCurrency(s.actualAmount)}</p>
                                            </div>
                                            <div className="text-right min-w-[90px]">
                                                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Diferencia</p>
                                                <p
                                                    className={cn(
                                                        "font-extrabold text-sm mt-0.5",
                                                        isExact
                                                            ? "text-emerald-600 dark:text-emerald-400"
                                                            : isSurplus
                                                              ? "text-blue-600 dark:text-blue-400"
                                                              : "text-rose-600 dark:text-rose-400"
                                                    )}
                                                >
                                                    {isExact
                                                        ? "Exacto"
                                                        : `${isSurplus ? "+" : ""}${formatCurrency(diff)}`}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Paginación Numérica Centralizada Estilo Apple */}
                        <div className="flex flex-col items-center justify-center gap-3 border-t border-stone-200/40 pt-5 dark:border-stone-800/30">
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full text-neutral-400 hover:text-foreground hover:bg-stone-50 dark:hover:bg-stone-900 transition-[background-color,color,transform] duration-150 active:scale-95"
                                    onClick={() => setCurrentClosedPage((page) => Math.max(1, page - 1))}
                                    disabled={currentClosedPage === 1}
                                >
                                    <ChevronLeft className="size-4" />
                                </Button>
                                
                                {getPageNumbers(currentClosedPage, totalClosedPages).map((page, idx) => {
                                    if (page === "...") {
                                        return (
                                            <span key={`elipsis-${idx}`} className="px-1.5 text-xs text-neutral-400 font-medium select-none">
                                                ...
                                            </span>
                                        );
                                    }
                                    
                                    const isCurrent = page === currentClosedPage;
                                    return (
                                        <Button
                                            key={`page-${page}`}
                                            variant={isCurrent ? "default" : "ghost"}
                                            size="icon"
                                            className={cn(
                                                "h-8 w-8 text-xs font-semibold rounded-full transition-[background-color,color,transform] duration-150 active:scale-95",
                                                isCurrent 
                                                    ? "bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-stone-100 shadow-sm" 
                                                    : "text-neutral-500 hover:text-foreground hover:bg-stone-50 dark:hover:bg-stone-900"
                                            )}
                                            onClick={() => setCurrentClosedPage(page as number)}
                                        >
                                            {page}
                                        </Button>
                                    );
                                })}

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full text-neutral-400 hover:text-foreground hover:bg-stone-50 dark:hover:bg-stone-900 transition-[background-color,color,transform] duration-150 active:scale-95"
                                    onClick={() => setCurrentClosedPage((page) => Math.min(totalClosedPages, page + 1))}
                                    disabled={currentClosedPage === totalClosedPages}
                                >
                                    <ChevronRight className="size-4" />
                                </Button>
                            </div>
                            <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                                Mostrando {Math.min(closed.length, (currentClosedPage - 1) * CLOSED_ARQUEOS_PER_PAGE + 1)}-{Math.min(closed.length, currentClosedPage * CLOSED_ARQUEOS_PER_PAGE)} de {closed.length} arqueos
                            </p>
                        </div>
                    </div>
                )}
            </section>

            {/* ─── Dialog de Arqueo ─── */}
            <Dialog
                open={Boolean(arqueoDialogSession)}
                onOpenChange={(open) => {
                    if (!open) {
                        setArqueoDialogSession(null);
                        setActualAmount("");
                        setShowBillCalculator(false);
                    }
                }}
            >
                <DialogContent className="sm:max-w-lg rounded-[2rem] border border-stone-200/50 dark:border-stone-800/40 bg-background/98 backdrop-blur-xl shadow-2xl p-6 sm:p-7 overflow-y-auto max-h-[90vh]">
                    <DialogHeader className="mb-3">
                        <DialogTitle className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-foreground">
                            <div className="flex size-10 items-center justify-center rounded-2xl bg-cyan-100 dark:bg-cyan-950/20 text-cyan-600 dark:text-cyan-400">
                                <ClipboardList className="size-5" />
                            </div>
                            Registrar Arqueo
                        </DialogTitle>
                        <DialogDescription className="text-xs text-neutral-400 mt-2.5 leading-relaxed">
                            {arqueoDialogSession && (
                                <>
                                    Contá el efectivo de la caja del <span className="font-semibold text-foreground">{formatArgentinaLongDate(arqueoDialogSession.openingDate)}</span> e introducí el total contado para conciliar el saldo.
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {arqueoDialogSession && (
                        <div className="space-y-5 py-2">
                            <div className="rounded-2xl border border-stone-200/50 bg-stone-50/50 p-5 dark:border-stone-800/40 dark:bg-neutral-900/5 flex flex-col justify-between items-center text-center">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1">Monto Esperado en Sistema</span>
                                <span className="text-3xl font-extrabold text-foreground tracking-tight">
                                    {formatCurrency(arqueoDialogSession.expectedAmount)}
                                </span>
                            </div>

                            {/* ─── Calculadora de Billetes ─── */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                                        Efectivo Real (Contado)
                                    </Label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setShowBillCalculator(!showBillCalculator);
                                            if (!showBillCalculator) {
                                                setBillCounts({
                                                    d10k: "", d2k: "", d1k: "", d500: "", d200: "", d100: "", d50: "", d20: "", d10: ""
                                                });
                                            }
                                        }}
                                        className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 h-7 px-2.5 rounded-lg border border-cyan-500/10 bg-cyan-500/5 hover:bg-cyan-500/10 cursor-pointer transition-all duration-200"
                                    >
                                        {showBillCalculator ? "Escribir monto manual" : "Contar por billetes"}
                                    </Button>
                                </div>

                                <AnimatePresence>
                                    {showBillCalculator && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0, y: -10 }}
                                            animate={{ opacity: 1, height: "auto", y: 0 }}
                                            exit={{ opacity: 0, height: 0, y: -10 }}
                                            className="rounded-2xl border border-stone-200/60 dark:border-stone-800/40 bg-stone-50/40 dark:bg-stone-900/10 p-4 space-y-4 shadow-inner overflow-hidden"
                                        >
                                            <div className="grid grid-cols-3 gap-3">
                                                {ARS_DENOMINATIONS.map((denom) => (
                                                    <div key={denom.key} className="space-y-1">
                                                        <label className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 block">
                                                            {denom.label}
                                                        </label>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            placeholder="0"
                                                            className="h-9 px-2 text-xs font-bold text-center border-stone-200 dark:border-stone-800 rounded-lg focus-visible:ring-1 focus-visible:ring-cyan-500 bg-background/80"
                                                            value={billCounts[denom.key]}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (val === "" || (Number(val) >= 0 && !val.includes("."))) {
                                                                    setBillCounts((prev) => ({
                                                                        ...prev,
                                                                        [denom.key]: val,
                                                                    }));
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            <div className="flex items-center justify-between text-xs border-t border-stone-200/50 dark:border-stone-800/30 pt-3 font-bold">
                                                <span className="text-neutral-400 dark:text-neutral-500">Suma total de billetes:</span>
                                                <span className="text-cyan-600 dark:text-cyan-400 font-extrabold text-sm">{formatCurrency(calculatedTotal)}</span>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="relative">
                                    <DollarSign className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-neutral-400" />
                                    <Input
                                        type="number"
                                        placeholder="Ej: 24500"
                                        disabled={showBillCalculator}
                                        className="h-12 pl-10 text-lg font-bold border border-stone-200 dark:border-stone-800 rounded-xl focus-visible:ring-1 focus-visible:ring-cyan-500 bg-background/50 disabled:opacity-90"
                                        value={actualAmount}
                                        onChange={(e) => setActualAmount(e.target.value)}
                                        autoFocus
                                    />
                                    {showBillCalculator && (
                                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wide">
                                            Calculado
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* ─── Analisis de Diferencia en Tiempo Real ─── */}
                            <AnimatePresence>
                                {difference !== null && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className={cn(
                                            "rounded-2xl border p-4 text-xs transition-all duration-300 shadow-sm flex flex-col gap-2.5 overflow-hidden",
                                            difference === 0
                                                ? "border-emerald-200 bg-emerald-50/40 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/10 dark:text-emerald-300"
                                                : difference > 0
                                                  ? "border-sky-200 bg-sky-50/40 text-sky-800 dark:border-sky-800/40 dark:bg-sky-950/10 dark:text-sky-300"
                                                  : "border-rose-200 bg-rose-50/40 text-rose-800 dark:border-rose-800/40 dark:bg-rose-950/10 dark:text-rose-300"
                                        )}
                                    >
                                        <div className="flex items-center justify-between font-bold">
                                            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                                                {difference === 0 ? (
                                                    <BadgeCheck className="size-4 text-emerald-500" />
                                                ) : difference > 0 ? (
                                                    <TrendingUp className="size-4 text-sky-500" />
                                                ) : (
                                                    <CircleAlert className="size-4 text-rose-500" />
                                                )}
                                                {difference === 0
                                                    ? "Arqueo Exacto"
                                                    : difference > 0
                                                      ? "Sobrante"
                                                      : "Faltante"}
                                            </span>
                                            <span className="text-sm font-extrabold">
                                                {difference === 0
                                                    ? "Exacto"
                                                    : `${difference > 0 ? "+" : ""}${formatCurrency(difference)}`}
                                            </span>
                                        </div>
                                        <p className="text-[11px] leading-normal opacity-90 font-medium">
                                            {difference === 0
                                                ? "El efectivo contado coincide perfectamente con lo esperado en el sistema."
                                                : difference > 0
                                                  ? `Hay un sobrante de ${formatCurrency(difference)} en efectivo en caja comparado con el sistema.`
                                                  : `Hay un faltante de ${formatCurrency(Math.abs(difference))} en efectivo en caja comparado con el sistema.`}
                                        </p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Responsable del Arqueo</Label>
                                <Select value={countedById} onValueChange={setCountedById}>
                                    <SelectTrigger className="w-full rounded-xl border border-stone-200 dark:border-stone-800 bg-background/50 text-xs font-semibold h-10 shadow-none">
                                        <SelectValue placeholder="Seleccioná una persona" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-stone-200 dark:border-stone-800">
                                        {sellers.map((s) => (
                                            <SelectItem key={s.id} value={s.id} className="text-xs font-medium rounded-lg">
                                                {s.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="mt-4 flex flex-row gap-2 sm:justify-end">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setArqueoDialogSession(null);
                                setActualAmount("");
                                setShowBillCalculator(false);
                            }}
                            className="rounded-xl h-10 text-xs font-semibold border-stone-200 dark:border-stone-800 px-4 flex-1 sm:flex-none cursor-pointer transition-[background-color,transform] duration-150 active:scale-[0.98]"
                        >
                            Cancelar
                        </Button>
                        <Button
                            className="bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-stone-100 rounded-xl h-10 text-xs font-semibold px-4 flex-1 sm:flex-none cursor-pointer transition-[background-color,transform] duration-150 active:scale-[0.985]"
                            onClick={handleSubmitArqueo}
                            disabled={isSaving}
                        >
                            {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                            Confirmar Conteo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
