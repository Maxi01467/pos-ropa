"use client";

import { formatArgentinaDateTime } from "@/lib/core/datetime";
import { barcodeFromTicketNumber } from "@/lib/printing/barcodes";

export interface ReceiptPrintData {
    ticketNumber: string;
    date: Date;
    sellerName: string;
    items: {
        name: string;
        quantity: number;
        price: number;
        subtotal: number;
    }[];
    giftItems?: {
        name: string;
        quantity: number;
        price: number;
        subtotal: number;
    }[];
    total: number;
    paymentMethod: string;
    cashAmount?: number;
    transferAmount?: number;
    exchangeCredit?: number;
    exchangedTicketNumber?: string;
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 0,
    }).format(amount);
}

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

const LEFT_PATTERNS: Record<string, { L: string; G: string }> = {
    "0": { L: "0001101", G: "0100111" },
    "1": { L: "0011001", G: "0110011" },
    "2": { L: "0010011", G: "0011011" },
    "3": { L: "0111101", G: "0100001" },
    "4": { L: "0100011", G: "0011101" },
    "5": { L: "0110001", G: "0111001" },
    "6": { L: "0101111", G: "0000101" },
    "7": { L: "0111011", G: "0010001" },
    "8": { L: "0110111", G: "0001001" },
    "9": { L: "0001011", G: "0010111" },
};

const RIGHT_PATTERNS: Record<string, string> = {
    "0": "1110010",
    "1": "1100110",
    "2": "1101100",
    "3": "1000010",
    "4": "1011100",
    "5": "1001110",
    "6": "1010000",
    "7": "1000100",
    "8": "1001000",
    "9": "1110100",
};

const PARITY_PATTERNS: Record<string, string> = {
    "0": "LLLLLL",
    "1": "LLGLGG",
    "2": "LLGGLG",
    "3": "LLGGGL",
    "4": "LGLLGG",
    "5": "LGGLLG",
    "6": "LGGGLL",
    "7": "LGLGLG",
    "8": "LGLGGL",
    "9": "LGGLGL",
};

