import type { PrismaClient } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { nextProductCode } from "./product-code.js";
import {
  productConversionsInclude,
  productUnitConversionInclude,
  toNumber,
} from "./unit-conversion-service.js";

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
  ...productConversionsInclude,
} as const;

export type UnitConversionInput = {
  active: boolean;
  factorToBase: number;
  fromUnitId: string;
};

function assertPositiveFactor(factorToBase: number) {
  if (!Number.isFinite(factorToBase) || factorToBase <= 0) {
    throw new AppError(400, "Informe um fator de conversão maior que zero.");
  }
}

async function assertCanChangeBaseUnit(
  prisma: PrismaClient,
  productId: string,
  nextUnitId: string,
) {
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
  });

  if (product.unitId === nextUnitId) {
    return;
  }

  const [
    stocks,
    movements,
    entryRequests,
    entryRequestItems,
    transferRequests,
    conversions,
  ] = await Promise.all([
    prisma.stock.count({ where: { productId } }),
    prisma.stockMovement.count({ where: { productId } }),
    prisma.entryRequest.count({ where: { productId } }),
    prisma.entryRequestItem.count({ where: { productId } }),
    prisma.transferRequest.count({ where: { productId } }),
    prisma.unitConversion.count({ where: { productId } }),
  ]);

  if (
    stocks ||
    movements ||
    entryRequests ||
    entryRequestItems ||
    transferRequests ||
    conversions
  ) {
    throw new AppError(
      409,
      "Não é possível alterar a unidade base de um produto com histórico ou estoque.",
    );
  }
}

async function assertConversionInput(
  prisma: PrismaClient,
  productId: string,
  input: UnitConversionInput,
) {
  assertPositiveFactor(toNumber(input.factorToBase));

  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
  });

  if (product.unitId === input.fromUnitId) {
    throw new AppError(
      400,
      "A unidade convertida deve ser diferente da unidade base do produto.",
    );
  }

  await prisma.unitOfMeasure.findUniqueOrThrow({
    where: { id: input.fromUnitId },
  });
}

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
  await assertCanChangeBaseUnit(prisma, productId, input.unitId);

  return prisma.product.update({
    where: { id: productId },
    data: input,
    include: productInclude,
  });
}

export async function createUnitConversion(
  prisma: PrismaClient,
  productId: string,
  input: UnitConversionInput,
) {
  await assertConversionInput(prisma, productId, input);

  return prisma.unitConversion.create({
    data: {
      active: input.active,
      factorToBase: input.factorToBase,
      fromUnitId: input.fromUnitId,
      productId,
    },
    include: productUnitConversionInclude,
  });
}

export async function updateUnitConversion(
  prisma: PrismaClient,
  productId: string,
  conversionId: string,
  input: UnitConversionInput,
) {
  await assertConversionInput(prisma, productId, input);
  await prisma.unitConversion.findFirstOrThrow({
    where: {
      id: conversionId,
      productId,
    },
  });

  return prisma.unitConversion.update({
    data: {
      active: input.active,
      factorToBase: input.factorToBase,
      fromUnitId: input.fromUnitId,
    },
    include: productUnitConversionInclude,
    where: { id: conversionId },
  });
}

export async function deleteUnitConversion(
  prisma: PrismaClient,
  productId: string,
  conversionId: string,
) {
  await prisma.unitConversion.findFirstOrThrow({
    where: {
      id: conversionId,
      productId,
    },
  });

  await prisma.unitConversion.delete({ where: { id: conversionId } });
}
