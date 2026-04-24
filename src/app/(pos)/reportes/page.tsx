"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowDownLeft,
    ArrowUpRight,
    Banknote,
    Clock3,
    CreditCard,
    PackageSearch,
    Layers,
    Loader2,
    PackageX,
    ReceiptText,
    ShieldAlert,
    Star,
    TrendingUp,
    User,
    Wallet,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/core/utils";
import {
    formatArgentinaDateTimeWithSuffix,
    formatArgentinaShortDate,
    normalizeDateInput,
} from "@/lib/core/datetime";
import { CACHE_TAGS } from "@/lib/core/cache-tags";
import { useDataRefresh } from "@/lib/sync/data-sync-client";
import {
    OfflineBootstrapRequiredError,
    assertOfflineBootstrapReady,
    getOfflineBootstrapRequiredMessage,
} from "@/lib/offline/offline-bootstrap";
import { db, initPowerSync } from "@/lib/powersync/db";
import { useTerminalSnapshot } from "@/lib/terminal/terminal-client";
import type { PosSaleHistoryItem } from "@/lib/offline/pos-runtime-data";

type InventoryProduct = {
    id: string;
    code: string;
    name: string;
    price: number;
    wholesalePrice: number;
    costPrice?: number;
    stock: number;
};

type LocalProductRow = {
    id: string;
    name: string;
    priceNormal: number | string | null;
    priceWholesale: number | string | null;
};

type LocalVariantRow = {
    productId: string;
    stock: number | string | null;
};

type LocalSaleRow = {
    id: string;
    ticketNumber: string | number | null;
    total: number | string | null;
    paymentMethod: string;
    cashAmount: number | string | null;
    transferAmount: number | string | null;
    date: string;
    sellerName: string;
};

type LocalSaleItemRow = {
    id: string;
    saleId: string;
    variantId: string;
    productName: string;
    size: string;
    color: string;
    sku: string;
    quantity: number | string | null;
    priceAtTime: number | string | null;
    priceType: string;
    returnedQuantity: number | string | null;
};

function formatCurrency(amount: number | null | undefined): string {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 0,
    }).format(Number(amount) || 0);
}

function formatDate(dateStr: string): string {
    return formatArgentinaDateTimeWithSuffix(dateStr);
}

function formatShortDate(dateStr: string): string {
    return formatArgentinaShortDate(dateStr);
}

function formatHourRange(hour: number): string {
    const start = hour.toString().padStart(2, "0");
    const end = ((hour + 1) % 24).toString().padStart(2, "0");
    return `${start}:00 - ${end}:00`;
}

function toNumber(value: number | string | null | undefined): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

async function queryRows<T extends object>(sql: string, parameters: unknown[] = []): Promise<T[]> {
    const rows = await db.getAll(sql, parameters);
    return rows as T[];
}

