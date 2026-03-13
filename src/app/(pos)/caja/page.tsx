"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
    getCurrentSession,
    openCashSession,
    closeCashSession,
    closeCashSessionWithoutCount,
    addCashMovement,
} from "@/app/actions/cash-actions";
import { getSellers } from "@/app/actions/pos-actions";
import {
    Wallet,
    ArrowUpCircle,
    ArrowDownCircle,
    LockKeyhole,
    LockOpen,
    Loader2,
    DollarSign,
    History,
    CheckCircle2,
    BadgeCheck,
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
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useSessionSnapshot } from "@/lib/session-client";

type Seller = { id: string; name: string; role: string };

type CashSale = {
    id: string;
    ticketNumber: number;
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

function formatCurrency(amount: number | string | null | undefined): string {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 0,
    }).format(Number(amount) || 0);
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
        <div className="p-6 lg:p-10 max-w-2xl mx-auto mt-10">
            <Card className="shadow-lg border-border/50">
                <CardHeader className="text-center pb-8">
                    <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <LockKeyhole className="size-8" />
                    </div>
                    <CardTitle className="text-2xl">La caja está cerrada</CardTitle>
                    <CardDescription className="text-base mt-2">
                        Para empezar a facturar y registrar movimientos, abrí la caja ingresando el cambio inicial.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>Usuario / Vendedor</Label>
                        <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                            <SelectTrigger className="h-12 w-full text-base">
                                <SelectValue placeholder="¿Quién abre la caja?" />
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
                    <div className="space-y-2">
                        <Label>Fondo de Caja (Cambio inicial)</Label>
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
                    <Button className="w-full h-14 text-lg bg-emerald-600 hover:bg-emerald-700" onClick={onOpen}>
                        Abrir Caja Ahora
                    </Button>
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

    const salesCash = session.sales.reduce((acc, sale) => acc + Number(sale.cashAmount || 0), 0);
    const manualIn = session.movements
        .filter((m) => m.type === "INGRESO")
        .reduce((acc, m) => acc + m.amount, 0);
    const manualOut = session.movements
        .filter((m) => m.type === "EGRESO")
        .reduce((acc, m) => acc + m.amount, 0);
    const expectedCash = Number(session.initialAmount) + salesCash + manualIn - manualOut;

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
            <div className="p-6 lg:p-10 max-w-2xl mx-auto animate-in fade-in duration-300">
                <div className="mb-6">
                    <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
                        <LockOpen className="size-8 text-emerald-600" />
                        Caja Abierta
                    </h1>
                    <p className="mt-1 text-muted-foreground">
                        Abierta por{" "}
                        <span className="font-medium text-foreground">{session.openedBy?.name}</span> el{" "}
                        {format(new Date(session.openingDate), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
                    </p>
                </div>

                <Card className="mb-6 border-emerald-200 bg-emerald-600 text-white shadow-md">
                    <CardContent className="p-6 text-center">
                        <p className="mb-2 text-sm font-medium uppercase tracking-wider text-emerald-100">
                            Efectivo en Cajón (Aprox.)
                        </p>
                        <p className="text-5xl font-bold">{formatCurrency(expectedCash)}</p>
                        <p className="mt-2 text-sm text-emerald-200">
                            Fondo inicial: {formatCurrency(session.initialAmount)}
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-slate-200 bg-slate-50">
                    <CardHeader>
                        <CardTitle>Cierre de Turno</CardTitle>
                        <CardDescription>
                            Contá el efectivo del cajón y registrá el arqueo para cerrar la caja.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Responsable del cierre</Label>
                            <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Seleccioná un usuario" />
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
                        <Button
                            className="h-14 w-full text-lg text-white bg-slate-900 hover:bg-slate-800"
                            onClick={() => setCloseDialogOpen(true)}
                        >
                            Realizar Arqueo y Cerrar
                        </Button>
                    </CardContent>
                </Card>
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
                        <div className="rounded-lg bg-emerald-50 p-4 flex justify-between items-center border border-emerald-100">
                            <span className="text-emerald-800 font-medium">El sistema espera:</span>
                            <span className="text-2xl font-bold text-emerald-700">
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
            <div className="p-6 lg:p-10 animate-in fade-in duration-300">
                <div className="mb-5">
                    <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
                        <LockOpen className="size-8 text-emerald-600" />
                        Caja Abierta
                    </h1>
                    <p className="mt-1 text-muted-foreground">
                        Abierta por{" "}
                        <span className="font-medium text-foreground">{session.openedBy?.name}</span> el{" "}
                        {format(new Date(session.openingDate), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
                    </p>
                </div>

                {/* Acciones rápidas */}
                <Card className="mb-8 border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-rose-50 shadow-sm">
                    <CardContent className="p-4 sm:p-5">
                        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                    Acciones Rápidas
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    Ingreso y retiro al alcance, sin perderlos de vista.
                                </p>
                            </div>
                            <div className="rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
                                Efectivo esperado:{" "}
                                <span className="font-bold text-emerald-700">{formatCurrency(expectedCash)}</span>
                            </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <Button
                                variant="outline"
                                className="h-20 justify-start gap-4 border-rose-200 bg-white text-left text-rose-700 shadow-sm hover:bg-rose-50"
                                onClick={() => {
                                    setMovementType("EGRESO");
                                    setMovementDialogOpen(true);
                                }}
                            >
                                <div className="rounded-full bg-rose-100 p-2.5">
                                    <ArrowDownCircle className="size-6 text-rose-600" />
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className="text-base font-bold">Retirar Dinero</span>
                                    <span className="text-xs text-rose-700/80">Pagos, gastos, retiros de caja</span>
                                </div>
                            </Button>
                            <Button
                                variant="outline"
                                className="h-20 justify-start gap-4 border-emerald-200 bg-white text-left text-emerald-700 shadow-sm hover:bg-emerald-50"
                                onClick={() => {
                                    setMovementType("INGRESO");
                                    setMovementDialogOpen(true);
                                }}
                            >
                                <div className="rounded-full bg-emerald-100 p-2.5">
                                    <ArrowUpCircle className="size-6 text-emerald-600" />
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className="text-base font-bold">Ingresar Dinero</span>
                                    <span className="text-xs text-emerald-700/80">
                                        Cambio extra, reposiciones, ingresos
                                    </span>
                                </div>
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Cards de stats */}
                <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="bg-emerald-600 text-white shadow-md border-none">
                        <CardContent className="p-6">
                            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-emerald-100">
                                Efectivo en Cajón (Aprox)
                            </p>
                            <p className="text-4xl font-bold">{formatCurrency(expectedCash)}</p>
                            <p className="mt-2 text-sm text-emerald-200">
                                Fondo inicial: {formatCurrency(session.initialAmount)}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-6">
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                                    Ventas Efectivo
                                </p>
                                <Wallet className="size-5 text-muted-foreground" />
                            </div>
                            <p className="text-3xl font-bold">{formatCurrency(salesCash)}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-6">
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-sm font-medium uppercase tracking-wider text-blue-600/80">
                                    Transferencias
                                </p>
                                <Wallet className="size-5 text-blue-600/50" />
                            </div>
                            <p className="text-3xl font-bold text-blue-600">{formatCurrency(salesTransfer)}</p>
                            <p className="mt-2 text-xs text-muted-foreground">
                                Dinero digital, no está en el cajón.
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-6">
                            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                                Gastos / Retiros
                            </p>
                            <p className="text-3xl font-bold text-rose-600">{formatCurrency(manualOut)}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Movimientos + Cierre */}
                <div className="grid gap-8 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <History className="size-5 text-muted-foreground" />
                                Movimientos Manuales de Hoy
                            </CardTitle>
                            <CardDescription>
                                Gastos, retiros o ingresos extra fuera de las ventas.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {session.movements.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground">
                                    No se registraron movimientos manuales hoy.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {session.movements.map((mov) => (
                                        <div
                                            key={mov.id}
                                            className="flex items-center justify-between p-3 rounded-lg border bg-muted/20"
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
                                                        {format(new Date(mov.createdAt), "HH:mm")} hs
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
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Panel de cierre ADMIN */}
                    <Card className="h-fit border-slate-200 bg-slate-50">
                        <CardHeader>
                            <CardTitle>Cierre de Turno</CardTitle>
                            <CardDescription>
                                Finalizá el día. Podés hacer el arqueo ahora o después.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
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
                                <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Seleccioná un usuario" />
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

                            <Button
                                className="h-12 w-full text-base text-white bg-slate-900 hover:bg-slate-800"
                                onClick={() => setCloseDialogOpen(true)}
                            >
                                Realizar Arqueo y Cerrar
                            </Button>
                            <Button
                                variant="outline"
                                className="h-12 w-full text-base border-amber-300 text-amber-700 hover:bg-amber-50"
                                onClick={() => setCloseWithoutDialogOpen(true)}
                            >
                                Cerrar sin arquear
                            </Button>
                        </CardContent>
                    </Card>
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
                        <div className="rounded-lg bg-emerald-50 p-4 flex justify-between items-center border border-emerald-100">
                            <span className="text-emerald-800 font-medium">El sistema espera:</span>
                            <span className="text-2xl font-bold text-emerald-700">
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
                        <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-amber-100">
                            <BadgeCheck className="size-7 text-amber-600" />
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
                            className="bg-amber-500 hover:bg-amber-600 text-white"
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
                getCurrentSession(),
                getSellers(),
            ]);
            setSession(currentSession as CashSession | null);
            setSellers(sellersData as Seller[]);
        } catch (error: any) {
            console.error("Caja Load Error:", error);
            toast.error("Error al cargar la caja: " + (error?.message || String(error)));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

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
        if (!initialAmount || isNaN(Number(initialAmount)))
            return toast.error("Ingresá un monto inicial válido");
        if (!selectedSellerId) return toast.error("Seleccioná un usuario");
        try {
            await openCashSession(Number(initialAmount), selectedSellerId);
            toast.success("Caja abierta correctamente");
            setInitialAmount("");
            loadData();
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Error al abrir la caja");
        }
    };

    const handleCloseWithArqueo = async (actualAmount: number, userId: string) => {
        if (!session) return;
        try {
            await closeCashSession(session.id, actualAmount, userId);
            if (isAdmin) {
                toast.success("Caja cerrada exitosamente");
            } else {
                // Staff: solo modal de éxito simple
                setStaffSuccessOpen(true);
            }
            loadData();
        } catch {
            toast.error("Error al cerrar la caja");
        }
    };

    const handleCloseWithoutCount = async (userId: string) => {
        if (!session) return;
        try {
            await closeCashSessionWithoutCount(session.id, userId);
            toast.success("Caja cerrada. El arqueo quedó pendiente en la sección Arqueos.");
            loadData();
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
            await addCashMovement(session.id, amount, type, reason);
            toast.success("Movimiento registrado");
            loadData();
        } catch {
            toast.error("Error al registrar movimiento");
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader2 className="size-10 animate-spin text-emerald-600" />
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
                        <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-emerald-100">
                            <CheckCircle2 className="size-9 text-emerald-600" />
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
