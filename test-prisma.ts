import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    try {
        console.log("Connecting...");
        const session = await prisma.cashSession.findFirst({
            where: { status: "OPEN" },
            include: {
                openedBy: true,
                closedBy: true,
                countedBy: true,
                movements: { orderBy: { createdAt: "desc" as const } },
                sales: true,
            }
        });
        console.log("Session found:", session ? session.id : "null");
    } catch(e) {
        console.error("error finding session:", e);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}
main();
