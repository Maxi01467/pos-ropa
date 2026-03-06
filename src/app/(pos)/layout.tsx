import { Sidebar } from "@/components/sidebar";

export default function POSLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen bg-background">
            <Sidebar />
            <main className="flex-1 overflow-auto">
                {/* Mobile top spacing for hamburger button */}
                <div className="h-16 lg:hidden" />
                {children}
            </main>
        </div>
    );
}
