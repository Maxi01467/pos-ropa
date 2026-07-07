"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
    Wallet,
    ArrowUpCircle,
    ArrowDownCircle,
    LockKeyhole,
    Loader2,
    DollarSign,
    History,
    CheckCircle2,
    BadgeCheck,
    ChevronLeft,
    ChevronRight,
    ReceiptText,
    ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import { toast } from "sonner";
import { cn } from "@/lib/core/utils";
import { formatArgentinaDateTime, formatArgentinaTime } from "@/lib/core/datetime";
import { useSessionSnapshot } from "@/lib/session/session-client";
import { notifyCashSessionUpdated } from "@/lib/session/cash-session-client";
import { CACHE_TAGS } from "@/lib/core/cache-tags";
import { notifyDataUpdated, useDataRefresh } from "@/lib/sync/data-sync-client";
import { getCashRuntime } from "@/lib/offline/cash-runtime";
import {
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import { motion, AnimatePresence } from "motion/react";

type Seller = { id: string; name: string; role: string };

type CashSale = {
    id: string;
    ticketNumber: string;
    total: number;
    paymentMethod: string;
    cashAmount: number | null;
    transferAmount: number | null;
    createdAt: string;
    userId: string;
};

type CashMovement = {
    id: string;
    sessionId: string;
    amount: number;
    type: string;
    reason: string;
    createdAt: string;
};

type CashSession = {
    id: string;
    openedById: string;
    closedById: string | null;
    status: string;
    openingDate: string;
    closingDate: string | null;
    initialAmount: number;
    expectedAmount: number | null;
    actualAmount: number | null;
    difference: number | null;
    openedBy: { id: string; name: string; role: string } | null;
    closedBy: { id: string; name: string; role: string } | null;
    movements: CashMovement[];
    sales: CashSale[];
};

const CASH_MOVEMENTS_PER_PAGE = 8;

function formatCurrency(amount: number | string | null | undefined): string {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 0,
    }).format(Number(amount) || 0);
}


