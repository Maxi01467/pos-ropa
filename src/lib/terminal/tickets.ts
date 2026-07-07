export const DEFAULT_TERMINAL_PREFIX = "C1";

export function normalizeTerminalPrefix(value?: string | null): string {
    const normalized = (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    return normalized || DEFAULT_TERMINAL_PREFIX;
}

export function buildTicketNumber(prefix: string, sequence: number): string {
    return `${normalizeTerminalPrefix(prefix)}-${String(Math.max(sequence, 1)).padStart(5, "0")}`;
}

export function extractTicketSequence(
    ticketNumber: string | number | null | undefined,
    prefix: string
): number | null {
    const normalizedPrefix = normalizeTerminalPrefix(prefix);
    const raw = String(ticketNumber ?? "").trim();

    if (!raw) {
        return null;
    }

    const prefixedMatch = raw.match(new RegExp(`^${normalizedPrefix}-(\\d+)$`, "i"));
    if (prefixedMatch) {
        return Number.parseInt(prefixedMatch[1], 10);
    }

    if (normalizedPrefix === DEFAULT_TERMINAL_PREFIX && /^\d+$/.test(raw)) {
        return Number.parseInt(raw, 10);
    }

    return null;
}

export function computeNextTicketSequence(
    ticketNumbers: Array<string | number | null | undefined>,
    prefix: string
): number {
    const maxSequence = ticketNumbers.reduce<number>((currentMax, ticketNumber) => {
        const next = extractTicketSequence(ticketNumber, prefix);
        return next != null && next > currentMax ? next : currentMax;
    }, 0);

    return maxSequence + 1;
}

/**
 * Dado el ticketNumber más alto de la DB (ya filtrado por prefix),
 * extrae su secuencia numérica y devuelve el siguiente número.
 * Retorna 1 si no hay ninguno previo.
 */
export function nextSequenceFromMax(
    maxTicketNumber: string | number | null | undefined,
    prefix: string
): number {
    const seq = extractTicketSequence(maxTicketNumber, prefix);
    return (seq ?? 0) + 1;
}

