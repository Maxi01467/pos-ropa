const EAN13_BODY_LENGTH = 12;

function computeEan13CheckDigit(digits: string): string {
    const sum = digits
        .split("")
        .reduce((acc, digit, index) => {
            const value = Number.parseInt(digit, 10);
            return acc + value * (index % 2 === 0 ? 1 : 3);
        }, 0);

    return String((10 - (sum % 10)) % 10);
}

export function barcodeFromSku(sku: string): string {
    const cleaned = sku.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    let hash = 0;
    for (const char of cleaned) {
        hash = (hash * 31 + char.charCodeAt(0)) % 1_000_000_000_000;
    }

    const body = String(hash).padStart(EAN13_BODY_LENGTH, "0").slice(0, EAN13_BODY_LENGTH);
    return `${body}${computeEan13CheckDigit(body)}`;
}

export function barcodeFromTicketNumber(ticketNumber: number): string {
    const body = String(ticketNumber).padStart(EAN13_BODY_LENGTH, "0").slice(-EAN13_BODY_LENGTH);
    return `${body}${computeEan13CheckDigit(body)}`;
}
