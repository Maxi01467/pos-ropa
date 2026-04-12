import { createSign } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";

// In production (e.g. Vercel), provide the full PEM contents via QZ_PRIVATE_KEY.
// For local development, the key can still be loaded from /private/qz/private-key.pem.
const PRIVATE_KEY_PATH = join(process.cwd(), "private", "qz", "private-key.pem");

function getPrivateKey(): string | null {
    const envKey = process.env.QZ_PRIVATE_KEY;
    if (envKey && envKey.trim().length > 0) {
        // Vercel env vars may store literal "\n" sequences instead of real newlines.
        return envKey.replace(/\\n/g, "\n");
    }

    try {
        return readFileSync(PRIVATE_KEY_PATH, "utf8");
    } catch {
        return null;
    }
}

export async function GET(request: NextRequest) {
    const message = request.nextUrl.searchParams.get("request");

    if (!message) {
        return new NextResponse("Missing 'request' query parameter", { status: 400 });
    }

    const privateKey = getPrivateKey();
    if (!privateKey) {
        return new NextResponse(
            "QZ private key not found. Set QZ_PRIVATE_KEY or place private-key.pem in /private/qz/",
            { status: 500 }
        );
    }

    try {
        const sign = createSign("SHA512");
        sign.update(message);
        sign.end();
        const signature = sign.sign(privateKey, "base64");
        return new NextResponse(signature, {
            headers: { "Content-Type": "text/plain" },
        });
    } catch (error) {
        console.error("QZ signing error:", error);
        return new NextResponse("Signing failed", { status: 500 });
    }
}
