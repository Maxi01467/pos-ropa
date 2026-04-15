export const CACHE_TAGS = {
  attendance: "attendance",
  cash: "cash",
  employees: "employees",
  inventory: "inventory",
  posProducts: "pos-products",
  posSellers: "pos-sellers",
  quickCreations: "quick-creations",
  sales: "sales",
  stock: "stock",
  suppliers: "suppliers",
} as const;

export function unstable_cache<T extends (...args: any[]) => Promise<any>>(
    cb: T,
    keyParts?: string[],
    options?: {
        revalidate?: number | false;
        tags?: string[];
    }
): T {
    // Retornamos directamente la función para evitar chachés persistentes.
    // Esto fuerza la obtención en tiempo real desde la BD en cada llamada.
    return cb;
}
