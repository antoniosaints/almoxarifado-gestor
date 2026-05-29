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

function writeTransaction<T>(
  prisma: PrismaWriter,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
) {
  if ("$transaction" in prisma) {
    return prisma.$transaction(operation);
  }

  return operation(prisma);
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