function buildEan13Svg(value: string): string {
    const digits = value.replace(/\D/g, "");
    if (digits.length !== 13) {
        return "";
    }

    const parity = PARITY_PATTERNS[digits[0]];
    if (!parity) {
        return "";
    }

    let pattern = "101";
    for (let index = 1; index <= 6; index += 1) {
        const digit = digits[index];
        pattern += LEFT_PATTERNS[digit][parity[index - 1] as "L" | "G"];
    }

    pattern += "01010";

    for (let index = 7; index <= 12; index += 1) {
        pattern += RIGHT_PATTERNS[digits[index]];
    }

    pattern += "101";

    const moduleWidth = 2;
    const quietZone = 10;
    const width = quietZone * 2 + pattern.length * moduleWidth;
    const height = 72;
    const guardBarIndexes = new Set<number>();

    for (let index = 0; index < 3; index += 1) {
        guardBarIndexes.add(index);
    }

    for (let index = 45; index < 50; index += 1) {
        guardBarIndexes.add(index);
    }

    for (let index = 92; index < 95; index += 1) {
        guardBarIndexes.add(index);
    }

    let bars = "";
    for (let index = 0; index < pattern.length; index += 1) {
        if (pattern[index] !== "1") continue;
        const x = quietZone + index * moduleWidth;
        const barHeight = guardBarIndexes.has(index) ? 62 : 54;
        bars += `<rect x="${x}" y="0" width="${moduleWidth}" height="${barHeight}" fill="#000" />`;
    }

    return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-label="Codigo de barras ${digits}">
            <rect width="${width}" height="${height}" fill="#fff" />
            ${bars}
            <text x="${quietZone - 2}" y="70" font-family="monospace" font-size="14"> ${digits[0]}</text>
            <text x="${quietZone + 22}" y="70" font-family="monospace" font-size="14">${digits.slice(1, 7)}</text>
            <text x="${quietZone + 110}" y="70" font-family="monospace" font-size="14">${digits.slice(7)}</text>
        </svg>
    `.trim();
}

export function renderReceiptHtml(data: ReceiptPrintData, isGift = false): string {
    const printableItems =
        isGift && data.giftItems && data.giftItems.length > 0 ? data.giftItems : data.items;
    const ticketBarcode = barcodeFromTicketNumber(data.ticketNumber);
    const barcodeSvg = buildEan13Svg(ticketBarcode);
    const formattedDate = formatArgentinaDateTime(data.date);
    const shouldShowPaymentBreakdown =
        data.paymentMethod === "MIXTO" &&
        typeof data.cashAmount === "number" &&
        typeof data.transferAmount === "number";

    const itemRows = printableItems
        .map((item) => {
            const priceColumn = isGift
                ? ""
                : `<td class="amount">${escapeHtml(formatCurrency(item.subtotal))}</td>`;
            const unitPrice = isGift
                ? ""
                : `<div class="subline">${escapeHtml(formatCurrency(item.price))} c/u</div>`;

            return `
                <tr>
                    <td class="qty">${item.quantity}x</td>
                    <td class="detail">
                        <div>${escapeHtml(item.name)}</div>
                        ${unitPrice}
                    </td>
                    ${priceColumn}
                </tr>
            `;
        })
        .join("");

    const totalsSection = isGift
        ? `
            <section class="divider note">
                Este comprobante no tiene valor comercial.<br />
                Valido unicamente para cambios.
            </section>
        `
        : `
            <section class="divider totals">
                ${data.exchangeCredit
                    ? `
                        <div class="row">
                            <span>Cambio ticket #${data.exchangedTicketNumber?.toString().padStart(5, "0")}</span>
                            <span>-${escapeHtml(formatCurrency(data.exchangeCredit))}</span>
                        </div>
                    `
                    : ""}
                <div class="row total">
                    <span>TOTAL</span>
                    <span>${escapeHtml(formatCurrency(data.total))}</span>
                </div>
                <div class="row payment">
                    <span>Pago</span>
                    <span>${escapeHtml(data.paymentMethod)}</span>
                </div>
                ${shouldShowPaymentBreakdown
                    ? `
                        <div class="row payment-detail">
                            <span>Efectivo</span>
                            <span>${escapeHtml(formatCurrency(data.cashAmount ?? 0))}</span>
                        </div>
                        <div class="row payment-detail">
                            <span>Transferencia</span>
                            <span>${escapeHtml(formatCurrency(data.transferAmount ?? 0))}</span>
                        </div>
                    `
                    : ""}
            </section>
        `;

    return `
        <!DOCTYPE html>
        <html lang="es">
            <head>
                <meta charset="utf-8" />
                <title>Boleta ${data.ticketNumber}</title>
                <style>
                    @page {
                        margin: 0;
                    }

                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                    }

                    html {
                        margin: 0;
                        padding: 0;
                        background: white;
                        width: 100%;
                        height: max-content;
                    }

                    body {
                        font-family: monospace;
                        color: black;
                        font-size: 11px;
                        line-height: 1.2;
                        width: 100%;
                        max-width: 72mm;
                        height: max-content;
                        margin: 0;
                        padding: 3mm 3mm 6mm 3mm;
                    }

                    .receipt {
                        width: 100%;
                        height: max-content;
                    }

                    .center {
                        text-align: center;
                    }

                    .divider {
                        border-bottom: 1px dashed #000;
                        padding: 8px 0;
                    }

                    .divider:first-child {
                        padding-top: 0;
                    }

                    h1 {
                        margin: 0;
                        font-size: 18px;
                        font-weight: 700;
                        letter-spacing: 0.08em;
                    }

                    p {
                        margin: 0;
                    }

                    .gift-title {
                        margin-top: 4px;
                        background: #000;
                        color: #fff;
                        padding: 2px 0;
                        font-size: 12px;
                        font-weight: 700;
                    }

                    .row {
                        display: flex;
                        justify-content: space-between;
                        gap: 8px;
                    }

                    .row + .row {
                        margin-top: 4px;
                    }

                    .label {
                        font-weight: 700;
                    }

                    table {
                        width: 100%;
                        border-collapse: collapse;
                        table-layout: fixed;
                    }

                    thead tr {
                        border-bottom: 1px dashed #000;
                    }

                    th, td {
                        padding: 4px 0;
                        vertical-align: top;
                    }

                    th {
                        font-weight: 700;
                        text-align: left;
                    }

                    .qty {
                        width: 9mm;
                    }

                    .amount {
                        width: 20mm;
                        text-align: right;
                    }

                    .detail {
                        word-break: break-word;
                    }

                    .subline {
                        font-size: 10px;
                    }

                    .total {
                        font-size: 16px;
                        font-weight: 700;
                    }

                    .payment {
                        text-transform: uppercase;
                    }

                    .payment-detail {
                        font-size: 10px;
                    }

                    .note {
                        font-size: 10px;
                        font-style: italic;
                        text-align: center;
                        padding: 16px 0;
                    }

                    .barcode {
                        margin: 0 auto 8px;
                        width: fit-content;
                    }

                    .barcode-text {
                        margin-top: 4px;
                        font-size: 10px;
                        font-weight: 700;
                    }

                    .footer {
                        padding-top: 12px;
                        text-align: center;
                    }

                    .spacer {
                        height: 10mm;
                    }
                </style>
            </head>
            <body>
                <article class="receipt">
                    <header class="divider center">
                        <h1>GANGAFITS</h1>
                        ${isGift ? '<p class="gift-title">TICKET DE CAMBIO</p>' : ""}
                        <p>Salta, Argentina</p>
                    </header>

                    <section class="divider">
                        <div class="row">
                            <span class="label">Ticket</span>
                            <span>${data.ticketNumber.toString().padStart(5, "0")}</span>
                        </div>
                        <div class="row">
                            <span class="label">Fecha</span>
                            <span>${escapeHtml(formattedDate)}</span>
                        </div>
                        ${isGift
                            ? ""
                            : `
                                <div class="row">
                                    <span class="label">Vendedor</span>
                                    <span>${escapeHtml(data.sellerName)}</span>
                                </div>
                            `}
                    </section>

                    <section class="divider">
                        <table>
                            <thead>
                                <tr>
                                    <th class="qty">Cant</th>
                                    <th>Detalle</th>
                                    ${isGift ? "" : '<th class="amount">Importe</th>'}
                                </tr>
                            </thead>
                            <tbody>
                                ${itemRows}
                            </tbody>
                        </table>
                    </section>

                    ${totalsSection}

                    <footer class="footer">
                        <div class="barcode">${barcodeSvg}</div>
                        <p class="barcode-text">${ticketBarcode}</p>
                        <p>Gracias por su compra</p>
                        <p>Cambios: 15 dias con este ticket</p>
                    </footer>

                    <div class="spacer"></div>
                </article>
            </body>
        </html>
    `.trim();
}
