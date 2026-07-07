"use client";

import { type WheelEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
    ReceiptText,
    Wallet,
    Loader2,
    Eye,
    Calendar,
    Banknote,
    CreditCard,
    Layers,
    ChevronLeft,
    ChevronRight,
    Search,
    X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScreenLoader } from "@/components/ui/screen-loader";

import { Card, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/core/utils";
import { formatArgentinaDateTimeWithSuffix } from "@/lib/core/datetime";
import { CACHE_TAGS } from "@/lib/core/cache-tags";
import { useDataRefresh } from "@/lib/sync/data-sync-client";
import {
    getCashHistoryRuntime,
    type CashHistorySession as CashSessionHistory,
} from "@/lib/offline/cash-history-runtime";

const CASH_SESSIONS_PER_PAGE = 10;
const PAYMENT_METHOD_FILTERS = [
    { value: "TODOS", label: "Todos los pagos" },
    { value: "EFECTIVO", label: "Efectivo" },
    { value: "TRANSFERENCIA", label: "Transferencia" },
    { value: "MIXTO", label: "Mixto" },
    { value: "CAMBIO", label: "Cambio" },
] as const;

type PaymentMethodFilter = (typeof PAYMENT_METHOD_FILTERS)[number]["value"];

function formatCurrency(amount: number | null | undefined): string {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 0,
    }).format(Number(amount) || 0);
}

function formatDate(dateStr: string | null): string {
    return formatArgentinaDateTimeWithSuffix(dateStr);
}

function SessionStatusBadge({ status }: { status: string }) {
    if (status === "OPEN") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                </span>
                ABIERTA
            </span>
        );
    }
    if (status === "PENDING_COUNT") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                </span>
                PENDIENTE
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-500/20 bg-stone-500/5 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-neutral-600 dark:border-neutral-400/20 dark:bg-neutral-400/10 dark:text-neutral-400">
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-400 dark:bg-stone-500" />
            CERRADA
        </span>
    );
}

function PaymentMethodBadge({ method }: { method: string }) {
    if (method === "EFECTIVO") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                <Banknote className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                Efectivo
            </span>
        );
    }
    if (method === "TRANSFERENCIA") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/5 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                <CreditCard className="size-3.5 text-blue-600 dark:text-blue-400" />
                Transferencia
            </span>
        );
    }
    if (method === "MIXTO") {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/5 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300">
                <Layers className="size-3.5 text-violet-600 dark:text-violet-400" />
                Mixto
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 px-2.5 py-0.5 text-xs font-semibold tracking-wide text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            Cambio
        </span>
    );
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

function MetricCard({
    label,
    value,
    description,
    icon,
    tone = "default",
}: {
    label: string;
    value: string;
    description?: string;
    icon: ReactNode;
    tone?: "default" | "success" | "danger" | "warning" | "info" | "dark";
}) {
    const iconClassName = cn(
        "flex size-10 shrink-0 items-center justify-center rounded-2xl border",
        tone === "success"
            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
            : tone === "danger"
              ? "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30"
              : tone === "warning"
                ? "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30"
                : tone === "info"
                  ? "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400 dark:border-blue-500/30"
                  : tone === "dark"
                    ? "bg-neutral-900/5 text-neutral-900 border-neutral-900/10 dark:bg-white/10 dark:text-white dark:border-white/15"
                    : "bg-neutral-50 text-neutral-500 border-neutral-200/50 dark:bg-neutral-900/50 dark:text-neutral-400 dark:border-neutral-800/60"
    );

    const valueClassName =
        tone === "success"
            ? "text-emerald-600 dark:text-emerald-400"
            : tone === "danger"
              ? "text-rose-600 dark:text-rose-400"
              : tone === "warning"
                ? "text-amber-600 dark:text-amber-400"
                : tone === "info"
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-foreground font-extrabold";

    return (
        <Card className="h-full rounded-[2rem] border border-neutral-200/50 bg-background/80 dark:border-neutral-800/40 dark:bg-neutral-900/20 shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-out hover:shadow-md hover:-translate-y-0.5">
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-400 dark:text-neutral-500">
                            {label}
                        </p>
                        <p className={cn("mt-2 text-2xl font-bold tracking-tight", valueClassName)}>
                            {value}
                        </p>
                        {description ? (
                            <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                                {description}
                            </p>
                        ) : null}
                    </div>
                    <div className={iconClassName}>{icon}</div>
                </div>
            </CardContent>
        </Card>
    );
}

