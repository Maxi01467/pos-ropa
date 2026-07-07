"use client";

import { useCallback, useMemo } from "react";
import { ClipboardList, History, Wallet } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CurrentCashTab } from "@/components/cash/current-cash-tab";
import { CashHistoryTab } from "@/components/cash/cash-history-tab";
import { CashCountsTab } from "@/components/cash/cash-counts-tab";
import { useSessionSnapshot } from "@/lib/session/session-client";

const CASH_TABS = [
    {
        value: "actual",
        label: "Caja actual",
        description: "Apertura, movimientos y cierre del turno.",
        icon: Wallet,
    },
    {
        value: "historial",
        label: "Historial",
        description: "",
        icon: History,
    },
    {
        value: "arqueos",
        label: "Arqueos",
        description: "Pendientes de conteo e historial cerrado.",
        icon: ClipboardList,
    },
] as const;

type CashTab = (typeof CASH_TABS)[number]["value"];
const TAB_PANEL_CLASS =
    "focus-visible:ring-0 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-2 data-[state=active]:duration-300 data-[state=active]:ease-out";

function isCashTab(value: string | null): value is CashTab {
    return CASH_TABS.some((tab) => tab.value === value);
}

export default function CajaPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { role } = useSessionSnapshot();

    const visibleTabs = useMemo(
        () =>
            role === "ADMIN"
                ? CASH_TABS
                : CASH_TABS.filter((tab) => tab.value === "actual"),
        [role]
    );

    const activeTab = useMemo<CashTab>(() => {
        const tab = searchParams.get("tab");
        if (!isCashTab(tab)) {
            return "actual";
        }

        return visibleTabs.some((visibleTab) => visibleTab.value === tab) ? tab : "actual";
    }, [searchParams, visibleTabs]);

    const handleTabChange = useCallback(
        (value: string) => {
            if (!isCashTab(value)) {
                return;
            }

            const nextParams = new URLSearchParams(searchParams.toString());
            if (value === "actual") {
                nextParams.delete("tab");
            } else {
                nextParams.set("tab", value);
            }

            const queryString = nextParams.toString();
            router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
                scroll: false,
            });
        },
        [pathname, router, searchParams]
    );
    const activeTabConfig = visibleTabs.find((tab) => tab.value === activeTab) ?? visibleTabs[0];
    const activeTabIndex = Math.max(
        0,
        visibleTabs.findIndex((tab) => tab.value === activeTab)
    );
    const tabCount = Math.max(1, visibleTabs.length);
    const switchIndicatorStyle = {
        width: `calc((100% - 0.5rem - ${(tabCount - 1) * 0.25}rem) / ${tabCount})`,
        transform: `translateX(calc(${activeTabIndex} * (100% + 0.25rem)))`,
    };

    return (
        <div className="p-4 sm:p-5 lg:p-6">
            <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-900/20 bg-[linear-gradient(135deg,rgba(8,145,178,0.16),rgba(14,116,144,0.06))] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-800 dark:text-cyan-100">
                        <Wallet className="size-3.5" />
                        Caja
                    </div>
                    <h1 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-foreground sm:text-3xl">
                        Caja y arqueos
                    </h1>
                    
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-5">
                {visibleTabs.length > 1 ? (
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <TabsList className="relative grid h-12 w-full grid-cols-3 gap-1 overflow-hidden rounded-2xl p-1 sm:max-w-xl lg:w-[32rem]">
                            <span
                                aria-hidden="true"
                                className="pointer-events-none absolute bottom-1 left-1 top-1 rounded-xl border border-border/70 bg-background shadow-sm transition-transform duration-300 ease-out dark:border-white/10 dark:bg-input/30"
                                style={switchIndicatorStyle}
                            />
                            {visibleTabs.map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    <TabsTrigger
                                        key={tab.value}
                                        value={tab.value}
                                        className="relative z-10 h-10 w-full cursor-pointer gap-2 rounded-xl bg-transparent px-3 text-sm shadow-none transition-colors duration-200 data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent"
                                    >
                                        <Icon className="size-4" />
                                        {tab.label}
                                    </TabsTrigger>
                                );
                            })}
                        </TabsList>
                        {activeTabConfig ? (
                            <p className="text-sm text-muted-foreground lg:text-right">
                                {activeTabConfig.description}
                            </p>
                        ) : null}
                    </div>
                ) : null}

                <div className="overflow-hidden">
                    <TabsContent value="actual" className={TAB_PANEL_CLASS}>
                        <CurrentCashTab />
                    </TabsContent>
                    <TabsContent value="historial" className={TAB_PANEL_CLASS}>
                        <CashHistoryTab />
                    </TabsContent>
                    <TabsContent value="arqueos" className={TAB_PANEL_CLASS}>
                        <CashCountsTab />
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
