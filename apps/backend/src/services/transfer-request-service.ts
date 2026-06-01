import {
  MovementType,
  TransferRequestStatus,
  type PrismaClient,
} from "@prisma/client";
import { AppError } from "../lib/errors.js";
import {
  convertQuantityToBase,
  quantityConversionAuditData,
} from "./unit-conversion-service.js";

type TransferRequestInput = {
  createdById: string;
  destinationWarehouseId: string;
  movementDate: Date;
  observation?: string | null;
  productId: string;
  quantity: number;
  sourceWarehouseId: string;
  unitId?: string | null;
};

type ReceiveTransferInput = {
  receivedAt?: Date;
  receivedById: string;
  requestId: string;
};

type CancelTransferInput = {
  cancelledById: string;
  requestId: string;
};

function assertTransferInput(input: {
  destinationWarehouseId: string;
  quantity: number;
  sourceWarehouseId: string;
}) {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new AppError(400, "Informe uma quantidade maior que zero.");
  }

  if (input.sourceWarehouseId === input.destinationWarehouseId) {
    throw new AppError(400, "O almoxarifado de destino deve ser diferente da origem.");
  }
}

export async function createTransferRequest(
  prisma: PrismaClient,
  input: TransferRequestInput,
) {
  assertTransferInput(input);

  return prisma.$transaction(async (transaction) => {
    const converted = await convertQuantityToBase(transaction, {
      productId: input.productId,
      quantity: input.quantity,
      unitId: input.unitId,
    });
    const [source, destination, stock] = await Promise.all([
      transaction.warehouse.findUnique({
        where: { id: input.sourceWarehouseId },
      }),
      transaction.warehouse.findUnique({
        where: { id: input.destinationWarehouseId },
      }),
      transaction.stock.findUnique({
        where: {
          warehouseId_productId: {
            productId: input.productId,
            warehouseId: input.sourceWarehouseId,
          },
        },
      }),
    ]);

    if (!source || !destination) {
      throw new AppError(404, "Almoxarifado não encontrado.");
    }

    if (!source.isGeneral) {
      throw new AppError(403, "Apenas o almoxarifado geral pode transferir produtos.");
    }

    if (!stock || stock.currentQuantity < converted.baseQuantity) {
      throw new AppError(409, "Quantidade insuficiente em estoque.");
    }

    return transaction.transferRequest.create({
      data: {
        createdById: input.createdById,
        destinationWarehouseId: input.destinationWarehouseId,
        movementDate: input.movementDate,
        observation: input.observation,
        productId: input.productId,
        quantity: converted.baseQuantity,
        sourceWarehouseId: input.sourceWarehouseId,
        ...quantityConversionAuditData(converted),
      },
    });
  });
}

export async function receiveTransferRequest(
  prisma: PrismaClient,
  input: ReceiveTransferInput,
) {
  const receivedAt = input.receivedAt ?? new Date();

  return prisma.$transaction(async (transaction) => {
    const request = await transaction.transferRequest.findUniqueOrThrow({
      where: { id: input.requestId },
    });

    if (request.status !== TransferRequestStatus.PENDING_RECEIPT) {
      throw new AppError(409, "Esta transferência já foi recebida.");
    }

    const sourceStock = await transaction.stock.findUnique({
      where: {
        warehouseId_productId: {
          productId: request.productId,
          warehouseId: request.sourceWarehouseId,
        },
      },
    });

    if (!sourceStock || sourceStock.currentQuantity < request.quantity) {
      throw new AppError(409, "Quantidade insuficiente em estoque.");
    }

    const updatedSourceStock = await transaction.stock.update({
      where: { id: sourceStock.id },
      data: {
        currentQuantity: {
          decrement: request.quantity,
        },
        lastMovementAt: receivedAt,
      },
    });
    const destinationStock = await transaction.stock.upsert({
      where: {
        warehouseId_productId: {
          productId: request.productId,
          warehouseId: request.destinationWarehouseId,
        },
      },
      update: {
        currentQuantity: {
          increment: request.quantity,
        },
        lastMovementAt: receivedAt,
      },
      create: {
        currentQuantity: request.quantity,
        lastMovementAt: receivedAt,
        productId: request.productId,
        warehouseId: request.destinationWarehouseId,
      },
    });
    const sourceAudit = {
      conversionFactor: request.conversionFactor,
      sourceQuantity: request.sourceQuantity,
      sourceUnitId: request.sourceUnitId,
    };

    const sourceMovement = await transaction.stockMovement.create({
      data: {
        destinationWarehouseId: request.destinationWarehouseId,
        movementDate: receivedAt,
        observation: request.observation,
        productId: request.productId,
        quantity: request.quantity,
        responsibleUserId: input.receivedById,
        sourceWarehouseId: request.sourceWarehouseId,
        stockId: updatedSourceStock.id,
        type: MovementType.TRANSFERENCIA_SAIDA,
        warehouseId: request.sourceWarehouseId,
        ...sourceAudit,
      },
    });
    const destinationMovement = await transaction.stockMovement.create({
      data: {
        destinationWarehouseId: request.destinationWarehouseId,
        movementDate: receivedAt,
        observation: request.observation,
        productId: request.productId,
        quantity: request.quantity,
        responsibleUserId: input.receivedById,
        sourceWarehouseId: request.sourceWarehouseId,
        stockId: destinationStock.id,
        type: MovementType.TRANSFERENCIA_ENTRADA,
        warehouseId: request.destinationWarehouseId,
        ...sourceAudit,
      },
    });

    const receivedTransfer = await transaction.transferRequest.update({
      where: { id: request.id },
      data: {
        receivedAt,
        receivedById: input.receivedById,
        status: TransferRequestStatus.RECEIVED,
      },
    });

    return {
      destinationMovement,
      destinationStock,
      request: receivedTransfer,
      sourceMovement,
      sourceStock: updatedSourceStock,
    };
  });
}

export async function cancelTransferRequest(
  prisma: PrismaClient,
  input: CancelTransferInput,
) {
  const request = await prisma.transferRequest.findUniqueOrThrow({
    where: { id: input.requestId },
  });

  if (request.status !== TransferRequestStatus.PENDING_RECEIPT) {
    throw new AppError(409, "Esta transferência não pode mais ser cancelada.");
  }

  return prisma.transferRequest.update({
    where: { id: request.id },
    data: {
      receivedAt: new Date(),
      receivedById: input.cancelledById,
      status: TransferRequestStatus.CANCELLED,
    },
  });
}
