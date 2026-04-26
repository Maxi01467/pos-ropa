import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/auth";

function buildLogoutResponse(request: NextRequest) {
    const response = NextResponse.redirect(new URL("/login?logged_out=1", request.url));

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

export function GET(request: NextRequest) {
    return buildLogoutResponse(request);
}

export function POST(request: NextRequest) {
    return buildLogoutResponse(request);
}
