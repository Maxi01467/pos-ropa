export interface Product {
    id: string;
    code: string;
    name: string;
    price: number;
    wholesalePrice: number;
    costPrice?: number;
    category: string;
    providerId?: string;
    createdAt: string;
    stock: number;
    color: string;
    sizes: string[];
}

export interface Provider {
    id: string;
    name: string;
    phone: string;
    notes: string;
}

export interface StockEntry {
    id: string;
    productId: string;
    providerId?: string;
    quantity: number;
    color: string;
    size: string;
    sku: string;
    date: string;
    mode: "simple" | "avanzado";
}

export const mockCategories = [
    "Remeras",
    "Jeans",
    "Pantalones",
    "Abrigos",
    "Buzos",
    "Vestidos",
    "Tops",
    "Faldas",
    "Camisas",
    "Shorts",
    "Accesorios",
];

export const mockSizes = ["XS", "S", "M", "L", "XL", "XXL", "28", "30", "32", "34", "36", "38", "40", "42", "44"];

export const mockProviders: Provider[] = [
    {
        id: "prov-1",
        name: "Textiles del Sur",
        phone: "1155443322",
        notes: "Viene los martes. Acepta cambios dentro de los 15 días.",
    },
    {
        id: "prov-2",
        name: "Distribuidora López",
        phone: "1144332211",
        notes: "Solo envío a domicilio. Mínimo 10 prendas por pedido.",
    },
    {
        id: "prov-3",
        name: "María Confecciones",
        phone: "",
        notes: "Ropa artesanal. Pedido con 1 semana de anticipación.",
    },
    {
        id: "prov-4",
        name: "Importadora Central",
        phone: "1166778899",
        notes: "Jeans y camperas importadas. Pago 50% adelanto.",
    },
];

export const mockProducts: Product[] = [
    {
        id: "1",
        code: "REM-001",
        name: "Remera Lisa Algodón",
        price: 12500,
        wholesalePrice: 7440,
        costPrice: 6200,
        category: "Remeras",
        providerId: "prov-1",
        createdAt: "2026-02-15",
        stock: 10,
        color: "",
        sizes: [],
    },
    {
        id: "2",
        code: "REM-002",
        name: "Remera Estampada Oversize",
        price: 18900,
        wholesalePrice: 11400,
        costPrice: 9500,
        category: "Remeras",
        providerId: "prov-1",
        createdAt: "2026-02-15",
        stock: 10,
        color: "",
        sizes: [],
    },
    {
        id: "3",
        code: "JEA-001",
        name: "Jean Recto Clásico",
        price: 35000,
        wholesalePrice: 21600,
        costPrice: 18000,
        category: "Jeans",
        providerId: "prov-4",
        createdAt: "2026-02-20",
        stock: 10,
        color: "",
        sizes: [],
    },
    {
        id: "4",
        code: "JEA-002",
        name: "Jean Mom Fit",
        price: 38500,
        wholesalePrice: 22800,
        costPrice: 19000,
        category: "Jeans",
        providerId: "prov-4",
        createdAt: "2026-02-20",
        stock: 10,
        color: "",
        sizes: [],
    },
    {
        id: "5",
        code: "CAM-001",
        name: "Campera de Jean",
        price: 45000,
        wholesalePrice: 28800,
        costPrice: 24000,
        category: "Abrigos",
        providerId: "prov-4",
        createdAt: "2026-02-22",
        stock: 10,
        color: "",
        sizes: [],
    },
    {
        id: "6",
        code: "BUZ-001",
        name: "Buzo Canguro Liso",
        price: 28000,
        wholesalePrice: 16800,
        costPrice: 14000,
        category: "Buzos",
        providerId: "prov-2",
        createdAt: "2026-02-25",
        stock: 10,
        color: "",
        sizes: [],
    },
    {
        id: "7",
        code: "PAN-001",
        name: "Pantalón Cargo Wide",
        price: 32000,
        wholesalePrice: 19200,
        costPrice: 16000,
        category: "Pantalones",
        providerId: "prov-2",
        createdAt: "2026-02-28",
        stock: 10,
        color: "",
        sizes: [],
    },
    {
        id: "8",
        code: "VES-001",
        name: "Vestido Midi Floral",
        price: 29900,
        wholesalePrice: 18000,
        costPrice: 15000,
        category: "Vestidos",
        providerId: "prov-3",
        createdAt: "2026-03-01",
        stock: 10,
        color: "",
        sizes: [],
    },
    {
        id: "9",
        code: "TOP-001",
        name: "Top Crop Costilla",
        price: 9800,
        wholesalePrice: 5400,
        costPrice: 4500,
        category: "Tops",
        providerId: "prov-3",
        createdAt: "2026-03-01",
        stock: 10,
        color: "",
        sizes: [],
    },
    {
        id: "10",
        code: "FAL-001",
        name: "Falda Plisada Mini",
        price: 22500,
        wholesalePrice: 13200,
        costPrice: 11000,
        category: "Faldas",
        providerId: "prov-3",
        createdAt: "2026-03-02",
        stock: 10,
        color: "",
        sizes: [],
    },
    {
        id: "11",
        code: "CAM-002",
        name: "Camisa Lino Manga Larga",
        price: 27000,
        wholesalePrice: 16200,
        costPrice: 13500,
        category: "Camisas",
        providerId: "prov-1",
        createdAt: "2026-03-03",
        stock: 10,
        color: "",
        sizes: [],
    },
    {
        id: "12",
        code: "SHO-001",
        name: "Short de Jean",
        price: 19500,
        wholesalePrice: 11400,
        costPrice: 9500,
        category: "Shorts",
        providerId: "prov-4",
        createdAt: "2026-03-04",
        stock: 10,
        color: "",
        sizes: [],
    },
];

