export const POS_PALETTE_STORAGE_KEY = "pos_palette";

export const POS_PALETTES = [
    {
        value: "current",
        label: "Actual",
        swatches: ["oklch(1.00 0.07 26)", "oklch(1.00 0.24 19)", "#ffffff"],
    },
    {
        value: "elegant-gray",
        label: "Gris elegante",
        swatches: ["#cbd5e1", "#94a3b8", "#e5e7eb"],
    },
] as const;

export type PosPalette = (typeof POS_PALETTES)[number]["value"];

export function isPosPalette(value: string | null): value is PosPalette {
    return POS_PALETTES.some((palette) => palette.value === value);
}
