"use client";

import { useState, useEffect, useMemo } from "react";
import { getSalesHistory } from "@/app/actions/sales-actions";
import {
    ReceiptText,
    Search,
    Eye,
    Calendar,
    CreditCard,
    Banknote,
    Loader2,
    Filter,
    X,
    Layers // Nuevo icono para pago mixto
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SaleItem {
    id: string;
    productName: string;
    size: string;
    color: string;
    sku: string;
    quantity: number;
    priceAtTime: number;
    priceType: string;
    returnedQuantity: number;
}

interface SaleTicket {
    id: string;
    ticketNumber: number;
    total: number;
    paymentMethod: string;
    cashAmount?: number;     // NUEVO: Para el desglose
    transferAmount?: number; // NUEVO: Para el desglose
    date: string;
    sellerName: string;
    items: SaleItem[];
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 0,
    }).format(amount);
}

function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-AR", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });
}

export default function BoletasPage() {
    const [sales, setSales] = useState<SaleTicket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Estados de filtrado
    const [searchQuery, setSearchQuery] = useState("");
    const [filterDateFrom, setFilterDateFrom] = useState("");
    const [filterDateTo, setFilterDateTo] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    
    const [selectedTicket, setSelectedTicket] = useState<SaleTicket | null>(null);

    useEffect(() => {
        const loadSales = async () => {
            try {
                const data = await getSalesHistory();
                setSales(data);
            } catch (error) {
                toast.error("Error al cargar el historial de boletas");
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };
        loadSales();
    }, []);

    // Lógica de filtrado
    const filteredSales = useMemo(() => {
        return sales.filter((sale) => {
            if (searchQuery && !sale.ticketNumber.toString().includes(searchQuery)) {
                return false;
            }
            if (filterDateFrom) {
                const fromDate = new Date(filterDateFrom);
                if (new Date(sale.date) < fromDate) {
                    return false;
                }
            }
            if (filterDateTo) {
                const toDate = new Date(`${filterDateTo}T23:59:59`);
                if (new Date(sale.date) > toDate) {
                    return false;
                }
            }
            return true;
        });
    }, [sales, searchQuery, filterDateFrom, filterDateTo]);

    // Estadísticas
    const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
    const totalTickets = filteredSales.length;

    const hasActiveDateFilters = filterDateFrom !== "" || filterDateTo !== "";

    const clearDateFilters = () => {
        setFilterDateFrom("");
        setFilterDateTo("");
    };

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-muted-foreground">
                    <Loader2 className="size-10 animate-spin text-primary" />
                    <p className="text-lg font-medium">Cargando historial de ventas...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-8">
            {/* Cabecera */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
                        Boletas y Ventas
                    </h1>
                    <p className="mt-1 text-muted-foreground">
                        Historial completo de tickets emitidos
                    </p>
                </div>
            </div>

            {/* Tarjetas de Resumen */}
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                            <Banknote className="size-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Recaudación Total</p>
                            <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <ReceiptText className="size-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Tickets Emitidos</p>
                            <p className="text-2xl font-bold">{totalTickets}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Buscador y Filtros */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por N° de Boleta..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-11 pl-10"
                        type="number"
                    />
                </div>
                
                <div className="flex items-center gap-2">
                    <Button
                        variant={showFilters ? "secondary" : "outline"}
                        className="h-11 gap-2"
                        onClick={() => setShowFilters(!showFilters)}
                    >
                        <Filter className="size-4" />
                        Fechas
                        {hasActiveDateFilters && (
                            <Badge variant="default" className="ml-1 flex size-5 items-center justify-center rounded-full p-0 text-xs">
                                !
                            </Badge>
                        )}
                    </Button>
                    {hasActiveDateFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-11 gap-1 text-muted-foreground"
                            onClick={clearDateFilters}
                        >
                            <X className="size-3.5" />
                            Limpiar fechas
                        </Button>
                    )}
                </div>
            </div>

            {/* Panel de Fechas */}
            {showFilters && (
                <div className="mb-6 rounded-lg border bg-muted/30 p-4 max-w-2xl">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Desde</Label>
                            <Input
                                type="date"
                                value={filterDateFrom}
                                onChange={(event) => setFilterDateFrom(event.target.value)}
                                className="h-10 bg-background"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium">Hasta</Label>
                            <Input
                                type="date"
                                value={filterDateTo}
                                onChange={(event) => setFilterDateTo(event.target.value)}
                                className="h-10 bg-background"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Tabla Principal */}
            <div className="rounded-xl border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="font-semibold">N° Boleta</TableHead>
                            <TableHead className="font-semibold">Fecha</TableHead>
                            <TableHead className="font-semibold">Vendedor</TableHead>
                            <TableHead className="font-semibold">Método Pago</TableHead>
                            <TableHead className="text-right font-semibold">Total</TableHead>
                            <TableHead className="text-right font-semibold">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredSales.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="py-16 text-center">
                                    <ReceiptText className="mx-auto mb-3 size-12 text-muted-foreground/30" />
                                    <p className="text-lg font-medium text-muted-foreground">
                                        No se encontraron boletas
                                    </p>
                                    {(searchQuery || hasActiveDateFilters) && (
                                        <p className="mt-1 text-sm text-muted-foreground/70">
                                            Probá ajustando los filtros de búsqueda
                                        </p>
                                    )}
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredSales.map((sale) => (
                                <TableRow key={sale.id}>
                                    <TableCell>
                                        <Badge variant="outline" className="font-mono text-sm bg-background">
                                            #{sale.ticketNumber.toString().padStart(4, '0')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="size-3.5" />
                                            {formatDate(sale.date)}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm font-medium">
                                        {sale.sellerName}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={cn(
                                            "gap-1",
                                            sale.paymentMethod === 'EFECTIVO' && 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
                                            sale.paymentMethod === 'TRANSFERENCIA' && 'bg-blue-100 text-blue-700 hover:bg-blue-200',
                                            sale.paymentMethod === 'MIXTO' && 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                        )}>
                                            {sale.paymentMethod === 'EFECTIVO' && <Banknote className="size-3" />}
                                            {sale.paymentMethod === 'TRANSFERENCIA' && <CreditCard className="size-3" />}
                                            {sale.paymentMethod === 'MIXTO' && <Layers className="size-3" />}
                                            {sale.paymentMethod}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-bold">
                                        {formatCurrency(sale.total)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="gap-2"
                                            onClick={() => setSelectedTicket(sale)}
                                        >
                                            <Eye className="size-4" />
                                            Ver detalle
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Modal de Detalle de Boleta */}
            <Dialog 
                open={Boolean(selectedTicket)} 
                onOpenChange={(open) => !open && setSelectedTicket(null)}
            >
                <DialogContent className="sm:max-w-2xl">
                    {selectedTicket && (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-xl">
                                    <ReceiptText className="size-5 text-muted-foreground" />
                                    Boleta #{selectedTicket.ticketNumber.toString().padStart(4, '0')}
                                </DialogTitle>
                                <DialogDescription>
                                    Emitida el {formatDate(selectedTicket.date)} por {selectedTicket.sellerName}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="mt-4 max-h-[40vh] overflow-auto rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                                            <TableHead>Producto</TableHead>
                                            <TableHead className="text-center">Cant.</TableHead>
                                            <TableHead className="text-right">Precio Unit.</TableHead>
                                            <TableHead className="text-right">Subtotal</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedTicket.items.map((item) => (
                                            <TableRow key={item.id}>
                                                <TableCell>
                                                    <p className="font-semibold">{item.productName}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Talle: {item.size} | Color: {item.color}
                                                    </p>
                                                    <code className="mt-1 block w-max rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                                        {item.sku}
                                                    </code>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="secondary">{item.quantity}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatCurrency(item.priceAtTime)}
                                                    <p className="text-[10px] text-muted-foreground uppercase font-medium">
                                                        {item.priceType === "WHOLESALE" ? "Mayorista" : "Normal"}
                                                    </p>
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {formatCurrency(item.priceAtTime * item.quantity)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            
                            {/* BLOQUE DE DESGLOSE DE PAGO */}
                            <div className="mt-4 flex flex-col gap-3 rounded-lg bg-muted/30 p-4 border border-border/50">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-muted-foreground">Método de pago</p>
                                        <Badge className={cn(
                                            "gap-1 uppercase tracking-wider text-xs",
                                            selectedTicket.paymentMethod === 'EFECTIVO' && 'bg-emerald-100 text-emerald-700',
                                            selectedTicket.paymentMethod === 'TRANSFERENCIA' && 'bg-blue-100 text-blue-700',
                                            selectedTicket.paymentMethod === 'MIXTO' && 'bg-purple-100 text-purple-700'
                                        )}>
                                            {selectedTicket.paymentMethod}
                                        </Badge>
                                    </div>
                                    <div className="text-right space-y-1">
                                        <p className="text-sm font-medium text-muted-foreground">Total cobrado</p>
                                        <p className="text-3xl font-bold tracking-tight">{formatCurrency(selectedTicket.total)}</p>
                                    </div>
                                </div>
                                
                                {/* Desglose exclusivo para MIXTO */}
                                {selectedTicket.paymentMethod === 'MIXTO' && (
                                    <div className="mt-2 grid grid-cols-2 gap-4 rounded-md bg-background p-3 border shadow-sm">
                                        <div>
                                            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-bold mb-1">
                                                En Efectivo
                                            </p>
                                            <p className="text-xl font-bold text-emerald-600">
                                                {formatCurrency(selectedTicket.cashAmount || 0)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-bold mb-1">
                                                Transferencia
                                            </p>
                                            <p className="text-xl font-bold text-blue-600">
                                                {formatCurrency(selectedTicket.transferAmount || 0)}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}