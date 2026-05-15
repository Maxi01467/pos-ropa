"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Banknote,
    CreditCard,
    Loader2,
    PackageX,
    ReceiptText,
    ShieldAlert,
    TrendingUp,
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

type DateRange = {
    from: string;
    to: string;
};

type ComparisonPreset = "last30" | "week" | "month" | "custom";
type ProductRankingMetric = "money" | "units";
type ProductRankingLimit = 10 | 20;

const canPreviewReportsInDev = process.env.NODE_ENV !== "production";

function formatCurrency(amount: number | null | undefined): string {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 0,
    }).format(Number(amount) || 0);
}

function formatShortDate(dateStr: string): string {
    return formatArgentinaShortDate(dateStr);
}

function formatHourRange(hour: number): string {
    const start = hour.toString().padStart(2, "0");
    const end = ((hour + 1) % 24).toString().padStart(2, "0");
    return `${start}:00 - ${end}:00`;
}

function toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function getDefaultDateRange() {
    const today = new Date();
    return {
        from: toDateKey(addDays(today, -29)),
        to: toDateKey(today),
    };
}

function parseDateKey(dateKey: string): Date {
    return new Date(`${dateKey}T00:00:00`);
}

function getMonthRange(date: Date): DateRange {
    return {
        from: toDateKey(new Date(date.getFullYear(), date.getMonth(), 1)),
        to: toDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
    };
}

function getWeekRange(date: Date): DateRange {
    const day = date.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = addDays(date, mondayOffset);

    return {
        from: toDateKey(monday),
        to: toDateKey(addDays(monday, 6)),
    };
}

function getPreviousRange(range: DateRange): DateRange {
    const start = parseDateKey(range.from);
    const end = parseDateKey(range.to);
    const days = Math.max(
        Math.round((end.getTime() - start.getTime()) / 86400000) + 1,
        1
    );
    const previousEnd = addDays(start, -1);

    return {
        from: toDateKey(addDays(previousEnd, -(days - 1))),
        to: toDateKey(previousEnd),
    };
}

