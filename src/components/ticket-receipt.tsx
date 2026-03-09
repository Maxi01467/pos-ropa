// src/components/ticket-receipt.tsx
"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";

const PAPER_WIDTH_MM = 80;
const HORIZONTAL_PADDING_MM = 4;

interface TicketReceiptProps {
    data: {
        ticketNumber: number;
        date: Date;
        sellerName: string;
        items: {
            name: string;
            quantity: number;
            price: number;
            subtotal: number;
        }[];
        total: number;
        paymentMethod: string;
    } | null;
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 0,
    }).format(amount);
}

export function TicketReceipt({ data }: TicketReceiptProps) {
    if (!data) return null;

    return (
        <div className="hidden print:block">
            <style>{`
                @media print {
                    @page {
                        size: ${PAPER_WIDTH_MM}mm auto;
                        margin: 0;
                    }

                    html,
                    body {
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #fff !important;
                    }
                }
            `}</style>

            <div className="fixed inset-0 z-[9999] bg-white text-black">
                <article
                    className="bg-white font-mono text-black"
                    style={{
                        width: `${PAPER_WIDTH_MM}mm`,
                        padding: `3mm ${HORIZONTAL_PADDING_MM}mm 6mm`,
                        fontSize: "11px",
                        lineHeight: 1.25,
                    }}
                >
                    <header className="border-b border-dashed border-black pb-2 text-center">
                        <h1 className="text-[18px] font-bold uppercase tracking-wide">
                            Mi Tienda de Ropa
                        </h1>
                        <p className="text-[11px]">Salta, Argentina</p>
                        <p className="text-[11px]">CUIT: 27-XXXXXXXX-X</p>
                    </header>

                    <section className="border-b border-dashed border-black py-2 text-[11px]">
                        <div className="flex items-start justify-between gap-3">
                            <span className="font-semibold">Ticket</span>
                            <span>{data.ticketNumber.toString().padStart(5, "0")}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                            <span className="font-semibold">Fecha</span>
                            <span>{format(data.date, "dd/MM/yyyy HH:mm", { locale: es })}</span>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                            <span className="font-semibold">Vendedor</span>
                            <span className="text-right">{data.sellerName}</span>
                        </div>
                    </section>

                    <section className="border-b border-dashed border-black py-2">
                        <table className="w-full table-fixed text-left text-[11px]">
                            <thead>
                                <tr className="border-b border-dashed border-black">
                                    <th className="w-[10mm] pb-1 font-bold">Cant</th>
                                    <th className="pb-1 font-bold">Detalle</th>
                                    <th className="w-[22mm] pb-1 text-right font-bold">Importe</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.items.map((item, index) => (
                                    <tr key={index} className="align-top">
                                        <td className="py-1 pr-1">{item.quantity}x</td>
                                        <td className="py-1 pr-2">
                                            <div className="whitespace-normal break-words">{item.name}</div>
                                            <div className="text-[10px]">
                                                {formatCurrency(item.price)} c/u
                                            </div>
                                        </td>
                                        <td className="py-1 text-right align-top">
                                            {formatCurrency(item.subtotal)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>

                    <section className="space-y-1 border-b border-dashed border-black py-2 text-[11px]">
                        <div className="flex items-center justify-between">
                            <span className="font-semibold">Items</span>
                            <span>{data.items.reduce((sum, item) => sum + item.quantity, 0)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[16px] font-bold">
                            <span>TOTAL</span>
                            <span>{formatCurrency(data.total)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="font-semibold">Pago</span>
                            <span className="uppercase">{data.paymentMethod}</span>
                        </div>
                    </section>

                    <footer className="pt-3 text-center text-[11px]">
                        <p>Gracias por su compra</p>
                        <p>Cambios dentro de 15 dias con ticket</p>
                    </footer>

                    <div style={{ height: "10mm" }} />
                </article>
            </div>
        </div>
    );
}
