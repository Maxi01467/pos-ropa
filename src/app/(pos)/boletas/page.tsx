// src/app/(pos)/boletas/page.tsx
"use client";

import { useState, useEffect } from "react";
import { getSalesHistory } from "@/app/actions/sales-actions";
import {
    ReceiptText,
    Search,
    Eye,
    Calendar,
    CreditCard,
    Banknote,
    Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

// Interfaces basadas en lo que devuelve nuestra Server Action
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
    const [searchQuery, setSearchQuery] = useState("");
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

    // Filtrar boletas por número de ticket
    const filteredSales = sales.filter((sale) =>
        sale.ticketNumber.toString().includes(searchQuery)
    );

    // Estadísticas rápidas
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
    const totalTickets = sales.length;

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

            {/* Buscador */}
            <div className="mb-6 flex max-w-md items-center gap-2">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por N° de Boleta..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-11 pl-10"
                        type="number"
                    />
                </div>
            </div>

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
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredSales.map((sale) => (
                                <TableRow key={sale.id}>
                                    <TableCell>
                                        <Badge variant="outline" className="font-mono text-sm">
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
                                        <Badge className={
                                            sale.paymentMethod === 'EFECTIVO' ? 'bg-emerald-100 text-emerald-700' : 
                                            sale.paymentMethod === 'TRANSFERENCIA' ? 'bg-blue-100 text-blue-700' : 
                                            'bg-slate-100 text-slate-700'
                                        }>
                                            {sale.paymentMethod === 'EFECTIVO' && <Banknote className="mr-1 size-3" />}
                                            {sale.paymentMethod === 'TRANSFERENCIA' && <CreditCard className="mr-1 size-3" />}
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

                            <div className="mt-4 rounded-lg border">
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
                                                    <code className="mt-1 block text-[10px] text-muted-foreground">
                                                        SKU: {item.sku}
                                                    </code>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="secondary">{item.quantity}</Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatCurrency(item.priceAtTime)}
                                                    <p className="text-[10px] text-muted-foreground uppercase">
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
                            
                            <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/50 p-4">
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground">Método de pago</p>
                                    <p className="font-semibold">{selectedTicket.paymentMethod}</p>
                                </div>
                                <div className="text-right space-y-1">
                                    <p className="text-sm text-muted-foreground">Total cobrado</p>
                                    <p className="text-2xl font-bold">{formatCurrency(selectedTicket.total)}</p>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}