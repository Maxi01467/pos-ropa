export const ARGENTINA_TIME_ZONE = "America/Argentina/Buenos_Aires";

export function normalizeDateInput(date: string | Date) {
    if (date instanceof Date) {
        return date;
    }

    const normalizedDate = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(date)
        ? date
        : `${date.replace(" ", "T")}Z`;

    return new Date(normalizedDate);
}

export function formatArgentinaDateTime(
    date: string | Date | null | undefined,
    options?: Intl.DateTimeFormatOptions
) {
    if (!date) return "—";

    const usesStyleOptions = Boolean(options?.dateStyle || options?.timeStyle);
    const formatOptions: Intl.DateTimeFormatOptions = usesStyleOptions
        ? {
            timeZone: ARGENTINA_TIME_ZONE,
            hourCycle: "h23",
            ...options,
        }
        : {
        timeZone: ARGENTINA_TIME_ZONE,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        ...options,
    };

    return new Intl.DateTimeFormat("es-AR", formatOptions).format(normalizeDateInput(date));
}

export function formatArgentinaDateTimeWithSuffix(
    date: string | Date | null | undefined,
    options?: Intl.DateTimeFormatOptions
) {
    const formatted = formatArgentinaDateTime(date, options);
    return formatted === "—" ? formatted : `${formatted} hs`;
}

export function formatArgentinaShortDate(date: string | Date | null | undefined) {
    return formatArgentinaDateTime(date, {
        year: undefined,
        hour: undefined,
        minute: undefined,
    });
}

export function formatArgentinaTime(date: string | Date | null | undefined) {
    return formatArgentinaDateTime(date, {
        day: undefined,
        month: undefined,
        year: undefined,
    });
}
