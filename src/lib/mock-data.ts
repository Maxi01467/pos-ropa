export interface Product {
    id: string;
    code: string;
    name: string;
    price: number;
    costPrice?: number;
    stock: number;
    sizes: string[];
    color: string;
    category: string;
    providerId?: string;
}

export interface Provider {
    id: string;
    name: string;
    phone: string;
    notes: string;
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
        costPrice: 6200,
        stock: 25,
        sizes: ["S", "M", "L", "XL"],
        color: "Blanco",
        category: "Remeras",
        providerId: "prov-1",
    },
    {
        id: "2",
        code: "REM-002",
        name: "Remera Estampada Oversize",
        price: 18900,
        costPrice: 9500,
        stock: 15,
        sizes: ["M", "L", "XL"],
        color: "Negro",
        category: "Remeras",
        providerId: "prov-1",
    },
    {
        id: "3",
        code: "JEA-001",
        name: "Jean Recto Clásico",
        price: 35000,
        costPrice: 18000,
        stock: 10,
        sizes: ["36", "38", "40", "42"],
        color: "Azul",
        category: "Jeans",
        providerId: "prov-4",
    },
    {
        id: "4",
        code: "JEA-002",
        name: "Jean Mom Fit",
        price: 38500,
        costPrice: 19000,
        stock: 8,
        sizes: ["36", "38", "40"],
        color: "Celeste",
        category: "Jeans",
        providerId: "prov-4",
    },
    {
        id: "5",
        code: "CAM-001",
        name: "Campera de Jean",
        price: 45000,
        costPrice: 24000,
        stock: 5,
        sizes: ["S", "M", "L"],
        color: "Azul Oscuro",
        category: "Abrigos",
        providerId: "prov-4",
    },
    {
        id: "6",
        code: "BUZ-001",
        name: "Buzo Canguro Liso",
        price: 28000,
        costPrice: 14000,
        stock: 12,
        sizes: ["S", "M", "L", "XL"],
        color: "Gris",
        category: "Buzos",
        providerId: "prov-2",
    },
    {
        id: "7",
        code: "PAN-001",
        name: "Pantalón Cargo Wide",
        price: 32000,
        costPrice: 16000,
        stock: 7,
        sizes: ["S", "M", "L"],
        color: "Verde Militar",
        category: "Pantalones",
        providerId: "prov-2",
    },
    {
        id: "8",
        code: "VES-001",
        name: "Vestido Midi Floral",
        price: 29900,
        costPrice: 15000,
        stock: 6,
        sizes: ["S", "M", "L"],
        color: "Multicolor",
        category: "Vestidos",
        providerId: "prov-3",
    },
    {
        id: "9",
        code: "TOP-001",
        name: "Top Crop Costilla",
        price: 9800,
        costPrice: 4500,
        stock: 20,
        sizes: ["S", "M", "L"],
        color: "Rosa",
        category: "Tops",
        providerId: "prov-3",
    },
    {
        id: "10",
        code: "FAL-001",
        name: "Falda Plisada Mini",
        price: 22500,
        costPrice: 11000,
        stock: 9,
        sizes: ["S", "M", "L"],
        color: "Negro",
        category: "Faldas",
        providerId: "prov-3",
    },
    {
        id: "11",
        code: "CAM-002",
        name: "Camisa Lino Manga Larga",
        price: 27000,
        costPrice: 13500,
        stock: 11,
        sizes: ["S", "M", "L", "XL"],
        color: "Beige",
        category: "Camisas",
        providerId: "prov-1",
    },
    {
        id: "12",
        code: "SHO-001",
        name: "Short de Jean",
        price: 19500,
        costPrice: 9500,
        stock: 14,
        sizes: ["36", "38", "40"],
        color: "Celeste",
        category: "Shorts",
        providerId: "prov-4",
    },
];
