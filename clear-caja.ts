import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("🧹 Borrando registros de caja y ventas...");

    // Se borran en orden para no violar restricciones de clave foránea
    const deletedSaleItems = await prisma.saleItem.deleteMany();
    console.log(`- ${deletedSaleItems.count} ítems de venta eliminados.`);

    const deletedSales = await prisma.sale.deleteMany();
    console.log(`- ${deletedSales.count} ventas eliminadas.`);

    const deletedMovements = await prisma.cashMovement.deleteMany();
    console.log(`- ${deletedMovements.count} movimientos de caja eliminados.`);

    const deletedSessions = await prisma.cashSession.deleteMany();
    console.log(`- ${deletedSessions.count} sesiones de caja eliminadas.`);

    console.log("✅ Limpieza completada con éxito.");
}

main()
    .catch((e) => {
        console.error("❌ Error al limpiar base de datos:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });