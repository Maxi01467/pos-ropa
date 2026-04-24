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

export function unstable_cache<TArgs extends unknown[], TResult>(
    cb: (...args: TArgs) => Promise<TResult>,
    _keyParts?: string[],
    _options?: {
        revalidate?: number | false;
        tags?: string[];
    }
): (...args: TArgs) => Promise<TResult> {
    void _keyParts;
    void _options;
    // Retornamos directamente la función para evitar chachés persistentes.
    // Esto fuerza la obtención en tiempo real desde la BD en cada llamada.
    return cb;
}
