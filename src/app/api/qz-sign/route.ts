import { createSign } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";

// The private key lives outside the public directory so it's never served directly.
// Place private-key.pem in: <project_root>/private/qz/private-key.pem
const PRIVATE_KEY_PATH = join(process.cwd(), "private", "qz", "private-key.pem");

export async function GET(request: NextRequest) {
    const message = request.nextUrl.searchParams.get("request");

    if (!message) {
        return new NextResponse("Missing 'request' query parameter", { status: 400 });
    }

    let privateKey: string;
    try {
        privateKey = readFileSync(PRIVATE_KEY_PATH, "utf8");
    } catch {
        return new NextResponse(
            "Private key not found. Place private-key.pem in /private/qz/",
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
