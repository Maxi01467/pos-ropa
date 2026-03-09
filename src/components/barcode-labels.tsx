// src/components/barcode-labels.tsx
"use client";

import Barcode from "react-barcode";
import { barcodeFromSku } from "@/lib/barcodes";

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
            {items.map((item: LabelItem, index: number) => {
                const barcodeValue = barcodeFromSku(item.sku);

                return (
                <div 
                    key={index} 
                    className="overflow-hidden bg-white text-black break-inside-avoid"
                    style={{
                        width: `${LABEL_WIDTH_MM}mm`,
                        height: `${LABEL_HEIGHT_MM}mm`,
                        padding: "0.8mm 1.1mm",
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
                            fontSize: "6px",
                            lineHeight: 1,
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                            overflow: "hidden",
                        }}
                    >
                        {item.productName}
                    </p>

                    <p
                        className="text-center font-medium"
                        style={{ fontSize: "5px", lineHeight: 1 }}
                    >
                        T: {item.size} | {item.color}
                    </p>

                    <div
                        className="flex w-full items-center justify-between font-bold"
                        style={{
                            fontSize: "5px",
                            lineHeight: 1,
                            borderTop: "0.2mm solid rgba(0,0,0,0.15)",
                            borderBottom: "0.2mm solid rgba(0,0,0,0.15)",
                            padding: "0.35mm 0",
                        }}
                    >
                        <span>V: {formatCurrency(item.retailPrice)}</span>
                        <span>M: {formatCurrency(item.wholesalePrice)}</span>
                    </div>

                    <div className="flex w-full flex-1 flex-col items-center justify-end">
                        <Barcode 
                            value={barcodeValue}
                            format="EAN13"
                            renderer="svg"
                            width={1.35}
                            height={30}
                            fontSize={7}
                            margin={0} 
                            textMargin={0}
                            displayValue={false}
                            background="transparent"
                            lineColor="#000000"
                        />
                        <p
                            className="mt-[0.4mm] w-full text-center font-semibold"
                            style={{
                                fontSize: "5px",
                                lineHeight: 1,
                                whiteSpace: "nowrap",
                                textOverflow: "ellipsis",
                                overflow: "hidden",
                            }}
                        >
                            {item.sku}
                        </p>
                    </div>
                </div>
                );
            })}
            </div>
        </div>
    );
}
