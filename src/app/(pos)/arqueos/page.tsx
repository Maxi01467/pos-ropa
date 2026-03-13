"use client";

import { useEffect, useState } from "react";
import {
    getPendingCountSessions,
    getClosedSessions,
    submitArqueo,
} from "@/app/actions/cash-actions";
import { getSellers } from "@/app/actions/pos-actions";
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
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type Seller = { id: string; name: string; role: string };

type CashSession = {
    id: string;
    status: string;
    openingDate: string;
    closingDate: string | null;
    countingDate: string | null;
    initialAmount: number;
    expectedAmount: number | null;
    actualAmount: number | null;
    difference: number | null;
    openedBy: { id: string; name: string; role: string } | null;
    closedBy: { id: string; name: string; role: string } | null;
    countedBy: { id: string; name: string; role: string } | null;
    movements: Array<{ id: string; amount: number; type: string; reason: string; createdAt: string }>;
    sales: Array<{ id: string; total: number; paymentMethod: string; cashAmount: number | null; createdAt: string }>;
};

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
    const [pending, setPending] = useState<CashSession[]>([]);
    const [closed, setClosed] = useState<CashSession[]>([]);
    const [sellers, setSellers] = useState<Seller[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Dialog state
    const [arqueoDialogSession, setArqueoDialogSession] = useState<CashSession | null>(null);
    const [actualAmount, setActualAmount] = useState("");
    const [countedById, setCountedById] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [p, c, s] = await Promise.all([
                getPendingCountSessions(),
                getClosedSessions(20),
                getSellers(),
            ]);
            setPending(p as CashSession[]);
            setClosed(c as CashSession[]);
            setSellers(s as Seller[]);
            if (s.length > 0) setCountedById(s[0].id);
        } catch {
            toast.error("Error al cargar los arqueos");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleOpenArqueoDialog = (session: CashSession) => {
        setArqueoDialogSession(session);
        setActualAmount("");
    };

    const handleSubmitArqueo = async () => {
        if (!arqueoDialogSession) return;
        if (actualAmount === "" || isNaN(Number(actualAmount))) {
            return toast.error("Ingresá el monto real que contaste");
        }
        if (!countedById) {
            return toast.error("Seleccioná quien realizó el arqueo");
        }
        setIsSaving(true);
        try {
            await submitArqueo(arqueoDialogSession.id, Number(actualAmount), countedById);
            toast.success("Arqueo registrado correctamente");
            setArqueoDialogSession(null);
            setActualAmount("");
            loadData();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Error al registrar el arqueo");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <Loader2 className="size-10 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="p-6 lg:p-10 animate-in fade-in duration-300">
            <div className="mb-8">
                <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
                    <ClipboardList className="size-8 text-amber-500" />
                    Arqueos de Caja
                </h1>
                <p className="mt-1 text-muted-foreground">
                    Controlá y registrá el conteo físico del efectivo de cada turno.
                </p>
            </div>

            {/* ─── Pendientes ─── */}
            <section className="mb-10">
                <div className="mb-4 flex items-center gap-3">
                    <h2 className="text-xl font-semibold">Pendientes de arqueo</h2>
                    {pending.length > 0 && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
                            {pending.length} pendiente{pending.length !== 1 ? "s" : ""}
                        </Badge>
                    )}
                </div>

                {pending.length === 0 ? (
                    <Card className="border-dashed">
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
                                    className="border-amber-200 bg-amber-50/50 shadow-sm hover:shadow-md transition-shadow"
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
                                            <Badge className="bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-100 text-xs">
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
                                            className="w-full bg-amber-500 hover:bg-amber-600 text-white"
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
                        {closed.map((s) => {
                            const diff = s.difference ?? 0;
                            const isExact = diff === 0;
                            const isSurplus = diff > 0;
                            return (
                                <Card key={s.id} className="shadow-sm">
                                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                                        <div className="flex items-center gap-4">
                                            <div
                                                className={cn(
                                                    "flex size-10 shrink-0 items-center justify-center rounded-full",
                                                    isExact
                                                        ? "bg-emerald-100 text-emerald-700"
                                                        : isSurplus
                                                          ? "bg-amber-100 text-amber-700"
                                                          : "bg-rose-100 text-rose-700"
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
                                                            ? "text-emerald-700"
                                                            : isSurplus
                                                              ? "text-amber-700"
                                                              : "text-rose-700"
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
                            <div className="rounded-lg bg-emerald-50 p-4 flex justify-between items-center border border-emerald-100">
                                <span className="text-emerald-800 font-medium text-sm">El sistema espera:</span>
                                <span className="text-2xl font-bold text-emerald-700">
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
                            className="bg-amber-500 hover:bg-amber-600 text-white"
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
