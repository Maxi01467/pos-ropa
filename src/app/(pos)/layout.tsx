import { redirect } from "next/navigation";
import { RouteGuard } from "@/components/route-guard";
import { POSLayoutClient } from "@/components/pos-layout-client";
import { getServerSession } from "@/lib/auth";

export default async function POSLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getServerSession();

    if (!session) {
        redirect("/login");
    }

    return (
        <RouteGuard>
            {/* Fondo fijo que el sidebar glass va a difuminar */}
            <div className="pos-shell-background fixed inset-0 -z-10" />
            <POSLayoutClient role={session.role} userName={session.userName}>
                {children}
            </POSLayoutClient>
        </RouteGuard>
    );
}
