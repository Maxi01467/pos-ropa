"use client";

import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const compactCurrencyFormatter = new Intl.NumberFormat("es-AR", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
});

interface SalesChartProps {
    salesData: { time: string; ventas: number }[];
}

export default function SalesChart({ salesData }: SalesChartProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <span className="text-sm text-muted-foreground animate-pulse">Cargando gráficos...</span>
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={salesData} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
                <defs>
                    <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis 
                    dataKey="time" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} 
                    dy={10}
                />
                <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} 
                    tickFormatter={(value) => `$${compactCurrencyFormatter.format(Number(value))}`}
                    tickMargin={8}
                    width={72}
                />
                <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--card)' }}
                />
                <Area 
                    type="monotone" 
                    dataKey="ventas" 
                    stroke="var(--primary)" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorVentas)" 
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}
