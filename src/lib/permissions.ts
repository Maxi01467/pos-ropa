export type SessionRole = "ADMIN" | "STAFF";

export const STAFF_ALLOWED_PATHS = ["/nueva-venta", "/caja"] as const;

export function getStoredRole(rawRole: string | null, rawUser: string | null): SessionRole {
    if (rawRole === "ADMIN" || rawRole === "STAFF") {
        return rawRole;
    }

    return rawUser?.toLowerCase().trim() === "admin" ? "ADMIN" : "STAFF";
}

export function canAccessPath(role: SessionRole, pathname: string): boolean {
    if (role === "ADMIN") return true;
    return STAFF_ALLOWED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
