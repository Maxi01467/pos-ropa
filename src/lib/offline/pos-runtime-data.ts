"use client";

import { getProductsForPOS, getSellers } from "@/app/actions/pos/pos-actions";
import { getSalesHistory } from "@/app/actions/sales/sales-actions";
import { isOfflineModeEnabled } from "@/lib/offline-config";
import { withOfflineReadFallback } from "@/lib/offline/runtime-fallback";
import { db, initPowerSync } from "@/lib/powersync/db";

export type PosCatalogProduct = {
    id: string;
    code: string;
    name: string;
    price: number;
    wholesalePrice: number;
    stock: number;
    sizes: string[];
    color: string;
    productId?: string;
    legacyBarcodes?: string[];
};

export type PosSeller = {
    id: string;
    name: string;
    role: string;
};

export type PosSaleHistoryItem = {
    id: string;
    ticketNumber: string;
    total: number;
    paymentMethod: string;
    cashAmount?: number;
    transferAmount?: number;
    date: string;
    sellerName: string;
    items: {
        id: string;
        variantId: string;
        productName: string;
        size: string;
        color: string;
        sku: string;
        quantity: number;
        priceAtTime: number;
        priceType: string;
        returnedQuantity: number;
    }[];
};

export type PosRuntimeMode = "server" | "powersync";

export interface PosRuntimeDataSource {
    mode: PosRuntimeMode;
    getProducts(): Promise<PosCatalogProduct[]>;
    getSellers(): Promise<PosSeller[]>;
    getSalesHistory(): Promise<PosSaleHistoryItem[]>;
}

type ProductRow = {
    productId: string;
    productName: string;
    priceNormal: number | string | null;
    priceWholesale: number | string | null;
    variantId: string | null;
    sku: string | null;
    size: string | null;
    color: string | null;
    stock: number | string | null;
    legacyBarcodes: string | null;
};

type SellerRow = {
    id: string;
    name: string;
    role: string;
};

type SaleRow = {
    id: string;
    ticketNumber: string | number | null;
    total: number | string | null;
    paymentMethod: string;
    cashAmount: number | string | null;
    transferAmount: number | string | null;
    date: string;
    sellerName: string;
};

type SaleItemRow = {
    id: string;
    saleId: string;
    variantId: string;
    productName: string;
    size: string;
    color: string;
    sku: string;
    quantity: number | string | null;
    priceAtTime: number | string | null;
    priceType: string;
    returnedQuantity: number | string | null;
};

const serverDataSource: PosRuntimeDataSource = {
    mode: "server",
    async getProducts() {
        return (await getProductsForPOS()) as PosCatalogProduct[];
    },
    async getSellers() {
        return (await getSellers()) as PosSeller[];
    },
    async getSalesHistory() {
        const sales = (await getSalesHistory()) as Array<
            Omit<PosSaleHistoryItem, "items"> & { items?: PosSaleHistoryItem["items"] }
        >;

        return sales.map((sale) => ({
            ...sale,
            items: sale.items ?? [],
        }));
    },
};

let powerSyncInitPromise: Promise<void> | null = null;

async function ensurePowerSyncReady(): Promise<void> {
    if (!powerSyncInitPromise) {
        powerSyncInitPromise = initPowerSync();
    }

    await powerSyncInitPromise;
}

function toNumber(value: number | string | null | undefined): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toTicketNumber(value: string | number | null | undefined): string {
    return String(value || "");
}

function splitLegacyBarcodes(raw: string | null): string[] {
    if (!raw) {
        return [];
    }

    return raw
        .split("||")
        .map((barcode) => barcode.trim())
        .filter(Boolean);
}

function mapPowerSyncProducts(rows: ProductRow[]): PosCatalogProduct[] {
    const canonicalVariantKeys = new Set(
        rows
            .filter((row) => row.variantId && row.sku && !row.sku.startsWith("OFF-"))
            .map((row) => `${row.productId}:${row.size ?? ""}:${row.color ?? ""}`)
    );

    return rows
        .filter((row) => {
            if (!row.variantId || !row.sku || !row.sku.startsWith("OFF-")) {
                return true;
            }

            const variantKey = `${row.productId}:${row.size ?? ""}:${row.color ?? ""}`;
            return !canonicalVariantKeys.has(variantKey);
        })
        .map((row) => {
            if (!row.variantId || !row.sku) {
                return {
                    id: row.productId,
                    code: row.productId.slice(-6).toUpperCase(),
                    name: row.productName,
                    price: toNumber(row.priceNormal),
                    wholesalePrice: toNumber(row.priceWholesale),
                    stock: 0,
                    sizes: [],
                    color: "",
                    productId: row.productId,
                    legacyBarcodes: [],
                };
            }

            return {
                id: row.variantId,
                code: row.sku,
                name:
                    row.size === "Único"
                        ? row.productName
                        : `${row.productName} - Talle ${row.size ?? ""}`,
                price: toNumber(row.priceNormal),
                wholesalePrice: toNumber(row.priceWholesale),
                stock: toNumber(row.stock),
                sizes: row.size ? [row.size] : [],
                color: row.color ?? "",
                productId: row.productId,
                legacyBarcodes: splitLegacyBarcodes(row.legacyBarcodes),
            };
        });
}

