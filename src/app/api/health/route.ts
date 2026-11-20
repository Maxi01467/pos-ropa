import { NextResponse } from "next/server";

/**
 * Endpoint de health check ultra-liviano.
 * Solo verifica que el servidor Next.js está corriendo y responde.
 * No toca la base de datos para no agregar latencia.
 * Usado por el cliente para detectar conectividad real (vs navigator.onLine
 * que solo indica si hay red local, no si el servidor es alcanzable).
 */
export async function GET() {
    return NextResponse.json({ ok: true }, { status: 200 });
}
