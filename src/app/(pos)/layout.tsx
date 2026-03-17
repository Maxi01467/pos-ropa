import { redirect } from "next/navigation";
import { RouteGuard } from "@/components/route-guard";
import { Sidebar } from "@/components/sidebar";
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
            <div className="flex min-h-screen bg-background">
                <Sidebar role={session.role} />
                <main className="flex-1 overflow-auto">
                    {/* Mobile top spacing for hamburger button */}
                    <div className="h-16 lg:hidden" />
                    {children}
                </main>
            </div>
        </RouteGuard>
    );
}
