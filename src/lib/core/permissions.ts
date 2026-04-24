export type SessionRole = "ADMIN" | "STAFF";

export const STAFF_ALLOWED_PATHS = ["/nueva-venta", "/caja", "/asistencia"] as const;

function isDesktopOnlyPath(pathname: string) {
    return pathname === "/reportes" || pathname.startsWith("/reportes/");
}

export function getStoredRole(rawRole: string | null, rawUser: string | null): SessionRole {
    if (rawRole === "ADMIN" || rawRole === "STAFF") {
        return rawRole;
    }

    return rawUser?.toLowerCase().trim() === "admin" ? "ADMIN" : "STAFF";
}

export function canAccessPath(
    role: SessionRole,
    pathname: string,
    options?: {
        isDesktop?: boolean;
    }
): boolean {
    const isDesktop = options?.isDesktop === true;

    if (isDesktopOnlyPath(pathname) && !isDesktop) {
        return false;
    }

    if (role === "ADMIN") return true;
    return STAFF_ALLOWED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
