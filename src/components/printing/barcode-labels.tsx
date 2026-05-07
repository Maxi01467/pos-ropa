// src/components/barcode-labels.tsx
"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Barcode from "react-barcode";
import { barcodeFromSku } from "@/lib/printing/barcodes";

const LABEL_WIDTH_MM = 38;
const LABEL_HEIGHT_MM = 20;
const BARCODE_HEIGHT = 60;
const BARCODE_SIDE_QUIET_ZONE_MM = 4; // Estándar EAN-13 requiere mínimo 3.63mm; usamos 4mm para mayor compatibilidad
const BARCODE_WIDTH_MM = 29;
const BARCODE_TEXT_FONT_SIZE_PX = 4;

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

export const BarcodeLabels = React.memo(function BarcodeLabels({ items }: BarcodeLabelsProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
    }, []);

    if (!items || items.length === 0 || !mounted) return null;

    return createPortal(
        <div className="barcode-labels-print-shell">
            <style>{`
                @media screen {
                    .barcode-labels-print-shell {
                        display: none !important;
                    }
                }

                @media print {
                    .barcode-labels-print-shell {
                        display: block !important;
                    }

                    @page {
                        size: ${LABEL_WIDTH_MM}mm ${LABEL_HEIGHT_MM}mm;
                        margin: 0;
                    }

                    html,
                    body {
                        margin: 0 !important;
                        padding: 0 !important;
                        width: ${LABEL_WIDTH_MM}mm !important;
                        min-width: ${LABEL_WIDTH_MM}mm !important;
                        background: #fff !important;
                        height: auto !important;
                        min-height: auto !important;
                        overflow: visible !important;
                    }

                    body > :not(.barcode-labels-print-shell) {
                        display: none !important;
                    }

                    .barcode-labels-print-root {
                        width: ${LABEL_WIDTH_MM}mm;
                        margin: 0;
                        padding: 0;
                        background: #fff;
                        overflow: visible;
                    }

                    /* SVG es vectorial: escalar con CSS no distorsiona las barras */
                    .barcode-labels-print-root svg {
                        display: block;
                        width: ${BARCODE_WIDTH_MM}mm !important;
                        height: auto !important;
                    }
                }
            `}</style>

            <div className="barcode-labels-print-root bg-white text-black">
                {items.map((item: LabelItem, index: number) => {
                    return (
                        <div
                            key={index}
                            className="overflow-hidden bg-white text-black break-inside-avoid"
                            style={{
                                width: `${LABEL_WIDTH_MM}mm`,
                                height: `${LABEL_HEIGHT_MM}mm`,
                                padding: "0.35mm 0.8mm 0.25mm",
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
                                    fontSize: "6.8px",
                                    lineHeight: 1,
                                    whiteSpace: "nowrap",
                                    textOverflow: "ellipsis",
                                    overflow: "hidden",
                                    color: "#000000"
                                }}
                            >
                                {item.productName}
                            </p>

                            <div
                                className="grid w-full grid-cols-2 gap-[0.45mm]"
                                style={{
                                    borderTop: "0.2mm solid #000000",
                                    padding: "0.5mm 0",
                                }}
                            >
                                <div
                                    className="flex flex-col items-center justify-center rounded-[1.1mm] border border-black/80 bg-white text-black"
                                    style={{ padding: "0.25mm 0.2mm" }}
                                >

                                    <span
                                        className="font-black"
                                        style={{ fontSize: "14px", lineHeight: 1, color: "#000000" }}
                                    >
                                        {formatCurrency(item.retailPrice)}
                                    </span>
                                </div>

                                <div
                                    className="flex flex-col items-center justify-center rounded-[1.1mm] border border-black/80 bg-white text-black"
                                    style={{ padding: "0.25mm 0.2mm" }}
                                >

                                    <span
                                        className="font-black"
                                        style={{ fontSize: "14px", lineHeight: 1, color: "#000000" }}
                                    >
                                        {formatCurrency(item.wholesalePrice)}
                                    </span>
                                </div>
                            </div>

                            <div
                                className="flex w-full flex-1 flex-col items-center justify-start"
                                style={{ marginTop: "1.2mm", minHeight: 0 }}
                            >
                                <div
                                    className="flex w-full items-center justify-center bg-white"
                                    style={{
                                        paddingLeft: `${BARCODE_SIDE_QUIET_ZONE_MM}mm`,
                                        paddingRight: `${BARCODE_SIDE_QUIET_ZONE_MM}mm`,
                                        boxSizing: "border-box",
                                        overflow: "visible",
                                    }}
                                >
                                    <Barcode
                                        value={barcodeFromSku(item.sku)}
                                        format="EAN13"
                                        renderer="svg" // SVG vectorial: no se distorsiona al escalar
                                        width={2} // ancho de módulo base; CSS escala el SVG sin pérdida
                                        height={BARCODE_HEIGHT}
                                        fontSize={BARCODE_TEXT_FONT_SIZE_PX}
                                        margin={0}
                                        marginTop={0}
                                        marginBottom={0}
                                        textMargin={0}
                                        displayValue={false}
                                        background="#ffffff"
                                        lineColor="#000000"
                                    />
                                </div>
                                {/* <p
                                    className="mt-[1mm] w-full text-center font-bold"
                                    style={{
                                        fontSize: `${BARCODE_TEXT_FONT_SIZE_PX}px`,
                                        lineHeight: "4.8px",
                                        letterSpacing: "0.02em",
                                        whiteSpace: "nowrap",
                                        textOverflow: "ellipsis",
                                        overflow: "hidden",
                                        color: "#000000"
                                    }}
                                >
                                    {item.sku}
                                </p> */}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>,
        document.body
    );
});
