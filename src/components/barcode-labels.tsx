// src/components/barcode-labels.tsx
"use client";

import Barcode from "react-barcode";

interface LabelItem {
    productName: string;
    sku: string;
    size: string;
    color: string;
    retailPrice: number;
    wholesalePrice: number;
}

interface BarcodeLabelsProps {
    items: LabelItem[];
}

function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 0,
    }).format(amount);
}

export function BarcodeLabels({ items }: BarcodeLabelsProps) {
    if (!items || items.length === 0) return null;

    return (
        <div className="hidden print:flex print:flex-wrap print:gap-2 absolute top-0 left-0 bg-white w-full">
            {items.map((item: LabelItem, index: number) => (
                <div 
                    key={index} 
                    className="w-[50mm] h-[25mm] flex flex-col items-center justify-between p-1 border border-dashed border-gray-300 print:border-none break-inside-avoid text-black overflow-hidden bg-white"
                >
                    {/* Nombre del Producto */}
                    <p className="text-[9px] font-black leading-tight truncate w-full text-center uppercase">
                        {item.productName}
                    </p>
                    
                    {/* Talle y Color */}
                    <p className="text-[8px] leading-tight text-center font-medium">
                        T: {item.size} | {item.color}
                    </p>

                    {/* SECCIÓN DE PRECIOS */}
                    <div className="flex justify-between w-full px-1 text-[9px] font-bold border-y border-black/10 py-0.5">
                        <span>V: {formatCurrency(item.retailPrice)}</span>
                        <span>M: {formatCurrency(item.wholesalePrice)}</span>
                    </div>

                    {/* Código de Barras */}
                    <div className="flex justify-center w-full scale-[0.9] origin-center">
                        <Barcode 
                            value={item.sku} 
                            width={1.1} 
                            height={20} 
                            fontSize={8} 
                            margin={0} 
                            displayValue={true} 
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}