function getComparisonPresetRanges(preset: Exclude<ComparisonPreset, "custom">): {
    current: DateRange;
    comparison: DateRange;
} {
    const today = new Date();

    if (preset === "week") {
        const current = getWeekRange(today);
        return {
            current,
            comparison: getPreviousRange(current),
        };
    }

    if (preset === "month") {
        const current = getMonthRange(today);
        const previousMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);

        return {
            current,
            comparison: getMonthRange(previousMonthDate),
        };
    }

    const current = getDefaultDateRange();
    return {
        current,
        comparison: getPreviousRange(current),
    };
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
    const canOpenReports = terminal.isDesktop || canPreviewReportsInDev;
    const initialComparisonRanges = useMemo(() => getComparisonPresetRanges("last30"), []);
    const [isComparisonEnabled, setIsComparisonEnabled] = useState(false);
    const [comparisonPreset, setComparisonPreset] = useState<ComparisonPreset>("last30");
    const [dateFrom, setDateFrom] = useState(initialComparisonRanges.current.from);
    const [dateTo, setDateTo] = useState(initialComparisonRanges.current.to);
    const [compareFrom, setCompareFrom] = useState(initialComparisonRanges.comparison.from);
    const [compareTo, setCompareTo] = useState(initialComparisonRanges.comparison.to);
    const [productRankingMetric, setProductRankingMetric] = useState<ProductRankingMetric>("money");
    const [productRankingLimit, setProductRankingLimit] = useState<ProductRankingLimit>(10);
    const [sales, setSales] = useState<PosSaleHistoryItem[]>([]);
    const [inventoryProducts, setInventoryProducts] = useState<InventoryProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const setPresetRanges = (preset: Exclude<ComparisonPreset, "custom">) => {
        const ranges = getComparisonPresetRanges(preset);
        setComparisonPreset(preset);
        setDateFrom(ranges.current.from);
        setDateTo(ranges.current.to);
        setCompareFrom(ranges.comparison.from);
        setCompareTo(ranges.comparison.to);
    };

    const enableComparison = () => {
        const previousRange = getPreviousRange({
            from: dateFrom || initialComparisonRanges.current.from,
            to: dateTo || initialComparisonRanges.current.to,
        });
        setCompareFrom(previousRange.from);
        setCompareTo(previousRange.to);
        setIsComparisonEnabled(true);
    };

    const loadReports = useCallback(async () => {
        if (!canOpenReports) {
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
    }, [canOpenReports]);

    useEffect(() => {
        if (!canOpenReports) {
            router.replace("/");
            return;
        }

        void loadReports();
    }, [canOpenReports, loadReports, router]);

    useDataRefresh(
        [CACHE_TAGS.sales, CACHE_TAGS.cash, CACHE_TAGS.inventory, CACHE_TAGS.stock],
        loadReports,
        {
            pollIntervalMs: false,
        }
    );

    const periodASales = useMemo(() => {
        const from = dateFrom || initialComparisonRanges.current.from;
        const to = dateTo || initialComparisonRanges.current.to;
        const [start, end] = from <= to ? [from, to] : [to, from];

        return sales.filter((sale) => {
            const saleDay = sale.date.slice(0, 10);
            return saleDay >= start && saleDay <= end;
        });
    }, [dateFrom, dateTo, initialComparisonRanges, sales]);

    const periodBSales = useMemo(() => {
        const from = compareFrom || initialComparisonRanges.comparison.from;
        const to = compareTo || initialComparisonRanges.comparison.to;
        const [start, end] = from <= to ? [from, to] : [to, from];

        return sales.filter((sale) => {
            const saleDay = sale.date.slice(0, 10);
            return saleDay >= start && saleDay <= end;
        });
    }, [compareFrom, compareTo, initialComparisonRanges, sales]);

    const comparisonChart = useMemo(() => {
        const rangeAFrom = dateFrom || initialComparisonRanges.current.from;
        const rangeATo = dateTo || initialComparisonRanges.current.to;
        const rangeBFrom = compareFrom || initialComparisonRanges.comparison.from;
        const rangeBTo = compareTo || initialComparisonRanges.comparison.to;
        const [startA, endA] = rangeAFrom <= rangeATo ? [rangeAFrom, rangeATo] : [rangeATo, rangeAFrom];
        const [startB, endB] = rangeBFrom <= rangeBTo ? [rangeBFrom, rangeBTo] : [rangeBTo, rangeBFrom];
        const totalsByDay = new Map<string, { total: number; tickets: number }>();
        const compareTotalsByDay = new Map<string, { total: number; tickets: number }>();

        periodASales.forEach((sale) => {
            const saleDay = sale.date.slice(0, 10);
            const current = totalsByDay.get(saleDay) ?? { total: 0, tickets: 0 };
            current.total += sale.total;
            current.tickets += 1;
            totalsByDay.set(saleDay, current);
        });

        periodBSales.forEach((sale) => {
            const saleDay = sale.date.slice(0, 10);
            const current = compareTotalsByDay.get(saleDay) ?? { total: 0, tickets: 0 };
            current.total += sale.total;
            current.tickets += 1;
            compareTotalsByDay.set(saleDay, current);
        });

        const daysA: string[] = [];
        const daysB: string[] = [];
        let cursorA = parseDateKey(startA);
        const endDateA = parseDateKey(endA);
        let cursorB = parseDateKey(startB);
        const endDateB = parseDateKey(endB);

        while (cursorA <= endDateA) {
            daysA.push(toDateKey(cursorA));
            cursorA = addDays(cursorA, 1);
        }

        while (cursorB <= endDateB) {
            daysB.push(toDateKey(cursorB));
            cursorB = addDays(cursorB, 1);
        }

        const rowCount = Math.max(daysA.length, daysB.length);
        const rows = Array.from({ length: rowCount }, (_, index) => {
            const dayA = daysA[index] ?? null;
            const dayB = daysB[index] ?? null;
            const current = dayA ? totalsByDay.get(dayA) ?? { total: 0, tickets: 0 } : { total: 0, tickets: 0 };
            const comparison = dayB ? compareTotalsByDay.get(dayB) ?? { total: 0, tickets: 0 } : { total: 0, tickets: 0 };

            return {
                index,
                dayA,
                dayB,
                totalA: current.total,
                ticketsA: current.tickets,
                totalB: comparison.total,
                ticketsB: comparison.tickets,
            };
        });

        return rows;
    }, [
        compareFrom,
        compareTo,
        dateFrom,
        dateTo,
        initialComparisonRanges,
        periodASales,
        periodBSales,
    ]);

    const chartMetrics = useMemo(() => {
        const totalA = periodASales.reduce((sum, sale) => sum + sale.total, 0);
        const totalB = isComparisonEnabled
            ? periodBSales.reduce((sum, sale) => sum + sale.total, 0)
            : 0;
        const maxTotal = Math.max(
            ...comparisonChart.flatMap((day) => [day.totalA, isComparisonEnabled ? day.totalB : 0]),
            0
        );
        const ticketAverageA = periodASales.length > 0 ? totalA / periodASales.length : 0;
        const difference = totalA - totalB;
        const percentageChange = isComparisonEnabled && totalB > 0 ? (difference / totalB) * 100 : null;

        return {
            totalA,
            totalB,
            difference,
            maxTotal,
            percentageChange,
            ticketAverageA,
            ticketsA: periodASales.length,
            ticketsB: isComparisonEnabled ? periodBSales.length : 0,
        };
    }, [comparisonChart, isComparisonEnabled, periodASales, periodBSales]);

    const reportData = useMemo(() => {
        const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
        const totalCash = sales.reduce((sum, sale) => sum + Number(sale.cashAmount || 0), 0);
        const totalTransfer = sales.reduce((sum, sale) => sum + Number(sale.transferAmount || 0), 0);
        const ticketAverage = sales.length > 0 ? totalSales / sales.length : 0;

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

        const hourRows = Array.from(byHourMap.values()).sort((a, b) => {
            if (b.tickets !== a.tickets) {
                return b.tickets - a.tickets;
            }

            return b.total - a.total;
        });
        const productRows = Array.from(byProductMap.values());

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
            hourRows,
            productRows,
            criticalStockRows,
            outOfStockRows,
        };
    }, [inventoryProducts, sales]);

    const productRankingRows = useMemo(() => {
        return [...reportData.productRows]
            .sort((a, b) => {
                if (productRankingMetric === "units") {
                    if (b.unitsSold !== a.unitsSold) {
                        return b.unitsSold - a.unitsSold;
                    }

                    return b.total - a.total;
                }

                if (b.total !== a.total) {
                    return b.total - a.total;
                }

                return b.unitsSold - a.unitsSold;
            })
            .slice(0, productRankingLimit);
    }, [productRankingLimit, productRankingMetric, reportData.productRows]);

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
                        <Card className="rounded-[1.5rem] border-border/70 bg-card/90 shadow-sm">
                            <CardHeader className="gap-4 xl:flex-row xl:items-start xl:justify-between">
                                <div>
                                    <CardTitle>Evolución de ventas diarias</CardTitle>
                                    <CardDescription>
                                        Facturación diaria del periodo seleccionado{isComparisonEnabled ? " con comparación activa." : "."}
                                    </CardDescription>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (isComparisonEnabled) {
                                                setIsComparisonEnabled(false);
                                                return;
                                            }

                                            enableComparison();
                                        }}
                                        className={cn(
                                            "h-9 rounded-xl border px-3 text-sm font-medium transition-colors",
                                            isComparisonEnabled
                                                ? "border-violet-800 bg-violet-900 text-violet-50"
                                                : "border-border bg-background text-muted-foreground hover:bg-muted"
                                        )}
                                    >
                                        Comparar
                                    </button>
                                    {isComparisonEnabled &&
                                        [
                                            { key: "last30", label: "30 días" },
                                            { key: "week", label: "Semana" },
                                            { key: "month", label: "Mes" },
                                        ].map((preset) => (
                                            <button
                                                key={preset.key}
                                                type="button"
                                                onClick={() => setPresetRanges(preset.key as Exclude<ComparisonPreset, "custom">)}
                                                className={cn(
                                                    "h-9 rounded-xl border px-3 text-sm font-medium transition-colors",
                                                    comparisonPreset === preset.key
                                                        ? "border-cyan-800 bg-cyan-900 text-cyan-50"
                                                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                                                )}
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className={cn("grid gap-3", isComparisonEnabled && "xl:grid-cols-2")}>
                                    <div className="rounded-[1.25rem] border border-cyan-800/25 bg-[linear-gradient(135deg,rgba(8,145,178,0.12),rgba(14,116,144,0.04))] p-4">
                                        <div className="mb-3 flex items-center gap-2">
                                            <span className="size-3 rounded-full bg-cyan-600" />
                                            <p className="text-sm font-semibold text-foreground">
                                                {isComparisonEnabled ? "Periodo A" : "Periodo"}
                                            </p>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <label className="space-y-1.5">
                                                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                    Desde
                                                </span>
                                                <input
                                                    type="date"
                                                    value={dateFrom}
                                                    onChange={(event) => {
                                                        setComparisonPreset("custom");
                                                        setDateFrom(event.target.value);
                                                    }}
                                                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-ring focus:ring-[3px] focus:ring-ring/20"
                                                />
                                            </label>
                                            <label className="space-y-1.5">
                                                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                    Hasta
                                                </span>
                                                <input
                                                    type="date"
                                                    value={dateTo}
                                                    onChange={(event) => {
                                                        setComparisonPreset("custom");
                                                        setDateTo(event.target.value);
                                                    }}
                                                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-ring focus:ring-[3px] focus:ring-ring/20"
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    {isComparisonEnabled && (
                                        <div className="rounded-[1.25rem] border border-violet-800/25 bg-[linear-gradient(135deg,rgba(109,40,217,0.10),rgba(67,56,202,0.04))] p-4">
                                            <div className="mb-3 flex items-center gap-2">
                                                <span className="size-3 rounded-full bg-violet-600" />
                                                <p className="text-sm font-semibold text-foreground">Periodo B</p>
                                            </div>
                                            <div className="grid gap-3 sm:grid-cols-2">
                                                <label className="space-y-1.5">
                                                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                        Desde
                                                    </span>
                                                    <input
                                                        type="date"
                                                        value={compareFrom}
                                                        onChange={(event) => {
                                                            setComparisonPreset("custom");
                                                            setCompareFrom(event.target.value);
                                                        }}
                                                        className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-ring focus:ring-[3px] focus:ring-ring/20"
                                                    />
                                                </label>
                                                <label className="space-y-1.5">
                                                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                        Hasta
                                                    </span>
                                                    <input
                                                        type="date"
                                                        value={compareTo}
                                                        onChange={(event) => {
                                                            setComparisonPreset("custom");
                                                            setCompareTo(event.target.value);
                                                        }}
                                                        className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-ring focus:ring-[3px] focus:ring-ring/20"
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className={cn("grid gap-3 sm:grid-cols-2", isComparisonEnabled ? "xl:grid-cols-4" : "xl:grid-cols-3")}>
                                    <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                            {isComparisonEnabled ? "Facturado A" : "Facturado"}
                                        </p>
                                        <p className="mt-2 text-xl font-bold text-foreground">
                                            {formatCurrency(chartMetrics.totalA)}
                                        </p>
                                    </div>
                                    <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                            Boletas
                                        </p>
                                        <p className="mt-2 text-xl font-bold text-foreground">
                                            {chartMetrics.ticketsA}
                                        </p>
                                    </div>
                                    {!isComparisonEnabled && (
                                        <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 p-4">
                                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                Ticket promedio
                                            </p>
                                            <p className="mt-2 text-xl font-bold text-foreground">
                                                {formatCurrency(chartMetrics.ticketAverageA)}
                                            </p>
                                        </div>
                                    )}
                                    {isComparisonEnabled && (
                                        <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 p-4">
                                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                Facturado B
                                            </p>
                                            <p className="mt-2 text-xl font-bold text-foreground">
                                                {formatCurrency(chartMetrics.totalB)}
                                            </p>
                                        </div>
                                    )}
                                    {isComparisonEnabled && (
                                        <div className="rounded-[1.25rem] border border-border/70 bg-muted/25 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                            Diferencia
                                        </p>
                                        <p className={cn(
                                            "mt-2 text-xl font-bold",
                                            chartMetrics.difference >= 0 ? "text-emerald-700" : "text-red-700"
                                        )}>
                                            {formatCurrency(chartMetrics.difference)}
                                        </p>
                                        </div>
                                    )}
                                </div>

                                <div className="h-[340px] rounded-[1.25rem] border border-border/70 bg-background p-4">
                                    {comparisonChart.length === 0 ? (
                                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                            Seleccioná un rango de fechas para ver la evolución.
                                        </div>
                                    ) : (
                                        <svg
                                            role="img"
                                            aria-label="Evolución diaria de ventas"
                                            viewBox="0 0 900 300"
                                            className="h-full w-full overflow-visible"
                                            preserveAspectRatio="none"
                                        >
                                            {(() => {
                                                const chartWidth = 820;
                                                const chartHeight = 210;
                                                const offsetX = 58;
                                                const offsetY = 24;
                                                const maxTotal = chartMetrics.maxTotal || 1;
                                                const pointGap = comparisonChart.length > 1 ? chartWidth / (comparisonChart.length - 1) : chartWidth;
                                                const points = comparisonChart.map((day, index) => {
                                                    const x = offsetX + index * pointGap;
                                                    const yA = offsetY + chartHeight - (day.totalA / maxTotal) * chartHeight;
                                                    const yB = offsetY + chartHeight - (day.totalB / maxTotal) * chartHeight;
                                                    return { ...day, x, yA, yB };
                                                });
                                                const pathA = points
                                                    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.yA.toFixed(2)}`)
                                                    .join(" ");
                                                const pathB = points
                                                    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.yB.toFixed(2)}`)
                                                    .join(" ");
                                                const areaPath = `${pathA} L ${offsetX + (points.length - 1) * pointGap} ${offsetY + chartHeight} L ${offsetX} ${offsetY + chartHeight} Z`;
                                                const guideValues = [1, 0.75, 0.5, 0.25, 0];
                                                const visibleLabels = points.filter((_, index) => {
                                                    if (points.length <= 8) {
                                                        return true;
                                                    }
                                                    const step = Math.ceil(points.length / 6);
                                                    return index === 0 || index === points.length - 1 || index % step === 0;
                                                });

                                                return (
                                                    <>
                                                        {guideValues.map((guide) => {
                                                            const y = offsetY + chartHeight - guide * chartHeight;

                                                            return (
                                                                <g key={guide}>
                                                                    <line
                                                                        x1={offsetX}
                                                                        x2={offsetX + chartWidth}
                                                                        y1={y}
                                                                        y2={y}
                                                                        className="stroke-border"
                                                                        strokeDasharray={guide === 0 ? "0" : "5 7"}
                                                                    />
                                                                    <text
                                                                        x={0}
                                                                        y={y + 4}
                                                                        className="fill-muted-foreground text-[11px]"
                                                                    >
                                                                        {formatCurrency(maxTotal * guide)}
                                                                    </text>
                                                                </g>
                                                            );
                                                        })}

                                                        <path d={areaPath} fill="url(#dailySalesArea)" opacity="0.28" />
                                                        {isComparisonEnabled && (
                                                            <path
                                                                d={pathB}
                                                                fill="none"
                                                                stroke="#7c3aed"
                                                                strokeWidth="3"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                strokeDasharray="8 7"
                                                            />
                                                        )}
                                                        <path
                                                            d={pathA}
                                                            fill="none"
                                                            stroke="url(#dailySalesLine)"
                                                            strokeWidth="4"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                        />

                                                        {points.map((point) => (
                                                            <g key={`${point.dayA}-${point.dayB}-${point.index}`}>
                                                                {isComparisonEnabled && (
                                                                    <circle
                                                                        cx={point.x}
                                                                        cy={point.yB}
                                                                        r={point.totalB > 0 ? 4 : 3}
                                                                        className="fill-background stroke-violet-600"
                                                                        strokeWidth="3"
                                                                    />
                                                                )}
                                                                <circle
                                                                    cx={point.x}
                                                                    cy={point.yA}
                                                                    r={point.totalA > 0 ? 4.5 : 3}
                                                                    className="fill-background stroke-cyan-700"
                                                                    strokeWidth="3"
                                                                />
                                                                <title>
                                                                    {isComparisonEnabled
                                                                        ? `A ${point.dayA ? formatShortDate(point.dayA) : "Sin día"} · ${formatCurrency(point.totalA)} · ${point.ticketsA} boleta${point.ticketsA !== 1 ? "s" : ""} | B ${point.dayB ? formatShortDate(point.dayB) : "Sin día"} · ${formatCurrency(point.totalB)} · ${point.ticketsB} boleta${point.ticketsB !== 1 ? "s" : ""}`
                                                                        : `${point.dayA ? formatShortDate(point.dayA) : "Sin día"} · ${formatCurrency(point.totalA)} · ${point.ticketsA} boleta${point.ticketsA !== 1 ? "s" : ""}`}
                                                                </title>
                                                            </g>
                                                        ))}

                                                        {visibleLabels.map((point) => (
                                                            <text
                                                                key={`${point.dayA}-${point.index}`}
                                                                x={point.x}
                                                                y={282}
                                                                textAnchor="middle"
                                                                className="fill-muted-foreground text-[11px]"
                                                            >
                                                                Día {point.index + 1}
                                                            </text>
                                                        ))}

                                                        {isComparisonEnabled && (
                                                            <g>
                                                                <line x1={670} x2={704} y1={18} y2={18} stroke="#0891b2" strokeWidth="4" strokeLinecap="round" />
                                                                <text x={712} y={22} className="fill-foreground text-[12px]">Periodo A</text>
                                                                <line x1={670} x2={704} y1={42} y2={42} stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" strokeDasharray="8 7" />
                                                                <text x={712} y={46} className="fill-foreground text-[12px]">Periodo B</text>
                                                            </g>
                                                        )}

                                                        <defs>
                                                            <linearGradient id="dailySalesLine" x1="0" y1="0" x2="1" y2="0">
                                                                <stop offset="0%" stopColor="#0f766e" />
                                                                <stop offset="100%" stopColor="#06b6d4" />
                                                            </linearGradient>
                                                            <linearGradient id="dailySalesArea" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="0%" stopColor="#06b6d4" />
                                                                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                                                            </linearGradient>
                                                        </defs>
                                                    </>
                                                );
                                            })()}
                                        </svg>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="medios" className="mt-4 space-y-4">
                        <Card className="rounded-[1.5rem] border-border/70 bg-card/90 shadow-sm">
                            <CardHeader>
                                <CardTitle>Transferencias vs efectivo</CardTitle>
                                <CardDescription>Distribución del dinero ingresado por medio de pago.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-6 xl:grid-cols-[420px_1fr] xl:items-center">
                                    <div className="relative mx-auto flex aspect-square w-full max-w-[360px] items-center justify-center">
                                        {(() => {
                                            const total = reportData.totalCollected;
                                            const cashPercentage = total > 0 ? (reportData.totalCash / total) * 100 : 0;
                                            const transferPercentage = total > 0 ? (reportData.totalTransfer / total) * 100 : 0;
                                            const cashDash = `${cashPercentage} ${100 - cashPercentage}`;
                                            const transferDash = `${transferPercentage} ${100 - transferPercentage}`;

                                            return (
                                                <>
                                                    <svg
                                                        role="img"
                                                        aria-label="Distribución entre efectivo y transferencia"
                                                        viewBox="0 0 120 120"
                                                        className="h-full w-full -rotate-90"
                                                    >
                                                        <circle
                                                            cx="60"
                                                            cy="60"
                                                            r="42"
                                                            fill="none"
                                                            className="stroke-muted"
                                                            strokeWidth="18"
                                                        />
                                                        {total > 0 && (
                                                            <>
                                                                <circle
                                                                    cx="60"
                                                                    cy="60"
                                                                    r="42"
                                                                    fill="none"
                                                                    stroke="#059669"
                                                                    strokeWidth="18"
                                                                    strokeDasharray={cashDash}
                                                                    pathLength="100"
                                                                    strokeLinecap="round"
                                                                />
                                                                <circle
                                                                    cx="60"
                                                                    cy="60"
                                                                    r="42"
                                                                    fill="none"
                                                                    stroke="#2563eb"
                                                                    strokeWidth="18"
                                                                    strokeDasharray={transferDash}
                                                                    strokeDashoffset={-cashPercentage}
                                                                    pathLength="100"
                                                                    strokeLinecap="round"
                                                                />
                                                            </>
                                                        )}
                                                    </svg>
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                            Total
                                                        </p>
                                                        <p className="mt-2 text-2xl font-bold text-foreground">
                                                            {formatCurrency(total)}
                                                        </p>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>

                                    <div className="grid gap-3">
                                        {reportData.paymentRows.map((payment) => {
                                            const percentage = reportData.totalCollected > 0
                                                ? (payment.amount / reportData.totalCollected) * 100
                                                : 0;

                                            return (
                                                <div key={payment.key} className="rounded-[1.25rem] border border-border/70 bg-muted/25 p-4">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-3">
                                                            <span
                                                                className={cn(
                                                                    "size-3 rounded-full",
                                                                    payment.key === "cash" ? "bg-emerald-600" : "bg-blue-600"
                                                                )}
                                                            />
                                                            <div>
                                                                <p className="font-semibold text-foreground">{payment.label}</p>
                                                                <p className="text-sm text-muted-foreground">
                                                                    {percentage.toFixed(1)}% del total
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <p className="text-lg font-bold">{formatCurrency(payment.amount)}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="horas" className="mt-4 space-y-4">
                        <Card className="rounded-[1.5rem] border-border/70 bg-card/90 shadow-sm">
                            <CardHeader>
                                <CardTitle>Horas pico</CardTitle>
                                <CardDescription>Cantidad de boletas emitidas por franja horaria.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[380px] rounded-[1.25rem] border border-border/70 bg-background p-4">
                                    {reportData.hourRows.length === 0 ? (
                                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                            Todavía no hay ventas registradas para analizar horarios.
                                        </div>
                                    ) : (
                                        <svg
                                            role="img"
                                            aria-label="Boletas por hora"
                                            viewBox="0 0 900 320"
                                            className="h-full w-full overflow-visible"
                                            preserveAspectRatio="none"
                                        >
                                            {(() => {
                                                const chartWidth = 800;
                                                const chartHeight = 220;
                                                const offsetX = 64;
                                                const offsetY = 28;
                                                const sortedHours = [...reportData.hourRows].sort((a, b) => a.hour - b.hour);
                                                const maxTickets = Math.max(...sortedHours.map((hour) => hour.tickets), 1);
                                                const slotWidth = chartWidth / sortedHours.length;
                                                const barWidth = Math.min(slotWidth * 0.58, 42);
                                                const guideValues = [1, 0.75, 0.5, 0.25, 0];

                                                return (
                                                    <>
                                                        {guideValues.map((guide) => {
                                                            const y = offsetY + chartHeight - guide * chartHeight;

                                                            return (
                                                                <g key={guide}>
                                                                    <line
                                                                        x1={offsetX}
                                                                        x2={offsetX + chartWidth}
                                                                        y1={y}
                                                                        y2={y}
                                                                        className="stroke-border"
                                                                        strokeDasharray={guide === 0 ? "0" : "5 7"}
                                                                    />
                                                                    <text
                                                                        x={18}
                                                                        y={y + 4}
                                                                        className="fill-muted-foreground text-[11px]"
                                                                    >
                                                                        {Math.round(maxTickets * guide)}
                                                                    </text>
                                                                </g>
                                                            );
                                                        })}

                                                        {sortedHours.map((hourRow, index) => {
                                                            const height = (hourRow.tickets / maxTickets) * chartHeight;
                                                            const x = offsetX + index * slotWidth + (slotWidth - barWidth) / 2;
                                                            const y = offsetY + chartHeight - height;

                                                            return (
                                                                <g key={hourRow.hour}>
                                                                    <rect
                                                                        x={x}
                                                                        y={y}
                                                                        width={barWidth}
                                                                        height={Math.max(height, 3)}
                                                                        rx="8"
                                                                        fill="url(#hourBarGradient)"
                                                                    />
                                                                    <text
                                                                        x={x + barWidth / 2}
                                                                        y={y - 8}
                                                                        textAnchor="middle"
                                                                        className="fill-foreground text-[12px] font-semibold"
                                                                    >
                                                                        {hourRow.tickets}
                                                                    </text>
                                                                    <text
                                                                        x={x + barWidth / 2}
                                                                        y={286}
                                                                        textAnchor="middle"
                                                                        className="fill-muted-foreground text-[11px]"
                                                                    >
                                                                        {hourRow.hour.toString().padStart(2, "0")}h
                                                                    </text>
                                                                    <title>
                                                                        {`${formatHourRange(hourRow.hour)} · ${hourRow.tickets} boleta${hourRow.tickets !== 1 ? "s" : ""} · ${formatCurrency(hourRow.total)}`}
                                                                    </title>
                                                                </g>
                                                            );
                                                        })}

                                                        <defs>
                                                            <linearGradient id="hourBarGradient" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="0%" stopColor="#0891b2" />
                                                                <stop offset="100%" stopColor="#0f766e" />
                                                            </linearGradient>
                                                        </defs>
                                                    </>
                                                );
                                            })()}
                                        </svg>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="productos" className="mt-4 space-y-4">
                        <Card className="rounded-[1.5rem] border-border/70 bg-card/90 shadow-sm">
                            <CardHeader className="gap-4 xl:flex-row xl:items-start xl:justify-between">
                                <div>
                                    <CardTitle>Productos estrella</CardTitle>
                                    <CardDescription>
                                        Ranking horizontal de productos por dinero facturado o unidades vendidas.
                                    </CardDescription>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setProductRankingMetric("money")}
                                        className={cn(
                                            "h-9 rounded-xl border px-3 text-sm font-medium transition-colors",
                                            productRankingMetric === "money"
                                                ? "border-cyan-800 bg-cyan-900 text-cyan-50"
                                                : "border-border bg-background text-muted-foreground hover:bg-muted"
                                        )}
                                    >
                                        Más vendidos en $
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setProductRankingMetric("units")}
                                        className={cn(
                                            "h-9 rounded-xl border px-3 text-sm font-medium transition-colors",
                                            productRankingMetric === "units"
                                                ? "border-cyan-800 bg-cyan-900 text-cyan-50"
                                                : "border-border bg-background text-muted-foreground hover:bg-muted"
                                        )}
                                    >
                                        Más vendidos en unidades
                                    </button>
                                    {[10, 20].map((limit) => (
                                        <button
                                            key={limit}
                                            type="button"
                                            onClick={() => setProductRankingLimit(limit as ProductRankingLimit)}
                                            className={cn(
                                                "h-9 rounded-xl border px-3 text-sm font-medium transition-colors",
                                                productRankingLimit === limit
                                                    ? "border-emerald-800 bg-emerald-900 text-emerald-50"
                                                    : "border-border bg-background text-muted-foreground hover:bg-muted"
                                            )}
                                        >
                                            Top {limit}
                                        </button>
                                    ))}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-[1.25rem] border border-border/70 bg-background p-4">
                                    {productRankingRows.length === 0 ? (
                                        <div className="flex min-h-[260px] items-center justify-center text-sm text-muted-foreground">
                                            Todavía no hay productos vendidos para analizar.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {(() => {
                                                const maxValue = Math.max(
                                                    ...productRankingRows.map((product) =>
                                                        productRankingMetric === "money" ? product.total : product.unitsSold
                                                    ),
                                                    1
                                                );

                                                return productRankingRows.map((product, index) => {
                                                    const value = productRankingMetric === "money" ? product.total : product.unitsSold;
                                                    const width = Math.max((value / maxValue) * 100, 3);

                                                    return (
                                                        <div
                                                            key={product.productName}
                                                            className="grid gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 sm:grid-cols-[minmax(180px,280px)_1fr_auto] sm:items-center"
                                                        >
                                                            <div className="min-w-0">
                                                                <p className="truncate text-sm font-semibold text-foreground" title={product.productName}>
                                                                    {index + 1}. {product.productName}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {product.unitsSold} unidades · {product.tickets} boleta{product.tickets !== 1 ? "s" : ""}
                                                                </p>
                                                            </div>
                                                            <div className="h-8 overflow-hidden rounded-full bg-muted">
                                                                <div
                                                                    className="flex h-full items-center justify-end rounded-full bg-[linear-gradient(90deg,#0f766e_0%,#06b6d4_100%)] px-3 text-xs font-bold text-white"
                                                                    style={{ width: `${width}%` }}
                                                                >
                                                                    {productRankingMetric === "money"
                                                                        ? formatCurrency(product.total)
                                                                        : product.unitsSold}
                                                                </div>
                                                            </div>
                                                            <p className="text-right text-sm font-bold text-foreground">
                                                                {productRankingMetric === "money"
                                                                    ? formatCurrency(product.total)
                                                                    : `${product.unitsSold} u.`}
                                                            </p>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
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
