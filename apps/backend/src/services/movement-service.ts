import { MovementType, type PrismaClient } from "@prisma/client";
import { AppError } from "../lib/errors.js";

type BaseMovementInput = {
  movementDate: Date;
  observation?: string | null;
  productId: string;
  quantity: number;
  userId: string;
};

export type EntryInput = BaseMovementInput & {
  invoiceId?: string | null;
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

export async function createEntry(prisma: PrismaClient, input: EntryInput) {
  assertPositiveQuantity(input.quantity);

  return prisma.$transaction(async (transaction) => {
    const stock = await transaction.stock.upsert({
      where: {
        warehouseId_productId: {
          warehouseId: input.warehouseId,
          productId: input.productId,
        },
      },
      update: {
        currentQuantity: {
          increment: input.quantity,
        },
        lastMovementAt: input.movementDate,
      },
      create: {
        currentQuantity: input.quantity,
        lastMovementAt: input.movementDate,
        productId: input.productId,
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
        type: MovementType.ENTRADA,
        unitPrice: input.unitPrice,
        warehouseId: input.warehouseId,
      },
    });

    return { movement, stock };
  });
}

export async function createOutput(prisma: PrismaClient, input: OutputInput) {
  assertPositiveQuantity(input.quantity);

  return prisma.$transaction(async (transaction) => {
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
        currentQuantity: {
          decrement: input.quantity,
        },
        lastMovementAt: input.movementDate,
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
        type: MovementType.SAIDA,
        warehouseId: input.warehouseId,
      },
    });

    return { movement, stock: updatedStock };
  });
}
