import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/auth";

function clearAuthCookie(response: NextResponse) {
    response.cookies.set(AUTH_COOKIE_NAME, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production" && process.env.POS_DESKTOP !== "1",
        path: "/",
        maxAge: 0,
        expires: new Date(0),
    });

    return response;
}

function buildLogoutResponse(request: NextRequest) {
    return clearAuthCookie(NextResponse.redirect(new URL("/login?logged_out=1", request.url)));
}

export function GET(request: NextRequest) {
    return buildLogoutResponse(request);
}

export function POST() {
    return clearAuthCookie(new NextResponse(null, { status: 204 }));
}
