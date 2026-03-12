"use client";

import { useEffect, useState, type ReactNode } from "react";
import { 
    getCurrentSession, 
    openCashSession, 
    closeCashSession, 
    addCashMovement 
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
    CircleAlert,
    BadgeCheck,
    TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type Seller = {
    id: string;
    name: string;
};

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

export default function CajaPage() {
    const [session, setSession] = useState<CashSession | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [sellers, setSellers] = useState<Seller[]>([]);
    const [selectedSellerId, setSelectedSellerId] = useState("");

    // Estados para Apertura
    const [initialAmount, setInitialAmount] = useState("");

    // Estados para Movimientos Manuales (Ingreso / Egreso)
    const [movementDialogOpen, setMovementDialogOpen] = useState(false);
    const [movementType, setMovementType] = useState<"INGRESO" | "EGRESO">("EGRESO");
    const [movementAmount, setMovementAmount] = useState("");
    const [movementReason, setMovementReason] = useState("");

    // Estados para el Cierre
    const [closeDialogOpen, setCloseDialogOpen] = useState(false);
    const [actualAmount, setActualAmount] = useState("");
    const [closeSummary, setCloseSummary] = useState<{
        expectedAmount: number;
        actualAmount: number;
        difference: number;
        closedByName: string;
    } | null>(null);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [currentSession, sellersData] = await Promise.all([
                getCurrentSession(),
                getSellers()
            ]);
            setSession(currentSession);
            setSellers(sellersData);
            if (sellersData.length > 0) {
                setSelectedSellerId(sellersData[0].id);
            }
        } catch {
            toast.error("Error al cargar la caja");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleOpenBox = async () => {
        if (!initialAmount || isNaN(Number(initialAmount))) {
            return toast.error("Ingresá un monto inicial válido");
        }
        if (!selectedSellerId) {
            return toast.error("Seleccioná un usuario");
        }

        try {
            await openCashSession(Number(initialAmount), selectedSellerId);
            toast.success("Caja abierta correctamente");
            setInitialAmount("");
            loadData();
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Error al abrir la caja");
        }
    };

    const handleAddMovement = async () => {
        if (!session) {
            return toast.error("No hay una caja abierta");
        }
        if (!movementAmount || isNaN(Number(movementAmount)) || Number(movementAmount) <= 0) {
            return toast.error("Monto inválido");
        }
        if (!movementReason.trim()) {
            return toast.error("Ingresá un motivo (ej: Pago de limpieza)");
        }

        try {
            await addCashMovement(session.id, Number(movementAmount), movementType, movementReason);
            toast.success("Movimiento registrado");
            setMovementDialogOpen(false);
            setMovementAmount("");
            setMovementReason("");
            loadData();
        } catch {
            toast.error("Error al registrar movimiento");
        }
    };

    const salesCash = session?.sales.reduce((acc, sale) => acc + Number(sale.cashAmount || 0), 0) ?? 0;
    const salesTransfer = session?.sales.reduce((acc, sale) => acc + Number(sale.transferAmount || 0), 0) ?? 0;
    const manualIn = session?.movements
        .filter((movement) => movement.type === "INGRESO")
        .reduce((acc, movement) => acc + Number(movement.amount), 0) ?? 0;
    const manualOut = session?.movements
        .filter((movement) => movement.type === "EGRESO")
        .reduce((acc, movement) => acc + Number(movement.amount), 0) ?? 0;
    const expectedCash = session ? Number(session.initialAmount) + salesCash + manualIn - manualOut : 0;

    const handleCloseBox = async () => {
        if (!session) {
            return toast.error("No hay una caja abierta para cerrar");
        }
        if (actualAmount === "" || isNaN(Number(actualAmount))) {
            return toast.error("Ingresá el monto real que contaste en la caja");
        }

        try {
            const closedSession = await closeCashSession(session.id, Number(actualAmount), selectedSellerId);
            toast.success("Caja cerrada exitosamente");

            setCloseDialogOpen(false);
            setCloseSummary({
                expectedAmount: Number(closedSession.expectedAmount || expectedCash),
                actualAmount: Number(closedSession.actualAmount || actualAmount),
                difference: Number(closedSession.difference || 0),
                closedByName:
                    sellers.find((seller) => seller.id === selectedSellerId)?.name || "Usuario",
            });
            setActualAmount("");
            loadData();
        } catch {
            toast.error("Error al cerrar la caja");
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
            <div className="p-6 lg:p-10 max-w-2xl mx-auto mt-10">
                <Card className="shadow-lg border-border/50">
                    <CardHeader className="text-center pb-8">
                        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <LockKeyhole className="size-8" />
                        </div>
                        <CardTitle className="text-2xl">La caja está cerrada</CardTitle>
                        <CardDescription className="text-base mt-2">
                            Para empezar a facturar y registrar movimientos, debés abrir la caja ingresando el cambio inicial.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label>Usuario / Vendedor</Label>
                            <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                                <SelectTrigger className="h-12 text-base">
                                    <SelectValue placeholder="¿Quién abre la caja?" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sellers.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
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
                        <Button 
                            className="w-full h-14 text-lg bg-emerald-600 hover:bg-emerald-700"
                            onClick={handleOpenBox}
                        >
                            Abrir Caja Ahora
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    } else {
        mainContent = (
            <div className="p-6 lg:p-10 animate-in fade-in duration-300">
                <div className="mb-5">
                    <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
                        <LockOpen className="size-8 text-emerald-600" />
                        Caja Abierta
                    </h1>
                    <p className="mt-1 text-muted-foreground">
                        Abierta por <span className="font-medium text-foreground">{session.openedBy?.name}</span> el {format(new Date(session.openingDate), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}
                    </p>
                </div>

                <Card className="mb-8 border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-rose-50 shadow-sm">
                    <CardContent className="p-4 sm:p-5">
                        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Acciones Rápidas</p>
                                <p className="text-sm text-muted-foreground">Ingreso y retiro al alcance, sin perderlos de vista.</p>
                            </div>
                            <div className="rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
                                Efectivo esperado: <span className="font-bold text-emerald-700">{formatCurrency(expectedCash)}</span>
                            </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            <Button
                                variant="outline"
                                className="h-20 justify-start gap-4 border-rose-200 bg-white text-left text-rose-700 shadow-sm hover:bg-rose-50"
                                onClick={() => { setMovementType("EGRESO"); setMovementDialogOpen(true); }}
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
                                onClick={() => { setMovementType("INGRESO"); setMovementDialogOpen(true); }}
                            >
                                <div className="rounded-full bg-emerald-100 p-2.5">
                                    <ArrowUpCircle className="size-6 text-emerald-600" />
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className="text-base font-bold">Ingresar Dinero</span>
                                    <span className="text-xs text-emerald-700/80">Cambio extra, reposiciones, ingresos</span>
                                </div>
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card className="bg-emerald-600 text-white shadow-md border-none">
                        <CardContent className="p-6">
                            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-emerald-100">Efectivo en Cajón (Aprox)</p>
                            <p className="text-4xl font-bold">{formatCurrency(expectedCash)}</p>
                            <p className="mt-2 text-sm text-emerald-200">
                                Fondo inicial: {formatCurrency(session.initialAmount)}
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Ventas Efectivo</p>
                                <Wallet className="size-5 text-muted-foreground" />
                            </div>
                            <p className="text-3xl font-bold">{formatCurrency(salesCash)}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <div className="mb-2 flex items-center justify-between">
                                <p className="text-sm font-medium uppercase tracking-wider text-blue-600/80">Transferencias</p>
                                <Wallet className="size-5 text-blue-600/50" />
                            </div>
                            <p className="text-3xl font-bold text-blue-600">{formatCurrency(salesTransfer)}</p>
                            <p className="mt-2 text-xs text-muted-foreground">Dinero digital, no está en el cajón.</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="p-6">
                            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">Gastos / Retiros</p>
                            <p className="text-3xl font-bold text-rose-600">{formatCurrency(manualOut)}</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-8 lg:grid-cols-3">
                    <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <History className="size-5 text-muted-foreground" />
                            Movimientos Manuales de Hoy
                        </CardTitle>
                        <CardDescription>Gastos, retiros o ingresos extra fuera de las ventas.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {session.movements.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground">
                                No se registraron movimientos manuales hoy.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {session.movements.map((mov) => (
                                    <div key={mov.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
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
                                        <p className={cn("font-bold", mov.type === "INGRESO" ? "text-emerald-600" : "text-rose-600")}>
                                            {mov.type === "INGRESO" ? "+" : "-"}{formatCurrency(mov.amount)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                    <Card className="h-fit border-slate-200 bg-slate-50">
                        <CardHeader>
                            <CardTitle>Cierre de Turno</CardTitle>
                            <CardDescription>Finalizá el día para generar el reporte y resetear la caja.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Resumen previo</p>
                                <div className="mt-3 space-y-2 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span>Efectivo esperado</span>
                                        <span className="font-semibold">{formatCurrency(expectedCash)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span>Ingresos manuales</span>
                                        <span className="font-semibold text-emerald-600">{formatCurrency(manualIn)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span>Retiros manuales</span>
                                        <span className="font-semibold text-rose-600">{formatCurrency(manualOut)}</span>
                                    </div>
                                </div>
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
            </div>
        );
    }

    return (
        <>
            {mainContent}

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
                                placeholder={movementType === "EGRESO" ? "Ej: Compra de artículos de limpieza" : "Ej: Cambio extra prestado"} 
                                value={movementReason}
                                onChange={(e) => setMovementReason(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMovementDialogOpen(false)}>Cancelar</Button>
                        <Button 
                            className={movementType === "INGRESO" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}
                            onClick={handleAddMovement}
                        >
                            Guardar {movementType.toLowerCase()}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Arqueo de Caja</DialogTitle>
                        <DialogDescription>
                            Contá los billetes que hay en el cajón físico y escribí el total acá abajo. El sistema calculará la diferencia.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        <div className="rounded-lg bg-emerald-50 p-4 flex justify-between items-center border border-emerald-100">
                            <span className="text-emerald-800 font-medium">El sistema espera:</span>
                            <span className="text-2xl font-bold text-emerald-700">{formatCurrency(expectedCash)}</span>
                        </div>
                        
                        <div className="space-y-2">
                            <Label className="text-base font-semibold">Efectivo Real (Contado por vos)</Label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                                <Input 
                                    type="number" 
                                    placeholder="Ej: 24500" 
                                    className="h-14 pl-10 text-xl font-medium border-2 focus-visible:ring-slate-400"
                                    value={actualAmount}
                                    onChange={(e) => setActualAmount(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Usuario responsable del cierre</Label>
                            <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleccioná un usuario" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sellers.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>Cancelar</Button>
                        <Button className="bg-slate-900 hover:bg-slate-800" onClick={handleCloseBox}>
                            Confirmar Cierre
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(closeSummary)} onOpenChange={(open) => !open && setCloseSummary(null)}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <div
                            className={cn(
                                "mx-auto mb-4 flex size-16 items-center justify-center rounded-full",
                                closeSummary?.difference === 0
                                    ? "bg-emerald-100 text-emerald-700"
                                    : closeSummary && closeSummary.difference > 0
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-rose-100 text-rose-700"
                            )}
                        >
                            {closeSummary?.difference === 0 ? (
                                <BadgeCheck className="size-8" />
                            ) : closeSummary && closeSummary.difference > 0 ? (
                                <TrendingUp className="size-8" />
                            ) : (
                                <CircleAlert className="size-8" />
                            )}
                        </div>
                        <DialogTitle className="text-center text-2xl">
                            {closeSummary?.difference === 0
                                ? "Caja cerrada sin diferencias"
                                : closeSummary && closeSummary.difference > 0
                                  ? "Caja cerrada con sobrante"
                                  : "Caja cerrada con faltante"}
                        </DialogTitle>
                        <DialogDescription className="text-center text-base">
                            Cierre registrado por <span className="font-semibold text-foreground">{closeSummary?.closedByName}</span>.
                        </DialogDescription>
                    </DialogHeader>

                    {closeSummary && (
                        <div className="space-y-4 py-2">
                            <div
                                className={cn(
                                    "rounded-2xl border p-5 text-center",
                                    closeSummary.difference === 0
                                        ? "border-emerald-200 bg-emerald-50"
                                        : closeSummary.difference > 0
                                          ? "border-amber-200 bg-amber-50"
                                          : "border-rose-200 bg-rose-50"
                                )}
                            >
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Resultado del Arqueo</p>
                                <p
                                    className={cn(
                                        "mt-3 text-4xl font-black tracking-tight",
                                        closeSummary.difference === 0
                                            ? "text-emerald-700"
                                            : closeSummary.difference > 0
                                              ? "text-amber-700"
                                              : "text-rose-700"
                                    )}
                                >
                                    {closeSummary.difference === 0
                                        ? "Exacto"
                                        : `${closeSummary.difference > 0 ? "+" : "-"}${formatCurrency(Math.abs(closeSummary.difference))}`}
                                </p>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    {closeSummary.difference === 0
                                        ? "El efectivo contado coincide con lo esperado."
                                        : closeSummary.difference > 0
                                          ? "Se contó más dinero del esperado en caja."
                                          : "Se contó menos dinero del esperado en caja."}
                                </p>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-xl border bg-white p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Esperado</p>
                                    <p className="mt-2 text-2xl font-bold">{formatCurrency(closeSummary.expectedAmount)}</p>
                                </div>
                                <div className="rounded-xl border bg-white p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Contado</p>
                                    <p className="mt-2 text-2xl font-bold">{formatCurrency(closeSummary.actualAmount)}</p>
                                </div>
                                <div className="rounded-xl border bg-white p-4">
                                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Diferencia</p>
                                    <p
                                        className={cn(
                                            "mt-2 text-2xl font-bold",
                                            closeSummary.difference === 0
                                                ? "text-emerald-700"
                                                : closeSummary.difference > 0
                                                  ? "text-amber-700"
                                                  : "text-rose-700"
                                        )}
                                    >
                                        {closeSummary.difference === 0
                                            ? formatCurrency(0)
                                            : `${closeSummary.difference > 0 ? "+" : "-"}${formatCurrency(Math.abs(closeSummary.difference))}`}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button className="w-full bg-slate-900 hover:bg-slate-800" onClick={() => setCloseSummary(null)}>
                            Entendido
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
