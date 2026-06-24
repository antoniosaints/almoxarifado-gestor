import { MovementType, Prisma, type PrismaClient } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import {
  conversionAuditData,
  convertQuantityToBase,
  roundCurrency,
  toNumber,
} from "./unit-conversion-service.js";

type PrismaWriter = PrismaClient | Prisma.TransactionClient;

type BaseMovementInput = {
  movementDate: Date;
  observation?: string | null;
  productId: string;
  quantity: number;
  unitId?: string | null;
  userId: string;
};

export type EntryInput = BaseMovementInput & {
  invoiceId?: string | null;
  minimumQuantity?: number;
  unitPrice?: number | null;
  warehouseId: string;
};

export type OutputInput = BaseMovementInput & {
  destinationNote?: string | null;
  warehouseId: string;
};

export type DeleteStockMovementInput = {
  movementId: string;
  userId: string;
};

function writeTransaction<T>(
  prisma: PrismaWriter,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
) {
  if ("$transaction" in prisma) {
    return prisma.$transaction(operation);
  }

  return operation(prisma);
}

function isEntryType(type: MovementType) {
  return type === MovementType.ENTRADA || type === MovementType.TRANSFERENCIA_ENTRADA;
}

function isOutputType(type: MovementType) {
  return type === MovementType.SAIDA || type === MovementType.TRANSFERENCIA_SAIDA;
}

function movementValue(movement: { quantity: number; unitPrice: Prisma.Decimal | null }) {
  return roundCurrency(movement.quantity * toNumber(movement.unitPrice));
}

const movementDeletionInclude = {
  destinationWarehouse: true,
  invoice: true,
  product: true,
  sourceWarehouse: true,
  sourceUnit: true,
  warehouse: true,
} satisfies Prisma.StockMovementInclude;

function movementDeletionDetails(
  movement: Prisma.StockMovementGetPayload<{
    include: typeof movementDeletionInclude;
  }>,
) {
  return JSON.stringify({
    destinationNote: movement.destinationNote,
    destinationWarehouse: movement.destinationWarehouse
      ? {
          id: movement.destinationWarehouse.id,
          name: movement.destinationWarehouse.name,
        }
      : null,
    invoice: movement.invoice
      ? {
          id: movement.invoice.id,
          number: movement.invoice.number,
        }
      : null,
    movementDate: movement.movementDate,
    product: {
      code: movement.product.code,
      id: movement.product.id,
      name: movement.product.name,
    },
    quantity: movement.quantity,
    conversionFactor: movement.conversionFactor,
    sourceQuantity: movement.sourceQuantity,
    sourceUnit: movement.sourceUnit
      ? {
          abbreviation: movement.sourceUnit.abbreviation,
          id: movement.sourceUnit.id,
          name: movement.sourceUnit.name,
        }
      : null,
    sourceUnitPrice: movement.sourceUnitPrice,
    sourceWarehouse: movement.sourceWarehouse
      ? {
          id: movement.sourceWarehouse.id,
          name: movement.sourceWarehouse.name,
        }
      : null,
    stockId: movement.stockId,
    type: movement.type,
    unitPrice: movement.unitPrice,
    warehouse: {
      id: movement.warehouse.id,
      name: movement.warehouse.name,
    },
  });
}

async function findMovementStock(
  transaction: Prisma.TransactionClient,
  movement: { productId: string; stockId: string | null; warehouseId: string },
) {
  if (movement.stockId) {
    return transaction.stock.findUnique({
      where: { id: movement.stockId },
    });
  }

  return transaction.stock.findUnique({
    where: {
      warehouseId_productId: {
        productId: movement.productId,
        warehouseId: movement.warehouseId,
      },
    },
  });
}

async function latestRemainingMovementDate(
  transaction: Prisma.TransactionClient,
  movement: { id: string; productId: string; warehouseId: string },
) {
  const latestMovement = await transaction.stockMovement.findFirst({
    where: {
      id: { not: movement.id },
      productId: movement.productId,
      warehouseId: movement.warehouseId,
    },
    orderBy: { movementDate: "desc" },
    select: { movementDate: true },
  });

  return latestMovement?.movementDate ?? null;
}

