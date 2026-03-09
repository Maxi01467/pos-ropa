// src/app/actions/pos-actions.ts
"use server";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getProductsForPOS() {
  // Traemos todas las variantes e incluimos los datos de su producto padre
  const variants = await prisma.productVariant.findMany({
    include: {
      product: true,
    },
    // Opcional: Solo traer las que tengan stock > 0
    // where: { stock: { gt: 0 } } 
  });

  // Mapeamos los datos de Prisma al formato exacto que espera tu UI
  return variants.map((v) => ({
    id: v.id, // ID de la variante (vital para el lector de código de barras)
    code: v.sku, 
    name: `${v.product.name} - Talle ${v.size}`, // Ej: "Pantalón Cargo - Talle 38"
    // Convertimos de Prisma Decimal a Number normal para el frontend
    price: Number(v.product.priceNormal),
    wholesalePrice: Number(v.product.priceWholesale),
    stock: v.stock,
    sizes: [v.size], 
    color: v.color,
    category: v.product.category || "General",
    productId: v.productId,
  }));
}