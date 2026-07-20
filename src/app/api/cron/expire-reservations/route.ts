import { type NextRequest, NextResponse } from "next/server";
import { expireReservations } from "@/app/actions/reservations/reservations-actions";

/**
 * GET /api/cron/expire-reservations
 *
 * Expira las reservas vencidas. Diseñado para llamarse desde un cron externo
 * (Vercel Cron, un scheduler, o una llamada interna periódica).
 *
 * Seguridad: requiere el header Authorization: Bearer <CRON_SECRET> o que
 * la variable CRON_SECRET no esté definida (desarrollo local).
 */
export async function GET(request: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (secret) {
        const authHeader = request.headers.get("authorization");
        if (authHeader !== `Bearer ${secret}`) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
    }

    const result = await expireReservations();

    if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
        ok: true,
        expiredCount: result.expiredCount,
        expiredNumbers: result.expiredNumbers,
    });
}
