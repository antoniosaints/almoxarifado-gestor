import type { Prisma, PrismaClient } from "@prisma/client";
import { AppError } from "../lib/errors.js";

type PrismaWriter = PrismaClient | Prisma.TransactionClient;

type ConversionRow = {
  active: boolean;
  factorToBase: Prisma.Decimal | number | string;
  fromUnitId: string;
};

type ProductWithConversions = {
  id: string;
  unitId: string;
  unitConversions: ConversionRow[];
};

export type ConvertedQuantity = {
  baseQuantity: number;
  baseUnitPrice: number | null;
  conversionFactor: number | null;
  sourceQuantity: number | null;
  sourceUnitId: string | null;
  sourceUnitPrice: number | null;
};

export const productUnitConversionInclude = {
  fromUnit: true,
} as const;

export const productConversionsInclude = {
  unitConversions: {
    include: productUnitConversionInclude,
    orderBy: { fromUnit: { abbreviation: "asc" } },
  },
} as const;

export function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value);
}

export function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isPositiveFinite(value: number) {
  return Number.isFinite(value) && value > 0;
}

function isIntegerQuantity(value: number) {
  return Number.isInteger(value);
}

function assertPositiveQuantity(quantity: number) {
  if (!isPositiveFinite(quantity)) {
    throw new AppError(400, "Informe uma quantidade maior que zero.");
  }
}

function assertBaseQuantity(quantity: number) {
  assertPositiveQuantity(quantity);

  if (!isIntegerQuantity(quantity)) {
    throw new AppError(400, "Informe uma quantidade inteira na unidade base.");
  }
}

function assertConversionFactor(factor: number) {
  if (!isPositiveFinite(factor)) {
    throw new AppError(400, "Informe um fator de conversão maior que zero.");
  }
}

function assertConvertedInteger(quantity: number) {
  if (!Number.isInteger(quantity)) {
    throw new AppError(
      400,
      "A conversão precisa resultar em uma quantidade inteira na unidade base.",
    );
  }
}

export function convertKnownProductQuantity(
  product: ProductWithConversions,
  input: {
    quantity: number;
    unitId?: string | null;
    unitPrice?: number | null;
  },
): ConvertedQuantity {
  const selectedUnitId = input.unitId?.trim() || null;
  const sourceQuantity = Number(input.quantity);
  const sourceUnitPrice =
    input.unitPrice === null || input.unitPrice === undefined
      ? null
      : Number(input.unitPrice);

  if (!selectedUnitId || selectedUnitId === product.unitId) {
    assertBaseQuantity(sourceQuantity);

    return {
      baseQuantity: sourceQuantity,
      baseUnitPrice:
        sourceUnitPrice === null ? null : roundCurrency(sourceUnitPrice),
      conversionFactor: null,
      sourceQuantity: null,
      sourceUnitId: null,
      sourceUnitPrice: null,
    };
  }

  assertPositiveQuantity(sourceQuantity);

  const conversion = product.unitConversions.find(
    (item) => item.active && item.fromUnitId === selectedUnitId,
  );

  if (!conversion) {
    throw new AppError(
      400,
      "Configure a conversão desta unidade no produto antes de movimentar.",
    );
  }

  const factor = toNumber(conversion.factorToBase);
  assertConversionFactor(factor);

  const converted = sourceQuantity * factor;
  const baseQuantity = Math.round(converted);
  assertConvertedInteger(converted);

  return {
    baseQuantity,
    baseUnitPrice:
      sourceUnitPrice === null ? null : roundCurrency(sourceUnitPrice / factor),
    conversionFactor: factor,
    sourceQuantity,
    sourceUnitId: selectedUnitId,
    sourceUnitPrice,
  };
}

export async function convertQuantityToBase(
  prisma: PrismaWriter,
  input: {
    productId: string;
    quantity: number;
    unitId?: string | null;
    unitPrice?: number | null;
  },
) {
  const product = await prisma.product.findUnique({
    include: {
      unitConversions: true,
    },
    where: { id: input.productId },
  });

  if (!product) {
    throw new AppError(404, "Produto não encontrado.");
  }

  return convertKnownProductQuantity(product, input);
}

export function conversionAuditData(conversion: ConvertedQuantity) {
  return {
    conversionFactor: conversion.conversionFactor,
    sourceQuantity: conversion.sourceQuantity,
    sourceUnitId: conversion.sourceUnitId,
    sourceUnitPrice: conversion.sourceUnitPrice,
  };
}

export function quantityConversionAuditData(conversion: ConvertedQuantity) {
  return {
    conversionFactor: conversion.conversionFactor,
    sourceQuantity: conversion.sourceQuantity,
    sourceUnitId: conversion.sourceUnitId,
  };
}
