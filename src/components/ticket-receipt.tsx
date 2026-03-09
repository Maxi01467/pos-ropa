// src/components/ticket-receipt.tsx
"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import Barcode from "react-barcode";
import { barcodeFromTicketNumber } from "@/lib/barcodes";

const PAPER_WIDTH_MM = 72;
const HORIZONTAL_PADDING_MM = 3;

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
    isGift?: boolean; // NUEVA PROP
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 0,
    }).format(amount);
}

export function TicketReceipt({ data, isGift = false }: TicketReceiptProps) {
    if (!data) return null;

    const ticketBarcode = barcodeFromTicketNumber(data.ticketNumber);

    return (
        <article
            className="bg-white font-mono text-black"
            style={{
                width: `${PAPER_WIDTH_MM}mm`,
                padding: `3mm ${HORIZONTAL_PADDING_MM}mm 6mm`,
                boxSizing: "border-box",
                margin: "0 auto",
                fontSize: "11px",
                lineHeight: 1.25,
            }}
        >
            <header className="border-b border-dashed border-black pb-2 text-center">
                <h1 className="text-[18px] font-bold uppercase tracking-wide">
                    GANGAFITS
                </h1>
                {isGift && (
                    <p className="mt-1 bg-black py-0.5 text-[12px] font-bold text-white">
                        TICKET DE CAMBIO
                    </p>
                )}
                <p className="text-[11px]">Salta, Argentina</p>
            </header>

            <section className="border-b border-dashed border-black py-2 text-[11px]">
                <div className="flex justify-between">
                    <span className="font-semibold">Ticket</span>
                    <span>{data.ticketNumber.toString().padStart(5, "0")}</span>
                </div>
                <div className="flex justify-between">
                    <span className="font-semibold">Fecha</span>
                    <span>{format(data.date, "dd/MM/yyyy HH:mm", { locale: es })}</span>
                </div>
                {!isGift && (
                    <div className="flex justify-between">
                        <span className="font-semibold">Vendedor</span>
                        <span>{data.sellerName}</span>
                    </div>
                )}
            </section>

            <section className="border-b border-dashed border-black py-2">
                <table className="w-full table-fixed text-[11px]">
                    <thead>
                        <tr className="border-b border-dashed border-black">
                            <th className="w-[9mm] pb-1 text-left font-bold">Cant</th>
                            <th className="pb-1 text-left font-bold">Detalle</th>
                            {!isGift && (
                                <th className="w-[20mm] pb-1 text-right font-bold">Importe</th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {data.items.map((item, index) => (
                            <tr key={index} className="align-top">
                                <td className="py-1">{item.quantity}x</td>
                                <td className="py-1">
                                    <div className="break-words">{item.name}</div>
                                    {!isGift && (
                                        <div className="text-[10px]">{formatCurrency(item.price)} c/u</div>
                                    )}
                                </td>
                                {!isGift && (
                                    <td className="py-1 text-right">{formatCurrency(item.subtotal)}</td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>

            {!isGift ? (
                <section className="space-y-1 border-b border-dashed border-black py-2 text-[11px]">
                    <div className="flex justify-between text-[16px] font-bold">
                        <span>TOTAL</span>
                        <span>{formatCurrency(data.total)}</span>
                    </div>
                    <div className="flex justify-between uppercase">
                        <span>Pago</span>
                        <span>{data.paymentMethod}</span>
                    </div>
                </section>
            ) : (
                <section className="border-b border-dashed border-black py-4 text-center text-[10px] italic">
                    Este comprobante no tiene valor comercial.
                    <br />
                    Valido unicamente para cambios.
                </section>
            )}

            <footer className="pt-3 text-center text-[11px]">
                <div className="mb-3 flex flex-col items-center">
                    <Barcode
                        value={ticketBarcode}
                        format="EAN13"
                        renderer="svg"
                        width={1.6}
                        height={34}
                        margin={0}
                        textMargin={1}
                        fontSize={10}
                        background="transparent"
                        lineColor="#000000"
                    />
                    <p className="mt-1 text-[10px] font-semibold">
                        {ticketBarcode}
                    </p>
                </div>
                <p>Gracias por su compra</p>
                <p>Cambios: 15 dias con este ticket</p>
            </footer>
            <div style={{ height: "10mm" }} />
        </article>
    );
}