function PaymentMethodDistributionChart({
    session,
}: {
    session: CashSession;
}) {
    const salesCash = session.sales.reduce((acc, sale) => acc + Number(sale.cashAmount || 0), 0);
    const salesTransfer = session.sales.reduce((acc, sale) => acc + Number(sale.transferAmount || 0), 0);
    const totalSales = salesCash + salesTransfer;

    const data = useMemo(() => {
        if (totalSales === 0) {
            return [
                { name: "Sin ventas", value: 1, color: "oklch(0.93 0.006 15)" },
            ];
        }
        return [
            { name: "Efectivo", value: salesCash, color: "#10b981" },
            { name: "Transferencia / Tarjeta", value: salesTransfer, color: "#3b82f6" },
        ];
    }, [salesCash, salesTransfer, totalSales]);

    return (
        <div className="flex flex-1 flex-col gap-4 min-h-0">
            <div className="flex items-center justify-between px-1">
                <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/10 bg-cyan-500/5 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
                        <Wallet className="size-3" />
                        Medios de Pago
                    </div>
                    <h4 className="text-sm font-bold text-foreground mt-1.5 tracking-tight">
                        Distribución de Ventas
                    </h4>
                </div>
                <div className="text-right">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/10 shadow-sm">
                        {session.sales.length} ventas
                    </span>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 mt-4 flex-1 items-center min-h-0">
                {/* Donut Chart */}
                <div className="relative h-[200px] flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={totalSales > 0 ? 4 : 0}
                                dataKey="value"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            {totalSales > 0 && (
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (!active || !payload?.length) return null;
                                        const dataItem = payload[0].payload;
                                        return (
                                            <div className="rounded-[1.5rem] border border-border/70 bg-background/90 p-3 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200 text-xs">
                                                <p className="font-bold text-foreground">{dataItem.name}</p>
                                                <p className="font-black text-muted-foreground mt-1">
                                                    {formatCurrency(dataItem.value)}
                                                </p>
                                            </div>
                                        );
                                    }}
                                />
                            )}
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total Ventas</span>
                        <span className="text-xl font-black text-foreground mt-0.5">{formatCurrency(totalSales)}</span>
                    </div>
                </div>

                {/* Legend and metrics */}
                <div className="flex flex-col gap-4 justify-center">
                    <div className="flex items-center gap-3 bg-muted/30 dark:bg-muted/10 p-3 rounded-2xl border border-border/40">
                        <div className="size-3 rounded-full bg-emerald-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none">Efectivo</p>
                            <p className="text-base font-extrabold text-foreground mt-1">{formatCurrency(salesCash)}</p>
                        </div>
                        {totalSales > 0 && (
                            <span className="text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full shrink-0">
                                {Math.round((salesCash / totalSales) * 100)}%
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 bg-muted/30 dark:bg-muted/10 p-3 rounded-2xl border border-border/40">
                        <div className="size-3 rounded-full bg-blue-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none">Transf. / Tarjeta</p>
                            <p className="text-base font-extrabold text-foreground mt-1">{formatCurrency(salesTransfer)}</p>
                        </div>
                        {totalSales > 0 && (
                            <span className="text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full shrink-0">
                                {Math.round((salesTransfer / totalSales) * 100)}%
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
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
    tone?: "default" | "success" | "danger" | "dark";
}) {
    const iconClassName = cn(
        "flex size-10 shrink-0 items-center justify-center rounded-2xl border",
        tone === "success"
            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
            : tone === "danger"
              ? "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30"
              : tone === "dark"
                ? "bg-neutral-900/5 text-neutral-900 border-neutral-900/10 dark:bg-white/10 dark:text-white dark:border-white/15"
                : "bg-neutral-50 text-neutral-500 border-neutral-200/50 dark:bg-neutral-900/50 dark:text-neutral-400 dark:border-neutral-800/60"
    );

    const valueClassName =
        tone === "success"
            ? "text-emerald-600 dark:text-emerald-400"
            : tone === "danger"
              ? "text-rose-600 dark:text-rose-400"
              : "text-foreground font-extrabold";

    return (
        <Card className="h-full rounded-[2rem] border border-neutral-200/50 bg-background/80 dark:border-neutral-800/40 dark:bg-neutral-900/20 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
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

function EmptyState({ title, description }: { title: string; description: string }) {
    return (
        <div className="rounded-[1.5rem] border border-dashed border-border/80 bg-background/70 px-6 py-16 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted">
                <ReceiptText className="size-5 text-muted-foreground" />
            </div>
            <p className="mt-4 text-base font-semibold text-foreground">{title}</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
    );
}

// ─────────────────────────────────────────────
// SHARED: Apertura de Caja (igual para todos)
// ─────────────────────────────────────────────
function AbrirCajaView({
    sellers,
    selectedSellerId,
    setSelectedSellerId,
    initialAmount,
    setInitialAmount,
    onOpen,
}: {
    sellers: Seller[];
    selectedSellerId: string;
    setSelectedSellerId: (v: string) => void;
    initialAmount: string;
    setInitialAmount: (v: string) => void;
    onOpen: () => void;
}) {
    return (
        <div className="flex flex-col items-center justify-start bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-stone-50 via-neutral-100 to-stone-100 dark:from-neutral-900 dark:via-neutral-950 dark:to-stone-950 min-h-[520px] p-4 sm:p-6 w-full rounded-[2.5rem] relative overflow-hidden">
            <Card className="w-full max-w-md rounded-[2.5rem] border border-stone-200/50 dark:border-neutral-800/40 bg-background/80 dark:bg-neutral-900/10 shadow-2xl p-6 sm:p-8 backdrop-blur-xl relative overflow-hidden group">
                <div className="absolute -right-20 -top-20 size-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none group-hover:bg-cyan-500/15 transition-all duration-500" />
                <div className="absolute -left-20 -bottom-20 size-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none group-hover:bg-indigo-500/15 transition-all duration-500" />
                
                <CardContent className="p-0 relative z-10">
                    <div className="flex flex-col items-center text-center">
                        <div className="mb-4 relative">
                            <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full scale-110" />
                            <motion.div
                                animate={{ rotate: [0, -4, 4, 0] }}
                                transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
                                className="relative flex size-16 items-center justify-center rounded-[1.75rem] border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-inner"
                            >
                                <LockKeyhole className="size-7" />
                            </motion.div>
                        </div>
                        <h2 className="text-2xl font-black tracking-tight text-foreground">
                            Caja Cerrada
                        </h2>
                        <p className="mt-2 text-xs leading-relaxed text-neutral-400 dark:text-neutral-500 max-w-[280px]">
                            Las operaciones de venta y movimientos están bloqueadas. Ingresá los datos del cajero para habilitar el turno.
                        </p>
                    </div>

                    <Separator className="my-6 bg-stone-200/50 dark:bg-neutral-800/40" />

                    <div className="space-y-5">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                                Usuario / Vendedor
                            </Label>
                            <Select value={selectedSellerId} onValueChange={setSelectedSellerId} disabled={sellers.length === 0}>
                                <SelectTrigger className="h-12 w-full text-sm font-semibold rounded-xl border border-stone-200 dark:border-stone-850 bg-background/50 focus:ring-cyan-500/20 shadow-none">
                                    <SelectValue placeholder={sellers.length === 0 ? "Buscando usuarios..." : "¿Quién abre la caja?"} />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-stone-200 dark:border-stone-800">
                                    {sellers.length === 0 ? (
                                        <div className="p-2 text-xs text-center text-neutral-400">Sincronizando usuarios...</div>
                                    ) : (
                                        sellers.map((s) => (
                                            <SelectItem key={s.id} value={s.id} className="text-xs font-semibold rounded-lg">
                                                {s.name}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                                Fondo de Caja (Efectivo Inicial)
                            </Label>
                            <div className="relative">
                                <DollarSign className="absolute left-3.5 top-1/2 size-5.5 -translate-y-1/2 text-neutral-400" />
                                <Input
                                    type="number"
                                    placeholder="Ej: 5000"
                                    className="h-14 pl-10 text-xl font-bold border border-stone-200 dark:border-stone-850 rounded-xl focus-visible:ring-1 focus-visible:ring-cyan-500 bg-background/50"
                                    value={initialAmount}
                                    onChange={(e) => setInitialAmount(e.target.value)}
                                />
                            </div>
                        </div>

                        <motion.div
                            whileHover={{ scale: 1.015 }}
                            whileTap={{ scale: 0.985 }}
                            className="pt-3"
                        >
                            <Button
                                className="h-13 w-full bg-neutral-900 text-white hover:bg-neutral-850 dark:bg-white dark:text-black dark:hover:bg-neutral-100 font-extrabold text-sm rounded-xl transition-all duration-200 shadow-md cursor-pointer"
                                onClick={onOpen}
                            >
                                Habilitar y Abrir Caja
                            </Button>
                        </motion.div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ─────────────────────────────────────────────────────────
// STAFF: Vista simplificada (solo efectivo esperado + cerrar)
// ─────────────────────────────────────────────────────────
function StaffCajaView({
    session,
    sellers,
    selectedSellerId,
    setSelectedSellerId,
    onClose,
}: {
    session: CashSession;
    sellers: Seller[];
    selectedSellerId: string;
    setSelectedSellerId: (v: string) => void;
    onClose: (actualAmount: number, userId: string) => void;
}) {
    const [closeDialogOpen, setCloseDialogOpen] = useState(false);
    const [actualAmount, setActualAmount] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const handleConfirmClose = async () => {
        if (actualAmount === "" || isNaN(Number(actualAmount))) {
            return toast.error("Ingresá el monto real que contaste en la caja");
        }
        setIsSaving(true);
        try {
            await onClose(Number(actualAmount), selectedSellerId);
            setCloseDialogOpen(false);
            setActualAmount("");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <div className="animate-in fade-in duration-300">
                <div className="flex w-full flex-col gap-5">
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Badge 1: Estado y Responsable */}
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/10 bg-emerald-500/[0.03] px-3.5 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 dark:border-emerald-500/20 dark:bg-emerald-500/[0.02] shadow-sm">
                            <span className="relative flex size-2 shrink-0">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
                            </span>
                            <span>
                                Turno activo · Abierto por{" "}
                                <span className="font-extrabold text-foreground">
                                    {session.openedBy?.name ?? "Sin responsable"}
                                </span>{" "}
                                el {formatArgentinaDateTime(session.openingDate).replace(",", " a las")}
                            </span>
                        </div>

                        {/* Badge 2: Fondo Inicial */}
                        <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200/50 bg-neutral-50/50 dark:border-neutral-800/40 dark:bg-neutral-900/10 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm">
                            <span>Fondo inicial:</span>
                            <span className="font-extrabold text-foreground">
                                {formatCurrency(session.initialAmount)}
                            </span>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <MetricCard
                            label="Fondo inicial"
                            value={formatCurrency(session.initialAmount)}
                            description="Monto con el que arrancó la jornada."
                            icon={<DollarSign className="size-5" />}
                        />
                        <MetricCard
                            label="Estado"
                            value="Activo"
                            description="La terminal está disponible para operar."
                            icon={<ShieldCheck className="size-5" />}
                            tone="success"
                        />
                    </div>

                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                        <Card className="rounded-[2rem] border border-neutral-200/50 bg-background dark:border-neutral-800/40 dark:bg-neutral-900/20 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-2xl tracking-tight font-bold text-foreground">
                                    Resumen del cierre
                                </CardTitle>
                                <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                                    Al final del turno contá el efectivo real para registrar el cierre.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-4">
                                    <div className="rounded-2xl border border-neutral-200/50 bg-neutral-50/50 p-5 dark:border-neutral-800/30 dark:bg-neutral-950/20">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-400 dark:text-neutral-500">
                                            Fondo inicial
                                        </p>
                                        <p className="mt-3 text-3xl font-extrabold tracking-tight text-foreground">
                                            {formatCurrency(session.initialAmount)}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-[2rem] border border-neutral-200/50 bg-background dark:border-neutral-800/40 dark:bg-neutral-900/20 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-2xl tracking-tight font-bold text-foreground">
                                    Cierre de turno
                                </CardTitle>
                                <CardDescription className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                                    Registrá el efectivo contado para cerrar la caja.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Responsable del cierre</Label>
                                    <Select value={selectedSellerId} onValueChange={setSelectedSellerId} disabled={sellers.length === 0}>
                                        <SelectTrigger className="w-full rounded-xl border border-neutral-200 dark:border-neutral-850 bg-background/50 text-xs font-semibold h-10 shadow-none">
                                            <SelectValue placeholder={sellers.length === 0 ? "Cargando..." : "Seleccioná un usuario"} />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-neutral-200 dark:border-neutral-800">
                                            {sellers.length > 0 ? (
                                                sellers.map((s) => (
                                                    <SelectItem key={s.id} value={s.id} className="text-xs font-medium rounded-lg">
                                                        {s.name}
                                                    </SelectItem>
                                                ))
                                            ) : (
                                                <div className="p-2 text-xs text-center text-neutral-500">Sin usuarios</div>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="rounded-2xl border border-neutral-200/40 bg-neutral-50/30 p-4 text-xs font-semibold text-neutral-500 dark:border-neutral-800/30 dark:bg-neutral-950/15 dark:text-neutral-400">
                                    Ingresá el efectivo contado para completar el arqueo.
                                </div>
                                <Button
                                    className="w-full bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-100 font-semibold text-xs h-11 rounded-xl transition-all duration-200 shadow-sm"
                                    onClick={() => setCloseDialogOpen(true)}
                                >
                                    Realizar arqueo y cerrar
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Dialog arqueo staff */}
            <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-[2rem] border border-neutral-200/50 dark:border-neutral-800/40 bg-background shadow-2xl p-6 sm:p-7">
                    <DialogHeader className="mb-3">
                        <DialogTitle className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-foreground">
                            <div className="flex size-10 items-center justify-center rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/60 text-neutral-500 dark:text-neutral-400">
                                <Wallet className="size-5" />
                            </div>
                            Arqueo de Caja
                        </DialogTitle>
                        <DialogDescription className="text-xs text-neutral-500 dark:text-neutral-400 mt-2.5 leading-relaxed">
                            Contá los billetes del cajón e introducí el total contado para conciliar el saldo.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5 py-2">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Efectivo Real (Contado por vos)</Label>
                            <div className="relative">
                                <DollarSign className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-neutral-400" />
                                <Input
                                    type="number"
                                    placeholder="Ej: 24500"
                                    className="h-12 pl-10 text-lg font-bold border border-neutral-200 dark:border-neutral-850 rounded-xl focus-visible:ring-1 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-700 bg-background/50"
                                    value={actualAmount}
                                    onChange={(e) => setActualAmount(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="mt-4 flex flex-row gap-2 sm:justify-end">
                        <Button variant="outline" onClick={() => setCloseDialogOpen(false)} className="rounded-xl h-10 text-xs font-semibold border-neutral-200 dark:border-neutral-800 px-4 flex-1 sm:flex-none transition-[background-color,transform] duration-150 active:scale-[0.98]">
                            Cancelar
                        </Button>
                        <Button
                            className="bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-100 rounded-xl h-10 text-xs font-semibold px-4 flex-1 sm:flex-none transition-[background-color,transform] duration-150 active:scale-[0.985]"
                            onClick={handleConfirmClose}
                            disabled={isSaving}
                        >
                            {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                            Confirmar Cierre
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────
// ADMIN: Vista completa (stats, movimientos, dos opciones de cierre)
// ─────────────────────────────────────────────────────────────────────
function AdminCajaView({
    session,
    sellers,
    selectedSellerId,
    setSelectedSellerId,
    onClose,
    onCloseWithoutCount,
    onAddMovement,
}: {
    session: CashSession;
    sellers: Seller[];
    selectedSellerId: string;
    setSelectedSellerId: (v: string) => void;
    onClose: (actualAmount: number, userId: string) => void;
    onCloseWithoutCount: (userId: string) => void;
    onAddMovement: (amount: number, type: "INGRESO" | "EGRESO", reason: string) => void;
}) {
    const [movementDialogOpen, setMovementDialogOpen] = useState(false);
    const [movementType, setMovementType] = useState<"INGRESO" | "EGRESO">("EGRESO");
    const [movementAmount, setMovementAmount] = useState("");
    const [movementReason, setMovementReason] = useState("");

    const [closeDialogOpen, setCloseDialogOpen] = useState(false);
    const [closeMethod, setCloseMethod] = useState<"ARQUEO" | "SIN_ARQUEO">("ARQUEO");
    const [actualAmount, setActualAmount] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [currentMovementsPage, setCurrentMovementsPage] = useState(1);
    const [expandedMovementId, setExpandedMovementId] = useState<string | null>(null);

    const salesCash = session.sales.reduce((acc, sale) => acc + Number(sale.cashAmount || 0), 0);
    const salesTransfer = session.sales.reduce(
        (acc, sale) => acc + Number(sale.transferAmount || 0),
        0
    );
    const manualIn = session.movements
        .filter((m) => m.type === "INGRESO")
        .reduce((acc, m) => acc + m.amount, 0);
    const manualOut = session.movements
        .filter((m) => m.type === "EGRESO")
        .reduce((acc, m) => acc + m.amount, 0);
    const expectedCash =
        Number(session.initialAmount) + salesCash + manualIn - manualOut;
    const totalMovementPages = Math.max(1, Math.ceil(session.movements.length / CASH_MOVEMENTS_PER_PAGE));
    const paginatedMovements = useMemo(() => {
        const start = (currentMovementsPage - 1) * CASH_MOVEMENTS_PER_PAGE;
        return session.movements.slice(start, start + CASH_MOVEMENTS_PER_PAGE);
    }, [currentMovementsPage, session.movements]);

    useEffect(() => {
        if (currentMovementsPage > totalMovementPages) {
            const timeoutId = setTimeout(() => {
                setCurrentMovementsPage(totalMovementPages);
            }, 0);
            return () => clearTimeout(timeoutId);
        }
    }, [currentMovementsPage, totalMovementPages]);

    const handleAddMovement = async () => {
        if (!movementAmount || isNaN(Number(movementAmount)) || Number(movementAmount) <= 0)
            return toast.error("Monto inválido");
        if (!movementReason.trim()) return toast.error("Ingresá un motivo");
        onAddMovement(Number(movementAmount), movementType, movementReason);
        setMovementDialogOpen(false);
        setMovementAmount("");
        setMovementReason("");
    };

    const handleConfirmClose = async () => {
        if (actualAmount === "" || isNaN(Number(actualAmount)))
            return toast.error("Ingresá el monto real que contaste en la caja");
        setIsSaving(true);
        try {
            await onClose(Number(actualAmount), selectedSellerId);
            setCloseDialogOpen(false);
            setActualAmount("");
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmCloseWithout = async () => {
        setIsSaving(true);
        try {
            await onCloseWithoutCount(selectedSellerId);
            setCloseDialogOpen(false);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <>
            <div className="animate-in fade-in duration-300">
                <div className="flex w-full flex-col gap-5">
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Badge 1: Estado y Responsable */}
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/10 bg-emerald-500/[0.03] px-3.5 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 dark:border-emerald-500/20 dark:bg-emerald-500/[0.02] shadow-sm">
                            <span className="relative flex size-2 shrink-0">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
                            </span>
                            <span>
                                Turno activo · Abierto por{" "}
                                <span className="font-extrabold text-foreground">
                                    {session.openedBy?.name ?? "Sin responsable"}
                                </span>{" "}
                                el {formatArgentinaDateTime(session.openingDate, { year: undefined }).replace(",", " a las")}
                            </span>
                        </div>

                        {/* Badge 2: Fondo Inicial */}
                        <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200/50 bg-neutral-50/50 dark:border-neutral-800/40 dark:bg-neutral-900/10 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm">
                            <span>Fondo inicial:</span>
                            <span className="font-extrabold text-foreground">
                                {formatCurrency(session.initialAmount)}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-6 lg:h-[calc(100vh-250px)] min-h-0">
                        {/* Fila 1: Grid Bento Asimétrico de 12 columnas en Desktop */}
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-12 shrink-0">
                            {/* Cierre de Turno (Tarjeta Principal Bento) */}
                            <Card className="rounded-[2rem] border border-cyan-500/20 dark:border-cyan-400/15 bg-gradient-to-br from-cyan-500/5 via-sky-500/5 to-transparent dark:from-cyan-950/20 dark:via-sky-900/10 dark:to-transparent bg-background/85 shadow-sm hover:shadow-md hover:border-cyan-500/35 dark:hover:border-cyan-400/25 transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 flex flex-col justify-between p-5 col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-4 relative overflow-hidden group min-h-[160px]">
                                <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-cyan-500 via-sky-400 to-indigo-500" />
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="relative flex size-2 shrink-0">
                                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
                                                <span className="relative inline-flex size-2 rounded-full bg-cyan-500"></span>
                                            </span>
                                            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-600 dark:text-cyan-400">
                                                Cierre de turno
                                            </p>
                                        </div>
                                        <p className="mt-2 text-2.5xl font-black text-foreground tracking-tight">
                                            {formatCurrency(expectedCash)}
                                        </p>
                                        <p className="mt-1 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                                            Efectivo esperado
                                        </p>
                                    </div>
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                                        <Wallet className="size-5" />
                                    </div>
                                </div>
                                <Button
                                    className="w-full bg-cyan-600 text-white hover:bg-cyan-500 dark:bg-cyan-500 dark:text-black dark:hover:bg-cyan-400 font-extrabold text-xs h-9.5 rounded-xl transition-[background-color,transform] duration-150 ease-out active:scale-[0.985] shadow-sm cursor-pointer mt-3"
                                    onClick={() => setCloseDialogOpen(true)}
                                >
                                    Cerrar Caja
                                </Button>
                            </Card>

                            {/* Métricas clave (Distribuidas asimétricamente en el Bento Grid) */}
                            <div className="col-span-1 lg:col-span-2 h-full">
                                <MetricCard
                                    label="Efectivo en caja"
                                    value={formatCurrency(expectedCash)}
                                    description={`Fondo inicial ${formatCurrency(session.initialAmount)}`}
                                    icon={<Wallet className="size-5" />}
                                    tone="dark"
                                />
                            </div>
                            <div className="col-span-1 lg:col-span-2 h-full">
                                <MetricCard
                                    label="Ventas efectivo"
                                    value={formatCurrency(salesCash)}
                                    description="Cobros que impactan en el cajón."
                                    icon={<DollarSign className="size-5" />}
                                />
                            </div>
                            <div className="col-span-1 lg:col-span-2 h-full">
                                <MetricCard
                                    label="Transferencias"
                                    value={formatCurrency(salesTransfer)}
                                    description="Cobros digitales fuera del efectivo."
                                    icon={<ChevronRight className="size-5" />}
                                    tone="success"
                                />
                            </div>
                            <div className="col-span-1 lg:col-span-2 h-full">
                                <MetricCard
                                    label="Retiros / gastos"
                                    value={formatCurrency(manualOut)}
                                    description="Salidas manuales registradas."
                                    icon={<ArrowDownCircle className="size-5" />}
                                    tone="danger"
                                />
                            </div>
                        </div>

                        {/* Fila 2: Tabla de Movimientos (3/5) + Gráfico (2/5) */}
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 flex-1 min-h-0">
                            {/* Tabla de Movimientos */}
                            <Card className="flex min-h-0 flex-col rounded-[2rem] border border-neutral-200/50 bg-background/80 dark:border-neutral-800/40 dark:bg-neutral-900/20 shadow-sm lg:col-span-3">
                                <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between p-5 pb-3">
                                    <div>
                                        <CardTitle className="flex items-center gap-2 text-sm font-bold tracking-tight">
                                            <History className="size-4 text-muted-foreground" />
                                            Movimientos de hoy
                                        </CardTitle>
                                    </div>
                                    <Button
                                        size="sm"
                                        className="bg-slate-900 text-white hover:bg-slate-800 text-[10px] font-bold px-3 py-1.5 h-8 rounded-xl shadow-none"
                                        onClick={() => {
                                            setMovementType("EGRESO");
                                            setMovementDialogOpen(true);
                                        }}
                                    >
                                        + Nuevo
                                    </Button>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-y-auto min-h-0 px-5 pb-5">
                                    {session.movements.length === 0 ? (
                                        <EmptyState
                                            title="Sin movimientos"
                                            description="No registraste ingresos ni retiros en esta jornada."
                                        />
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="rounded-2xl border border-stone-200/50 bg-background/50 overflow-hidden dark:border-neutral-800/40 dark:bg-neutral-900/10 shadow-sm divide-y divide-stone-200/40 dark:divide-stone-800/30">
                                                {paginatedMovements.map((mov) => {
                                                    const isIngreso = mov.type === "INGRESO";
                                                    const isExpanded = expandedMovementId === mov.id;
                                                    return (
                                                        <div key={mov.id} className="flex flex-col">
                                                            <div
                                                                className="flex items-center justify-between p-4 hover:bg-stone-50/100 dark:hover:bg-stone-900/45 transition-colors duration-200 cursor-pointer select-none"
                                                                onClick={() => setExpandedMovementId(isExpanded ? null : mov.id)}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div
                                                                        className={cn(
                                                                            "flex size-9 shrink-0 items-center justify-center rounded-full border transition-transform duration-300",
                                                                            isIngreso
                                                                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30"
                                                                                : "bg-rose-500/10 text-rose-600 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400 dark:border-rose-500/30",
                                                                            isExpanded && "scale-105"
                                                                        )}
                                                                    >
                                                                        {isIngreso ? (
                                                                            <ArrowUpCircle className="size-4.5" />
                                                                        ) : (
                                                                            <ArrowDownCircle className="size-4.5" />
                                                                        )}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="font-extrabold text-xs text-foreground truncate max-w-[150px]">{mov.reason}</p>
                                                                        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-semibold mt-0.5">
                                                                            {formatArgentinaTime(mov.createdAt)} hs
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2.5">
                                                                    <p
                                                                        className={cn(
                                                                            "font-black text-xs shrink-0",
                                                                            isIngreso
                                                                                ? "text-emerald-600 dark:text-emerald-400"
                                                                                : "text-rose-600 dark:text-rose-400"
                                                                        )}
                                                                    >
                                                                        {isIngreso ? "+" : "-"}
                                                                        {formatCurrency(mov.amount)}
                                                                    </p>
                                                                    <motion.span
                                                                        animate={{ rotate: isExpanded ? 90 : 0 }}
                                                                        transition={{ type: "spring", duration: 0.25, bounce: 0 }}
                                                                        className="text-neutral-400 dark:text-neutral-500"
                                                                    >
                                                                        <ChevronRight className="size-3.5 animate-in fade-in duration-200" />
                                                                    </motion.span>
                                                                </div>
                                                            </div>
                                                            <AnimatePresence initial={false}>
                                                                {isExpanded && (
                                                                    <motion.div
                                                                        initial={{ height: 0, opacity: 0 }}
                                                                        animate={{ height: "auto", opacity: 1 }}
                                                                        exit={{ height: 0, opacity: 0 }}
                                                                        transition={{ type: "spring", duration: 0.25, bounce: 0 }}
                                                                        className="overflow-hidden border-t border-stone-200/40 dark:border-stone-800/30 bg-stone-50/40 dark:bg-neutral-900/10 text-[11px] text-neutral-500 dark:text-neutral-400"
                                                                    >
                                                                        <div className="p-4 space-y-2.5 font-medium leading-normal">
                                                                            <div className="flex justify-between items-center">
                                                                                <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">Identificador único</span>
                                                                                <span className="font-mono text-[10px] text-foreground select-all bg-stone-100/50 dark:bg-stone-900/50 px-1.5 py-0.5 rounded border border-stone-200/30">{mov.id}</span>
                                                                            </div>
                                                                            <div className="flex justify-between items-center">
                                                                                <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">Concepto / Motivo</span>
                                                                                <span className="text-foreground font-semibold">{mov.reason}</span>
                                                                            </div>
                                                                            <div className="flex justify-between items-center">
                                                                                <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">Tipo de flujo</span>
                                                                                <span className={cn("font-bold px-2 py-0.5 rounded-full text-[10px] border", isIngreso ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/15" : "bg-rose-500/10 text-rose-600 border-rose-500/15")}>
                                                                                    {isIngreso ? "Ingreso Manual" : "Egreso / Gasto"}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex justify-between items-center">
                                                                                <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">Fecha y Hora</span>
                                                                                <span className="text-foreground font-semibold">{formatArgentinaDateTime(mov.createdAt)}</span>
                                                                            </div>
                                                                        </div>
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Paginación Numérica Centralizada */}
                                            <div className="flex flex-col items-center justify-center gap-2 border-t border-neutral-200/40 pt-4 dark:border-neutral-800/30">
                                                <div className="flex items-center gap-0.5">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 rounded-full text-neutral-400 hover:text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all duration-200"
                                                        onClick={() => setCurrentMovementsPage((page) => Math.max(1, page - 1))}
                                                        disabled={currentMovementsPage === 1}
                                                    >
                                                        <ChevronLeft className="size-3.5" />
                                                    </Button>
                                                    
                                                    {getPageNumbers(currentMovementsPage, totalMovementPages).map((page, idx) => {
                                                        if (page === "...") {
                                                            return (
                                                                <span key={`elipsis-${idx}`} className="px-1.5 text-xs text-neutral-400 font-medium select-none">
                                                                    ...
                                                                </span>
                                                            );
                                                        }
                                                        
                                                        const isCurrent = page === currentMovementsPage;
                                                        return (
                                                            <Button
                                                                key={`page-${page}`}
                                                                variant={isCurrent ? "default" : "ghost"}
                                                                size="icon"
                                                                className={cn(
                                                                    "h-7 w-7 text-[10px] font-semibold rounded-full transition-all duration-200",
                                                                    isCurrent 
                                                                        ? "bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-100 shadow-sm" 
                                                                        : "text-neutral-500 hover:text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-900"
                                                                )}
                                                                onClick={() => setCurrentMovementsPage(page as number)}
                                                            >
                                                                {page}
                                                            </Button>
                                                        );
                                                    })}

                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 rounded-full text-neutral-400 hover:text-foreground hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all duration-200"
                                                        onClick={() => setCurrentMovementsPage((page) => Math.min(totalMovementPages, page + 1))}
                                                        disabled={currentMovementsPage === totalMovementPages}
                                                    >
                                                        <ChevronRight className="size-3.5" />
                                                    </Button>
                                                </div>
                                                <p className="text-[10px] font-semibold text-neutral-555 dark:text-neutral-400">
                                                    Mostrando {Math.min(session.movements.length, (currentMovementsPage - 1) * CASH_MOVEMENTS_PER_PAGE + 1)}-{Math.min(session.movements.length, currentMovementsPage * CASH_MOVEMENTS_PER_PAGE)} de {session.movements.length}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Gráfico de distribución de medios de pago */}
                            <Card className="flex h-full flex-col rounded-[2rem] border border-neutral-200/50 bg-background/80 dark:border-neutral-800/40 dark:bg-neutral-900/20 shadow-sm overflow-hidden p-6 lg:col-span-2">
                                <PaymentMethodDistributionChart session={session} />
                            </Card>
                        </div>
                    </div>
                </div>
            </div>


            {/* Dialog movimiento */}
            <Dialog open={movementDialogOpen} onOpenChange={setMovementDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-[2rem] border border-neutral-200/50 dark:border-neutral-800/40 bg-background shadow-2xl p-6 sm:p-7">
                    <DialogHeader className="mb-3">
                        <DialogTitle className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-foreground">
                            <div className="flex size-10 items-center justify-center rounded-2xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200/50 dark:border-neutral-800/60 text-neutral-500 dark:text-neutral-400">
                                <History className="size-5" />
                            </div>
                            Registrar Movimiento
                        </DialogTitle>
                        <DialogDescription className="text-xs text-neutral-500 dark:text-neutral-400 mt-2.5 leading-relaxed">
                            El monto afectará el total esperado en efectivo al final del día.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {/* Selector de Movimientos Segmentado iOS Style */}
                        <div className="relative grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-900 border border-neutral-200/30 dark:border-neutral-800/50">
                            <Button
                                type="button"
                                variant="ghost"
                                className={cn(
                                    "flex h-9 items-center justify-center gap-2 rounded-lg text-xs font-semibold transition-all shadow-none",
                                    movementType === "EGRESO"
                                        ? "bg-white text-rose-600 shadow-sm dark:bg-neutral-800 dark:text-rose-400"
                                        : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200 bg-transparent hover:bg-neutral-50 dark:hover:bg-neutral-850"
                                )}
                                onClick={() => setMovementType("EGRESO")}
                            >
                                <ArrowDownCircle className="size-4" />
                                Retiro / Gasto
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                className={cn(
                                    "flex h-9 items-center justify-center gap-2 rounded-lg text-xs font-semibold transition-all shadow-none",
                                    movementType === "INGRESO"
                                        ? "bg-white text-emerald-600 shadow-sm dark:bg-neutral-800 dark:text-emerald-400"
                                        : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200 bg-transparent hover:bg-neutral-50 dark:hover:bg-neutral-850"
                                )}
                                onClick={() => setMovementType("INGRESO")}
                            >
                                <ArrowUpCircle className="size-4" />
                                Ingreso Extra
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Monto</Label>
                            <div className="relative">
                                <DollarSign className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-neutral-400" />
                                <Input
                                    type="number"
                                    placeholder="Ej: 1500"
                                    className="h-12 pl-10 text-lg font-bold border border-neutral-200 dark:border-neutral-850 rounded-xl focus-visible:ring-1 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-700 bg-background/50"
                                    value={movementAmount}
                                    onChange={(e) => setMovementAmount(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Motivo / Descripción</Label>
                            <Input
                                placeholder={
                                    movementType === "EGRESO"
                                        ? "Ej: Compra de artículos de limpieza"
                                        : "Ej: Cambio extra prestado"
                                }
                                className="h-11 text-xs border border-neutral-200 dark:border-neutral-850 rounded-xl focus-visible:ring-1 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-700 bg-background/50"
                                value={movementReason}
                                onChange={(e) => setMovementReason(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter className="mt-4 flex flex-row gap-2 sm:justify-end">
                        <Button variant="outline" onClick={() => setMovementDialogOpen(false)} className="rounded-xl h-10 text-xs font-semibold border-neutral-200 dark:border-neutral-800 px-4 flex-1 sm:flex-none">
                            Cancelar
                        </Button>
                        <Button
                            className={cn(
                                "rounded-xl h-10 text-xs font-semibold px-4 flex-1 sm:flex-none text-white dark:text-black",
                                movementType === "INGRESO"
                                    ? "bg-emerald-600 hover:bg-emerald-500 dark:bg-emerald-400 dark:hover:bg-emerald-300"
                                    : "bg-rose-600 hover:bg-rose-500 dark:bg-rose-400 dark:hover:bg-rose-300"
                            )}
                            onClick={handleAddMovement}
                        >
                            Guardar {movementType.toLowerCase()}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog único y consolidado de Cierre de Caja */}
            <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-[2.2rem] border border-neutral-200/60 dark:border-neutral-800/50 bg-background shadow-2xl p-6 sm:p-7">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-foreground">
                            <div className="flex size-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-neutral-850 border border-neutral-200/50 dark:border-neutral-800/60 text-slate-800 dark:text-neutral-200">
                                <Wallet className="size-5" />
                            </div>
                            Cierre de Caja
                        </DialogTitle>
                        <DialogDescription className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed">
                            Configurá las opciones para finalizar el turno de caja de forma segura.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-1">
                        {/* Selector de responsable del cierre */}
                        <div className="space-y-2">
                            <Label className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Responsable del cierre</Label>
                            <Select value={selectedSellerId} onValueChange={setSelectedSellerId} disabled={sellers.length === 0}>
                                <SelectTrigger className="w-full rounded-xl border border-neutral-200 dark:border-neutral-850 bg-background text-xs font-semibold h-10 shadow-none">
                                    <SelectValue placeholder={sellers.length === 0 ? "Cargando..." : "Seleccioná un usuario"} />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-neutral-200 dark:border-neutral-800">
                                    {sellers.length > 0 ? (
                                        sellers.map((s) => (
                                            <SelectItem key={s.id} value={s.id} className="text-xs font-medium rounded-lg">
                                                {s.name}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <div className="p-2 text-xs text-center text-neutral-500">Sin usuarios</div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Tipo de cierre segmentado iOS style */}
                        <div className="space-y-2">
                            <Label className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Tipo de cierre</Label>
                            <div className="relative grid grid-cols-2 gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-900 border border-neutral-200/30 dark:border-neutral-800/50">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className={cn(
                                        "flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all shadow-none",
                                        closeMethod === "ARQUEO"
                                            ? "bg-white text-slate-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                                            : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200 bg-transparent"
                                    )}
                                    onClick={() => setCloseMethod("ARQUEO")}
                                >
                                    <CheckCircle2 className="size-4 text-emerald-500" />
                                    Con Arqueo
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className={cn(
                                        "flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all shadow-none",
                                        closeMethod === "SIN_ARQUEO"
                                            ? "bg-white text-amber-600 shadow-sm dark:bg-neutral-800 dark:text-amber-400"
                                            : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200 bg-transparent"
                                    )}
                                    onClick={() => setCloseMethod("SIN_ARQUEO")}
                                >
                                    <BadgeCheck className="size-4 text-amber-500" />
                                    Cierre Rápido
                                </Button>
                            </div>
                        </div>

                        {/* Contenido condicional según método */}
                        {closeMethod === "ARQUEO" ? (
                            <div className="space-y-4 pt-1 animate-in fade-in duration-200">
                                {/* Resumen del Día en forma de Ticket/Recibo */}
                                <div className="rounded-2xl border border-neutral-200/50 bg-neutral-50/30 p-4 dark:border-neutral-800/40 dark:bg-neutral-950/20 space-y-3">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400 dark:text-neutral-500 border-b border-neutral-200/40 dark:border-neutral-800/40 pb-2">
                                        Flujo de caja registrado
                                    </p>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
                                            <span>Fondo inicial</span>
                                            <span className="font-semibold text-foreground">{formatCurrency(session.initialAmount)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                                            <span>Ventas en efectivo</span>
                                            <span className="font-extrabold">+{formatCurrency(salesCash)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-cyan-600 dark:text-cyan-400">
                                            <span>Cobros por transferencia</span>
                                            <span className="font-extrabold">+{formatCurrency(salesTransfer)}</span>
                                        </div>
                                        {manualIn > 0 && (
                                            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                                                <span>Ingresos manuales</span>
                                                <span className="font-extrabold">+{formatCurrency(manualIn)}</span>
                                            </div>
                                        )}
                                        {manualOut > 0 && (
                                            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
                                                <span>Retiros manuales</span>
                                                <span className="font-extrabold">-{formatCurrency(manualOut)}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between border-t border-dashed border-neutral-300 dark:border-neutral-850 pt-2.5 font-bold text-sm text-foreground">
                                            <span>Efectivo esperado</span>
                                            <span className="text-base font-black">{formatCurrency(expectedCash)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Efectivo Real en Caja</Label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-neutral-400" />
                                        <Input
                                            type="number"
                                            placeholder="Contá y escribí el total"
                                            className="h-12 pl-10 text-lg font-bold border border-neutral-200 dark:border-neutral-855 rounded-xl focus-visible:ring-1 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-700 bg-background/50"
                                            value={actualAmount}
                                            onChange={(e) => setActualAmount(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-in fade-in duration-200">
                                {/* Resumen del Día también para Cierre Rápido */}
                                <div className="rounded-2xl border border-neutral-200/50 bg-neutral-50/30 p-4 dark:border-neutral-800/40 dark:bg-neutral-950/20 space-y-3">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400 dark:text-neutral-500 border-b border-neutral-200/40 dark:border-neutral-800/40 pb-2">
                                        Flujo de caja registrado
                                    </p>
                                    <div className="space-y-2 text-xs">
                                        <div className="flex items-center justify-between text-neutral-500 dark:text-neutral-400">
                                            <span>Fondo inicial</span>
                                            <span className="font-semibold text-foreground">{formatCurrency(session.initialAmount)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                                            <span>Ventas efectivo</span>
                                            <span className="font-extrabold">+{formatCurrency(salesCash)}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-cyan-600 dark:text-cyan-400">
                                            <span>Transferencias</span>
                                            <span className="font-extrabold">+{formatCurrency(salesTransfer)}</span>
                                        </div>
                                        <div className="flex items-center justify-between border-t border-dashed border-neutral-300 dark:border-neutral-855 pt-2.5 font-bold text-sm text-foreground">
                                            <span>Total esperado</span>
                                            <span className="text-base font-black">{formatCurrency(expectedCash)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-amber-500/10 bg-amber-500/[0.02] p-4 dark:border-amber-500/20 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                                    <p className="font-bold mb-1">Cierre sin arqueo de caja</p>
                                    La caja quedará cerrada operativamente y ya no aceptará ventas. Podrás realizar el conteo físico y registrar el arqueo más adelante desde la pestaña <span className="font-semibold underline">Arqueos</span>.
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="mt-4 flex flex-row gap-2 sm:justify-end">
                        <Button variant="ghost" onClick={() => setCloseDialogOpen(false)} className="rounded-xl h-10 text-xs font-semibold px-4 flex-1 sm:flex-none">
                            Cancelar
                        </Button>
                        {closeMethod === "ARQUEO" ? (
                            <Button
                                className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-100 rounded-xl h-10 text-xs font-semibold px-4 flex-1 sm:flex-none"
                                onClick={handleConfirmClose}
                                disabled={isSaving}
                            >
                                {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                                Confirmar y Cerrar
                            </Button>
                        ) : (
                            <Button
                                className="bg-amber-600 hover:bg-amber-500 text-white dark:bg-amber-500 dark:hover:bg-amber-400 dark:text-black rounded-xl h-10 text-xs font-semibold px-4 flex-1 sm:flex-none shadow-none"
                                onClick={handleConfirmCloseWithout}
                                disabled={isSaving}
                            >
                                {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                                Sí, Cerrar Turno
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ─────────────────────────────────────────────
// ROOT PAGE
// ─────────────────────────────────────────────
export function CurrentCashTab() {
    const { role, userId } = useSessionSnapshot();
    const isAdmin = role === "ADMIN";
    const cashRuntime = useMemo(() => getCashRuntime(), []);

    const [session, setSession] = useState<CashSession | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [sellers, setSellers] = useState<Seller[]>([]);
    const [selectedSellerId, setSelectedSellerId] = useState("");
    const [initialAmount, setInitialAmount] = useState("");

    // Modal de éxito simple para staff
    const [staffSuccessOpen, setStaffSuccessOpen] = useState(false);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [currentSession, sellersData] = await Promise.all([
                cashRuntime.getCurrentSession(),
                cashRuntime.getSellers(),
            ]);
            setSession(currentSession as CashSession | null);
            setSellers(sellersData as Seller[]);
            setIsLoading(false);
        } catch (error: unknown) {
            console.error("Caja Load Error:", error);
            toast.error(
                "Error al cargar la caja: " +
                    (error instanceof Error ? error.message : String(error))
            );
            setIsLoading(false);
        }
    }, [cashRuntime]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            void loadData();
        }, 0);
        return () => clearTimeout(timeoutId);
    }, [loadData]);

    useDataRefresh([CACHE_TAGS.cash, CACHE_TAGS.sales, CACHE_TAGS.employees], loadData, {
        pollIntervalMs: false,
    });

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            setSelectedSellerId((currentSelectedSellerId) => {
                if (
                    currentSelectedSellerId &&
                    sellers.some((seller) => seller.id === currentSelectedSellerId)
                ) {
                    return currentSelectedSellerId;
                }

                if (userId && sellers.some((seller) => seller.id === userId)) {
                    return userId;
                }

                return sellers[0]?.id ?? "";
            });
        }, 0);
        return () => clearTimeout(timeoutId);
    }, [sellers, userId]);

    const handleOpenBox = async () => {
        const parsedInitialAmount = Number(initialAmount);

        if (initialAmount.trim() === "" || Number.isNaN(parsedInitialAmount) || parsedInitialAmount < 0)
            return toast.error("Ingresá un monto inicial válido");
        if (!selectedSellerId) return toast.error("Seleccioná un usuario");
        try {
            const openedSession = await cashRuntime.openCashSession(parsedInitialAmount, selectedSellerId);
            setSession(openedSession as CashSession);
            notifyCashSessionUpdated(true);
            notifyDataUpdated([CACHE_TAGS.cash, CACHE_TAGS.attendance]);
            toast.success("Caja abierta correctamente");
            setInitialAmount("");
            await loadData();
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Error al abrir la caja");
        }
    };

    const handleCloseWithArqueo = async (actualAmount: number, userId: string) => {
        if (!session) return;
        try {
            await cashRuntime.closeCashSession(session.id, actualAmount, userId);
            setSession(null);
            notifyCashSessionUpdated(false);
            notifyDataUpdated([CACHE_TAGS.cash, CACHE_TAGS.sales, CACHE_TAGS.attendance]);
            if (isAdmin) {
                toast.success("Caja cerrada exitosamente");
            } else {
                // Staff: solo modal de éxito simple
                setStaffSuccessOpen(true);
            }
            await loadData();
        } catch {
            toast.error("Error al cerrar la caja");
        }
    };

    const handleCloseWithoutCount = async (userId: string) => {
        if (!session) return;
        try {
            await cashRuntime.closeCashSessionWithoutCount(session.id, userId);
            setSession(null);
            notifyCashSessionUpdated(false);
            notifyDataUpdated([CACHE_TAGS.cash, CACHE_TAGS.sales, CACHE_TAGS.attendance]);
            toast.success("Caja cerrada. El arqueo quedó pendiente en la pestaña Arqueos.");
            await loadData();
        } catch {
            toast.error("Error al cerrar la caja");
        }
    };

    const handleAddMovement = async (
        amount: number,
        type: "INGRESO" | "EGRESO",
        reason: string
    ) => {
        if (!session) return;
        try {
            await cashRuntime.addCashMovement(session.id, amount, type, reason);
            notifyDataUpdated(CACHE_TAGS.cash);
            toast.success("Movimiento registrado");
            await loadData();
        } catch {
            toast.error("Error al registrar movimiento");
        }
    };

    if (isLoading) {
        return (
            <ScreenLoader
                layout="centered"
                message="Cargando caja..."
                description="Estamos trayendo la sesión y los vendedores."
            />
        );
    }

    let mainContent: ReactNode;

    if (!session) {
        mainContent = (
            <AbrirCajaView
                sellers={sellers}
                selectedSellerId={selectedSellerId}
                setSelectedSellerId={setSelectedSellerId}
                initialAmount={initialAmount}
                setInitialAmount={setInitialAmount}
                onOpen={handleOpenBox}
            />
        );
    } else if (isAdmin) {
        mainContent = (
            <AdminCajaView
                session={session}
                sellers={sellers}
                selectedSellerId={selectedSellerId}
                setSelectedSellerId={setSelectedSellerId}
                onClose={handleCloseWithArqueo}
                onCloseWithoutCount={handleCloseWithoutCount}
                onAddMovement={handleAddMovement}
            />
        );
    } else {
        mainContent = (
            <StaffCajaView
                session={session}
                sellers={sellers}
                selectedSellerId={selectedSellerId}
                setSelectedSellerId={setSelectedSellerId}
                onClose={handleCloseWithArqueo}
            />
        );
    }

    return (
        <>
            {mainContent}

            {/* Modal éxito simple para STAFF */}
            <Dialog open={staffSuccessOpen} onOpenChange={setStaffSuccessOpen}>
                <DialogContent className="sm:max-w-sm rounded-[2rem] border border-neutral-200/50 dark:border-neutral-800/40 bg-background shadow-2xl p-6 sm:p-7 text-center">
                    <DialogHeader className="mb-3">
                        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                            <CheckCircle2 className="size-6" />
                        </div>
                        <DialogTitle className="text-center text-xl font-bold tracking-tight text-foreground">Caja cerrada</DialogTitle>
                        <DialogDescription className="text-center text-xs text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed">
                            El turno fue cerrado exitosamente. ¡Hasta la próxima!
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button
                            className="w-full bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-100 rounded-xl h-10 text-xs font-semibold px-4 shadow-none"
                            onClick={() => setStaffSuccessOpen(false)}
                        >
                            Entendido
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
