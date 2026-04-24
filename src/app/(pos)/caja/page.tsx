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
    ChevronRight,
    ReceiptText,
    ShieldCheck,
    Landmark,
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
import { toast } from "sonner";
import { cn } from "@/lib/core/utils";
import { formatArgentinaDateTime, formatArgentinaTime } from "@/lib/core/datetime";
import { useSessionSnapshot } from "@/lib/session/session-client";
import { notifyCashSessionUpdated } from "@/lib/session/cash-session-client";
import { CACHE_TAGS } from "@/lib/core/cache-tags";
import { notifyDataUpdated, useDataRefresh } from "@/lib/sync/data-sync-client";
import { getCashRuntime } from "@/lib/offline/cash-runtime";

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


function ShellHeader({
    eyebrow,
    title,
    description,
    aside,
    tone = "neutral",
}: {
    eyebrow: string;
    title: string;
    description: string;
    aside?: ReactNode;
    tone?: "neutral" | "success" | "warning";
}) {
    const shellClassName =
        tone === "success"
            ? "border-emerald-900/15 bg-[linear-gradient(135deg,rgba(236,253,245,0.96)_0%,rgba(255,255,255,0.98)_48%,rgba(209,250,229,0.72)_100%)] dark:border-emerald-400/15 dark:bg-[linear-gradient(135deg,rgba(6,78,59,0.58)_0%,rgba(15,23,42,0.94)_52%,rgba(5,150,105,0.18)_100%)]"
            : tone === "warning"
              ? "border-amber-900/15 bg-[linear-gradient(135deg,rgba(255,247,237,0.98)_0%,rgba(255,255,255,0.98)_48%,rgba(254,215,170,0.68)_100%)] dark:border-amber-400/15 dark:bg-[linear-gradient(135deg,rgba(120,53,15,0.58)_0%,rgba(15,23,42,0.94)_52%,rgba(245,158,11,0.16)_100%)]"
              : "border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.96)_48%,rgba(241,245,249,0.92)_100%)] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(30,41,59,0.94)_0%,rgba(15,23,42,0.96)_48%,rgba(2,6,23,0.98)_100%)]";

    return (
        <div className={cn("rounded-[1.5rem] border px-4 py-4 shadow-sm sm:px-5", shellClassName)}>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-900/20 bg-[linear-gradient(135deg,rgba(8,145,178,0.18),rgba(14,116,144,0.08))] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-800 dark:text-cyan-100">
                        <Landmark className="size-3.5" />
                        {eyebrow}
                    </div>
                    <h1 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-3xl">
                        {title}
                    </h1>
                    {description ? (
                        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                    ) : null}
                </div>
                {aside ? <div className="xl:min-w-[220px] xl:max-w-[280px]">{aside}</div> : null}
            </div>
        </div>
    );
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
    const toneClassName =
        tone === "success"
            ? "border-emerald-900/15 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(209,250,229,0.72))] dark:border-emerald-400/15 dark:bg-[linear-gradient(135deg,rgba(6,78,59,0.48),rgba(5,150,105,0.16))]"
            : tone === "danger"
              ? "border-rose-900/15 bg-[linear-gradient(135deg,rgba(255,241,242,0.98),rgba(255,228,230,0.78))] dark:border-rose-400/15 dark:bg-[linear-gradient(135deg,rgba(76,5,25,0.54),rgba(190,24,93,0.14))]"
            : tone === "dark"
                ? "border-slate-800/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(30,41,59,0.96))] text-white dark:border-slate-700/70 dark:bg-[linear-gradient(135deg,rgba(2,6,23,0.98),rgba(15,23,42,0.96))]"
                : "border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(30,41,59,0.9),rgba(15,23,42,0.96))]";

    const iconClassName =
        tone === "success"
            ? "bg-emerald-900 text-emerald-100 dark:bg-emerald-400/15 dark:text-emerald-100"
            : tone === "danger"
              ? "bg-rose-900 text-rose-100 dark:bg-rose-400/15 dark:text-rose-100"
              : tone === "dark"
                ? "bg-white/10 text-white"
                : "bg-slate-900 text-slate-100 dark:bg-white/10 dark:text-white";

    const labelClassName = tone === "dark" ? "text-white/65" : "text-muted-foreground";
    const valueClassName = tone === "dark" ? "text-white" : "text-foreground";
    const descriptionClassName = tone === "dark" ? "text-white/65" : "text-muted-foreground";

    return (
        <Card className={cn("rounded-[1.5rem] border shadow-sm", toneClassName)}>
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className={cn("text-[11px] font-semibold uppercase tracking-[0.22em]", labelClassName)}>
                            {label}
                        </p>
                        <p className={cn("mt-3 text-3xl font-semibold tracking-[-0.05em]", valueClassName)}>
                            {value}
                        </p>
                        {description ? (
                            <p className={cn("mt-2 text-sm leading-6", descriptionClassName)}>
                                {description}
                            </p>
                        ) : null}
                    </div>
                    <div className={cn("rounded-2xl p-3", iconClassName)}>{icon}</div>
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
        <div className="p-4 sm:p-5 lg:p-6">
            <div className="flex w-full flex-col gap-5">
                <ShellHeader
                    eyebrow="Apertura de caja"
                    title="Abrir caja"
                    description=""
                    tone="warning"
                    aside={
                        <div className="rounded-[1.25rem] border border-amber-900/15 bg-[linear-gradient(135deg,rgba(255,247,237,0.98),rgba(255,255,255,0.94))] p-4 shadow-sm dark:border-amber-400/15 dark:bg-[linear-gradient(135deg,rgba(120,53,15,0.52),rgba(15,23,42,0.88))]">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-800/80 dark:text-amber-100/80">
                                Estado actual
                            </p>
                            <div className="mt-3 flex items-center gap-3">
                                <div className="rounded-2xl bg-amber-900 p-2.5 dark:bg-amber-400/15">
                                    <LockKeyhole className="size-5 text-amber-100 dark:text-amber-100" />
                                </div>
                                <div>
                                    <p className="text-lg font-semibold text-foreground">Caja cerrada</p>
                                    <p className="text-sm text-muted-foreground">Ventas bloqueadas</p>
                                </div>
                            </div>
                        </div>
                    }
                />

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                    <div className="grid gap-4 sm:grid-cols-3">
                        {[
                            ["1", "Elegí responsable", "Quién queda a cargo de la caja al inicio del turno."],
                            ["2", "Definí el cambio", "Monto base en efectivo para operar durante el día."],
                            ["3", "Habilitá ventas", "La caja queda lista para cobrar y registrar movimientos."],
                        ].map(([step, title, description]) => (
                            <Card
                                key={step}
                                className="rounded-[1.55rem] border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] shadow-sm dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(30,41,59,0.9),rgba(15,23,42,0.96))]"
                            >
                                <CardContent className="p-5">
                                    <div className="text-3xl font-semibold tracking-[-0.08em] text-muted-foreground/40">
                                        {step}
                                    </div>
                                    <p className="mt-4 text-base font-semibold text-foreground">{title}</p>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <Card className="rounded-[1.75rem] border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] shadow-sm dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(30,41,59,0.9),rgba(15,23,42,0.96))]">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-2xl tracking-[-0.05em]">
                                Abrir caja
                            </CardTitle>
                            <CardDescription className="text-sm">
                                Definí responsable y monto inicial para comenzar.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="space-y-2">
                                <Label>Usuario / Vendedor</Label>
                                <Select value={selectedSellerId} onValueChange={setSelectedSellerId} disabled={sellers.length === 0}>
                                    <SelectTrigger className="h-12 w-full text-base">
                                        <SelectValue placeholder={sellers.length === 0 ? "Buscando usuarios..." : "¿Quién abre la caja?"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {sellers.length === 0 ? (
                                            <div className="p-2 text-sm text-center text-muted-foreground">Sincronizando u obtenidos 0...</div>
                                        ) : (
                                            sellers.map((s) => (
                                                <SelectItem key={s.id} value={s.id}>
                                                    {s.name}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Fondo de caja</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        type="number"
                                        placeholder="Ej: 5000"
                                        className="h-14 pl-10 text-xl font-medium"
                                        value={initialAmount}
                                        onChange={(e) => setInitialAmount(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="rounded-2xl bg-muted/55 p-4 text-sm text-muted-foreground">
                                Este monto se toma como base para calcular el efectivo esperado al
                                cierre.
                            </div>
                            <Button className="h-14 w-full text-lg" onClick={onOpen}>
                                Abrir caja ahora
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
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
            <div className="animate-in fade-in p-4 duration-300 sm:p-5 lg:p-6">
                <div className="flex w-full flex-col gap-5">
                    <ShellHeader
                        eyebrow="Turno activo"
                        title="Caja activa"
                        description=""
                        tone="success"
                        aside={
                            <div className="rounded-[1.25rem] border border-emerald-900/15 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(255,255,255,0.94))] p-4 shadow-sm dark:border-emerald-400/15 dark:bg-[linear-gradient(135deg,rgba(6,78,59,0.52),rgba(15,23,42,0.88))]">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-800/80 dark:text-emerald-100/80">
                                    Apertura
                                </p>
                                <p className="mt-2 text-base font-semibold text-foreground">
                                    {session.openedBy?.name}
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {formatArgentinaDateTime(session.openingDate).replace(",", " ·")}
                                </p>
                            </div>
                        }
                    />

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
                        <Card className="rounded-[1.75rem] border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] shadow-sm dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(30,41,59,0.9),rgba(15,23,42,0.96))]">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-2xl tracking-[-0.05em]">
                                    Resumen del cierre
                                </CardTitle>
                                <CardDescription>
                                    Al final del turno contá el efectivo real para registrar el cierre.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-4">
                                    <div className="rounded-[1.4rem] border border-border/70 bg-muted/35 p-5 dark:border-white/10 dark:bg-white/5">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                                            Fondo inicial
                                        </p>
                                        <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground">
                                            {formatCurrency(session.initialAmount)}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-[1.75rem] border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] shadow-sm dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(30,41,59,0.9),rgba(15,23,42,0.96))]">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-2xl tracking-[-0.05em]">
                                    Cierre de turno
                                </CardTitle>
                                <CardDescription>
                                    Registrá el efectivo contado para cerrar la caja.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Responsable del cierre</Label>
                                    <Select value={selectedSellerId} onValueChange={setSelectedSellerId} disabled={sellers.length === 0}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder={sellers.length === 0 ? "Cargando..." : "Seleccioná un usuario"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {sellers.length > 0 ? (
                                                sellers.map((s) => (
                                                    <SelectItem key={s.id} value={s.id}>
                                                        {s.name}
                                                    </SelectItem>
                                                ))
                                            ) : (
                                                <div className="p-2 text-sm text-center text-muted-foreground">Sin usuarios</div>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="rounded-2xl bg-muted/55 p-4 text-sm text-muted-foreground dark:bg-white/5">
                                    Ingresá el efectivo contado para completar el arqueo.
                                </div>
                                <Button
                                    className="h-14 w-full text-lg text-white bg-slate-900 hover:bg-slate-800"
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Arqueo de Caja</DialogTitle>
                        <DialogDescription>
                            Contá los billetes del cajón y escribí el total. Luego se cerrará la caja.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5 py-2">
                        <div className="space-y-2">
                            <Label className="text-base font-semibold">Efectivo Real (Contado por vos)</Label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    type="number"
                                    placeholder="Ej: 24500"
                                    className="h-14 pl-10 text-xl font-medium border-2"
                                    value={actualAmount}
                                    onChange={(e) => setActualAmount(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            className="bg-slate-900 hover:bg-slate-800"
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
    const [closeWithoutDialogOpen, setCloseWithoutDialogOpen] = useState(false);
    const [actualAmount, setActualAmount] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingWithout, setIsSavingWithout] = useState(false);
    const [currentMovementsPage, setCurrentMovementsPage] = useState(1);

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
            setCurrentMovementsPage(totalMovementPages);
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
        setIsSavingWithout(true);
        try {
            await onCloseWithoutCount(selectedSellerId);
            setCloseWithoutDialogOpen(false);
        } finally {
            setIsSavingWithout(false);
        }
    };

    return (
        <>
            <div className="animate-in fade-in p-4 duration-300 sm:p-5 lg:p-6">
                <div className="flex w-full flex-col gap-5">
                    <ShellHeader
                        eyebrow="Monitoreo operativo"
                        title="Caja del turno"
                        description=""
                        tone="success"
                        aside={
                            <div className="rounded-[1.25rem] border border-emerald-900/15 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(255,255,255,0.94))] p-4 shadow-sm dark:border-emerald-400/15 dark:bg-[linear-gradient(135deg,rgba(6,78,59,0.52),rgba(15,23,42,0.88))]">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-800/80 dark:text-emerald-100/80">
                                    Apertura
                                </p>
                                <p className="mt-2 text-base font-semibold text-foreground">
                                    {session.openedBy?.name ?? "Sin responsable"}
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {formatArgentinaDateTime(session.openingDate, { year: undefined }).replace(",", " ·")}
                                </p>
                                <div className="mt-4 rounded-2xl bg-emerald-950/8 p-3">
                                    <p className="text-xs uppercase tracking-[0.18em] text-emerald-800/75 dark:text-emerald-100/75">
                                        Efectivo esperado
                                    </p>
                                    <p className="mt-1 text-2xl font-semibold tracking-[-0.05em] text-foreground">
                                        {formatCurrency(expectedCash)}
                                    </p>
                                </div>
                            </div>
                        }
                    />

                    <Card className="rounded-[1.75rem] border-border/70 bg-[linear-gradient(135deg,rgba(240,253,250,0.98),rgba(255,255,255,0.96),rgba(255,241,242,0.9))] shadow-sm dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(6,78,59,0.28),rgba(15,23,42,0.96),rgba(76,5,25,0.26))]">
                        <CardContent className="p-4 sm:p-5">
                            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                        Acciones rápidas
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Ingreso y retiro al alcance, sin perderlos de vista.
                                    </p>
                                </div>
                                <div className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm dark:bg-white/10 dark:text-slate-100">
                                    Efectivo esperado:{" "}
                                    <span className="font-bold text-emerald-800 dark:text-emerald-100">{formatCurrency(expectedCash)}</span>
                                </div>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                                <Button
                                    variant="outline"
                                    className="h-20 justify-start gap-4 border-rose-900/15 bg-[linear-gradient(135deg,rgba(255,241,242,0.98),rgba(255,255,255,0.96))] text-left text-rose-700 shadow-sm hover:bg-rose-950/6 dark:border-rose-400/15 dark:bg-[linear-gradient(135deg,rgba(76,5,25,0.54),rgba(15,23,42,0.9))] dark:text-rose-100"
                                    onClick={() => {
                                        setMovementType("EGRESO");
                                        setMovementDialogOpen(true);
                                    }}
                                >
                                        <div className="rounded-full bg-rose-900 p-2.5 dark:bg-rose-400/15">
                                            <ArrowDownCircle className="size-6 text-rose-100 dark:text-rose-100" />
                                        </div>
                                    <div className="flex flex-col items-start">
                                        <span className="text-base font-bold">Retirar dinero</span>
                                        <span className="text-xs text-rose-700/80 dark:text-rose-100/80">Pagos, gastos o retiros de caja</span>
                                    </div>
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-20 justify-start gap-4 border-emerald-900/15 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(255,255,255,0.96))] text-left text-emerald-700 shadow-sm hover:bg-emerald-950/6 dark:border-emerald-400/15 dark:bg-[linear-gradient(135deg,rgba(6,78,59,0.54),rgba(15,23,42,0.9))] dark:text-emerald-100"
                                    onClick={() => {
                                        setMovementType("INGRESO");
                                        setMovementDialogOpen(true);
                                    }}
                                >
                                        <div className="rounded-full bg-emerald-900 p-2.5 dark:bg-emerald-400/15">
                                            <ArrowUpCircle className="size-6 text-emerald-100 dark:text-emerald-100" />
                                        </div>
                                    <div className="flex flex-col items-start">
                                        <span className="text-base font-bold">Ingresar dinero</span>
                                        <span className="text-xs text-emerald-700/80 dark:text-emerald-100/80">
                                            Cambio extra, reposiciones o ingresos
                                        </span>
                                    </div>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <MetricCard
                            label="Efectivo en caja"
                            value={formatCurrency(expectedCash)}
                            description={`Fondo inicial ${formatCurrency(session.initialAmount)}`}
                            icon={<Wallet className="size-5" />}
                            tone="dark"
                        />
                        <MetricCard
                            label="Ventas efectivo"
                            value={formatCurrency(salesCash)}
                            description="Cobros que impactan en el cajón."
                            icon={<DollarSign className="size-5" />}
                        />
                        <MetricCard
                            label="Transferencias"
                            value={formatCurrency(salesTransfer)}
                            description="Cobros digitales fuera del efectivo."
                            icon={<ChevronRight className="size-5" />}
                            tone="success"
                        />
                        <MetricCard
                            label="Retiros / gastos"
                            value={formatCurrency(manualOut)}
                            description="Salidas manuales registradas en el turno."
                            icon={<ArrowDownCircle className="size-5" />}
                            tone="danger"
                        />
                    </div>

                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
                        <Card className="rounded-[1.75rem] border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] shadow-sm dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(30,41,59,0.9),rgba(15,23,42,0.96))]">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <History className="size-5 text-muted-foreground" />
                                    Movimientos manuales de hoy
                                </CardTitle>
                                <CardDescription>
                                    Gastos, retiros o ingresos extra fuera de las ventas.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {session.movements.length === 0 ? (
                                    <EmptyState
                                        title="Sin movimientos manuales"
                                        description="Todavía no registraste ingresos extra ni retiros en esta jornada."
                                    />
                                ) : (
                                    <div className="space-y-3">
                                        {paginatedMovements.map((mov) => (
                                            <div
                                                key={mov.id}
                                                className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/85 p-4 dark:border-white/10 dark:bg-white/5"
                                            >
                                                <div className="flex items-center gap-3">
                                                    {mov.type === "INGRESO" ? (
                                                        <ArrowUpCircle className="size-8 text-emerald-500" />
                                                    ) : (
                                                        <ArrowDownCircle className="size-8 text-rose-500" />
                                                    )}
                                                    <div>
                                                        <p className="font-semibold text-sm">{mov.reason}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {formatArgentinaTime(mov.createdAt)} hs
                                                        </p>
                                                    </div>
                                                </div>
                                                <p
                                                    className={cn(
                                                        "font-bold",
                                                        mov.type === "INGRESO"
                                                            ? "text-emerald-600"
                                                            : "text-rose-600"
                                                    )}
                                                >
                                                    {mov.type === "INGRESO" ? "+" : "-"}
                                                    {formatCurrency(mov.amount)}
                                                </p>
                                            </div>
                                        ))}
                                        <div className="flex flex-col gap-3 rounded-[1.25rem] border border-border/70 bg-card/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                            <p className="text-sm text-muted-foreground">
                                                Página {currentMovementsPage} de {totalMovementPages} · {session.movements.length} movimiento(s)
                                            </p>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => setCurrentMovementsPage((page) => Math.max(1, page - 1))}
                                                    disabled={currentMovementsPage === 1}
                                                >
                                                    Anterior
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    onClick={() =>
                                                        setCurrentMovementsPage((page) => Math.min(totalMovementPages, page + 1))
                                                    }
                                                    disabled={currentMovementsPage === totalMovementPages}
                                                >
                                                    Siguiente
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="h-fit rounded-[1.75rem] border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] shadow-sm dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(30,41,59,0.9),rgba(15,23,42,0.96))]">
                            <CardHeader>
                                <CardTitle>Cierre de turno</CardTitle>
                                <CardDescription>
                                    Finalizá el día. Podés hacer el arqueo ahora o después.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="rounded-xl border border-border/70 bg-white/90 p-4 dark:border-white/10 dark:bg-white/5">
                                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                        Resumen previo
                                    </p>
                                    <div className="mt-3 space-y-2 text-sm">
                                        <div className="flex items-center justify-between">
                                            <span>Efectivo esperado</span>
                                            <span className="font-semibold">{formatCurrency(expectedCash)}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span>Ingresos manuales</span>
                                            <span className="font-semibold text-emerald-600">
                                                {formatCurrency(manualIn)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span>Retiros manuales</span>
                                            <span className="font-semibold text-rose-600">
                                                {formatCurrency(manualOut)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">
                                        Responsable del cierre
                                    </Label>
                                    <Select value={selectedSellerId} onValueChange={setSelectedSellerId} disabled={sellers.length === 0}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder={sellers.length === 0 ? "Cargando..." : "Seleccioná un usuario"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {sellers.length > 0 ? (
                                                sellers.map((s) => (
                                                    <SelectItem key={s.id} value={s.id}>
                                                        {s.name}
                                                    </SelectItem>
                                                ))
                                            ) : (
                                                <div className="p-2 text-sm text-center text-muted-foreground">Sin usuarios</div>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <Button
                                    className="h-12 w-full text-base text-white bg-slate-900 hover:bg-slate-800"
                                    onClick={() => setCloseDialogOpen(true)}
                                >
                                    Realizar arqueo y cerrar
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-12 w-full text-base border-orange-900/20 text-orange-700 hover:bg-orange-950/6"
                                    onClick={() => setCloseWithoutDialogOpen(true)}
                                >
                                    Cerrar sin arquear
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Dialog movimiento */}
            <Dialog open={movementDialogOpen} onOpenChange={setMovementDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Registrar {movementType === "INGRESO" ? "Ingreso Extra" : "Retiro / Gasto"}
                        </DialogTitle>
                        <DialogDescription>
                            El monto afectará el total esperado en efectivo al final del día.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Monto</Label>
                            <Input
                                type="number"
                                placeholder="Ej: 1500"
                                value={movementAmount}
                                onChange={(e) => setMovementAmount(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Motivo / Descripción</Label>
                            <Input
                                placeholder={
                                    movementType === "EGRESO"
                                        ? "Ej: Compra de artículos de limpieza"
                                        : "Ej: Cambio extra prestado"
                                }
                                value={movementReason}
                                onChange={(e) => setMovementReason(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMovementDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            className={
                                movementType === "INGRESO"
                                    ? "bg-emerald-600 hover:bg-emerald-700"
                                    : "bg-rose-600 hover:bg-rose-700"
                            }
                            onClick={handleAddMovement}
                        >
                            Guardar {movementType.toLowerCase()}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog arqueo inmediato ADMIN */}
            <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Arqueo de Caja</DialogTitle>
                        <DialogDescription>
                            Contá los billetes del cajón y escribí el total. El sistema calculará la diferencia.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="rounded-lg border border-emerald-800/20 bg-[linear-gradient(135deg,rgba(5,150,105,0.14),rgba(6,95,70,0.04))] p-4 flex justify-between items-center">
                            <span className="text-emerald-900 dark:text-emerald-100 font-medium">El sistema espera:</span>
                            <span className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                                {formatCurrency(expectedCash)}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-base font-semibold">Efectivo Real (Contado por vos)</Label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    type="number"
                                    placeholder="Ej: 24500"
                                    className="h-14 pl-10 text-xl font-medium border-2"
                                    value={actualAmount}
                                    onChange={(e) => setActualAmount(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            className="bg-slate-900 hover:bg-slate-800"
                            onClick={handleConfirmClose}
                            disabled={isSaving}
                        >
                            {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                            Confirmar Cierre
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog cerrar sin arquear */}
            <Dialog open={closeWithoutDialogOpen} onOpenChange={setCloseWithoutDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-orange-900">
                            <BadgeCheck className="size-7 text-orange-100" />
                        </div>
                        <DialogTitle className="text-center">Cerrar sin arquear</DialogTitle>
                        <DialogDescription className="text-center">
                            La caja quedará cerrada operativamente — ya no se registrarán ventas en este turno.
                            Podés hacer el arqueo después desde la sección{" "}
                            <span className="font-semibold text-foreground">Arqueos</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-2">
                        <Button variant="outline" onClick={() => setCloseWithoutDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            className="bg-orange-700 hover:bg-orange-800 text-white"
                            onClick={handleConfirmCloseWithout}
                            disabled={isSavingWithout}
                        >
                            {isSavingWithout && <Loader2 className="mr-2 size-4 animate-spin" />}
                            Sí, cerrar sin arquear
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ─────────────────────────────────────────────
// ROOT PAGE
// ─────────────────────────────────────────────
export default function CajaPage() {
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
        } catch (error: unknown) {
            console.error("Caja Load Error:", error);
            toast.error(
                "Error al cargar la caja: " +
                    (error instanceof Error ? error.message : String(error))
            );
        } finally {
            setIsLoading(false);
        }
    }, [cashRuntime]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    useDataRefresh([CACHE_TAGS.cash, CACHE_TAGS.sales, CACHE_TAGS.employees], loadData, {
        pollIntervalMs: false,
    });

    useEffect(() => {
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
            toast.success("Caja cerrada. El arqueo quedó pendiente en la sección Arqueos.");
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
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-6">
                <div className="rounded-[1.75rem] border border-border/70 bg-card/90 px-10 py-8 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="rounded-2xl bg-[linear-gradient(135deg,#059669_0%,#065f46_100%)] p-3 text-emerald-50">
                            <Loader2 className="size-6 animate-spin" />
                        </div>
                        <div>
                            <p className="text-base font-semibold text-foreground">Cargando caja</p>
                            <p className="text-sm text-muted-foreground">
                                Estamos trayendo la sesión y los vendedores.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
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
                <DialogContent className="sm:max-w-sm text-center">
                    <DialogHeader>
                        <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-emerald-900">
                            <CheckCircle2 className="size-9 text-emerald-100" />
                        </div>
                        <DialogTitle className="text-center text-xl">Caja cerrada</DialogTitle>
                        <DialogDescription className="text-center text-base">
                            El turno fue cerrado exitosamente. ¡Hasta la próxima!
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-2">
                        <Button
                            className="w-full bg-emerald-600 hover:bg-emerald-700"
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
