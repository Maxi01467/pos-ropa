// src/components/barcode-labels.tsx
"use client";

import Barcode from "react-barcode";

const LABEL_WIDTH_MM = 38;
const LABEL_HEIGHT_MM = 20;

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
        <div className="hidden print:block">
            <style>{`
                @media print {
                    @page {
                        size: ${LABEL_WIDTH_MM}mm ${LABEL_HEIGHT_MM}mm;
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
            {items.map((item: LabelItem, index: number) => (
                <div 
                    key={index} 
                    className="overflow-hidden bg-white text-black break-inside-avoid"
                    style={{
                        width: `${LABEL_WIDTH_MM}mm`,
                        height: `${LABEL_HEIGHT_MM}mm`,
                        padding: "1.2mm 1.4mm",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        pageBreakAfter: index === items.length - 1 ? "auto" : "always",
                        breakAfter: index === items.length - 1 ? "auto" : "page",
                    }}
                >
                    <p
                        className="w-full text-center font-black uppercase"
                        style={{
                            fontSize: "7px",
                            lineHeight: 1.05,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                        }}
                    >
                        {item.productName}
                    </p>

                    <p
                        className="text-center font-medium"
                        style={{ fontSize: "6px", lineHeight: 1.1 }}
                    >
                        T: {item.size} | {item.color}
                    </p>

                    <div
                        className="flex w-full items-center justify-between font-bold"
                        style={{
                            fontSize: "6px",
                            lineHeight: 1.1,
                            borderTop: "0.2mm solid rgba(0,0,0,0.15)",
                            borderBottom: "0.2mm solid rgba(0,0,0,0.15)",
                            padding: "0.5mm 0",
                        }}
                    >
                        <span>V: {formatCurrency(item.retailPrice)}</span>
                        <span>M: {formatCurrency(item.wholesalePrice)}</span>
                    </div>

                    <div className="flex w-full justify-center">
                        <Barcode 
                            value={item.sku} 
                            format="CODE128"
                            renderer="svg"
                            width={0.72}
                            height={16}
                            fontSize={6}
                            margin={0} 
                            textMargin={1}
                            displayValue={true}
                            background="transparent"
                            lineColor="#000000"
                        />
                    </div>
                </div>
            ))}
            </div>
        </div>
    );
}
