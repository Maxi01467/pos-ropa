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

type CacheOptions = {
    revalidate?: number | false;
    tags?: string[];
};

export function unstable_cache<Args extends unknown[], Result>(
    cb: (...args: Args) => Promise<Result>,
    _keyParts?: string[],
    _options?: CacheOptions
): (...args: Args) => Promise<Result> {
    // Retornamos directamente la función para evitar chachés persistentes.
    // Esto fuerza la obtención en tiempo real desde la BD en cada llamada.
    void _keyParts;
    void _options;
    return cb;
}
