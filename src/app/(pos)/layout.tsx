import { redirect } from "next/navigation";
import { RouteGuard } from "@/components/layout/route-guard";
import { POSLayoutClient } from "@/components/layout/pos-layout-client";
import { getServerSession } from "@/lib/auth/auth";

export default async function POSLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    let session;

    try {
        session = await getServerSession();
    } catch (error) {
        if (
            error &&
            typeof error === "object" &&
            "digest" in error &&
            typeof error.digest === "string" &&
            error.digest.startsWith("NEXT_REDIRECT")
        ) {
            throw error;
        }

        if (process.env.POS_DESKTOP === "1") {
            const message =
                error instanceof Error ? error.message : "Error desconocido al validar sesión";

            return (
                <main className="flex min-h-screen items-center justify-center bg-[#f5efe4] p-6">
                    <section className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl">
                        <h1 className="text-2xl font-semibold text-red-700">
                            Error al abrir la sesión
                        </h1>
                        <p className="mt-3 text-sm text-slate-700">
                            La app de escritorio capturó el detalle real del error:
                        </p>
                        <pre className="mt-4 overflow-auto rounded-2xl bg-slate-50 p-4 text-sm text-slate-900">
                            {message}
                        </pre>
                    </section>
                </main>
            );
        }

        throw error;
    }

    if (!session) {
        redirect("/login");
    }

    if (session.role === "STAFF" && session.clientType !== "desktop") {
        redirect("/login");
    }

    return (
        <>
            <div className="pos-shell-background fixed inset-0 -z-10" />
            <POSLayoutClient role={session.role} userName={session.userName}>
                <RouteGuard>
                    {children}
                </RouteGuard>
            </POSLayoutClient>
        </>
    );
}