async function loadLocalReportsData() {
    await initPowerSync();
    assertOfflineBootstrapReady();

    const [productRows, variantRows, salesRows, saleItemRows] = await Promise.all([
        queryRows<LocalProductRow>(
            `
                SELECT id, name, priceNormal, priceWholesale
                FROM "Product"
                WHERE deletedAt IS NULL
                ORDER BY createdAt DESC
            `
        ),
        queryRows<LocalVariantRow>(
            `
                SELECT productId, stock
                FROM "ProductVariant"
                WHERE deletedAt IS NULL
            `
        ),
        queryRows<LocalSaleRow>(
            `
                SELECT
                    s.id,
                    s.ticketNumber,
                    s.total,
                    s.paymentMethod,
                    s.cashAmount,
                    s.transferAmount,
                    s.createdAt AS date,
                    COALESCE(u.name, 'Vendedor') AS sellerName
                FROM "Sale" s
                LEFT JOIN "User" u
                    ON u.id = s.userId
                WHERE s.deletedAt IS NULL
                ORDER BY s.createdAt DESC
            `
        ),
        queryRows<LocalSaleItemRow>(
            `
                    SELECT
                        si.id,
                        si.saleId,
                        si.variantId,
                        p.name AS productName,
                        pv.size,
                        pv.color,
                    pv.sku,
                    si.quantity,
                    si.priceAtTime,
                    si.priceType,
                    si.returnedQuantity
                FROM "SaleItem" si
                INNER JOIN "ProductVariant" pv
                    ON pv.id = si.variantId
                INNER JOIN "Product" p
                    ON p.id = pv.productId
                WHERE si.deletedAt IS NULL
            `
        ),
    ]);

    const itemsBySaleId = new Map<string, PosSaleHistoryItem["items"]>();
    saleItemRows.forEach((item) => {
        const currentItems = itemsBySaleId.get(item.saleId) ?? [];
        currentItems.push({
            id: item.id,
            variantId: item.variantId,
            productName: item.productName,
            size: item.size,
            color: item.color,
            sku: item.sku,
            quantity: toNumber(item.quantity),
            priceAtTime: toNumber(item.priceAtTime),
            priceType: item.priceType,
            returnedQuantity: toNumber(item.returnedQuantity),
        });
        itemsBySaleId.set(item.saleId, currentItems);
    });

    const sales: PosSaleHistoryItem[] = salesRows.map((sale) => ({
        id: sale.id,
        ticketNumber: String(sale.ticketNumber || ""),
        total: toNumber(sale.total),
        paymentMethod: sale.paymentMethod,
        cashAmount: sale.cashAmount == null ? undefined : toNumber(sale.cashAmount),
        transferAmount: sale.transferAmount == null ? undefined : toNumber(sale.transferAmount),
        date: sale.date,
        sellerName: sale.sellerName,
        items: itemsBySaleId.get(sale.id) ?? [],
    }));

    const inventoryProductsMap = new Map<string, InventoryProduct>();
    productRows.forEach((product) => {
        inventoryProductsMap.set(product.id, {
            id: product.id,
            code: product.id.slice(-6).toUpperCase(),
            name: product.name,
            price: toNumber(product.priceNormal),
            wholesalePrice: toNumber(product.priceWholesale),
            stock: 0,
        });
    });

    variantRows.forEach((variant) => {
        const current = inventoryProductsMap.get(variant.productId);
        if (!current) {
            return;
        }

        current.stock += toNumber(variant.stock);
    });

    return {
        sales,
        inventoryProducts: Array.from(inventoryProductsMap.values()),
    };
}

