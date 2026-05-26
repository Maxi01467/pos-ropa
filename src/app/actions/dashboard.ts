"use server";

import { prisma } from "@/lib/prisma";
import { formatArgentinaDateTime } from "@/lib/core/datetime";

function getArgentinaDateKey(date: Date) {
    const parts = new Intl.DateTimeFormat("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    return `${year}-${month}-${day}`;
}

function addDaysToDateKey(dateKey: string, days: number) {
    const [year, month, day] = dateKey.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + days));
    const nextYear = date.getUTCFullYear();
    const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
    const nextDay = String(date.getUTCDate()).padStart(2, "0");

    return `${nextYear}-${nextMonth}-${nextDay}`;
}

function getArgentinaDayRange(dateKey: string) {
    return {
        start: new Date(`${dateKey}T00:00:00.000-03:00`),
        end: new Date(`${dateKey}T23:59:59.999-03:00`),
    };
}

export async function getDashboardData() {
    const todayKey = getArgentinaDateKey(new Date());
    const yesterdayKey = addDaysToDateKey(todayKey, -1);
    const { start: todayStart, end: todayEnd } = getArgentinaDayRange(todayKey);
    const { start: yesterdayStart, end: yesterdayEnd } = getArgentinaDayRange(yesterdayKey);

    // Fetch sales for today
    const salesToday = await prisma.sale.findMany({
        where: {
            createdAt: {
                gte: todayStart,
                lte: todayEnd,
            },
            deletedAt: null,
        },
        include: {
            items: true,
        },
    });

    // Fetch sales for yesterday to calculate trend
    const salesYesterday = await prisma.sale.findMany({
        where: {
            createdAt: {
                gte: yesterdayStart,
                lte: yesterdayEnd,
            },
            deletedAt: null,
        },
        include: {
            items: true,
        },
    });

    // Calculate totals for today
    let totalSalesRevenueToday = 0;
    let totalItemsSoldToday = 0;
    
    salesToday.forEach((sale) => {
        totalSalesRevenueToday += Number(sale.total) || 0;
        sale.items.forEach((item) => {
            totalItemsSoldToday += item.quantity || 0;
        });
    });

    // Calculate totals for yesterday
    let totalSalesRevenueYesterday = 0;
    let totalItemsSoldYesterday = 0;

    salesYesterday.forEach((sale) => {
        totalSalesRevenueYesterday += Number(sale.total) || 0;
        sale.items.forEach((item) => {
            totalItemsSoldYesterday += item.quantity || 0;
        });
    });

    // Compute averages
    const ticketPromedioToday = salesToday.length > 0 ? totalSalesRevenueToday / salesToday.length : 0;
    const ticketPromedioYesterday = salesYesterday.length > 0 ? totalSalesRevenueYesterday / salesYesterday.length : 0;

    // Helper for computing percentage trend
    const calculateTrend = (current: number, past: number) => {
        if (past === 0) return current > 0 ? { value: "+100%", isUp: true } : { value: "0%", isUp: true };
        const diff = current - past;
        const percent = Math.round((diff / past) * 100);
        return {
            value: `${percent > 0 ? "+" : ""}${percent}%`,
            isUp: percent >= 0,
        };
    };

    // Calculate trends
    const revenueTrend = calculateTrend(totalSalesRevenueToday, totalSalesRevenueYesterday);
    const itemsTrend = calculateTrend(totalItemsSoldToday, totalItemsSoldYesterday);
    const ticketTrend = calculateTrend(ticketPromedioToday, ticketPromedioYesterday);

    // Group sales today by hour for the chart (9:00 to 20:00)
    const salesDataMap: Record<string, number> = {};
    // Initialize common working hours with 0
    for (let i = 9; i <= 20; i++) {
        salesDataMap[`${i.toString().padStart(2, '0')}:00`] = 0;
    }

    salesToday.forEach((sale) => {
        // Obtenemos la hora en huso horario de Argentina (00 a 23)
        const localTimeStr = formatArgentinaDateTime(sale.createdAt, {
            day: undefined,
            month: undefined,
            year: undefined,
        });
        
        // extraemos los dos primeros digitos de la hora (ej de "09:30" => "09")
        // y lo forzamos a :00 para agruparlo
        const hour = localTimeStr.split(":")[0];
        const hourKey = `${hour}:00`;
        
        if (salesDataMap[hourKey] !== undefined) {
            salesDataMap[hourKey] += Number(sale.total);
        } else {
            salesDataMap[hourKey] = Number(sale.total);
        }
    });

    // Convert map to sorted array
    const chartData = Object.keys(salesDataMap)
        .sort((a, b) => a.localeCompare(b))
        .map((time) => ({ time, ventas: salesDataMap[time] }));

    return {
        kpis: {
            revenueToday: totalSalesRevenueToday,
            revenueTrend,
            itemsToday: totalItemsSoldToday,
            itemsTrend,
            ticketToday: ticketPromedioToday,
            ticketTrend,
        },
        chartData,
    };
}