export const mockStockEntries: StockEntry[] = [
    {
        id: "se-1",
        productId: "1",
        providerId: "prov-1",
        quantity: 10,
        color: "Único",
        size: "Único",
        sku: "REM-001-UNI",
        date: "2026-03-04T10:30:00",
        mode: "simple",
    },
    {
        id: "se-2",
        productId: "1",
        providerId: "prov-1",
        quantity: 5,
        color: "Blanco",
        size: "S",
        sku: "REM-001-BLA-S",
        date: "2026-03-05T14:00:00",
        mode: "avanzado",
    },
    {
        id: "se-3",
        productId: "1",
        providerId: "prov-1",
        quantity: 7,
        color: "Blanco",
        size: "M",
        sku: "REM-001-BLA-M",
        date: "2026-03-05T14:00:00",
        mode: "avanzado",
    },
    {
        id: "se-4",
        productId: "3",
        providerId: "prov-4",
        quantity: 4,
        color: "Azul",
        size: "38",
        sku: "JEA-001-AZU-38",
        date: "2026-03-05T16:15:00",
        mode: "avanzado",
    },
    {
        id: "se-5",
        productId: "3",
        providerId: "prov-4",
        quantity: 3,
        color: "Azul",
        size: "40",
        sku: "JEA-001-AZU-40",
        date: "2026-03-05T16:15:00",
        mode: "avanzado",
    },
    {
        id: "se-6",
        productId: "6",
        providerId: "prov-2",
        quantity: 12,
        color: "Único",
        size: "Único",
        sku: "BUZ-001-UNI",
        date: "2026-03-06T09:00:00",
        mode: "simple",
    },
    {
        id: "se-7",
        productId: "9",
        providerId: "prov-3",
        quantity: 8,
        color: "Único",
        size: "Único",
        sku: "TOP-001-UNI",
        date: "2026-03-06T11:30:00",
        mode: "simple",
    },
    {
        id: "se-8",
        productId: "5",
        providerId: "prov-4",
        quantity: 2,
        color: "Azul Oscuro",
        size: "M",
        sku: "CAM-001-AOS-M",
        date: "2026-03-06T14:45:00",
        mode: "avanzado",
    },
    {
        id: "se-9",
        productId: "5",
        providerId: "prov-4",
        quantity: 3,
        color: "Azul Oscuro",
        size: "L",
        sku: "CAM-001-AOS-L",
        date: "2026-03-06T14:45:00",
        mode: "avanzado",
    },
];
