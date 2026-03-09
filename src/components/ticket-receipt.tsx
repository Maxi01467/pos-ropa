// src/components/ticket-receipt.tsx
"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";

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
        // Estas clases de Tailwind son la magia: 
        // "hidden" lo oculta en pantalla normal.
        // "print:block" lo muestra SOLO al imprimir.
        <div className="hidden print:block print:w-[80mm] print:bg-white print:text-black font-mono text-sm p-4 absolute top-0 left-0">
            
            {/* Cabecera de la tienda (Cambiá esto por el nombre del local de tu mamá) */}
            <div className="text-center mb-4">
                <h1 className="font-bold text-xl uppercase">Mi Tienda de Ropa</h1>
                <p className="text-xs">Salta, Argentina</p>
                <p className="text-xs">CUIT: 27-XXXXXXXX-X</p>
            </div>

            {/* Datos del Ticket */}
            <div className="border-b border-black border-dashed pb-2 mb-2 text-xs">
                <p>Ticket N°: {data.ticketNumber.toString().padStart(5, '0')}</p>
                <p>Fecha: {format(data.date, "dd/MM/yyyy HH:mm", { locale: es })}</p>
                <p>Vendedor: {data.sellerName}</p>
            </div>

            {/* Detalle de Productos */}
            <div className="border-b border-black border-dashed pb-2 mb-2 text-xs">
                <table className="w-full text-left">
                    <thead>
                        <tr>
                            <th className="font-bold w-12">Cant</th>
                            <th className="font-bold">Descripción</th>
                            <th className="font-bold text-right">Subt.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.items.map((item, index) => (
                            <tr key={index} className="align-top">
                                <td>{item.quantity}x</td>
                                <td className="pr-1">{item.name}</td>
                                <td className="text-right">{formatCurrency(item.subtotal)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Totales */}
            <div className="text-right mb-4">
                <p className="font-bold text-lg">
                    TOTAL: {formatCurrency(data.total)}
                </p>
                <p className="text-xs uppercase">Pago: {data.paymentMethod}</p>
            </div>

            {/* Pie del ticket */}
            <div className="text-center text-xs mt-6 mb-8">
                <p>¡Gracias por su compra!</p>
                <p>Los cambios se realizan dentro</p>
                <p>de los 15 días con este ticket.</p>
            </div>
            
            {/* Espacio extra abajo para el corte de papel */}
            <div className="h-8"></div>
        </div>
    );
}