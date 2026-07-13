import { PrismaClient } from "@prisma/client";
import { barcodeFromTicketNumber } from "../src/lib/printing/barcodes";

async function main() {
    const prisma = new PrismaClient();
    try {
        const sales = await prisma.sale.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                ticketNumber: true,
                total: true,
                createdAt: true,
            }
        });
        console.log("SALES WITH BARCODES:");
        const salesWithBarcodes = sales.map(s => ({
            ...s,
            barcode: barcodeFromTicketNumber(s.ticketNumber)
        }));
        console.log(JSON.stringify(salesWithBarcodes, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
