"use client";

import { usePathname } from "next/navigation";

export function usePageTransitionKey() {
    return usePathname();
}

export function PageTransition({ children }: { children: React.ReactNode }) {
    return (
        <div className="animate-page-enter size-full">
            {children}
        </div>
    );
}
