"use client";

import { useEffect, useMemo, useState } from "react";
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
    const [selectedSession, setSelectedSession] = useState<CashSessionHistory | null>(null);

    useEffect(() => {
        const loadHistory = async () => {
            try {
                const data = await getCashSessionsHistory();
                setSessions(data);
            } catch (error) {
                toast.error("No se pudo cargar el historial de caja");
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };

        loadHistory();
    }, []);

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

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-muted-foreground">
                    <Loader2 className="size-10 animate-spin text-primary" />
                    <p className="text-lg font-medium">Cargando historial de caja...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
                    Historial de Caja
                </h1>
                <p className="mt-1 text-muted-foreground">
                    Revisá todas las cajas abiertas, cerradas o pendientes y consultá las boletas de cada sesión.
                </p>
            </div>

            <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                            <LockOpen className="size-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Cajas abiertas</p>
                            <p className="text-2xl font-bold">{summary.openSessions}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
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
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                            <Wallet className="size-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Pendientes de arqueo</p>
                            <p className="text-2xl font-bold">{summary.pendingCountSessions}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                            <ReceiptText className="size-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Boletas registradas</p>
                            <p className="text-2xl font-bold">{summary.totalTickets}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="rounded-xl border bg-card">
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
                                            Caja #{sessions.length - index}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            className={cn(
                                                "gap-1",
                                                session.status === "OPEN" && "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
                                                session.status === "CLOSED" && "bg-slate-100 text-slate-700 hover:bg-slate-200",
                                                session.status === "PENDING_COUNT" && "bg-amber-100 text-amber-700 hover:bg-amber-200"
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
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="gap-2"
                                            onClick={() => setSelectedSession(session)}
                                        >
                                            <Eye className="size-4" />
                                            Ver boletas
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog
                open={Boolean(selectedSession)}
                onOpenChange={(open) => !open && setSelectedSession(null)}
            >
                <DialogContent className="sm:max-w-4xl">
                    {selectedSession && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-xl">
                                    <Wallet className="size-5 text-muted-foreground" />
                                    Detalle de caja
                                </DialogTitle>
                                <DialogDescription>
                                    Apertura: {formatDate(selectedSession.openingDate)} · Cierre: {formatDate(selectedSession.closingDate)}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-lg border bg-muted/30 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado</p>
                                    <p className="mt-2 text-lg font-bold">{selectedSession.status === "PENDING_COUNT" ? "PENDIENTE" : selectedSession.status}</p>
                                </div>
                                <div className="rounded-lg border bg-muted/30 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fondo inicial</p>
                                    <p className="mt-2 text-lg font-bold">{formatCurrency(selectedSession.initialAmount)}</p>
                                </div>
                                <div className="rounded-lg border bg-muted/30 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Boletas</p>
                                    <p className="mt-2 text-lg font-bold">{selectedSession.sales.length}</p>
                                </div>
                            </div>

                            <div className="max-h-[50vh] overflow-auto rounded-lg border">
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
                                        {selectedSession.sales.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                                                    Esta caja todavía no tiene boletas registradas.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            selectedSession.sales.map((sale) => (
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
                                                            sale.paymentMethod === "EFECTIVO" && "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
                                                            sale.paymentMethod === "TRANSFERENCIA" && "bg-blue-100 text-blue-700 hover:bg-blue-200",
                                                            sale.paymentMethod === "MIXTO" && "bg-purple-100 text-purple-700 hover:bg-purple-200",
                                                            sale.paymentMethod === "CAMBIO" && "bg-amber-100 text-amber-700 hover:bg-amber-200"
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