function mapPowerSyncSales(sales: SaleRow[], items: SaleItemRow[]): PosSaleHistoryItem[] {
    const itemsBySaleId = new Map<string, PosSaleHistoryItem["items"]>();

    items.forEach((item) => {
        const currentItems = itemsBySaleId.get(item.saleId) ?? [];
        currentItems.push({
            id: item.id,
            variantId: item.variantId,
            productName: item.productName,
            size: item.size,
            color: item.color,
            sku: item.sku,
            quantity: toNumber(item.quantity),
            priceAtTime: toNumber(item.priceAtTime),
            priceType: item.priceType,
            returnedQuantity: toNumber(item.returnedQuantity),
        });
        itemsBySaleId.set(item.saleId, currentItems);
    });

    return sales.map((sale) => ({
        id: sale.id,
        ticketNumber: toTicketNumber(sale.ticketNumber),
        total: toNumber(sale.total),
        paymentMethod: sale.paymentMethod,
        cashAmount: sale.cashAmount == null ? undefined : toNumber(sale.cashAmount),
        transferAmount: sale.transferAmount == null ? undefined : toNumber(sale.transferAmount),
        date: sale.date,
        sellerName: sale.sellerName,
        items: itemsBySaleId.get(sale.id) ?? [],
    }));
}

async function queryPowerSyncRows<T extends object>(sql: string, parameters: unknown[] = []): Promise<T[]> {
    const rows = await db.getAll(sql, parameters);
    return rows as T[];
}

async function withPowerSyncFallback<T>(
    label: string,
    queryLocal: () => Promise<T[]>,
    queryServer: () => Promise<T[]>
): Promise<T[]> {
    return withOfflineReadFallback({
        label,
        logPrefix: "pos-runtime-data",
        ensureReady: ensurePowerSyncReady,
        local: queryLocal,
        server: queryServer,
        hasUsableLocalData: (rows) => rows.length > 0,
    });
}

const powerSyncDataSource: PosRuntimeDataSource = {
    mode: "powersync",
    async getProducts() {
        return withPowerSyncFallback(
            "products",
            async () => {
                const rows = await queryPowerSyncRows<ProductRow>(
                    `
                        SELECT
                            p.id AS productId,
                            p.name AS productName,
                            p.priceNormal,
                            p.priceWholesale,
                            pv.id AS variantId,
                            pv.sku,
                            pv.size,
                            pv.color,
                            pv.stock,
                            GROUP_CONCAT(ba.barcode, '||') AS legacyBarcodes
                        FROM "Product" p
                        LEFT JOIN "ProductVariant" pv
                            ON pv.productId = p.id
                           AND pv.deletedAt IS NULL
                        LEFT JOIN "BarcodeAlias" ba
                            ON ba.variantId = pv.id
                           AND ba.deletedAt IS NULL
                        WHERE p.deletedAt IS NULL
                        GROUP BY
                            p.id,
                            p.name,
                            p.priceNormal,
                            p.priceWholesale,
                            pv.id,
                            pv.sku,
                            pv.size,
                            pv.color,
                            pv.stock
                        ORDER BY p.createdAt DESC, pv.createdAt DESC
                    `
                );

                return mapPowerSyncProducts(rows);
            },
            () => serverDataSource.getProducts()
        );
    },
    async getSellers() {
        return withPowerSyncFallback(
            "sellers",
            async () => {
                const rows = await queryPowerSyncRows<SellerRow>(
                    `
                        SELECT id, name, role
                        FROM "User"
                        WHERE deletedAt IS NULL
                          AND active = 1
                        ORDER BY name ASC
                    `
                );

                return rows;
            },
            () => serverDataSource.getSellers()
        );
    },
    async getSalesHistory() {
        return withPowerSyncFallback(
            "sales-history",
            async () => {
                const [salesRows, itemRows] = await Promise.all([
                    queryPowerSyncRows<SaleRow>(
                        `
                            SELECT
                                s.id,
                                s.ticketNumber,
                                s.total,
                                s.paymentMethod,
                                s.cashAmount,
                                s.transferAmount,
                                s.createdAt AS date,
                                COALESCE(u.name, 'Vendedor') AS sellerName
                            FROM "Sale" s
                            LEFT JOIN "User" u
                                ON u.id = s.userId
                            WHERE s.deletedAt IS NULL
                            ORDER BY s.createdAt DESC
                        `
                    ),
                    queryPowerSyncRows<SaleItemRow>(
                        `
                            SELECT
                                si.id,
                                si.saleId,
                                si.variantId,
                                p.name AS productName,
                                pv.size,
                                pv.color,
                                pv.sku,
                                si.quantity,
                                si.priceAtTime,
                                si.priceType,
                                si.returnedQuantity
                            FROM "SaleItem" si
                            INNER JOIN "ProductVariant" pv
                                ON pv.id = si.variantId
                            INNER JOIN "Product" p
                                ON p.id = pv.productId
                            WHERE si.deletedAt IS NULL
                        `
                    ),
                ]);

                return mapPowerSyncSales(salesRows, itemRows);
            },
            () => serverDataSource.getSalesHistory()
        );
    },
};

export function getPosRuntimeDataSource(): PosRuntimeDataSource {
    if (isOfflineModeEnabled()) {
        return powerSyncDataSource;
    }

    return serverDataSource;
}