export function CashHistoryTab() {
    const cashHistoryRuntime = useMemo(() => getCashHistoryRuntime(), []);
    const [sessions, setSessions] = useState<CashSessionHistory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedTicketsSession, setSelectedTicketsSession] = useState<CashSessionHistory | null>(null);
    const [selectedCashSession, setSelectedCashSession] = useState<CashSessionHistory | null>(null);
    const [selectedTicketDetail, setSelectedTicketDetail] = useState<CashSessionHistory["sales"][number] | null>(null);
    const [ticketsPaymentFilter, setTicketsPaymentFilter] = useState<PaymentMethodFilter>("TODOS");

    // Filtros Estilo Apple
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<"TODAS" | "OPEN" | "CLOSED" | "PENDING_COUNT">("TODAS");
    const [dateFilter, setDateFilter] = useState("");

    const loadHistory = useCallback(async () => {
        try {
            const data = await cashHistoryRuntime.getCashSessionsHistory();
            setSessions(data);
            setIsLoading(false);
        } catch (error) {
            toast.error("No se pudo cargar el historial de caja");
            console.error(error);
            setIsLoading(false);
        }
    }, [cashHistoryRuntime]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            void loadHistory();
        }, 0);
        return () => clearTimeout(timeoutId);
    }, [loadHistory]);

    useDataRefresh([CACHE_TAGS.cash, CACHE_TAGS.sales], loadHistory, {
        pollIntervalMs: false,
    });

    const filteredSessions = useMemo(() => {
        return sessions.filter((session) => {
            // 1. Filtrar por Estado
            if (statusFilter !== "TODAS" && session.status !== statusFilter) {
                return false;
            }

            // 2. Filtrar por Fecha
            if (dateFilter) {
                const sessionDateStr = session.openingDate.split("T")[0];
                if (sessionDateStr !== dateFilter) {
                    return false;
                }
            }

            // 3. Filtrar por Búsqueda (cajero o número de caja)
            if (searchTerm.trim()) {
                const search = searchTerm.toLowerCase().trim();
                const absoluteIndex = sessions.findIndex((s) => s.id === session.id);
                const sessionNumber = String(sessions.length - absoluteIndex);
                
                const matchesNumber = sessionNumber.includes(search) || `caja #${sessionNumber}`.includes(search) || `#${sessionNumber}`.includes(search) || `caja ${sessionNumber}`.includes(search);
                const matchesOpenedBy = session.openedBy?.name.toLowerCase().includes(search) ?? false;
                const matchesClosedBy = session.closedBy?.name.toLowerCase().includes(search) ?? false;
                const matchesCountedBy = session.countedBy?.name.toLowerCase().includes(search) ?? false;

                if (!matchesNumber && !matchesOpenedBy && !matchesClosedBy && !matchesCountedBy) {
                    return false;
                }
            }

            return true;
        });
    }, [sessions, searchTerm, statusFilter, dateFilter]);

    const totalSessions = filteredSessions.length;
    const totalPages = Math.max(1, Math.ceil(totalSessions / CASH_SESSIONS_PER_PAGE));
    const paginatedSessions = useMemo(() => {
        const start = (currentPage - 1) * CASH_SESSIONS_PER_PAGE;
        return filteredSessions.slice(start, start + CASH_SESSIONS_PER_PAGE);
    }, [currentPage, filteredSessions]);

    useEffect(() => {
        if (currentPage > totalPages) {
            const timeoutId = setTimeout(() => {
                setCurrentPage(totalPages);
            }, 0);
            return () => clearTimeout(timeoutId);
        }
    }, [currentPage, totalPages]);

    useEffect(() => {
        if (!selectedTicketsSession) {
            const timeoutId = setTimeout(() => {
                setTicketsPaymentFilter("TODOS");
                setSelectedTicketDetail(null);
            }, 0);
            return () => clearTimeout(timeoutId);
        }
    }, [selectedTicketsSession]);

    const summary = useMemo(() => {
        let totalRevenue = 0;
        let totalCashSales = 0;
        let totalTransferSales = 0;
        let totalDifference = 0;

        filteredSessions.forEach((session) => {
            const salesCash = session.sales.reduce((sum, sale) => sum + Number(sale.cashAmount || 0), 0);
            const salesTransfer = session.sales.reduce((sum, sale) => sum + Number(sale.transferAmount || 0), 0);

            totalCashSales += salesCash;
            totalTransferSales += salesTransfer;
            totalRevenue += (salesCash + salesTransfer);
            totalDifference += (session.difference || 0);
        });

        return {
            totalRevenue,
            totalCashSales,
            totalTransferSales,
            totalDifference,
        };
    }, [filteredSessions]);

    const getSessionAmounts = (session: CashSessionHistory) => {
        const salesCash = session.sales.reduce((sum, sale) => sum + Number(sale.cashAmount || 0), 0);
        const salesTransfer = session.sales.reduce((sum, sale) => sum + Number(sale.transferAmount || 0), 0);
        const manualIn = session.movements
            .filter((movement) => movement.type === "INGRESO")
            .reduce((sum, movement) => sum + movement.amount, 0);
        const manualOut = session.movements
            .filter((movement) => movement.type === "EGRESO")
            .reduce((sum, movement) => sum + movement.amount, 0);
        const expectedCash = session.initialAmount + salesCash + manualIn - manualOut;

        return {
            salesCash,
            salesTransfer,
            manualIn,
            manualOut,
            expectedCash,
        };
    };

    const filteredTicketSales = useMemo(() => {
        if (!selectedTicketsSession) {
            return [];
        }

        if (ticketsPaymentFilter === "TODOS") {
            return selectedTicketsSession.sales;
        }

        return selectedTicketsSession.sales.filter(
            (sale) => sale.paymentMethod === ticketsPaymentFilter
        );
    }, [selectedTicketsSession, ticketsPaymentFilter]);

    const handleModalTableWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
        const scrollContainer = event.currentTarget;

        event.preventDefault();
        event.stopPropagation();

        scrollContainer.scrollTop += event.deltaY;
        scrollContainer.scrollLeft += event.deltaX;
    }, []);

    if (isLoading) {
        return <ScreenLoader layout="centered" message="Cargando historial" description="Estamos preparando las sesiones y sus boletas." />;
    }

    return (
        <div className="animate-in fade-in duration-300">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                    label="Facturación Total"
                    value={formatCurrency(summary.totalRevenue)}
                    description="Ventas totales cobradas"
                    icon={<Banknote className="size-5" />}
                    tone="success"
                />
                <MetricCard
                    label="Ventas en Efectivo"
                    value={formatCurrency(summary.totalCashSales)}
                    description="Total cobrado en efectivo"
                    icon={<Wallet className="size-5" />}
                    tone="info"
                />
                <MetricCard
                    label="Transferencia / Tarjeta"
                    value={formatCurrency(summary.totalTransferSales)}
                    description="Total cobrado por vía digital"
                    icon={<CreditCard className="size-5" />}
                    tone="warning"
                />
                <MetricCard
                    label="Diferencia de Arqueo"
                    value={formatCurrency(summary.totalDifference)}
                    description={summary.totalDifference < 0 ? "Faltante neto acumulado" : summary.totalDifference > 0 ? "Sobrante neto acumulado" : "Cierres sin diferencias"}
                    icon={<Layers className="size-5" />}
                    tone={summary.totalDifference < 0 ? "danger" : summary.totalDifference > 0 ? "success" : "dark"}
                />
            </div>

            {/* Panel de Filtros Estilo Apple */}
            <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-stone-50/30 dark:bg-neutral-900/5 border border-stone-200/50 dark:border-stone-800/40 rounded-2xl p-3.5 transition-all duration-300">
                {/* 1. Buscador */}
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Buscar por cajero, caja #..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="w-full pl-10 pr-9 py-1.5 text-xs bg-background border border-stone-200 dark:border-stone-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-400 dark:focus:ring-neutral-700 transition-all duration-200"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => {
                                setSearchTerm("");
                                setCurrentPage(1);
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-stone-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-foreground transition-all duration-200"
                        >
                            <X className="size-3" />
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* 2. Selector de Fecha Rápido */}
                    <div className="relative">
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => {
                                setDateFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="pl-9 pr-7 py-1.5 text-xs font-semibold bg-background border border-stone-200 dark:border-stone-800 rounded-xl text-foreground focus:outline-none transition-all duration-200 cursor-pointer h-8.5 [color-scheme:light] dark:[color-scheme:dark]"
                        />
                        <Calendar className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                        {dateFilter && (
                            <button
                                onClick={() => {
                                    setDateFilter("");
                                    setCurrentPage(1);
                                }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-stone-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-foreground transition-all duration-200"
                            >
                                <X className="size-3" />
                            </button>
                        )}
                    </div>

                    {/* 3. Control Segmentado de Estados (iOS) */}
                    <div className="inline-flex h-8.5 rounded-xl bg-stone-100 p-0.5 dark:bg-neutral-900 border border-stone-200/50 dark:border-stone-800/40">
                        {(
                            [
                                { value: "TODAS", label: "Todas" },
                                { value: "OPEN", label: "Abiertas" },
                                { value: "PENDING_COUNT", label: "Pendientes" },
                                { value: "CLOSED", label: "Cerradas" },
                            ] as const
                        ).map((status) => {
                            const isActive = statusFilter === status.value;
                            return (
                                <button
                                    key={status.value}
                                    onClick={() => {
                                        setStatusFilter(status.value);
                                        setCurrentPage(1);
                                    }}
                                    className={cn(
                                        "h-full rounded-[10px] px-3 py-1 text-[11px] font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.97] cursor-pointer select-none",
                                        isActive
                                            ? "bg-white text-neutral-950 shadow-sm border border-stone-200/10 dark:bg-neutral-800 dark:text-neutral-50"
                                            : "text-neutral-500 dark:text-neutral-400 hover:text-foreground hover:bg-neutral-200/20 dark:hover:bg-neutral-800/40"
                                    )}
                                >
                                    {status.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200/50 bg-background dark:border-stone-800/40 shadow-sm transition-all duration-300">
                <Table>
                    <TableHeader className="bg-stone-50/100 dark:bg-neutral-900/40">
                        <TableRow className="hover:bg-transparent border-b border-stone-200/50 dark:border-stone-800/40">
                            <TableHead className="font-semibold text-xs tracking-wider uppercase text-neutral-400 dark:text-neutral-500 py-3.5">Caja</TableHead>
                            <TableHead className="font-semibold text-xs tracking-wider uppercase text-neutral-400 dark:text-neutral-500 py-3.5">Estado</TableHead>
                            <TableHead className="font-semibold text-xs tracking-wider uppercase text-neutral-400 dark:text-neutral-500 py-3.5">Apertura</TableHead>
                            <TableHead className="font-semibold text-xs tracking-wider uppercase text-neutral-400 dark:text-neutral-500 py-3.5">Cierre</TableHead>
                            <TableHead className="font-semibold text-xs tracking-wider uppercase text-neutral-400 dark:text-neutral-500 py-3.5">Abierta por</TableHead>
                            <TableHead className="text-right font-semibold text-xs tracking-wider uppercase text-neutral-400 dark:text-neutral-500 py-3.5">Boletas</TableHead>
                            <TableHead className="text-right font-semibold text-xs tracking-wider uppercase text-neutral-400 dark:text-neutral-500 py-3.5">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sessions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="py-20 text-center">
                                    <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-stone-50 dark:bg-neutral-900/50">
                                        <Wallet className="size-6 text-neutral-400" />
                                    </div>
                                    <p className="text-base font-semibold text-foreground">
                                        No hay sesiones registradas
                                    </p>
                                    <p className="text-sm text-neutral-400 mt-1">
                                        Las aperturas de caja aparecerán listadas aquí.
                                    </p>
                                </TableCell>
                            </TableRow>
                        ) : filteredSessions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="py-20 text-center">
                                    <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-stone-50 dark:bg-neutral-900/50">
                                        <Search className="size-6 text-neutral-400 animate-pulse" />
                                    </div>
                                    <p className="text-base font-semibold text-foreground">
                                        No se encontraron resultados
                                    </p>
                                    <p className="text-sm text-neutral-400 mt-1">
                                        Intenta ajustar los criterios de búsqueda o filtros aplicados.
                                    </p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedSessions.map((session) => {
                                const absoluteIndex = sessions.findIndex((s) => s.id === session.id);
                                const sessionNumber = sessions.length - absoluteIndex;

                                return (
                                    <TableRow key={session.id} className="hover:bg-stone-50/100 dark:hover:bg-stone-900/30 border-b border-stone-200/40 dark:border-stone-800/30 last:border-b-0 transition-colors duration-200">
                                        <TableCell className="py-4">
                                            <span className="font-mono text-sm font-semibold px-2.5 py-1 rounded-lg border border-stone-200/50 bg-stone-50/30 dark:border-stone-800/40 dark:bg-stone-900/20 text-foreground">
                                                Caja #{Math.max(sessionNumber, 1)}
                                            </span>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <SessionStatusBadge status={session.status} />
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground py-4">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="size-3.5 text-neutral-400" />
                                                {formatDate(session.openingDate)}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground py-4">
                                            {session.closingDate ? formatDate(session.closingDate) : "—"}
                                        </TableCell>
                                        <TableCell className="text-sm font-semibold text-foreground py-4">
                                            {session.openedBy?.name ?? "—"}
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-foreground py-4">
                                            {session.sales.length}
                                        </TableCell>
                                        <TableCell className="text-right py-4">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 gap-1.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-background/50 hover:bg-stone-50 dark:hover:bg-stone-900 text-foreground text-xs font-semibold shadow-none transition-all duration-200"
                                                    onClick={() => setSelectedCashSession(session)}
                                                >
                                                    <Wallet className="size-3.5 text-neutral-400" />
                                                    Ver caja
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 gap-1.5 rounded-xl text-neutral-500 hover:text-foreground hover:bg-stone-50 dark:hover:bg-stone-900 text-xs font-semibold transition-all duration-200"
                                                    onClick={() => setSelectedTicketsSession(session)}
                                                >
                                                    <Eye className="size-3.5 text-neutral-400" />
                                                    Ver boletas
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {sessions.length > 0 ? (
                <div className="mt-6 flex flex-col items-center justify-center gap-3 border-t border-stone-200/40 pt-5 dark:border-stone-800/30">
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-neutral-400 hover:text-foreground hover:bg-stone-50 dark:hover:bg-stone-900 transition-[background-color,color,transform] duration-150 active:scale-95"
                            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="size-4" />
                        </Button>
                        
                        {getPageNumbers(currentPage, totalPages).map((page, idx) => {
                            if (page === "...") {
                                return (
                                    <span key={`elipsis-${idx}`} className="px-1.5 text-xs text-neutral-400 font-medium select-none">
                                        ...
                                    </span>
                                );
                            }
                            
                            const isCurrent = page === currentPage;
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
                                    onClick={() => setCurrentPage(page as number)}
                                >
                                    {page}
                                </Button>
                            );
                        })}

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full text-neutral-400 hover:text-foreground hover:bg-stone-50 dark:hover:bg-stone-900 transition-[background-color,color,transform] duration-150 active:scale-95"
                            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                            disabled={currentPage === totalPages}
                        >
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                    <p className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                        Mostrando {Math.min(totalSessions, (currentPage - 1) * CASH_SESSIONS_PER_PAGE + 1)}-{Math.min(totalSessions, currentPage * CASH_SESSIONS_PER_PAGE)} de {totalSessions} sesiones
                    </p>
                </div>
            ) : null}

            <Dialog
                open={Boolean(selectedCashSession)}
                onOpenChange={(open) => !open && setSelectedCashSession(null)}
            >
                <DialogContent className="sm:max-w-4xl rounded-[2rem] border-stone-200/50 dark:border-stone-800/40 bg-background/98 backdrop-blur-xl shadow-2xl p-6 sm:p-8">
                    {selectedCashSession && (
                        <>
                            {(() => {
                                const amounts = getSessionAmounts(selectedCashSession);
                                const difference = selectedCashSession.difference ?? 0;

                                return (
                                    <>
                                        <DialogHeader className="mb-4">
                                            <div className="flex items-center justify-between">
                                                <DialogTitle className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-foreground">
                                                    <div className="flex size-10 items-center justify-center rounded-2xl bg-stone-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400">
                                                        <Wallet className="size-5" />
                                                    </div>
                                                    Detalle de Caja
                                                </DialogTitle>
                                                <SessionStatusBadge status={selectedCashSession.status} />
                                            </div>
                                            <DialogDescription className="text-xs text-muted-foreground mt-2">
                                                Sesión de caja registrada. Apertura: <span className="font-semibold">{formatDate(selectedCashSession.openingDate)}</span> · Cierre: <span className="font-semibold">{selectedCashSession.closingDate ? formatDate(selectedCashSession.closingDate) : "Activa"}</span>
                                            </DialogDescription>
                                        </DialogHeader>

                                        <div className="grid gap-6 md:grid-cols-12">
                                            {/* Column 1: Financial Overview (8 cols) */}
                                            <div className="md:col-span-8 flex flex-col gap-6">
                                                <div className="overflow-hidden rounded-[1.75rem] border border-stone-200/50 bg-stone-50/20 p-5 dark:border-stone-800/40 dark:bg-neutral-900/5">
                                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-3.5">Fórmula de Balance</h3>
                                                    <div className="divide-y divide-stone-200/40 dark:divide-neutral-800/30">
                                                        <div className="flex justify-between py-3">
                                                            <span className="text-sm text-neutral-500 dark:text-neutral-400">Fondo inicial</span>
                                                            <span className="text-sm font-semibold text-foreground">{formatCurrency(selectedCashSession.initialAmount)}</span>
                                                        </div>
                                                        <div className="flex justify-between py-3">
                                                            <span className="text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                                Efectivo en ventas
                                                            </span>
                                                            <span className="text-sm font-semibold text-foreground">{formatCurrency(amounts.salesCash)}</span>
                                                        </div>
                                                        <div className="flex justify-between py-3">
                                                            <span className="text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
                                                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                                                Transferencias
                                                            </span>
                                                            <span className="text-sm font-semibold text-foreground">{formatCurrency(amounts.salesTransfer)}</span>
                                                        </div>
                                                        <div className="flex justify-between py-3">
                                                            <span className="text-sm text-neutral-500 dark:text-neutral-400">Ingresos manuales</span>
                                                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">+{formatCurrency(amounts.manualIn)}</span>
                                                        </div>
                                                        <div className="flex justify-between py-3">
                                                            <span className="text-sm text-neutral-500 dark:text-neutral-400">Egresos manuales</span>
                                                            <span className="text-sm font-bold text-rose-600 dark:text-rose-400">-{formatCurrency(amounts.manualOut)}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="overflow-hidden rounded-[1.75rem] border border-stone-200/50 bg-stone-50/20 p-5 dark:border-stone-800/40 dark:bg-neutral-900/5">
                                                    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-3">Responsables de Turno</h3>
                                                    <div className="grid gap-3 sm:grid-cols-2">
                                                        <div className="rounded-2xl border border-stone-200/40 bg-stone-50/10 p-4 dark:border-stone-800/20 dark:bg-neutral-900/5 flex flex-col justify-between">
                                                            <div>
                                                                <p className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Apertura</p>
                                                                <p className="mt-1 text-sm font-bold text-foreground">{selectedCashSession.openedBy?.name ?? "—"}</p>
                                                            </div>
                                                            <p className="text-[11px] text-neutral-400 mt-2">{formatDate(selectedCashSession.openingDate)}</p>
                                                        </div>
                                                        <div className="rounded-2xl border border-stone-200/40 bg-stone-50/10 p-4 dark:border-stone-800/20 dark:bg-neutral-900/5 flex flex-col justify-between">
                                                            <div>
                                                                <p className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Cierre</p>
                                                                <p className="mt-1 text-sm font-bold text-foreground">{selectedCashSession.closedBy?.name ?? "—"}</p>
                                                            </div>
                                                            <p className="text-[11px] text-neutral-400 mt-2">{selectedCashSession.closingDate ? formatDate(selectedCashSession.closingDate) : "En proceso"}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Column 2: Audit Balance (4 cols) */}
                                            <div className="md:col-span-4 flex flex-col gap-6">
                                                <div className="overflow-hidden rounded-[1.75rem] border border-stone-200/50 bg-stone-50/20 p-5 dark:border-stone-800/40 dark:bg-neutral-900/5 flex flex-col justify-between h-full">
                                                    <div>
                                                        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-3.5">Balance General</h3>
                                                        <div className="space-y-4">
                                                            <div className="rounded-xl bg-background p-3 border border-stone-200/40 dark:border-stone-800/20">
                                                                <p className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Monto Esperado</p>
                                                                <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">
                                                                    {formatCurrency(selectedCashSession.expectedAmount ?? amounts.expectedCash)}
                                                                </p>
                                                            </div>
                                                            <div className="rounded-xl bg-background p-3 border border-stone-200/40 dark:border-stone-800/20">
                                                                <p className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Monto Contado</p>
                                                                <p className="text-xl font-extrabold tracking-tight text-foreground mt-0.5">
                                                                    {formatCurrency(selectedCashSession.actualAmount)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="mt-6 pt-5 border-t border-stone-200/50 dark:border-stone-800/40">
                                                        <p className="text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Diferencia de Caja</p>
                                                        <div className="mt-1 flex items-baseline gap-2">
                                                            <span className={cn(
                                                                "text-3xl font-extrabold tracking-tight",
                                                                difference === 0 && "text-foreground",
                                                                difference > 0 && "text-emerald-600 dark:text-emerald-400",
                                                                difference < 0 && "text-rose-600 dark:text-rose-400"
                                                            )}>
                                                                {difference > 0 ? "+" : ""}
                                                                {formatCurrency(difference)}
                                                            </span>
                                                        </div>
                                                        {selectedCashSession.countedBy && (
                                                            <p className="text-[10px] text-neutral-400 mt-3 leading-relaxed">
                                                                Arqueado por <strong className="font-semibold text-foreground">{selectedCashSession.countedBy.name}</strong> el {formatDate(selectedCashSession.countingDate)}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(selectedTicketsSession)}
                onOpenChange={(open) => {
                    if (!open) {
                        setSelectedTicketsSession(null);
                        setSelectedTicketDetail(null);
                    }
                }}
            >
                <DialogContent className="max-h-[90vh] grid-rows-[auto_auto_auto_minmax(0,1fr)] overflow-hidden sm:max-w-5xl rounded-[2rem] border-stone-200/50 dark:border-stone-800/40 bg-background/98 backdrop-blur-xl shadow-2xl p-6 sm:p-8">
                    {selectedTicketsSession && (
                        <>
                            <DialogHeader>
                                <div className="flex items-center justify-between">
                                    <DialogTitle className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-foreground">
                                        <div className="flex size-10 items-center justify-center rounded-2xl bg-stone-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400">
                                            <Eye className="size-5" />
                                        </div>
                                        Boletas de la Caja
                                    </DialogTitle>
                                    <SessionStatusBadge status={selectedTicketsSession.status} />
                                </div>
                                <DialogDescription className="text-xs text-muted-foreground mt-2">
                                    Apertura: <span className="font-semibold">{formatDate(selectedTicketsSession.openingDate)}</span> · Cierre: <span className="font-semibold">{selectedTicketsSession.closingDate ? formatDate(selectedTicketsSession.closingDate) : "Activa"}</span>
                                </DialogDescription>
                            </DialogHeader>

                            <div className="grid gap-4 sm:grid-cols-3">
                                <div className="rounded-2xl border border-stone-200/50 bg-stone-50/20 p-4 dark:border-stone-800/40 dark:bg-neutral-900/5">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Estado de caja</p>
                                    <div className="mt-2 flex">
                                        <SessionStatusBadge status={selectedTicketsSession.status} />
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-stone-200/50 bg-stone-50/20 p-4 dark:border-stone-800/40 dark:bg-neutral-900/5 flex flex-col justify-between">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Fondo inicial</p>
                                    <p className="mt-1 text-lg font-bold text-foreground">{formatCurrency(selectedTicketsSession.initialAmount)}</p>
                                </div>
                                <div className="rounded-2xl border border-stone-200/50 bg-stone-50/20 p-4 dark:border-stone-800/40 dark:bg-neutral-900/5 flex flex-col justify-between">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Total boletas</p>
                                    <p className="mt-1 text-lg font-bold text-foreground">{selectedTicketsSession.sales.length}</p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 rounded-2xl border border-stone-200/50 bg-stone-50/10 p-4 dark:border-stone-800/40 dark:bg-neutral-900/5 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-foreground">Filtrar boletas</p>
                                    <p className="text-xs text-neutral-400 mt-0.5">
                                        Mostrando {filteredTicketSales.length} de {selectedTicketsSession.sales.length}
                                    </p>
                                </div>
                                <Select
                                    value={ticketsPaymentFilter}
                                    onValueChange={(value) =>
                                        setTicketsPaymentFilter(value as PaymentMethodFilter)
                                    }
                                >
                                    <SelectTrigger className="w-full sm:w-[220px] rounded-xl border border-stone-200 dark:border-stone-800 bg-background/50 text-xs font-semibold h-9 shadow-none">
                                        <SelectValue placeholder="Tipo de pago" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-stone-200 dark:border-stone-800">
                                        {PAYMENT_METHOD_FILTERS.map((method) => (
                                            <SelectItem key={method.value} value={method.value} className="text-xs font-medium rounded-lg">
                                                {method.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div
                                className="min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl border border-stone-200/50 dark:border-stone-800/40 bg-background/40 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-neutral-200 [&::-webkit-scrollbar-thumb]:rounded-full dark:[&::-webkit-scrollbar-thumb]:bg-neutral-800 [&::-webkit-scrollbar-track]:transparent"
                                onWheelCapture={handleModalTableWheel}
                            >
                                <Table>
                                    <TableHeader className="bg-stone-50/100 dark:bg-neutral-900/40">
                                        <TableRow className="hover:bg-transparent border-b border-stone-200/50 dark:border-stone-800/40">
                                            <TableHead className="font-semibold text-[10px] tracking-wider uppercase text-neutral-400 py-3">N° Boleta</TableHead>
                                            <TableHead className="font-semibold text-[10px] tracking-wider uppercase text-neutral-400 py-3">Fecha</TableHead>
                                            <TableHead className="font-semibold text-[10px] tracking-wider uppercase text-neutral-400 py-3">Vendedor</TableHead>
                                            <TableHead className="font-semibold text-[10px] tracking-wider uppercase text-neutral-400 py-3">Método</TableHead>
                                            <TableHead className="text-right font-semibold text-[10px] tracking-wider uppercase text-neutral-400 py-3">Total</TableHead>
                                            <TableHead className="text-right font-semibold text-[10px] tracking-wider uppercase text-neutral-400 py-3">Detalle</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedTicketsSession.sales.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground text-xs font-medium">
                                                    Esta caja todavía no tiene boletas registradas.
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredTicketSales.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground text-xs font-medium">
                                                    No hay boletas para el tipo de pago seleccionado.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredTicketSales.map((sale) => (
                                                <TableRow key={sale.id} className="hover:bg-stone-50/100 dark:hover:bg-stone-900/30 border-b border-stone-200/40 dark:border-stone-800/30 last:border-b-0">
                                                    <TableCell className="py-3">
                                                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md border border-stone-200/50 bg-stone-50/20 dark:border-stone-800/40 dark:bg-stone-900/20 text-foreground">
                                                            #{sale.ticketNumber.toString().padStart(4, "0")}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground py-3">
                                                        {formatDate(sale.createdAt)}
                                                    </TableCell>
                                                    <TableCell className="text-xs font-semibold text-foreground py-3">
                                                        {sale.sellerName}
                                                    </TableCell>
                                                    <TableCell className="py-3">
                                                        <PaymentMethodBadge method={sale.paymentMethod} />
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold text-foreground py-3 text-sm">
                                                        {formatCurrency(sale.total)}
                                                    </TableCell>
                                                    <TableCell className="text-right py-3">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 gap-1.5 rounded-lg border border-stone-200 dark:border-stone-800 bg-background/50 hover:bg-stone-50 dark:hover:bg-stone-900 text-foreground text-[11px] font-semibold transition-all duration-200 shadow-none"
                                                            onClick={() => setSelectedTicketDetail(sale)}
                                                        >
                                                            <Eye className="size-3 text-neutral-400" />
                                                            Ver detalle
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(selectedTicketDetail)}
                onOpenChange={(open) => !open && setSelectedTicketDetail(null)}
            >
                <DialogContent className="max-h-[90vh] grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden sm:max-w-3xl rounded-[2rem] border-stone-200/50 dark:border-stone-800/40 bg-background/98 backdrop-blur-xl shadow-2xl p-6 sm:p-8">
                    {selectedTicketDetail && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-foreground">
                                    <div className="flex size-10 items-center justify-center rounded-2xl bg-stone-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400">
                                        <ReceiptText className="size-5" />
                                    </div>
                                    Detalle de Boleta #{selectedTicketDetail.ticketNumber.toString().padStart(4, "0")}
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground mt-2">
                                    Fecha: <span className="font-semibold">{formatDate(selectedTicketDetail.createdAt)}</span> · Vendedor: <span className="font-semibold">{selectedTicketDetail.sellerName}</span>
                                </DialogDescription>
                            </DialogHeader>

                            <div className="grid gap-4 sm:grid-cols-3">
                                <div className="rounded-2xl border border-stone-200/50 bg-stone-50/20 p-4 dark:border-stone-800/40 dark:bg-neutral-900/5 flex flex-col justify-between">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Método de pago</p>
                                    <div className="mt-2 flex">
                                        <PaymentMethodBadge method={selectedTicketDetail.paymentMethod} />
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-stone-200/50 bg-stone-50/20 p-4 dark:border-stone-800/40 dark:bg-neutral-900/5 flex flex-col justify-between">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Productos</p>
                                    <p className="mt-1 text-sm font-bold text-foreground">{selectedTicketDetail.items.length} productos</p>
                                </div>
                                <div className="rounded-2xl border border-stone-200/50 bg-stone-50/20 p-4 dark:border-stone-800/40 dark:bg-neutral-900/5 flex flex-col justify-between">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Total boleta</p>
                                    <p className="mt-1 text-base font-extrabold text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedTicketDetail.total)}</p>
                                </div>
                            </div>

                            <div
                                className="min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl border border-stone-200/50 dark:border-stone-800/40 bg-background/40 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-neutral-200 [&::-webkit-scrollbar-thumb]:rounded-full dark:[&::-webkit-scrollbar-thumb]:bg-neutral-800 [&::-webkit-scrollbar-track]:transparent"
                                onWheelCapture={handleModalTableWheel}
                            >
                                <Table>
                                    <TableHeader className="bg-stone-50/100 dark:bg-neutral-900/40">
                                        <TableRow className="hover:bg-transparent border-b border-stone-200/50 dark:border-stone-800/40">
                                            <TableHead className="font-semibold text-[10px] tracking-wider uppercase text-neutral-400 py-3">Producto</TableHead>
                                            <TableHead className="text-right font-semibold text-[10px] tracking-wider uppercase text-neutral-400 py-3">Cant.</TableHead>
                                            <TableHead className="text-right font-semibold text-[10px] tracking-wider uppercase text-neutral-400 py-3">Precio</TableHead>
                                            <TableHead className="text-right font-semibold text-[10px] tracking-wider uppercase text-neutral-400 py-3">Subtotal</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedTicketDetail.items.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="py-12 text-center text-muted-foreground text-xs font-medium">
                                                    Esta boleta no tiene productos cargados.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            selectedTicketDetail.items.map((item) => (
                                                <TableRow key={item.id} className="hover:bg-stone-50/100 dark:hover:bg-stone-900/30 border-b border-stone-200/40 dark:border-stone-800/30 last:border-b-0">
                                                    <TableCell className="font-semibold text-xs text-foreground py-3">{item.productName}</TableCell>
                                                    <TableCell className="text-right py-3 text-xs text-neutral-500 font-medium">{item.quantity}</TableCell>
                                                    <TableCell className="text-right py-3 text-xs text-neutral-500 font-medium">{formatCurrency(item.priceAtTime)}</TableCell>
                                                    <TableCell className="text-right font-bold text-foreground py-3 text-xs">
                                                        {formatCurrency(item.quantity * item.priceAtTime)}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
