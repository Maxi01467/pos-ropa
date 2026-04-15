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

                    .barcode-labels-print-root {
                        position: absolute;
                        top: 0;
                        left: 0;
                        z-index: 9999;
                        width: ${LABEL_WIDTH_MM}mm;
                        margin: 0;
                        padding: 0;
                        background: #fff;
                    }
                }
            `}</style>

            <div className="barcode-labels-print-root bg-white text-black">
            {items.map((item: LabelItem, index: number) => {
                const barcodeValue = barcodeFromSku(item.sku);

                return (
                <div 
                    key={index} 
                    className="overflow-hidden bg-white text-black break-inside-avoid"
                    style={{
                        width: `${LABEL_WIDTH_MM}mm`,
                        height: `${LABEL_HEIGHT_MM}mm`,
                        padding: "0.7mm 1mm",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        boxSizing: "border-box",
                        overflow: "hidden",
                        pageBreakInside: "avoid",
                        breakInside: "avoid-page",
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

                    <div
                        className="grid w-full grid-cols-2 gap-[0.7mm]"
                        style={{
                            borderTop: "0.2mm solid rgba(0,0,0,0.15)",
                            borderBottom: "0.2mm solid rgba(0,0,0,0.15)",
                            padding: "0.55mm 0",
                        }}
                    >
                        <div
                            className="flex flex-col items-center justify-center rounded-[1.1mm] bg-black text-white"
                            style={{ padding: "0.45mm 0.3mm" }}
                        >
                            <span
                                className="font-bold uppercase"
                                style={{ fontSize: "4px", lineHeight: 1, letterSpacing: "0.08em", color: "#000000" }}
                            >
                                Venta
                            </span>
                            <span
                                className="font-black"
                                style={{ fontSize: "7.8px", lineHeight: 1.02, color: "#000000" }}
                            >
                                {formatCurrency(item.retailPrice)}
                            </span>
                        </div>

                        <div
                            className="flex flex-col items-center justify-center rounded-[1.1mm] border border-black/20 bg-neutral-100"
                            style={{ padding: "0.45mm 0.3mm" }}
                        >
                            <span
                                className="font-bold uppercase"
                                style={{ fontSize: "4px", lineHeight: 1, letterSpacing: "0.08em" }}
                            >
                                Mayor
                            </span>
                            <span
                                className="font-black"
                                style={{ fontSize: "7px", lineHeight: 1.02 }}
                            >
                                {formatCurrency(item.wholesalePrice)}
                            </span>
                        </div>
                    </div>

                    <div
                        className="flex w-full flex-1 flex-col items-center justify-end"
                        style={{ marginTop: "-2.2mm" }}
                    >
                        <Barcode 
                            value={barcodeValue}
                            format="EAN13"
                            renderer="svg"
                            width={1.22}
                            height={22}
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
                                fontSize: "6.9px",
                                lineHeight: 1,
                                letterSpacing: "0.02em",
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
