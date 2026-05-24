import {
  MovementType,
  RequestStatus,
  type PrismaClient,
} from "@prisma/client";
import { AppError } from "../lib/errors.js";

type EntryRequestInput = {
  movementDate: Date;
  observation?: string | null;
  productId: string;
  quantity: number;
  requestedById: string;
  warehouseId: string;
};

type ApprovalInput = {
  invoiceId?: string | null;
  requestId: string;
  reviewedById: string;
};

function assertPositiveQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new AppError(400, "Informe uma quantidade maior que zero.");
  }
}

export async function createEntryRequest(
  prisma: PrismaClient,
  input: EntryRequestInput,
) {
  assertPositiveQuantity(input.quantity);

  const stock = await prisma.stock.findUnique({
    where: {
      warehouseId_productId: {
        productId: input.productId,
        warehouseId: input.warehouseId,
      },
    },
    select: {
      id: true,
    },
  });

  if (!stock) {
    throw new AppError(
      400,
      "Solicite apenas produtos ja cadastrados no estoque deste almoxarifado.",
    );
  }

  return prisma.entryRequest.create({
    data: {
      movementDate: input.movementDate,
      observation: input.observation,
      productId: input.productId,
      quantity: input.quantity,
      requestedById: input.requestedById,
      warehouseId: input.warehouseId,
    },
  });
}

export async function approveEntryRequest(
  prisma: PrismaClient,
  input: ApprovalInput,
) {
  return prisma.$transaction(async (transaction) => {
    const request = await transaction.entryRequest.findUniqueOrThrow({
      where: { id: input.requestId },
    });

    if (request.status !== RequestStatus.PENDING) {
      throw new AppError(409, "Esta solicitacao ja foi analisada.");
    }

    const generalWarehouse = await transaction.warehouse.findFirst({
      where: {
        active: true,
        isGeneral: true,
      },
    });

    if (!generalWarehouse) {
      throw new AppError(409, "Cadastre um almoxarifado geral ativo para aprovar.");
    }

    const generalStock = await transaction.stock.findUnique({
      where: {
        warehouseId_productId: {
          warehouseId: generalWarehouse.id,
          productId: request.productId,
        },
      },
    });

    if (!generalStock || generalStock.currentQuantity < request.quantity) {
      throw new AppError(409, "Quantidade insuficiente no estoque geral.");
    }

    const sourceStock = await transaction.stock.update({
      where: { id: generalStock.id },
      data: {
        currentQuantity: {
          decrement: request.quantity,
        },
        lastMovementAt: request.movementDate,
      },
    });

    const stock = await transaction.stock.upsert({
      where: {
        warehouseId_productId: {
          warehouseId: request.warehouseId,
          productId: request.productId,
        },
      },
      update: {
        currentQuantity: {
          increment: request.quantity,
        },
        lastMovementAt: request.movementDate,
      },
      create: {
        currentQuantity: request.quantity,
        lastMovementAt: request.movementDate,
        productId: request.productId,
        warehouseId: request.warehouseId,
      },
    });

    const sourceMovement = await transaction.stockMovement.create({
      data: {
        destinationWarehouseId: request.warehouseId,
        movementDate: request.movementDate,
        observation: request.observation,
        productId: request.productId,
        quantity: request.quantity,
        responsibleUserId: input.reviewedById,
        sourceWarehouseId: generalWarehouse.id,
        stockId: sourceStock.id,
        type: MovementType.TRANSFERENCIA_SAIDA,
        warehouseId: generalWarehouse.id,
      },
    });

    const movement = await transaction.stockMovement.create({
      data: {
        destinationWarehouseId: request.warehouseId,
        invoiceId: input.invoiceId,
        movementDate: request.movementDate,
        observation: request.observation,
        productId: request.productId,
        quantity: request.quantity,
        responsibleUserId: input.reviewedById,
        sourceWarehouseId: generalWarehouse.id,
        stockId: stock.id,
        type: MovementType.TRANSFERENCIA_ENTRADA,
        warehouseId: request.warehouseId,
      },
    });

    const approvedRequest = await transaction.entryRequest.update({
      where: { id: request.id },
      data: {
        reviewedAt: new Date(),
        reviewedById: input.reviewedById,
        status: RequestStatus.APPROVED,
      },
    });

    return {
      movement,
      request: approvedRequest,
      sourceMovement,
      sourceStock,
      stock,
    };
  });
}

export async function rejectEntryRequest(
  prisma: PrismaClient,
  requestId: string,
  reviewedById: string,
) {
  const request = await prisma.entryRequest.findUniqueOrThrow({
    where: { id: requestId },
  });

  if (request.status !== RequestStatus.PENDING) {
    throw new AppError(409, "Esta solicitacao ja foi analisada.");
  }

  return prisma.entryRequest.update({
    where: { id: request.id },
    data: {
      reviewedAt: new Date(),
      reviewedById,
      status: RequestStatus.REJECTED,
    },
  });
}
