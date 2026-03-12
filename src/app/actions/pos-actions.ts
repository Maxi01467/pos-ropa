// src/app/actions/pos-actions.ts
"use server";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getSellers() {
    const users = await prisma.user.findMany({
        where: {
            active: true,
        },
        select: {
            id: true,
            name: true,
            role: true,
        },
        orderBy: { name: 'asc' }
    });
    return users;
}

export async function getProductsForPOS() {
  const products = await prisma.product.findMany({
    include: {
      variants: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return products.flatMap((product) => {
    if (product.variants.length === 0) {
      return [
        {
          id: product.id,
          code: product.id.slice(-6).toUpperCase(),
          name: product.name,
          price: Number(product.priceNormal),
          wholesalePrice: Number(product.priceWholesale),
          stock: 0,
          sizes: [],
          color: "",
          productId: product.id,
        },
      ];
    }

    return product.variants.map((variant) => ({
      id: variant.id,
      code: variant.sku,
      name: `${product.name} - Talle ${variant.size}`,
      price: Number(product.priceNormal),
      wholesalePrice: Number(product.priceWholesale),
      stock: variant.stock,
      sizes: [variant.size],
      color: variant.color,
      productId: product.id,
    }));
  });
}
