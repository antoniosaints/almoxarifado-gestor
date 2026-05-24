import { MovementType, Prisma, type PrismaClient } from "@prisma/client";
import { AppError } from "../lib/errors.js";

type PrismaWriter = PrismaClient | Prisma.TransactionClient;

type BaseMovementInput = {
  movementDate: Date;
  observation?: string | null;
  productId: string;
  quantity: number;
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

function assertPositiveQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new AppError(400, "Informe uma quantidade maior que zero.");
  }
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value);
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

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
  assertPositiveQuantity(input.quantity);

  return writeTransaction(prisma, async (transaction) => {
    const existingStock = await transaction.stock.findUnique({
      where: {
        warehouseId_productId: {
          warehouseId: input.warehouseId,
          productId: input.productId,
        },
      },
    });
    const entryUnitPrice =
      input.unitPrice === null || input.unitPrice === undefined
        ? 0
        : roundCurrency(input.unitPrice);
    const stock = existingStock
      ? await transaction.stock.update({
          where: { id: existingStock.id },
          data: (() => {
            const nextQuantity = existingStock.currentQuantity + input.quantity;
            const nextAverage = roundCurrency(
              (existingStock.currentQuantity * toNumber(existingStock.unitPriceAverage) +
                input.quantity * entryUnitPrice) /
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
            currentQuantity: input.quantity,
            lastMovementAt: input.movementDate,
            minimumQuantity: input.minimumQuantity ?? 0,
            productId: input.productId,
            totalValue: roundCurrency(input.quantity * entryUnitPrice),
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
        quantity: input.quantity,
        responsibleUserId: input.userId,
        stockId: stock.id,
        type: MovementType.ENTRADA,
        unitPrice: input.unitPrice,
        warehouseId: input.warehouseId,
      },
    });

    return { movement, stock };
  });
}

export async function createOutput(prisma: PrismaWriter, input: OutputInput) {
  assertPositiveQuantity(input.quantity);

  return writeTransaction(prisma, async (transaction) => {
    const stock = await transaction.stock.findUnique({
      where: {
        warehouseId_productId: {
          warehouseId: input.warehouseId,
          productId: input.productId,
        },
      },
    });

    if (!stock || stock.currentQuantity < input.quantity) {
      throw new AppError(409, "Quantidade insuficiente em estoque.");
    }

    const updatedStock = await transaction.stock.update({
      where: { id: stock.id },
      data: {
        currentQuantity: stock.currentQuantity - input.quantity,
        lastMovementAt: input.movementDate,
        totalValue: roundCurrency(
          (stock.currentQuantity - input.quantity) * toNumber(stock.unitPriceAverage),
        ),
      },
    });

    const movement = await transaction.stockMovement.create({
      data: {
        destinationNote: input.destinationNote,
        movementDate: input.movementDate,
        observation: input.observation,
        productId: input.productId,
        quantity: input.quantity,
        responsibleUserId: input.userId,
        stockId: stock.id,
        type: MovementType.SAIDA,
        warehouseId: input.warehouseId,
      },
    });

    return { movement, stock: updatedStock };
  });
}
