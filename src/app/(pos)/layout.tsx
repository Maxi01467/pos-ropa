import { RouteGuard } from "@/components/layout/route-guard";
import { POSLayoutClient } from "@/components/layout/pos-layout-client";
import { getServerSession } from "@/lib/auth/auth";

export default async function POSLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getServerSession();

    return (
        <>
            <div className="pos-shell-background fixed inset-0 -z-10" />
            <POSLayoutClient initialSession={session}>
                <RouteGuard>
                    {children}
                </RouteGuard>
            </POSLayoutClient>
        </>
    );
}
