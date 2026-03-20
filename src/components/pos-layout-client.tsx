"use client";

import { useState } from "react";
import { AppHeader } from "@/components/app-header";
import { Sidebar } from "@/components/sidebar";
import type { SessionRole } from "@/lib/permissions";

export function POSLayoutClient({
    role,
    userName,
    children,
}: {
    role: SessionRole;
    userName: string;
    children: React.ReactNode;
}) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="flex min-h-screen bg-transparent">
            <Sidebar
                role={role}
                userName={userName}
                collapsed={collapsed}
                onToggleCollapse={() => setCollapsed((c) => !c)}
            />
            <main className="relative flex min-h-screen flex-1 flex-col overflow-hidden">
                <AppHeader
                    userName={userName}
                    role={role}
                />
                <div className="flex-1 overflow-auto bg-transparent">
                    {children}
                </div>
            </main>
        </div>
    );
}
