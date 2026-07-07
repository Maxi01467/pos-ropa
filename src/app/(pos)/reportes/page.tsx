"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Area,
    ComposedChart,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
    Line,
} from "recharts";
import {
    Banknote,
    CreditCard,
    Loader2,
    ReceiptText,
    TrendingUp,
    Wallet,
} from "lucide-react";
import { ScreenLoader } from "@/components/ui/screen-loader";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

function getArgentinaHour(dateStr: string): number {
    return Number(
        new Intl.DateTimeFormat("es-AR", {
            timeZone: "America/Argentina/Buenos_Aires",
            hour: "2-digit",
            hourCycle: "h23",
        }).format(normalizeDateInput(dateStr))
    );
}

function getArgentinaDateKey(date: string | Date): string {
    const parts = new Intl.DateTimeFormat("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(normalizeDateInput(date));
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    return `${year}-${month}-${day}`;
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

function normalizeRange(range: DateRange): DateRange {
    const from = range.from || range.to;
    const to = range.to || range.from;

    if (!from || !to) {
        return getDefaultDateRange();
    }

    return from <= to ? { from, to } : { from: to, to: from };
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

    const [salesRows, saleItemRows] = await Promise.all([
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

    return {
        sales,
    };
}

export default function ReportesPage() {
    const router = useRouter();
    const terminal = useTerminalSnapshot();
    const canOpenReports = true; // Habilitado temporalmente para acceso web/desarrollo
    const initialComparisonRanges = useMemo(() => getComparisonPresetRanges("last30"), []);
    const [isComparisonEnabled, setIsComparisonEnabled] = useState(false);
    const [comparisonPreset, setComparisonPreset] = useState<ComparisonPreset>("last30");
    const [dateFrom, setDateFrom] = useState(initialComparisonRanges.current.from);
    const [dateTo, setDateTo] = useState(initialComparisonRanges.current.to);
    const [compareFrom, setCompareFrom] = useState(initialComparisonRanges.comparison.from);
    const [compareTo, setCompareTo] = useState(initialComparisonRanges.comparison.to);
    const [isPeriodFilterEnabled, setIsPeriodFilterEnabled] = useState(false);
    const [productRankingMetric, setProductRankingMetric] = useState<ProductRankingMetric>("money");
    const [productRankingLimit, setProductRankingLimit] = useState<ProductRankingLimit>(10);
    const [sales, setSales] = useState<PosSaleHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const applyDateRange = (range: DateRange, preset: ComparisonPreset = "custom") => {
        const normalizedRange = normalizeRange(range);
        const previousRange = getPreviousRange(normalizedRange);

        setIsPeriodFilterEnabled(true);
        setComparisonPreset(preset);
        setDateFrom(normalizedRange.from);
        setDateTo(normalizedRange.to);
        setCompareFrom(previousRange.from);
        setCompareTo(previousRange.to);
    };

    const setPresetRanges = (preset: Exclude<ComparisonPreset, "custom">) => {
        const ranges = getComparisonPresetRanges(preset);
        applyDateRange(ranges.current, preset);
    };

    const setTodayRange = () => {
        const today = getArgentinaDateKey(new Date());
        applyDateRange({ from: today, to: today });
    };

    const clearPeriodFilter = () => {
        setIsPeriodFilterEnabled(false);
        setIsComparisonEnabled(false);
    };

    const enableComparison = () => {
        const previousRange = getPreviousRange(normalizeRange({
            from: dateFrom || initialComparisonRanges.current.from,
            to: dateTo || initialComparisonRanges.current.to,
        }));
        setIsPeriodFilterEnabled(true);
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

    const selectedPeriodRange = useMemo(() => {
        return normalizeRange({
            from: dateFrom || initialComparisonRanges.current.from,
            to: dateTo || initialComparisonRanges.current.to,
        });
    }, [dateFrom, dateTo, initialComparisonRanges]);

    const filteredSales = useMemo(() => {
        if (!isPeriodFilterEnabled) {
            return sales;
        }

        return sales.filter((sale) => {
            const saleDay = getArgentinaDateKey(sale.date);
            return saleDay >= selectedPeriodRange.from && saleDay <= selectedPeriodRange.to;
        });
    }, [isPeriodFilterEnabled, sales, selectedPeriodRange]);

    const activePeriodRange = useMemo(() => {
        if (isPeriodFilterEnabled) {
            return selectedPeriodRange;
        }

        if (sales.length === 0) {
            return initialComparisonRanges.current;
        }

        const days = sales
            .map((sale) => getArgentinaDateKey(sale.date))
            .sort((a, b) => a.localeCompare(b));

        return {
            from: days[0],
            to: days[days.length - 1],
        };
    }, [initialComparisonRanges, isPeriodFilterEnabled, sales, selectedPeriodRange]);

    const periodASales = useMemo(() => filteredSales, [filteredSales]);

    const periodBSales = useMemo(() => {
        if (!isComparisonEnabled) {
            return [];
        }

        const range = normalizeRange({
            from: compareFrom || initialComparisonRanges.comparison.from,
            to: compareTo || initialComparisonRanges.comparison.to,
        });

        return sales.filter((sale) => {
            const saleDay = getArgentinaDateKey(sale.date);
            return saleDay >= range.from && saleDay <= range.to;
        });
    }, [compareFrom, compareTo, initialComparisonRanges, isComparisonEnabled, sales]);

    const isSalesChartGroupedByHour =
        isPeriodFilterEnabled && activePeriodRange.from === activePeriodRange.to;

    const comparisonChart = useMemo(() => {
        const rangeAFrom = activePeriodRange.from;
        const rangeATo = activePeriodRange.to;
        const rangeBFrom = compareFrom || initialComparisonRanges.comparison.from;
        const rangeBTo = compareTo || initialComparisonRanges.comparison.to;
        const [startA, endA] = rangeAFrom <= rangeATo ? [rangeAFrom, rangeATo] : [rangeATo, rangeAFrom];
        const [startB, endB] = rangeBFrom <= rangeBTo ? [rangeBFrom, rangeBTo] : [rangeBTo, rangeBFrom];
        if (isSalesChartGroupedByHour) {
            const totalsByHour = new Map<number, { total: number; tickets: number }>();
            const compareTotalsByHour = new Map<number, { total: number; tickets: number }>();

            periodASales.forEach((sale) => {
                const saleHour = getArgentinaHour(sale.date);
                const current = totalsByHour.get(saleHour) ?? { total: 0, tickets: 0 };
                current.total += sale.total;
                current.tickets += 1;
                totalsByHour.set(saleHour, current);
            });

            periodBSales.forEach((sale) => {
                const saleHour = getArgentinaHour(sale.date);
                const current = compareTotalsByHour.get(saleHour) ?? { total: 0, tickets: 0 };
                current.total += sale.total;
                current.tickets += 1;
                compareTotalsByHour.set(saleHour, current);
            });

            return Array.from({ length: 24 }, (_, hour) => {
                const current = totalsByHour.get(hour) ?? { total: 0, tickets: 0 };
                const comparison = compareTotalsByHour.get(hour) ?? { total: 0, tickets: 0 };

                return {
                    index: hour,
                    hour,
                    dayA: startA,
                    dayB: startB,
                    totalA: current.total,
                    ticketsA: current.tickets,
                    totalB: comparison.total,
                    ticketsB: comparison.tickets,
                };
            });
        }

        const totalsByDay = new Map<string, { total: number; tickets: number }>();
        const compareTotalsByDay = new Map<string, { total: number; tickets: number }>();

        periodASales.forEach((sale) => {
            const saleDay = getArgentinaDateKey(sale.date);
            const current = totalsByDay.get(saleDay) ?? { total: 0, tickets: 0 };
            current.total += sale.total;
            current.tickets += 1;
            totalsByDay.set(saleDay, current);
        });

        periodBSales.forEach((sale) => {
            const saleDay = getArgentinaDateKey(sale.date);
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
        activePeriodRange,
        compareFrom,
        compareTo,
        isSalesChartGroupedByHour,
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
        const totalSales = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
        const totalCash = filteredSales.reduce((sum, sale) => sum + Number(sale.cashAmount || 0), 0);
        const totalTransfer = filteredSales.reduce((sum, sale) => sum + Number(sale.transferAmount || 0), 0);
        const ticketAverage = filteredSales.length > 0 ? totalSales / filteredSales.length : 0;

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

        filteredSales.forEach((sale) => {
            const saleHour = getArgentinaHour(sale.date);
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
                count: filteredSales.filter((sale) => Number(sale.cashAmount || 0) > 0).length,
                icon: Banknote,
                tone: "bg-emerald-900 text-emerald-100",
            },
            {
                key: "transfer",
                label: "Transferencia",
                amount: totalTransfer,
                count: filteredSales.filter((sale) => Number(sale.transferAmount || 0) > 0).length,
                icon: CreditCard,
                tone: "bg-blue-900 text-blue-100",
            },
        ];

        const totalCollected = totalCash + totalTransfer;
        return {
            totalSales,
            totalCash,
            totalTransfer,
            ticketAverage,
            totalCollected,
            paymentRows,
            hourRows,
            productRows,
        };
    }, [filteredSales]);

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

    const periodFilterControls = (
        <div className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-muted/10 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
                <button
                    type="button"
                    onClick={clearPeriodFilter}
                    className={cn(
                        "h-8 rounded-lg border px-3 text-xs font-semibold transition-colors",
                        !isPeriodFilterEnabled
                            ? "border-slate-800 bg-slate-900 text-slate-50"
                            : "border-transparent bg-transparent text-muted-foreground hover:bg-muted"
                    )}
                >
                    Todo el tiempo
                </button>
                <div className="h-4 w-px bg-border/60 mx-1" />
                <button
                    type="button"
                    onClick={setTodayRange}
                    className="h-8 rounded-lg px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted"
                >
                    Hoy
                </button>
                {[
                    { key: "week", label: "Esta semana" },
                    { key: "month", label: "Este mes" },
                    { key: "last30", label: "Últimos 30 días" },
                ].map((preset) => (
                    <button
                        key={preset.key}
                        type="button"
                        onClick={() => setPresetRanges(preset.key as Exclude<ComparisonPreset, "custom">)}
                        className={cn(
                            "h-8 rounded-lg border px-3 text-xs font-semibold transition-colors",
                            isPeriodFilterEnabled && comparisonPreset === preset.key
                                ? "border-rose-800/30 bg-rose-900/10 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300"
                                : "border-transparent bg-transparent text-muted-foreground hover:bg-muted"
                        )}
                    >
                        {preset.label}
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="flex h-9 items-center overflow-hidden rounded-xl border border-input bg-background shadow-sm transition-colors focus-within:border-ring focus-within:ring-[2px] focus-within:ring-ring/20">
                    <span className="bg-muted/30 px-3 text-xs font-medium text-muted-foreground border-r border-border h-full flex items-center">
                        Desde
                    </span>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(event) => {
                            const nextFrom = event.target.value;
                            setIsPeriodFilterEnabled(true);
                            setComparisonPreset("custom");
                            setDateFrom(nextFrom);
                            setCompareFrom(getPreviousRange(normalizeRange({ from: nextFrom, to: dateTo })).from);
                            setCompareTo(getPreviousRange(normalizeRange({ from: nextFrom, to: dateTo })).to);
                        }}
                        className="h-full border-0 bg-transparent px-2 text-sm text-foreground outline-none w-[130px]"
                    />
                </div>
                <div className="flex h-9 items-center overflow-hidden rounded-xl border border-input bg-background shadow-sm transition-colors focus-within:border-ring focus-within:ring-[2px] focus-within:ring-ring/20">
                    <span className="bg-muted/30 px-3 text-xs font-medium text-muted-foreground border-r border-border h-full flex items-center">
                        Hasta
                    </span>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(event) => {
                            const nextTo = event.target.value;
                            setIsPeriodFilterEnabled(true);
                            setComparisonPreset("custom");
                            setDateTo(nextTo);
                            setCompareFrom(getPreviousRange(normalizeRange({ from: dateFrom, to: nextTo })).from);
                            setCompareTo(getPreviousRange(normalizeRange({ from: dateFrom, to: nextTo })).to);
                        }}
                        className="h-full border-0 bg-transparent px-2 text-sm text-foreground outline-none w-[130px]"
                    />
                </div>
            </div>
        </div>
    );

    if (isLoading) {
        return <ScreenLoader layout="centered" message="Cargando reportes" description="Estamos consolidando ventas y productos." />;
    }

    return (
        <div className="p-4 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-rose-900/25 bg-[linear-gradient(135deg,rgba(244,63,94,0.18),rgba(190,24,74,0.08))] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-800 dark:text-rose-100">
                            <TrendingUp className="size-3.5" />
                            Reportes
                        </div>
                        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-3xl">
                            Ventas y productos
                        </h1>
                    </div>
                </div>

                <Tabs defaultValue="ventas" className="mt-1">
                    <TabsList className="w-full justify-start sm:w-fit">
                        <TabsTrigger value="ventas">Reporte de ventas</TabsTrigger>
                        <TabsTrigger value="medios">Transferencias vs efectivo</TabsTrigger>
                        <TabsTrigger value="horas">Horas pico</TabsTrigger>
                        <TabsTrigger value="productos">Productos estrella</TabsTrigger>
                    </TabsList>

                    <TabsContent value="ventas" className="mt-4 space-y-4">
                        <Card className="rounded-[1.5rem] border-border/70 bg-card/90 shadow-sm">
                            <CardHeader className="gap-4 xl:flex-row xl:items-start xl:justify-between">
                                <div>
                                    <CardTitle>
                                        {isSalesChartGroupedByHour
                                            ? "Evolución de ventas por hora"
                                            : "Evolución de ventas diarias"}
                                    </CardTitle>
                                    <CardDescription>
                                        {isSalesChartGroupedByHour
                                            ? "Facturación por hora del día seleccionado"
                                            : "Facturación diaria del periodo seleccionado"}
                                        {isComparisonEnabled ? " con comparación activa." : "."}
                                    </CardDescription>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
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
                                            "h-8 rounded-lg border px-3 text-xs font-semibold transition-colors",
                                            isComparisonEnabled
                                                ? "border-fuchsia-800/30 bg-fuchsia-900/10 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300"
                                                : "border-transparent bg-transparent text-muted-foreground hover:bg-muted"
                                        )}
                                    >
                                        Comparar
                                    </button>
                                    
                                    <div className="h-4 w-px bg-border/60 mx-1" />

                                    <button
                                        type="button"
                                        onClick={clearPeriodFilter}
                                        className={cn(
                                            "h-8 rounded-lg border px-3 text-xs font-semibold transition-colors",
                                            !isPeriodFilterEnabled
                                                ? "border-slate-800 bg-slate-900 text-slate-50"
                                                : "border-transparent bg-transparent text-muted-foreground hover:bg-muted"
                                        )}
                                    >
                                        Todo el tiempo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={setTodayRange}
                                        className="h-8 rounded-lg px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted"
                                    >
                                        Hoy
                                    </button>

                                    {[
                                        { key: "week", label: "Esta semana" },
                                        { key: "month", label: "Este mes" },
                                        { key: "last30", label: "Últimos 30 días" },
                                    ].map((preset) => (
                                        <button
                                            key={preset.key}
                                            type="button"
                                            onClick={() => setPresetRanges(preset.key as Exclude<ComparisonPreset, "custom">)}
                                            className={cn(
                                                "h-8 rounded-lg border px-3 text-xs font-semibold transition-colors",
                                                isPeriodFilterEnabled && comparisonPreset === preset.key
                                                    ? "border-rose-800/30 bg-rose-900/10 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300"
                                                    : "border-transparent bg-transparent text-muted-foreground hover:bg-muted"
                                            )}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className={cn("grid gap-3", isComparisonEnabled && "xl:grid-cols-2")}>
                                    <div className="rounded-[1.25rem] border border-rose-800/25 bg-[linear-gradient(135deg,rgba(244,63,94,0.12),rgba(190,24,74,0.04))] p-4">
                                        <div className="mb-3 flex items-center gap-2">
                                            <span className="size-3 rounded-full bg-rose-600" />
                                            <p className="text-sm font-semibold text-foreground">
                                                {isComparisonEnabled ? "Periodo A" : "Periodo"}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <div className="flex h-9 flex-1 sm:flex-none items-center overflow-hidden rounded-xl border border-rose-800/20 bg-background shadow-sm transition-colors focus-within:border-rose-600 focus-within:ring-[2px] focus-within:ring-rose-600/20">
                                                <span className="bg-rose-950/5 px-3 text-xs font-medium text-rose-800 border-r border-rose-800/20 h-full flex items-center dark:text-rose-400 dark:bg-rose-900/20 dark:border-rose-800/40">
                                                    Desde
                                                </span>
                                                <input
                                                    type="date"
                                                    value={dateFrom}
                                                    onChange={(event) => {
                                                        setIsPeriodFilterEnabled(true);
                                                        setComparisonPreset("custom");
                                                        setDateFrom(event.target.value);
                                                    }}
                                                    className="h-full border-0 bg-transparent px-2 text-sm text-foreground outline-none w-full sm:w-[130px]"
                                                />
                                            </div>
                                            <div className="flex h-9 flex-1 sm:flex-none items-center overflow-hidden rounded-xl border border-rose-800/20 bg-background shadow-sm transition-colors focus-within:border-rose-600 focus-within:ring-[2px] focus-within:ring-rose-600/20">
                                                <span className="bg-rose-950/5 px-3 text-xs font-medium text-rose-800 border-r border-rose-800/20 h-full flex items-center dark:text-rose-400 dark:bg-rose-900/20 dark:border-rose-800/40">
                                                    Hasta
                                                </span>
                                                <input
                                                    type="date"
                                                    value={dateTo}
                                                    onChange={(event) => {
                                                        setIsPeriodFilterEnabled(true);
                                                        setComparisonPreset("custom");
                                                        setDateTo(event.target.value);
                                                    }}
                                                    className="h-full border-0 bg-transparent px-2 text-sm text-foreground outline-none w-full sm:w-[130px]"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {isComparisonEnabled && (
                                        <div className="rounded-[1.25rem] border border-fuchsia-800/25 bg-[linear-gradient(135deg,rgba(217,70,239,0.10),rgba(192,38,211,0.04))] p-4">
                                            <div className="mb-3 flex items-center gap-2">
                                                <span className="size-3 rounded-full bg-fuchsia-600" />
                                                <p className="text-sm font-semibold text-foreground">Periodo B</p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3">
                                                <div className="flex h-9 flex-1 sm:flex-none items-center overflow-hidden rounded-xl border border-fuchsia-800/20 bg-background shadow-sm transition-colors focus-within:border-fuchsia-600 focus-within:ring-[2px] focus-within:ring-fuchsia-600/20">
                                                    <span className="bg-fuchsia-950/5 px-3 text-xs font-medium text-fuchsia-800 border-r border-fuchsia-800/20 h-full flex items-center dark:text-fuchsia-400 dark:bg-fuchsia-900/20 dark:border-fuchsia-800/40">
                                                        Desde
                                                    </span>
                                                    <input
                                                        type="date"
                                                        value={compareFrom}
                                                        onChange={(event) => {
                                                            setComparisonPreset("custom");
                                                            setCompareFrom(event.target.value);
                                                        }}
                                                        className="h-full border-0 bg-transparent px-2 text-sm text-foreground outline-none w-full sm:w-[130px]"
                                                    />
                                                </div>
                                                <div className="flex h-9 flex-1 sm:flex-none items-center overflow-hidden rounded-xl border border-fuchsia-800/20 bg-background shadow-sm transition-colors focus-within:border-fuchsia-600 focus-within:ring-[2px] focus-within:ring-fuchsia-600/20">
                                                    <span className="bg-fuchsia-950/5 px-3 text-xs font-medium text-fuchsia-800 border-r border-fuchsia-800/20 h-full flex items-center dark:text-fuchsia-400 dark:bg-fuchsia-900/20 dark:border-fuchsia-800/40">
                                                        Hasta
                                                    </span>
                                                    <input
                                                        type="date"
                                                        value={compareTo}
                                                        onChange={(event) => {
                                                            setComparisonPreset("custom");
                                                            setCompareTo(event.target.value);
                                                        }}
                                                        className="h-full border-0 bg-transparent px-2 text-sm text-foreground outline-none w-full sm:w-[130px]"
                                                    />
                                                </div>
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

                                <div className="h-[340px] rounded-[1.25rem] border border-border/70 bg-background p-4 flex flex-col">
                                    {comparisonChart.length === 0 ? (
                                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                            Seleccioná un rango de fechas para ver la evolución.
                                        </div>
                                    ) : (
                                        <div className="flex-1 w-full mt-2">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart data={comparisonChart} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id="colorTotalA" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#FE369E" stopOpacity={0.3} />
                                                            <stop offset="95%" stopColor="#FE369E" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                                    <XAxis 
                                                        dataKey="index" 
                                                        tickFormatter={(v) =>
                                                            isSalesChartGroupedByHour
                                                                ? `${String(v).padStart(2, "0")}h`
                                                                : `Día ${v + 1}`
                                                        }
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} 
                                                        dy={10}
                                                        minTickGap={30}
                                                    />
                                                    <YAxis 
                                                        yAxisId="left"
                                                        tickFormatter={(v) => new Intl.NumberFormat("es-AR", { notation: "compact", compactDisplay: "short" }).format(v)}
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} 
                                                    />
                                                    <RechartsTooltip 
                                                        content={({ active, payload }) => {
                                                            if (active && payload && payload.length) {
                                                                return (
                                                                    <div className="rounded-xl border border-border/50 bg-background/95 p-3 shadow-lg backdrop-blur-sm">
                                                                        <div className="grid gap-2">
                                                                            {/* Periodo A */}
                                                                            <div className="flex items-center justify-between gap-4">
                                                                                <div className="flex items-center gap-2">
                                                                                    <div className="size-2.5 rounded-full bg-[#FE369E]"></div>
                                                                                    <div>
                                                                                        <p className="text-xs font-medium text-muted-foreground">{isComparisonEnabled ? "Periodo A" : isSalesChartGroupedByHour ? "Hora" : "Día"}</p>
                                                                                        {isSalesChartGroupedByHour && typeof payload[0]?.payload.hour === "number" && (
                                                                                            <p className="text-[10px] text-muted-foreground/70">
                                                                                                {formatHourRange(payload[0].payload.hour)}
                                                                                            </p>
                                                                                        )}
                                                                                        {payload[0]?.payload.dayA && (
                                                                                            <p className="text-[10px] text-muted-foreground/70">
                                                                                                {formatShortDate(payload[0].payload.dayA)}
                                                                                            </p>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="text-right">
                                                                                    <p className="text-sm font-bold text-foreground">
                                                                                        {formatCurrency(payload[0]?.value as number)}
                                                                                    </p>
                                                                                    <p className="text-[10px] text-muted-foreground">
                                                                                        {payload[0]?.payload.ticketsA} boletas
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                            
                                                                            {/* Periodo B */}
                                                                            {isComparisonEnabled && payload[1] && (
                                                                                <>
                                                                                    <div className="h-px bg-border/50" />
                                                                                    <div className="flex items-center justify-between gap-4">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <div className="size-2.5 rounded-full bg-[#FF9FD5]"></div>
                                                                                            <div>
                                                                                                <p className="text-xs font-medium text-muted-foreground">Periodo B</p>
                                                                                                {isSalesChartGroupedByHour && typeof payload[1].payload.hour === "number" && (
                                                                                                    <p className="text-[10px] text-muted-foreground/70">
                                                                                                        {formatHourRange(payload[1].payload.hour)}
                                                                                                    </p>
                                                                                                )}
                                                                                                {payload[1].payload.dayB && (
                                                                                                    <p className="text-[10px] text-muted-foreground/70">
                                                                                                        {formatShortDate(payload[1].payload.dayB)}
                                                                                                    </p>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="text-right">
                                                                                            <p className="text-sm font-bold text-foreground">
                                                                                                {formatCurrency(payload[1]?.value as number)}
                                                                                            </p>
                                                                                            <p className="text-[10px] text-muted-foreground">
                                                                                                {payload[1]?.payload.ticketsB} boletas
                                                                                            </p>
                                                                                        </div>
                                                                                    </div>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        }}
                                                    />
                                                    
                                                    {isComparisonEnabled && (
                                                        <Line
                                                            yAxisId="left"
                                                            type="monotone"
                                                            dataKey="totalB"
                                                            stroke="#FF9FD5"
                                                            strokeWidth={2.5}
                                                            strokeDasharray="5 5"
                                                            dot={{ r: 3, fill: "var(--background)", strokeWidth: 2 }}
                                                            activeDot={{ r: 5 }}
                                                            name="Periodo B"
                                                        />
                                                    )}

                                                    <Area
                                                        yAxisId="left"
                                                        type="monotone"
                                                        dataKey="totalA"
                                                        stroke="#FE369E"
                                                        strokeWidth={3}
                                                        fillOpacity={1}
                                                        fill="url(#colorTotalA)"
                                                        dot={{ r: 4, fill: "var(--background)", strokeWidth: 2 }}
                                                        activeDot={{ r: 6, strokeWidth: 0, fill: "#FE369E" }}
                                                        name="Periodo A"
                                                    />
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="medios" className="mt-4 space-y-4">
                        <Card className="rounded-[1.5rem] border-border/70 bg-card/90 shadow-sm">
                            <CardHeader className="gap-4">
                                <div>
                                    <CardTitle>Transferencias vs efectivo</CardTitle>
                                    <CardDescription>Distribución del dinero ingresado por medio de pago.</CardDescription>
                                </div>
                                {periodFilterControls}
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-6 xl:grid-cols-[420px_1fr] xl:items-center">
                                    <div className="relative mx-auto flex aspect-square w-full max-w-[360px] items-center justify-center">
                                        {(() => {
                                            const total = reportData.totalCollected;
                                            const cashPercentage = total > 0 ? (reportData.totalCash / total) * 100 : 0;
                                            const transferPercentage = total > 0 ? (reportData.totalTransfer / total) * 100 : 0;
                                            const hasData = total > 0;
                                            
                                            const pieData = hasData ? [
                                                { name: "Efectivo", value: reportData.totalCash, percentage: cashPercentage, fill: "url(#pieCash)", color: "#FE369E" },
                                                { name: "Transferencia", value: reportData.totalTransfer, percentage: transferPercentage, fill: "url(#pieTransfer)", color: "#FF9FD5" }
                                            ] : [
                                                { name: "Sin datos", value: 1, fill: "var(--muted)", color: "var(--muted)", isPlaceholder: true }
                                            ];

                                            return (
                                                <div className="h-full w-full relative">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <defs>
                                                                <linearGradient id="pieCash" x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="0%" stopColor="#FF64B9" />
                                                                    <stop offset="100%" stopColor="#D0065F" />
                                                                </linearGradient>
                                                                <linearGradient id="pieTransfer" x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="0%" stopColor="#FFCAE9" />
                                                                    <stop offset="100%" stopColor="#FF9FD5" />
                                                                </linearGradient>
                                                            </defs>
                                                            <Pie
                                                                data={pieData}
                                                                cx="50%"
                                                                cy="50%"
                                                                innerRadius="65%"
                                                                outerRadius="95%"
                                                                paddingAngle={hasData ? 4 : 0}
                                                                dataKey="value"
                                                                stroke="none"
                                                                cornerRadius={hasData ? 10 : 0}
                                                            >
                                                                {pieData.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                                ))}
                                                            </Pie>
                                                            {hasData && (
                                                                <RechartsTooltip
                                                                    content={({ active, payload }) => {
                                                                        if (active && payload && payload.length && !payload[0].payload.isPlaceholder) {
                                                                            const data = payload[0].payload;
                                                                            return (
                                                                                <div className="rounded-xl border border-border/50 bg-background/95 p-3 shadow-lg backdrop-blur-sm z-50">
                                                                                    <div className="flex flex-col gap-1">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <div className="size-3 rounded-full" style={{ backgroundColor: data.color }} />
                                                                                            <p className="text-sm font-semibold text-foreground">{data.name}</p>
                                                                                        </div>
                                                                                        <div className="mt-2 flex items-center justify-between gap-6">
                                                                                            <p className="text-sm font-medium text-muted-foreground">% del Total</p>
                                                                                            <p className="text-sm font-semibold text-muted-foreground">{data.percentage.toFixed(1)}%</p>
                                                                                        </div>
                                                                                        <div className="flex items-center justify-between gap-6">
                                                                                            <p className="text-sm font-medium text-foreground">Ingreso</p>
                                                                                            <p className="text-sm font-bold text-foreground">{formatCurrency(data.value)}</p>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        }
                                                                        return null;
                                                                    }}
                                                                />
                                                            )}
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                    
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                            Total
                                                        </p>
                                                        <p className="mt-2 text-2xl font-bold text-foreground">
                                                            {formatCurrency(total)}
                                                        </p>
                                                    </div>
                                                </div>
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
                                                                    payment.key === "cash" ? "bg-[#FE369E]" : "bg-[#FF9FD5]"
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
                            <CardHeader className="gap-4">
                                <div>
                                    <CardTitle>Horas pico</CardTitle>
                                    <CardDescription>Cantidad de boletas emitidas por franja horaria.</CardDescription>
                                </div>
                                {periodFilterControls}
                            </CardHeader>
                            <CardContent>
                                <div className="h-[380px] rounded-[1.25rem] border border-border/70 bg-background p-4 flex flex-col">
                                    {reportData.hourRows.length === 0 ? (
                                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                            Todavía no hay ventas registradas para analizar horarios.
                                        </div>
                                    ) : (
                                        <div className="flex-1 w-full mt-2">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={[...reportData.hourRows].sort((a, b) => a.hour - b.hour)} margin={{ top: 20, right: 10, left: -20, bottom: 0 }} barSize={42}>
                                                    <defs>
                                                        <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#FE369E" />
                                                            <stop offset="100%" stopColor="#D0065F" />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                                    <XAxis 
                                                        dataKey="hour" 
                                                        tickFormatter={(v) => `${v.toString().padStart(2, "0")}h`}
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} 
                                                        dy={10}
                                                    />
                                                    <YAxis 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} 
                                                    />
                                                    <RechartsTooltip
                                                        cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                                                        content={({ active, payload }) => {
                                                            if (active && payload && payload.length) {
                                                                const data = payload[0].payload;
                                                                return (
                                                                    <div className="rounded-xl border border-border/50 bg-background/95 p-3 shadow-lg backdrop-blur-sm">
                                                                        <div className="flex flex-col gap-1">
                                                                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                                                                                {formatHourRange(data.hour)}
                                                                            </p>
                                                                            <div className="mt-2 flex items-center justify-between gap-6">
                                                                                <p className="text-sm font-medium text-foreground">Boletas</p>
                                                                                <p className="text-sm font-bold text-foreground">{data.tickets}</p>
                                                                            </div>
                                                                            <div className="flex items-center justify-between gap-6">
                                                                                <p className="text-sm font-medium text-muted-foreground">Facturado</p>
                                                                                <p className="text-sm font-semibold text-muted-foreground">{formatCurrency(data.total)}</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        }}
                                                    />
                                                    <Bar 
                                                        dataKey="tickets" 
                                                        fill="url(#colorTickets)" 
                                                        radius={[4, 4, 0, 0]}
                                                        label={{ position: "top", fill: "var(--foreground)", fontSize: 12, fontWeight: 600, dy: -6 }}
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="productos" className="mt-4 space-y-4">
                        <Card className="rounded-[1.5rem] border-border/70 bg-card/90 shadow-sm">
                            <CardHeader className="gap-4">
                                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
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
                                                    ? "border-rose-800 bg-rose-900 text-rose-50"
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
                                                    ? "border-rose-800 bg-rose-900 text-rose-50"
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
                                                        ? "border-fuchsia-800 bg-fuchsia-900 text-fuchsia-50"
                                                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                                                )}
                                            >
                                                Top {limit}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {periodFilterControls}
                            </CardHeader>
                            <CardContent>
                                <div 
                                    className="rounded-[1.25rem] border border-border/70 bg-background p-4 flex flex-col"
                                    style={{ height: Math.max(productRankingRows.length * 56 + 60, 260) }}
                                >
                                    {productRankingRows.length === 0 ? (
                                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                            Todavía no hay productos vendidos para analizar.
                                        </div>
                                    ) : (
                                        <div className="flex-1 w-full mt-2 min-h-0">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart 
                                                    data={productRankingRows} 
                                                    layout="vertical" 
                                                    margin={{ top: 0, right: 80, left: 0, bottom: 0 }} 
                                                    barSize={32}
                                                >
                                                    <defs>
                                                        <linearGradient id="colorProduct" x1="0" y1="0" x2="1" y2="0">
                                                            <stop offset="0%" stopColor="#FF9FD5" />
                                                            <stop offset="100%" stopColor="#FE369E" />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" />
                                                    <XAxis 
                                                        type="number" 
                                                        hide={true}
                                                    />
                                                    <YAxis 
                                                        type="category" 
                                                        dataKey="productName" 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        width={140}
                                                        tick={{ fill: "var(--foreground)", fontSize: 12, fontWeight: 500 }}
                                                        tickFormatter={(v) => v.length > 20 ? v.substring(0, 18) + "..." : v}
                                                    />
                                                    <RechartsTooltip
                                                        cursor={{ fill: "transparent" }}
                                                        content={({ active, payload }) => {
                                                            if (active && payload && payload.length) {
                                                                const data = payload[0].payload;
                                                                return (
                                                                    <div className="rounded-xl border border-border/50 bg-background/95 p-3 shadow-lg backdrop-blur-sm z-50">
                                                                        <div className="flex flex-col gap-1">
                                                                            <p className="text-sm font-bold text-foreground max-w-[240px] break-words">
                                                                                {data.productName}
                                                                            </p>
                                                                            <div className="mt-2 flex items-center justify-between gap-6">
                                                                                <p className="text-sm font-medium text-muted-foreground">Unidades / Boletas</p>
                                                                                <p className="text-sm font-semibold text-muted-foreground">{data.unitsSold} u. / {data.tickets} bol.</p>
                                                                            </div>
                                                                            <div className="flex items-center justify-between gap-6">
                                                                                <p className="text-sm font-medium text-foreground">Facturado</p>
                                                                                <p className="text-sm font-bold text-foreground">{formatCurrency(data.total)}</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        }}
                                                    />
                                                    <Bar 
                                                        dataKey={productRankingMetric === "money" ? "total" : "unitsSold"} 
                                                        fill="url(#colorProduct)" 
                                                        radius={[0, 6, 6, 0]}
                                                        label={{ 
                                                            position: "right", 
                                                            fill: "var(--foreground)", 
                                                            fontSize: 13, 
                                                            fontWeight: 600,
                                                            formatter: (value) => {
                                                                const numericValue = Number(value);
                                                                return productRankingMetric === "money"
                                                                    ? formatCurrency(numericValue)
                                                                    : `${numericValue} u.`;
                                                            }
                                                        }}
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                </Tabs>
            </div>
        </div>
    );
}