export default function ReportesPage() {
    const router = useRouter();
    const terminal = useTerminalSnapshot();
    const [sales, setSales] = useState<PosSaleHistoryItem[]>([]);
    const [inventoryProducts, setInventoryProducts] = useState<InventoryProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadReports = useCallback(async () => {
        if (!terminal.isDesktop) {
            return;
        }

        try {
            const localData = await loadLocalReportsData();
            setSales(localData.sales);
            setInventoryProducts(localData.inventoryProducts);
        } catch (error) {
            console.error(error);
            toast.error(
                error instanceof OfflineBootstrapRequiredError
                    ? getOfflineBootstrapRequiredMessage()
                    : "No se pudieron cargar los reportes"
            );
        } finally {
            setIsLoading(false);
        }
    }, [terminal.isDesktop]);

    useEffect(() => {
        if (!terminal.isDesktop) {
            router.replace("/");
            return;
        }

        void loadReports();
    }, [loadReports, router, terminal.isDesktop]);

    useDataRefresh(
        [CACHE_TAGS.sales, CACHE_TAGS.cash, CACHE_TAGS.inventory, CACHE_TAGS.stock],
        loadReports,
        {
            pollIntervalMs: false,
        }
    );

    const reportData = useMemo(() => {
        const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
        const totalCash = sales.reduce((sum, sale) => sum + Number(sale.cashAmount || 0), 0);
        const totalTransfer = sales.reduce((sum, sale) => sum + Number(sale.transferAmount || 0), 0);
        const ticketAverage = sales.length > 0 ? totalSales / sales.length : 0;

        const bySellerMap = new Map<string, { sellerName: string; tickets: number; total: number }>();
        const byDayMap = new Map<string, { day: string; tickets: number; total: number }>();
        const byHourMap = new Map<number, { hour: number; tickets: number; total: number }>();
        const byProductMap = new Map<
            string,
            {
                productName: string;
                unitsSold: number;
                tickets: number;
                total: number;
            }
        >();

        sales.forEach((sale) => {
            const sellerCurrent = bySellerMap.get(sale.sellerName) ?? {
                sellerName: sale.sellerName,
                tickets: 0,
                total: 0,
            };

            sellerCurrent.tickets += 1;
            sellerCurrent.total += sale.total;
            bySellerMap.set(sale.sellerName, sellerCurrent);

            const dayKey = sale.date.slice(0, 10);
            const dayCurrent = byDayMap.get(dayKey) ?? {
                day: dayKey,
                tickets: 0,
                total: 0,
            };

            dayCurrent.tickets += 1;
            dayCurrent.total += sale.total;
            byDayMap.set(dayKey, dayCurrent);

            const saleHour = Number(
                new Intl.DateTimeFormat("es-AR", {
                    timeZone: "America/Argentina/Buenos_Aires",
                    hour: "2-digit",
                    hourCycle: "h23",
                }).format(normalizeDateInput(sale.date))
            );
            const hourCurrent = byHourMap.get(saleHour) ?? {
                hour: saleHour,
                tickets: 0,
                total: 0,
            };

            hourCurrent.tickets += 1;
            hourCurrent.total += sale.total;
            byHourMap.set(saleHour, hourCurrent);

            const productsInTicket = new Set<string>();
            sale.items?.forEach((item) => {
                const netQuantity = Math.max(item.quantity - Number(item.returnedQuantity || 0), 0);
                if (netQuantity <= 0) {
                    return;
                }

                const productCurrent = byProductMap.get(item.productName) ?? {
                    productName: item.productName,
                    unitsSold: 0,
                    tickets: 0,
                    total: 0,
                };

                productCurrent.unitsSold += netQuantity;
                productCurrent.total += netQuantity * Number(item.priceAtTime || 0);

                if (!productsInTicket.has(item.productName)) {
                    productCurrent.tickets += 1;
                    productsInTicket.add(item.productName);
                }

                byProductMap.set(item.productName, productCurrent);
            });
        });

        const sellerRows = Array.from(bySellerMap.values()).sort((a, b) => b.total - a.total);
        const dayRows = Array.from(byDayMap.values())
            .sort((a, b) => a.day.localeCompare(b.day))
            .slice(-7);
        const hourRows = Array.from(byHourMap.values()).sort((a, b) => {
            if (b.tickets !== a.tickets) {
                return b.tickets - a.tickets;
            }

            return b.total - a.total;
        });
        const topProductRows = Array.from(byProductMap.values())
            .sort((a, b) => {
                if (b.unitsSold !== a.unitsSold) {
                    return b.unitsSold - a.unitsSold;
                }

                return b.total - a.total;
            })
            .slice(0, 10);

        const paymentRows = [
            {
                key: "cash",
                label: "Efectivo",
                amount: totalCash,
                count: sales.filter((sale) => Number(sale.cashAmount || 0) > 0).length,
                icon: Banknote,
                tone: "bg-emerald-900 text-emerald-100",
            },
            {
                key: "transfer",
                label: "Transferencia",
                amount: totalTransfer,
                count: sales.filter((sale) => Number(sale.transferAmount || 0) > 0).length,
                icon: CreditCard,
                tone: "bg-blue-900 text-blue-100",
            },
        ];

        const totalCollected = totalCash + totalTransfer;
        const topSeller = sellerRows[0] ?? null;
        const topHour = hourRows[0] ?? null;
        const topProduct = topProductRows[0] ?? null;
        const soldProductsCount = byProductMap.size;
        const outOfStockRows = inventoryProducts
            .filter((product) => product.stock <= 0)
            .sort((a, b) => a.name.localeCompare(b.name));
        const criticalStockRows = inventoryProducts
            .filter((product) => product.stock > 0 && product.stock <= 3)
            .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name));

        return {
            totalSales,
            totalCash,
            totalTransfer,
            ticketAverage,
            totalCollected,
            paymentRows,
            sellerRows,
            dayRows,
            hourRows,
            topProductRows,
            topSeller,
            topHour,
            topProduct,
            soldProductsCount,
            criticalStockRows,
            outOfStockRows,
            recentSales: sales.slice(0, 10),
            cashOnlyCount: sales.filter((sale) => sale.paymentMethod === "EFECTIVO").length,
            transferOnlyCount: sales.filter((sale) => sale.paymentMethod === "TRANSFERENCIA").length,
            mixedCount: sales.filter((sale) => sale.paymentMethod === "MIXTO").length,
        };
    }, [inventoryProducts, sales]);

    if (isLoading) {
        return (
            <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-6">
                <div className="rounded-[1.75rem] border border-border/70 bg-card/90 px-10 py-8 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="rounded-2xl bg-slate-100 p-3">
                            <Loader2 className="size-6 animate-spin text-slate-700" />
                        </div>
                        <div>
                            <p className="text-base font-semibold text-foreground">Cargando reportes</p>
                            <p className="text-sm text-muted-foreground">
                                Estamos consolidando ventas, productos e inventario.
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
                        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-900/25 bg-[linear-gradient(135deg,rgba(8,145,178,0.18),rgba(14,116,144,0.08))] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-800 dark:text-cyan-100">
                            <TrendingUp className="size-3.5" />
                            Reportes
                        </div>
                        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-3xl">
                            Ventas, productos e inventario
                        </h1>
                    </div>
                    <div className="inline-flex items-center gap-3 rounded-[1.25rem] border border-border/70 bg-card/90 px-4 py-3 shadow-sm">
                        <div className="rounded-xl bg-muted px-3 py-2 text-center">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                                Ventas
                            </p>
                            <p className="mt-1 text-xl font-semibold text-foreground">{sales.length}</p>
                        </div>
                        <div className="rounded-xl bg-muted px-3 py-2 text-center">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                                Facturado
                            </p>
                            <p className="mt-1 text-xl font-semibold text-foreground">{formatCurrency(reportData.totalSales)}</p>
                        </div>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <Card className="rounded-[1.5rem] border-emerald-800/20 bg-[linear-gradient(135deg,rgba(5,150,105,0.14),rgba(6,95,70,0.04))] shadow-sm">
                        <CardContent className="flex items-center gap-4 p-4">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-900 text-emerald-100">
                                <Wallet className="size-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total vendido</p>
                                <p className="text-2xl font-bold">{formatCurrency(reportData.totalSales)}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-[1.5rem] border-blue-800/20 bg-[linear-gradient(135deg,rgba(37,99,235,0.14),rgba(30,64,175,0.04))] shadow-sm">
                        <CardContent className="flex items-center gap-4 p-4">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-900 text-blue-100">
                                <ReceiptText className="size-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Ticket promedio</p>
                                <p className="text-2xl font-bold">{formatCurrency(reportData.ticketAverage)}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-[1.5rem] border-orange-800/20 bg-[linear-gradient(135deg,rgba(234,88,12,0.14),rgba(194,65,12,0.04))] shadow-sm">
                        <CardContent className="flex items-center gap-4 p-4">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-orange-900 text-orange-100">
                                <Banknote className="size-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Efectivo</p>
                                <p className="text-2xl font-bold">{formatCurrency(reportData.totalCash)}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="rounded-[1.5rem] border-violet-800/20 bg-[linear-gradient(135deg,rgba(109,40,217,0.14),rgba(67,56,202,0.04))] shadow-sm">
                        <CardContent className="flex items-center gap-4 p-4">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-violet-900 text-violet-100">
                                <CreditCard className="size-5" />
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Transferencias</p>
                                <p className="text-2xl font-bold">{formatCurrency(reportData.totalTransfer)}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Tabs defaultValue="ventas" className="mt-1">
                    <TabsList className="w-full justify-start sm:w-fit">
                        <TabsTrigger value="ventas">Reporte de ventas</TabsTrigger>
                        <TabsTrigger value="medios">Transferencias vs efectivo</TabsTrigger>
                        <TabsTrigger value="horas">Horas pico</TabsTrigger>
                        <TabsTrigger value="productos">Productos estrella</TabsTrigger>
                        <TabsTrigger value="stock">Stock crítico</TabsTrigger>
                    </TabsList>

                    <TabsContent value="ventas" className="mt-4 space-y-4">
                        <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
                            <Card className="rounded-[1.5rem] border-border/70 bg-card/90 shadow-sm">
                                <CardHeader>
                                    <CardTitle>Resumen por vendedor</CardTitle>
                                    <CardDescription>Ventas acumuladas y cantidad de boletas registradas.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-hidden rounded-[1.25rem] border border-border/70">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead>Vendedor</TableHead>
                                                    <TableHead className="text-right">Boletas</TableHead>
                                                    <TableHead className="text-right">Total</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {reportData.sellerRows.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="py-12 text-center text-muted-foreground">
                                                            Todavía no hay ventas registradas.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    reportData.sellerRows.map((seller) => (
                                                        <TableRow key={seller.sellerName}>
                                                            <TableCell className="font-medium">{seller.sellerName}</TableCell>
                                                            <TableCell className="text-right">{seller.tickets}</TableCell>
                                                            <TableCell className="text-right font-bold">{formatCurrency(seller.total)}</TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-[1.5rem] border-border/70 bg-card/90 shadow-sm">
                                <CardHeader>
                                    <CardTitle>Ritmo de ventas</CardTitle>
                                    <CardDescription>Últimos días con ventas registradas.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {reportData.dayRows.length === 0 ? (
                                        <div className="rounded-[1.25rem] border border-dashed border-border/80 px-4 py-10 text-center text-sm text-muted-foreground">
                                            Sin días para mostrar todavía.
                                        </div>
                                    ) : (
                                        reportData.dayRows.map((day) => {
                                            const width = reportData.totalSales > 0 ? (day.total / reportData.totalSales) * 100 : 0;

                                            return (
                                                <div key={day.day} className="rounded-[1.25rem] border border-border/70 bg-muted/25 p-4">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <p className="text-sm font-semibold text-foreground">{formatShortDate(day.day)}</p>
                                                            <p className="text-xs text-muted-foreground">{day.tickets} boleta{day.tickets !== 1 ? "s" : ""}</p>
                                                        </div>
                                                        <p className="text-sm font-bold">{formatCurrency(day.total)}</p>
                                                    </div>
                                                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                                                        <div
                                                            className="h-full rounded-full bg-[linear-gradient(90deg,#0f766e_0%,#06b6d4_100%)]"
                                                            style={{ width: `${Math.max(width, 6)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="rounded-[1.5rem] border-border/70 bg-card/90 shadow-sm">
                            <CardHeader>
                                <CardTitle>Últimas ventas</CardTitle>
                                <CardDescription>Boletas recientes con vendedor y medio de pago.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-hidden rounded-[1.25rem] border border-border/70">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead>Boleta</TableHead>
                                                <TableHead>Fecha</TableHead>
                                                <TableHead>Vendedor</TableHead>
                                                <TableHead>Medio</TableHead>
                                                <TableHead className="text-right">Total</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {reportData.recentSales.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                                                        Todavía no hay ventas registradas.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                reportData.recentSales.map((sale) => (
                                                    <TableRow key={sale.id}>
                                                        <TableCell>
                                                            <Badge variant="outline" className="bg-background font-mono text-sm">
                                                                #{sale.ticketNumber.toString().padStart(4, "0")}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-sm text-muted-foreground">
                                                            {formatDate(sale.date)}
                                                        </TableCell>
                                                        <TableCell className="font-medium">{sale.sellerName}</TableCell>
                                                        <TableCell>
                                                            <Badge
                                                                className={cn(
                                                                    "gap-1",
                                                                    sale.paymentMethod === "EFECTIVO" && "bg-emerald-900 text-emerald-100 hover:bg-emerald-800",
                                                                    sale.paymentMethod === "TRANSFERENCIA" && "bg-blue-900 text-blue-100 hover:bg-blue-800",
                                                                    sale.paymentMethod === "MIXTO" && "bg-violet-900 text-violet-100 hover:bg-violet-800",
                                                                    sale.paymentMethod === "CAMBIO" && "bg-orange-900 text-orange-100 hover:bg-orange-800",
                                                                )}
                                                            >
                                                                {sale.paymentMethod === "EFECTIVO" && <Banknote className="size-3" />}
                                                                {sale.paymentMethod === "TRANSFERENCIA" && <CreditCard className="size-3" />}
                                                                {sale.paymentMethod === "MIXTO" && <Layers className="size-3" />}
                                                                {sale.paymentMethod}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right font-bold">{formatCurrency(sale.total)}</TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="medios" className="mt-4 space-y-4">
                        <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
                            <Card className="rounded-[1.5rem] border-border/70 bg-card/90 shadow-sm">
                                <CardHeader>
                                    <CardTitle>Transferencias vs efectivo</CardTitle>
                                    <CardDescription>Comparación del dinero ingresado por cada medio de pago.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {reportData.paymentRows.map((payment) => {
                                        const Icon = payment.icon;
                                        const percentage = reportData.totalCollected > 0 ? (payment.amount / reportData.totalCollected) * 100 : 0;

                                        return (
                                            <div key={payment.key} className="rounded-[1.25rem] border border-border/70 bg-muted/25 p-4">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn("flex size-10 items-center justify-center rounded-lg", payment.tone)}>
                                                            <Icon className="size-5" />
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-foreground">{payment.label}</p>
                                                            <p className="text-sm text-muted-foreground">
                                                                {payment.count} venta{payment.count !== 1 ? "s" : ""} con participación
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-lg font-bold">{formatCurrency(payment.amount)}</p>
                                                        <p className="text-sm text-muted-foreground">{percentage.toFixed(1)}%</p>
                                                    </div>
                                                </div>
                                                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                                                    <div
                                                        className={cn(
                                                            "h-full rounded-full",
                                                            payment.key === "cash"
                                                                ? "bg-[linear-gradient(90deg,#059669_0%,#22c55e_100%)]"
                                                                : "bg-[linear-gradient(90deg,#2563eb_0%,#06b6d4_100%)]",
                                                        )}
                                                        style={{ width: `${Math.max(percentage, 6)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>

                            <Card className="rounded-[1.5rem] border-border/70 bg-card/90 shadow-sm">
                                <CardHeader>
                                    <CardTitle>Composición de cobros</CardTitle>
                                    <CardDescription>Conteo de operaciones por tipo de cobro registrado.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <ArrowDownLeft className="size-4 text-emerald-600" />
                                                <span className="text-sm font-medium">Solo efectivo</span>
                                            </div>
                                            <span className="text-lg font-bold">{reportData.cashOnlyCount}</span>
                                        </div>
                                    </div>
                                    <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <ArrowUpRight className="size-4 text-blue-600" />
                                                <span className="text-sm font-medium">Solo transferencia</span>
                                            </div>
                                            <span className="text-lg font-bold">{reportData.transferOnlyCount}</span>
                                        </div>
                                    </div>
                                    <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Layers className="size-4 text-violet-600" />
                                                <span className="text-sm font-medium">Cobro mixto</span>
                                            </div>
                                            <span className="text-lg font-bold">{reportData.mixedCount}</span>
                                        </div>
                                    </div>
                                    <div className="rounded-[1.25rem] border border-border/70 bg-[linear-gradient(135deg,rgba(15,118,110,0.12),rgba(8,145,178,0.04))] p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vendedora destacada</p>
                                                <p className="mt-2 text-base font-bold text-foreground">
                                                    {reportData.topSeller?.sellerName ?? "—"}
                                                </p>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {reportData.topSeller
                                                        ? `${reportData.topSeller.tickets} boletas · ${formatCurrency(reportData.topSeller.total)}`
                                                        : "Sin datos todavía"}
                                                </p>
                                            </div>
                                            <div className="flex size-10 items-center justify-center rounded-lg bg-cyan-900 text-cyan-100">
                                                <User className="size-5" />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="horas" className="mt-4 space-y-4">
                        <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
                            <Card className="rounded-[1.5rem] border-border/70 bg-card/90 shadow-sm">
                                <CardHeader>
                                    <CardTitle>Horarios con más ventas</CardTitle>
                                    <CardDescription>Franja horaria ordenada por cantidad de boletas y facturación.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-hidden rounded-[1.25rem] border border-border/70">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead>Horario</TableHead>
                                                    <TableHead className="text-right">Boletas</TableHead>
                                                    <TableHead className="text-right">Facturado</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {reportData.hourRows.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="py-12 text-center text-muted-foreground">
                                                            Todavía no hay ventas registradas para analizar horarios.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    reportData.hourRows.map((hourRow) => (
                                                        <TableRow key={hourRow.hour}>
                                                            <TableCell className="font-medium">{formatHourRange(hourRow.hour)}</TableCell>
                                                            <TableCell className="text-right">{hourRow.tickets}</TableCell>
                                                            <TableCell className="text-right font-bold">{formatCurrency(hourRow.total)}</TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-[1.5rem] border-border/70 bg-card/90 shadow-sm">
                                <CardHeader>
                                    <CardTitle>Hora pico</CardTitle>
                                    <CardDescription>La franja con mayor cantidad de operaciones registradas.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="rounded-[1.25rem] border border-cyan-900/20 bg-[linear-gradient(135deg,rgba(8,145,178,0.14),rgba(14,116,144,0.04))] p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Franja destacada</p>
                                                <p className="mt-2 text-base font-bold text-foreground">
                                                    {reportData.topHour ? formatHourRange(reportData.topHour.hour) : "—"}
                                                </p>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {reportData.topHour
                                                        ? `${reportData.topHour.tickets} boletas`
                                                        : "Sin datos todavía"}
                                                </p>
                                                <p className="mt-1 text-sm font-medium text-foreground">
                                                    {reportData.topHour ? formatCurrency(reportData.topHour.total) : ""}
                                                </p>
                                            </div>
                                            <div className="flex size-10 items-center justify-center rounded-lg bg-cyan-900 text-cyan-100">
                                                <Clock3 className="size-5" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <ReceiptText className="size-4 text-blue-700" />
                                                <span className="text-sm font-medium">Boletas analizadas</span>
                                            </div>
                                            <span className="text-lg font-bold">{sales.length}</span>
                                        </div>
                                    </div>

                                    <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <TrendingUp className="size-4 text-emerald-700" />
                                                <span className="text-sm font-medium">Franjas con actividad</span>
                                            </div>
                                            <span className="text-lg font-bold">{reportData.hourRows.length}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="productos" className="mt-4 space-y-4">
                        <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
                            <Card className="rounded-[1.5rem] border-border/70 bg-card/90 shadow-sm">
                                <CardHeader>
                                    <CardTitle>Productos más vendidos</CardTitle>
                                    <CardDescription>Ranking por unidades vendidas netas, descontando devoluciones.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-hidden rounded-[1.25rem] border border-border/70">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead>Producto</TableHead>
                                                    <TableHead className="text-right">Unidades</TableHead>
                                                    <TableHead className="text-right">Boletas</TableHead>
                                                    <TableHead className="text-right">Facturado</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {reportData.topProductRows.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                                                            Todavía no hay productos vendidos para analizar.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    reportData.topProductRows.map((product) => (
                                                        <TableRow key={product.productName}>
                                                            <TableCell className="font-medium">{product.productName}</TableCell>
                                                            <TableCell className="text-right font-semibold">{product.unitsSold}</TableCell>
                                                            <TableCell className="text-right">{product.tickets}</TableCell>
                                                            <TableCell className="text-right font-bold">{formatCurrency(product.total)}</TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-[1.5rem] border-border/70 bg-card/90 shadow-sm">
                                <CardHeader>
                                    <CardTitle>Producto estrella</CardTitle>
                                    <CardDescription>El artículo con mayor salida dentro del historial de ventas.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className="rounded-[1.25rem] border border-amber-800/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.14),rgba(217,119,6,0.04))] p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Más vendido</p>
                                                <p className="mt-2 text-base font-bold text-foreground">
                                                    {reportData.topProduct?.productName ?? "—"}
                                                </p>
                                                <p className="mt-1 text-sm text-muted-foreground">
                                                    {reportData.topProduct
                                                        ? `${reportData.topProduct.unitsSold} unidades · ${reportData.topProduct.tickets} boletas`
                                                        : "Sin datos todavía"}
                                                </p>
                                                <p className="mt-1 text-sm font-medium text-foreground">
                                                    {reportData.topProduct ? formatCurrency(reportData.topProduct.total) : ""}
                                                </p>
                                            </div>
                                            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-900 text-amber-100">
                                                <Star className="size-5" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <PackageSearch className="size-4 text-cyan-700" />
                                                <span className="text-sm font-medium">Productos con ventas</span>
                                            </div>
                                            <span className="text-lg font-bold">{reportData.soldProductsCount}</span>
                                        </div>
                                    </div>

                                    <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <ReceiptText className="size-4 text-blue-700" />
                                                <span className="text-sm font-medium">Boletas analizadas</span>
                                            </div>
                                            <span className="text-lg font-bold">{sales.length}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="stock" className="mt-4 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <Card className="rounded-[1.5rem] border-red-800/20 bg-[linear-gradient(135deg,rgba(220,38,38,0.14),rgba(153,27,27,0.04))] shadow-sm">
                                <CardContent className="flex items-center gap-4 p-4">
                                    <div className="flex size-10 items-center justify-center rounded-lg bg-red-900 text-red-100">
                                        <PackageX className="size-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Sin stock</p>
                                        <p className="text-2xl font-bold">{reportData.outOfStockRows.length}</p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="rounded-[1.5rem] border-amber-800/20 bg-[linear-gradient(135deg,rgba(245,158,11,0.14),rgba(180,83,9,0.04))] shadow-sm">
                                <CardContent className="flex items-center gap-4 p-4">
                                    <div className="flex size-10 items-center justify-center rounded-lg bg-amber-900 text-amber-100">
                                        <ShieldAlert className="size-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Stock crítico</p>
                                        <p className="text-2xl font-bold">{reportData.criticalStockRows.length}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-2">
                            <Card className="rounded-[1.5rem] border-border/70 bg-card/90 shadow-sm">
                                <CardHeader>
                                    <CardTitle>Productos faltantes</CardTitle>
                                    <CardDescription>Artículos con stock total en 0.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-hidden rounded-[1.25rem] border border-border/70">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead>Producto</TableHead>
                                                    <TableHead>Código</TableHead>
                                                    <TableHead className="text-right">Stock</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {reportData.outOfStockRows.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="py-12 text-center text-muted-foreground">
                                                            No hay productos faltantes.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    reportData.outOfStockRows.map((product) => (
                                                        <TableRow key={product.id}>
                                                            <TableCell className="font-medium">{product.name}</TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline" className="bg-background font-mono text-xs">
                                                                    {product.code}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right font-bold text-red-700">0</TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="rounded-[1.5rem] border-border/70 bg-card/90 shadow-sm">
                                <CardHeader>
                                    <CardTitle>Stock crítico</CardTitle>
                                    <CardDescription>Productos con entre 1 y 3 unidades disponibles.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-hidden rounded-[1.25rem] border border-border/70">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead>Producto</TableHead>
                                                    <TableHead>Código</TableHead>
                                                    <TableHead className="text-right">Stock</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {reportData.criticalStockRows.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="py-12 text-center text-muted-foreground">
                                                            No hay productos en nivel crítico.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    reportData.criticalStockRows.map((product) => (
                                                        <TableRow key={product.id}>
                                                            <TableCell className="font-medium">{product.name}</TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline" className="bg-background font-mono text-xs">
                                                                    {product.code}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell className="text-right font-bold text-amber-700">{product.stock}</TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