export async function createEntry(prisma: PrismaWriter, input: EntryInput) {
  return writeTransaction(prisma, async (transaction) => {
    const converted = await convertQuantityToBase(transaction, {
      productId: input.productId,
      quantity: input.quantity,
      unitId: input.unitId,
      unitPrice: input.unitPrice,
    });
    const existingStock = await transaction.stock.findUnique({
      where: {
        warehouseId_productId: {
          warehouseId: input.warehouseId,
          productId: input.productId,
        },
      },
    });
    const entryUnitPrice =
      converted.baseUnitPrice === null || converted.baseUnitPrice === undefined
        ? 0
        : roundCurrency(converted.baseUnitPrice);
    const stock = existingStock
      ? await transaction.stock.update({
          where: { id: existingStock.id },
          data: (() => {
            const nextQuantity =
              existingStock.currentQuantity + converted.baseQuantity;
            const nextAverage = roundCurrency(
              (existingStock.currentQuantity * toNumber(existingStock.unitPriceAverage) +
                converted.baseQuantity * entryUnitPrice) /
                nextQuantity,
            );

            return {
              currentQuantity: nextQuantity,
              lastMovementAt: input.movementDate,
              totalValue: roundCurrency(nextQuantity * nextAverage),
              unitPriceAverage: nextAverage,
            };
          })(),
        })
      : await transaction.stock.create({
          data: {
            currentQuantity: converted.baseQuantity,
            lastMovementAt: input.movementDate,
            minimumQuantity: input.minimumQuantity ?? 0,
            productId: input.productId,
            totalValue: roundCurrency(converted.baseQuantity * entryUnitPrice),
            unitPriceAverage: entryUnitPrice,
            warehouseId: input.warehouseId,
          },
        });

    const movement = await transaction.stockMovement.create({
      data: {
        movementDate: input.movementDate,
        observation: input.observation,
        invoiceId: input.invoiceId,
        productId: input.productId,
        quantity: converted.baseQuantity,
        responsibleUserId: input.userId,
        stockId: stock.id,
        type: MovementType.ENTRADA,
        unitPrice: converted.baseUnitPrice,
        warehouseId: input.warehouseId,
        ...conversionAuditData(converted),
      },
    });

    return { movement, stock };
  });
}

export async function createOutput(prisma: PrismaWriter, input: OutputInput) {
  return writeTransaction(prisma, async (transaction) => {
    const converted = await convertQuantityToBase(transaction, {
      productId: input.productId,
      quantity: input.quantity,
      unitId: input.unitId,
    });
    const stock = await transaction.stock.findUnique({
      where: {
        warehouseId_productId: {
          warehouseId: input.warehouseId,
          productId: input.productId,
        },
      },
    });

    if (!stock || stock.currentQuantity < converted.baseQuantity) {
      throw new AppError(409, "Quantidade insuficiente em estoque.");
    }

    const updatedStock = await transaction.stock.update({
      where: { id: stock.id },
      data: {
        currentQuantity: stock.currentQuantity - converted.baseQuantity,
        lastMovementAt: input.movementDate,
        totalValue: roundCurrency(
          (stock.currentQuantity - converted.baseQuantity) *
            toNumber(stock.unitPriceAverage),
        ),
      },
    });

    const movement = await transaction.stockMovement.create({
      data: {
        destinationNote: input.destinationNote,
        movementDate: input.movementDate,
        observation: input.observation,
        productId: input.productId,
        quantity: converted.baseQuantity,
        responsibleUserId: input.userId,
        stockId: stock.id,
        type: MovementType.SAIDA,
        warehouseId: input.warehouseId,
        ...conversionAuditData(converted),
      },
    });

    return { movement, stock: updatedStock };
  });
}

export async function deleteStockMovement(
  prisma: PrismaWriter,
  input: DeleteStockMovementInput,
) {
  return writeTransaction(prisma, async (transaction) => {
    const movement = await transaction.stockMovement.findUniqueOrThrow({
      where: { id: input.movementId },
      include: movementDeletionInclude,
    });
    const stock = await findMovementStock(transaction, movement);

    if (!stock) {
      throw new AppError(404, "Estoque da movimentacao nao encontrado.");
    }

    const quantityDelta = isEntryType(movement.type)
      ? -movement.quantity
      : movement.quantity;
    const nextQuantity = stock.currentQuantity + quantityDelta;

    if (!isEntryType(movement.type) && !isOutputType(movement.type)) {
      throw new AppError(400, "Tipo de movimentacao nao suportado para exclusao.");
    }

    if (nextQuantity < 0) {
      throw new AppError(
        409,
        "Nao e possivel excluir esta movimentacao porque a reversao geraria estoque negativo.",
      );
    }

    const currentAverage = toNumber(stock.unitPriceAverage);
    const currentTotal = toNumber(stock.totalValue);
    const nextTotalValue =
      movement.type === MovementType.SAIDA
        ? roundCurrency(nextQuantity * currentAverage)
        : movement.type === MovementType.TRANSFERENCIA_SAIDA
          ? roundCurrency(currentTotal)
          : nextQuantity === 0
            ? 0
            : Math.max(0, roundCurrency(currentTotal - movementValue(movement)));
    const nextUnitPriceAverage =
      isEntryType(movement.type) && nextQuantity > 0
        ? roundCurrency(nextTotalValue / nextQuantity)
        : nextQuantity === 0
          ? 0
          : currentAverage;
    const lastMovementAt = await latestRemainingMovementDate(transaction, movement);

    const updatedStock = await transaction.stock.update({
      where: { id: stock.id },
      data: {
        currentQuantity: nextQuantity,
        lastMovementAt,
        totalValue: nextTotalValue,
        unitPriceAverage: nextUnitPriceAverage,
      },
    });

    await transaction.auditLog.create({
      data: {
        action: "DELETE",
        details: movementDeletionDetails(movement),
        entity: "StockMovement",
        entityId: movement.id,
        userId: input.userId,
      },
    });

    await transaction.stockMovement.delete({ where: { id: movement.id } });

    return { movement, stock: updatedStock };
  });
}
