import { RouteGuard } from "@/components/layout/route-guard";
import { POSLayoutClient } from "@/components/layout/pos-layout-client";

export default async function POSLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <div className="pos-shell-background fixed inset-0 -z-10" />
            <POSLayoutClient>
                <RouteGuard>
                    {children}
                </RouteGuard>
            </POSLayoutClient>
        </>
    );
}
