/**
 * Script de migración: Sistema viejo → POS nuevo
 *
 * Lee data-migration/productos.json y data-migration/codigobarras.json y crea en la BD:
 *   - Product (nombre, precios)
 *   - ProductVariant (SKU generado, stock = cantidad de códigos activos)
 *   - StockMovement (ingreso inicial)
 *   - BarcodeAlias[] (uno por cada código de barras activo del sistema viejo)
 *
 * Uso: npm run migrate:productos
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

// ─── Interfaces del JSON viejo ──────────────────────────────────────────────

interface ProductoViejo {
    id_articulo: number;
    descripcion: string;
    precio_venta: number;
    precio_mayor: number | null;
    estado: string; // "A" = activo, "*" = inactivo
}

interface CodigoBarraViejo {
    codigo: number;
    id_articulo: number;
    estado: string; // "A" = disponible, "V" = vendido, "C" = cancelado
}

// ─── Carga de datos ──────────────────────────────────────────────────────────

function loadJson<T>(filename: string): T {
    const path = join(__dirname, "..", "data-migration", filename);
    const raw = readFileSync(path, "utf-8");
    return (JSON.parse(raw) as { rows: T }).rows;
}

// ─── Limpieza de la base de datos ────────────────────────────────────────────

async function clearDatabase() {
    console.log("🗑️  Limpiando base de datos...\n");

    // Orden importante: primero las tablas que dependen de otras
    await prisma.barcodeAlias.deleteMany();
    await prisma.saleItem.deleteMany();
    await prisma.stockMovement.deleteMany();
    await prisma.cashMovement.deleteMany();
    await prisma.sale.deleteMany();
    await prisma.cashSession.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.supplier.deleteMany();
    await prisma.shift.deleteMany();

    // Nota: los Users se mantienen (se necesitan para autenticación)
    console.log("   ✓ Ventas, boletas y sesiones de caja eliminadas");
    console.log("   ✓ Productos, variantes y stock eliminados");
    console.log("   ✓ Proveedores y turnos eliminados");
    console.log("   ✓ Usuarios y empleados conservados\n");
}

// ─── Función principal ───────────────────────────────────────────────────────

async function main() {
    console.log("\n🚀 Iniciando migración de productos...\n");

    // 0. Limpiar base de datos
    await clearDatabase();

    // 1. Cargar datos
    const productos = loadJson<ProductoViejo[]>("productos.json");
    const codigos = loadJson<CodigoBarraViejo[]>("codigobarras.json");

    // 2. Filtrar solo activos
    const productosActivos = productos.filter((p) => p.estado === "A");

    // 3. Agrupar códigos activos por id_articulo
    const codigosPorArticulo = new Map<number, string[]>();
    for (const c of codigos) {
        if (c.estado !== "A") continue;
        if (!codigosPorArticulo.has(c.id_articulo)) {
            codigosPorArticulo.set(c.id_articulo, []);
        }
        codigosPorArticulo.get(c.id_articulo)!.push(String(c.codigo));
    }

    console.log(`📦 Productos activos encontrados: ${productosActivos.length}`);
    console.log(`🏷️  Códigos activos (en stock):   ${[...codigosPorArticulo.values()].flat().length}`);
    console.log("");

    let creados = 0;
    let omitidos = 0;
    let totalAliases = 0;

    // 4. Migrar cada producto (sin transacciones – compatible con Supabase pooler)
    for (const prod of productosActivos) {
        const codigosActivos = codigosPorArticulo.get(prod.id_articulo) ?? [];

        // Solo importamos si tiene al menos un código en stock
        if (codigosActivos.length === 0) {
            omitidos++;
            continue;
        }

        const nombre = prod.descripcion.trim();
        const precioVenta = Number(prod.precio_venta);
        const precioMayor =
            prod.precio_mayor && Number(prod.precio_mayor) > 0
                ? Number(prod.precio_mayor)
                : precioVenta; // Fallback: usar precio venta

        const stock = codigosActivos.length;

        // Crear producto
        const product = await prisma.product.create({
            data: {
                name: nombre,
                priceNormal: precioVenta,
                priceWholesale: precioMayor,
            },
        });

        // Generar SKU único basado en el ID del producto nuevo
        const productCode = product.id.slice(-6).toUpperCase();
        const sku = `${productCode}-UNI`;

        // Crear variante con stock
        const variant = await prisma.productVariant.create({
            data: {
                productId: product.id,
                size: "Único",
                color: "Único",
                sku,
                stock,
            },
        });

        // Registrar movimiento de stock inicial
        await prisma.stockMovement.create({
            data: {
                variantId: variant.id,
                quantity: stock,
                type: "INGRESO",
                notes: `Migración desde sistema anterior (id_articulo: ${prod.id_articulo})`,
            },
        });

        // Crear todos los aliases de una vez (más eficiente)
        await prisma.barcodeAlias.createMany({
            data: codigosActivos.map((barcode) => ({
                barcode,
                variantId: variant.id,
            })),
            skipDuplicates: true,
        });

        totalAliases += codigosActivos.length;
        creados++;

        if (creados % 50 === 0) {
            console.log(`  ✓ ${creados} productos migrados...`);
        }
    }

    console.log("\n✅ Migración completada:\n");
    console.log(`   Productos creados:      ${creados}`);
    console.log(`   Códigos alias creados:  ${totalAliases}`);
    console.log(`   Productos sin stock:    ${omitidos} (omitidos)`);
    console.log("");
}

main()
    .catch((e) => {
        console.error("❌ Error en la migración:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
