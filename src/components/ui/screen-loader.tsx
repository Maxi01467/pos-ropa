import { Loader2 } from "lucide-react";

export function ScreenLoader({
    message = "Cargando...",
    description,
    layout = "absolute",
}: {
    message?: string;
    description?: string;
    layout?: "absolute" | "centered" | "inline";
}) {
    if (layout === "inline") {
        return (
            <div className="flex flex-col items-center justify-center p-8 gap-1">
                <div className="flex items-center gap-2.5">
                    <Loader2 className="size-5 animate-spin text-rose-500 dark:text-rose-400" />
                    {message && (
                        <span className="text-sm font-semibold tracking-tight text-neutral-800 dark:text-neutral-200">
                            {message}
                        </span>
                    )}
                </div>
            </div>
        );
    }

    if (layout === "centered") {
        return (
            <div className="flex min-h-[250px] w-full items-center justify-center p-6 animate-in fade-in duration-200">
                <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-[1px] px-6 py-4 shadow-sm flex flex-col items-center gap-2 max-w-sm text-center">
                    <div className="flex items-center gap-3">
                        <Loader2 className="size-5 animate-spin text-rose-500" />
                        {message && (
                            <span className="text-xs font-semibold tracking-tight text-foreground select-none">
                                {message}
                            </span>
                        )}
                    </div>
                    {description && (
                        <p className="text-[11px] text-muted-foreground leading-normal max-w-[240px]">
                            {description}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    // Absolute variant uses the elegant, clean floating curtain design
    return (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-background/40 backdrop-blur-[2px] animate-in fade-in duration-200">
            <div className="flex flex-col items-center justify-center gap-3">
                {/* Circular spinner matching NavigationOverlay style and performance speed */}
                <div 
                    className="size-8 rounded-full border-[3px] border-rose-500/20 border-t-rose-500 animate-spin"
                    style={{ animationDuration: "0.65s" }}
                />
                
                {/* Floating status message */}
                <span className="text-xs font-medium text-muted-foreground select-none opacity-80">
                    {message}
                </span>

                {/* Optional description */}
                {description && (
                    <span className="text-[11px] text-muted-foreground/60 max-w-xs text-center leading-normal">
                        {description}
                    </span>
                )}
            </div>
        </div>
    );
}
