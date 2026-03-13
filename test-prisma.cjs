const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function serializeCashSession(session) {
    return {
        id: session.id,
        openedById: session.openedById,
        closedById: session.closedById,
        countedById: session.countedById,
        status: session.status,
        openingDate: session.openingDate.toISOString(),
        closingDate: session.closingDate !== null ? session.closingDate.toISOString() : null,
        countingDate: session.countingDate !== null ? session.countingDate.toISOString() : null,
        initialAmount: Number(session.initialAmount),
        expectedAmount: session.expectedAmount == null ? null : Number(session.expectedAmount),
        actualAmount: session.actualAmount == null ? null : Number(session.actualAmount),
        difference: session.difference == null ? null : Number(session.difference),
        openedBy: session.openedBy
            ? { id: session.openedBy.id, name: session.openedBy.name, role: session.openedBy.role }
            : null,
        closedBy: session.closedBy
            ? { id: session.closedBy.id, name: session.closedBy.name, role: session.closedBy.role }
            : null,
        countedBy: session.countedBy
            ? { id: session.countedBy.id, name: session.countedBy.name, role: session.countedBy.role }
            : null,
        movements: session.movements.map((m) => ({
            id: m.id,
            sessionId: m.sessionId,
            amount: Number(m.amount),
            type: m.type,
            reason: m.reason,
            createdAt: m.createdAt.toISOString(),
        })),
        sales: session.sales.map((sale) => ({
            id: sale.id,
            ticketNumber: sale.ticketNumber,
            total: Number(sale.total),
            paymentMethod: sale.paymentMethod,
            cashAmount: sale.cashAmount == null ? null : Number(sale.cashAmount),
            transferAmount: sale.transferAmount == null ? null : Number(sale.transferAmount),
            createdAt: sale.createdAt.toISOString(),
            userId: sale.userId,
        })),
    };
}

async function main() {
    try {
        console.log("Connecting...");
        const session = await prisma.cashSession.findFirst({
            where: { status: "OPEN" },
            include: {
                openedBy: true,
                closedBy: true,
                countedBy: true,
                movements: { orderBy: { createdAt: "desc" } },
                sales: true,
            }
        });
        console.log("Session found:", session ? session.id : "null");
        if (session) {
            console.log("Serializing...");
            const serialized = serializeCashSession(session);
            console.log("Success! Keys:", Object.keys(serialized).join(", "));
        }
    } catch(e) {
        console.error("error finding or serializing session:", e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
