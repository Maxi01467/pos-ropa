export type SessionRole = "ADMIN" | "STAFF";

export const STAFF_ALLOWED_PATHS = ["/nueva-venta", "/caja", "/asistencia"] as const;

function normalizePath(pathname: string) {
    return pathname.split(/[?#]/, 1)[0] || "/";
}

function isDesktopOnlyPath(pathname: string) {
    const path = normalizePath(pathname);

    return (
        path === "/nueva-venta" ||
        path.startsWith("/nueva-venta/") ||
        path === "/reportes" ||
        path.startsWith("/reportes/")
    );
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
    const path = normalizePath(pathname);

    if (isDesktopOnlyPath(path) && !isDesktop) {
        return false;
    }

    if (role === "ADMIN") return true;

    return STAFF_ALLOWED_PATHS.some((allowedPath) => path === allowedPath || path.startsWith(`${allowedPath}/`));
}

export function getDefaultPathForRole(role: SessionRole, options?: { isDesktop?: boolean }) {
    if (role === "ADMIN") {
        return "/";
    }

    return options?.isDesktop === true ? "/nueva-venta" : "/caja";
}
