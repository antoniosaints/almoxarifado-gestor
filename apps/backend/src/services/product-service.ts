import type { PrismaClient } from "@prisma/client";
import { nextProductCode } from "./product-code.js";

export type ProductInput = {
  active: boolean;
  categoryId: string;
  description?: string | null;
  minimumQuantity?: number;
  name: string;
  unitId: string;
};

const productInclude = {
  category: true,
  unit: true,
} as const;

export async function createProduct(prisma: PrismaClient, input: ProductInput) {
  const lastProduct = await prisma.product.findFirst({
    orderBy: { code: "desc" },
    select: { code: true },
  });

  return prisma.product.create({
    data: {
      ...input,
      code: nextProductCode(lastProduct?.code),
    },
    include: productInclude,
  });
}

export async function updateProduct(
  prisma: PrismaClient,
  productId: string,
  input: ProductInput,
) {
  return prisma.product.update({
    where: { id: productId },
    data: input,
    include: productInclude,
  });
}
