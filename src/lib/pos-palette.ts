export const POS_PALETTE_STORAGE_KEY = "pos_palette";

export const POS_PALETTES = [
    {
        value: "current",
        label: "Actual",
        swatches: ["#fb923c", "#6366f1", "#ede8e3"],
    },
    {
        value: "elegant-gray",
        label: "Gris elegante",
        swatches: ["#cbd5e1", "#94a3b8", "#e5e7eb"],
    },
    {
        value: "green",
        label: "Verde",
        swatches: ["#10b981", "#34d399", "#dcfce7"],
    },
    {
        value: "violet",
        label: "Magenta / violeta",
        swatches: ["#d946ef", "#8b5cf6", "#f5d0fe"],
    },
    {
        value: "lava",
        label: "Lava",
        swatches: ["#ef4444", "#f97316", "#451a03"],
    },
] as const;

export type PosPalette = (typeof POS_PALETTES)[number]["value"];

export function isPosPalette(value: string | null): value is PosPalette {
    return POS_PALETTES.some((palette) => palette.value === value);
}

