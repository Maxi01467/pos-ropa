"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getCashSessionsHistory } from "@/app/actions/cash-actions";
import {
    ReceiptText,
    Wallet,
    LockOpen,
    Lock,
    Loader2,
    Eye,
    Calendar,
    Banknote,
    CreditCard,
    Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type CashSessionHistory = {
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
    movements: Array<{
        id: string;
        amount: number;
        type: string;
        reason: string;
        createdAt: string;
    }>;
    sales: Array<{
        id: string;
        ticketNumber: number;
        total: number;
        paymentMethod: string;
        cashAmount: number | null;
        transferAmount: number | null;
        createdAt: string;
        sellerName: string;
    }>;
};

function formatCurrency(amount: number | null | undefined): string {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 0,
    }).format(Number(amount) || 0);
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return "—";

    return new Date(dateStr).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function HistorialCajaPage() {
    const [sessions, setSessions] = useState<CashSessionHistory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(30);
    const [totalPages, setTotalPages] = useState(1);
    const [totalSessions, setTotalSessions] = useState(0);
    const [selectedTicketsSession, setSelectedTicketsSession] = useState<CashSessionHistory | null>(null);
    const [selectedCashSession, setSelectedCashSession] = useState<CashSessionHistory | null>(null);

    const loadHistory = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await getCashSessionsHistory({ page: currentPage, pageSize });
            setSessions(data.items);
            setPageSize(data.pageSize);
            setTotalPages(data.totalPages);
            setTotalSessions(data.total);
        } catch (error) {
            toast.error("No se pudo cargar el historial de caja");
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, pageSize]);

    useEffect(() => {
        void loadHistory();
    }, [loadHistory]);

    const summary = useMemo(() => {
        const openSessions = sessions.filter((session) => session.status === "OPEN").length;
        const closedSessions = sessions.filter((session) => session.status === "CLOSED").length;
        const pendingCountSessions = sessions.filter((session) => session.status === "PENDING_COUNT").length;
        const totalTickets = sessions.reduce((sum, session) => sum + session.sales.length, 0);

        return {
            openSessions,
            closedSessions,
            pendingCountSessions,
            totalTickets,
        };
    }, [sessions]);

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

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-6">
                <div className="rounded-[1.75rem] border border-border/70 bg-card/90 px-10 py-8 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="rounded-2xl bg-slate-100 p-3">
                            <Loader2 className="size-6 animate-spin text-slate-700" />
                        </div>
                        <div>
                            <p className="text-base font-semibold text-foreground">Cargando historial</p>
                            <p className="text-sm text-muted-foreground">
                                Estamos preparando las sesiones y sus boletas.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-violet-900/25 bg-[linear-gradient(135deg,rgba(109,40,217,0.18),rgba(67,56,202,0.08))] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-800 dark:text-violet-100">
                            <ReceiptText className="size-3.5" />
                            Historial de caja
                        </div>
                        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-3xl">
                            Boletas y sesiones
                        </h1>
                    </div>
                    <div className="inline-flex items-center gap-3 rounded-[1.25rem] border border-border/70 bg-card/90 px-4 py-3 shadow-sm">
                        <div className="rounded-xl bg-muted px-3 py-2 text-center">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                                Sesiones
                            </p>
                            <p className="mt-1 text-xl font-semibold text-foreground">{totalSessions}</p>
                        </div>
                        <div className="rounded-xl bg-muted px-3 py-2 text-center">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                                Boletas
                            </p>
                            <p className="mt-1 text-xl font-semibold text-foreground">{summary.totalTickets}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="rounded-[1.5rem] border-emerald-800/20 bg-[linear-gradient(135deg,rgba(5,150,105,0.14),rgba(6,95,70,0.04))] shadow-sm">
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-900 text-emerald-100">
                            <LockOpen className="size-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Cajas abiertas</p>
                            <p className="text-2xl font-bold">{summary.openSessions}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-[1.5rem] border-border/70 bg-card/90 shadow-sm">
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                            <Lock className="size-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Cajas cerradas</p>
                            <p className="text-2xl font-bold">{summary.closedSessions}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-[1.5rem] border-orange-800/20 bg-[linear-gradient(135deg,rgba(234,88,12,0.14),rgba(194,65,12,0.04))] shadow-sm">
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-orange-900 text-orange-100">
                            <Wallet className="size-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Pendientes de arqueo</p>
                            <p className="text-2xl font-bold">{summary.pendingCountSessions}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-[1.5rem] border-blue-800/20 bg-[linear-gradient(135deg,rgba(37,99,235,0.14),rgba(30,64,175,0.04))] shadow-sm">
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-blue-900 text-blue-100">
                            <ReceiptText className="size-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Boletas registradas</p>
                            <p className="text-2xl font-bold">{summary.totalTickets}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="mt-5 overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/92 shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="font-semibold">Caja</TableHead>
                            <TableHead className="font-semibold">Estado</TableHead>
                            <TableHead className="font-semibold">Apertura</TableHead>
                            <TableHead className="font-semibold">Cierre</TableHead>
                            <TableHead className="font-semibold">Abierta por</TableHead>
                            <TableHead className="text-right font-semibold">Boletas</TableHead>
                            <TableHead className="text-right font-semibold">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sessions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="py-16 text-center">
                                    <Wallet className="mx-auto mb-3 size-12 text-muted-foreground/30" />
                                    <p className="text-lg font-medium text-muted-foreground">
                                        Todavía no hay sesiones de caja registradas
                                    </p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            sessions.map((session, index) => (
                                <TableRow key={session.id}>
                                    <TableCell>
                                        <Badge variant="outline" className="font-mono text-sm bg-background">
                                            Caja #{Math.max(totalSessions - (currentPage - 1) * pageSize - index, 1)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            className={cn(
                                                "gap-1",
                                                session.status === "OPEN" && "bg-emerald-900 text-emerald-100 hover:bg-emerald-800",
                                                session.status === "CLOSED" && "bg-slate-100 text-slate-700 hover:bg-slate-200",
                                                session.status === "PENDING_COUNT" && "bg-orange-900 text-orange-100 hover:bg-orange-800"
                                            )}
                                        >
                                            {session.status === "OPEN" ? <LockOpen className="size-3" /> : <Lock className="size-3" />}
                                            {session.status === "PENDING_COUNT" ? "PENDIENTE" : session.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="size-3.5" />
                                            {formatDate(session.openingDate)}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {formatDate(session.closingDate)}
                                    </TableCell>
                                    <TableCell className="text-sm font-medium">
                                        {session.openedBy?.name ?? "—"}
                                    </TableCell>
                                    <TableCell className="text-right font-bold">
                                        {session.sales.length}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-2"
                                                onClick={() => setSelectedCashSession(session)}
                                            >
                                                <Wallet className="size-4" />
                                                Ver caja
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="gap-2"
                                                onClick={() => setSelectedTicketsSession(session)}
                                            >
                                                <Eye className="size-4" />
                                                Ver boletas
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {sessions.length > 0 ? (
                <div className="mt-4 flex flex-col gap-3 rounded-[1.25rem] border border-border/70 bg-card/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                        Página {currentPage} de {totalPages} · {totalSessions} sesión(es)
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                            disabled={currentPage === 1}
                        >
                            Anterior
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                            disabled={currentPage === totalPages}
                        >
                            Siguiente
                        </Button>
                    </div>
                </div>
            ) : null}

            <Dialog
                open={Boolean(selectedCashSession)}
                onOpenChange={(open) => !open && setSelectedCashSession(null)}
            >
                <DialogContent className="sm:max-w-4xl">
                    {selectedCashSession && (
                        <>
                            {(() => {
                                const amounts = getSessionAmounts(selectedCashSession);

                                return (
                                    <>
                                        <DialogHeader>
                                            <DialogTitle className="flex items-center gap-2 text-xl">
                                                <Wallet className="size-5 text-muted-foreground" />
                                                Detalle de caja
                                            </DialogTitle>
                                            <DialogDescription>
                                                Apertura: {formatDate(selectedCashSession.openingDate)} · Cierre: {formatDate(selectedCashSession.closingDate)}
                                            </DialogDescription>
                                        </DialogHeader>

                                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                            <div className="rounded-[1.25rem] border border-border/70 bg-muted/30 p-4">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</p>
                                                <p className="mt-2 text-lg font-bold">
                                                    {selectedCashSession.status === "PENDING_COUNT" ? "PENDIENTE" : selectedCashSession.status}
                                                </p>
                                            </div>
                                            <div className="rounded-[1.25rem] border border-border/70 bg-muted/30 p-4">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fondo inicial</p>
                                                <p className="mt-2 text-lg font-bold">{formatCurrency(selectedCashSession.initialAmount)}</p>
                                            </div>
                                            <div className="rounded-[1.25rem] border border-border/70 bg-muted/30 p-4">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Efectivo en ventas</p>
                                                <p className="mt-2 text-lg font-bold">{formatCurrency(amounts.salesCash)}</p>
                                            </div>
                                            <div className="rounded-[1.25rem] border border-border/70 bg-muted/30 p-4">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transferencias</p>
                                                <p className="mt-2 text-lg font-bold">{formatCurrency(amounts.salesTransfer)}</p>
                                            </div>
                                            <div className="rounded-[1.25rem] border border-border/70 bg-muted/30 p-4">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ingresos manuales</p>
                                                <p className="mt-2 text-lg font-bold">{formatCurrency(amounts.manualIn)}</p>
                                            </div>
                                            <div className="rounded-[1.25rem] border border-border/70 bg-muted/30 p-4">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Egresos manuales</p>
                                                <p className="mt-2 text-lg font-bold">{formatCurrency(amounts.manualOut)}</p>
                                            </div>
                                            <div className="rounded-[1.25rem] border border-border/70 bg-muted/30 p-4">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Monto esperado</p>
                                                <p className="mt-2 text-lg font-bold">{formatCurrency(selectedCashSession.expectedAmount ?? amounts.expectedCash)}</p>
                                            </div>
                                            <div className="rounded-[1.25rem] border border-border/70 bg-muted/30 p-4">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Monto contado</p>
                                                <p className="mt-2 text-lg font-bold">{formatCurrency(selectedCashSession.actualAmount)}</p>
                                            </div>
                                        </div>

                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="rounded-[1.25rem] border border-border/70 bg-muted/30 p-4">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Diferencia</p>
                                                <p className="mt-2 text-lg font-bold">{formatCurrency(selectedCashSession.difference)}</p>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    Arqueada por {selectedCashSession.countedBy?.name ?? "—"} el {formatDate(selectedCashSession.countingDate)}
                                                </p>
                                            </div>
                                            <div className="rounded-[1.25rem] border border-border/70 bg-muted/30 p-4">
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Responsables</p>
                                                <p className="mt-2 text-sm font-medium text-foreground">Apertura: {selectedCashSession.openedBy?.name ?? "—"}</p>
                                                <p className="mt-1 text-sm text-muted-foreground">Cierre: {selectedCashSession.closedBy?.name ?? "—"}</p>
                                                <p className="mt-1 text-sm text-muted-foreground">Boletas: {selectedCashSession.sales.length}</p>
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
                onOpenChange={(open) => !open && setSelectedTicketsSession(null)}
            >
                <DialogContent className="sm:max-w-4xl">
                    {selectedTicketsSession && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-xl">
                                    <Eye className="size-5 text-muted-foreground" />
                                    Boletas de la caja
                                </DialogTitle>
                                <DialogDescription>
                                    Apertura: {formatDate(selectedTicketsSession.openingDate)} · Cierre: {formatDate(selectedTicketsSession.closingDate)}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-[1.25rem] border border-border/70 bg-muted/30 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</p>
                                    <p className="mt-2 text-lg font-bold">{selectedTicketsSession.status === "PENDING_COUNT" ? "PENDIENTE" : selectedTicketsSession.status}</p>
                                </div>
                                <div className="rounded-[1.25rem] border border-border/70 bg-muted/30 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fondo inicial</p>
                                    <p className="mt-2 text-lg font-bold">{formatCurrency(selectedTicketsSession.initialAmount)}</p>
                                </div>
                                <div className="rounded-[1.25rem] border border-border/70 bg-muted/30 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Boletas</p>
                                    <p className="mt-2 text-lg font-bold">{selectedTicketsSession.sales.length}</p>
                                </div>
                            </div>

                            <div className="max-h-[50vh] overflow-auto rounded-[1.25rem] border border-border/70">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead>N° Boleta</TableHead>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Vendedor</TableHead>
                                            <TableHead>Método</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedTicketsSession.sales.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                                                    Esta caja todavía no tiene boletas registradas.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            selectedTicketsSession.sales.map((sale) => (
                                                <TableRow key={sale.id}>
                                                    <TableCell>
                                                        <Badge variant="outline" className="font-mono text-sm bg-background">
                                                            #{sale.ticketNumber.toString().padStart(4, "0")}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {formatDate(sale.createdAt)}
                                                    </TableCell>
                                                    <TableCell className="text-sm font-medium">
                                                        {sale.sellerName}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge className={cn(
                                                            "gap-1",
                                                            sale.paymentMethod === "EFECTIVO" && "bg-emerald-900 text-emerald-100 hover:bg-emerald-800",
                                                            sale.paymentMethod === "TRANSFERENCIA" && "bg-blue-900 text-blue-100 hover:bg-blue-800",
                                                            sale.paymentMethod === "MIXTO" && "bg-violet-900 text-violet-100 hover:bg-violet-800",
                                                            sale.paymentMethod === "CAMBIO" && "bg-orange-900 text-orange-100 hover:bg-orange-800"
                                                        )}>
                                                            {sale.paymentMethod === "EFECTIVO" && <Banknote className="size-3" />}
                                                            {sale.paymentMethod === "TRANSFERENCIA" && <CreditCard className="size-3" />}
                                                            {sale.paymentMethod === "MIXTO" && <Layers className="size-3" />}
                                                            {sale.paymentMethod}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold">
                                                        {formatCurrency(sale.total)}
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
