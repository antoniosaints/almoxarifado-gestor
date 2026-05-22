import { MovementType, TransferRequestStatus } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { createBaseFixture, resetDatabase } from "../test/database.js";
import {
  createTransferRequest,
  receiveTransferRequest,
} from "./transfer-request-service.js";

describe("transfer request service", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
  });

  it("keeps stock unchanged until destination receives the transfer", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const source = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        isGeneral: true,
        name: "Almoxarifado Central",
      },
    });
    const destination = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado de Obras",
      },
    });
    await prisma.stock.create({
      data: {
        currentQuantity: 10,
        productId: product.id,
        warehouseId: source.id,
      },
    });

    const transfer = await createTransferRequest(prisma, {
      createdById: user.id,
      destinationWarehouseId: destination.id,
      movementDate: new Date("2026-05-22T12:00:00.000Z"),
      productId: product.id,
      quantity: 4,
      sourceWarehouseId: source.id,
    });

    const sourceStock = await prisma.stock.findUniqueOrThrow({
      where: {
        warehouseId_productId: {
          warehouseId: source.id,
          productId: product.id,
        },
      },
    });

    expect(transfer.status).toBe(TransferRequestStatus.PENDING_RECEIPT);
    expect(sourceStock.currentQuantity).toBe(10);
    expect(await prisma.stockMovement.count()).toBe(0);
  });

  it("records receiver and stock movements when destination accepts a transfer", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const source = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        isGeneral: true,
        name: "Almoxarifado Central",
      },
    });
    const destination = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado da Saude",
      },
    });
    const receiver = await prisma.user.create({
      data: {
        email: "recebedor@prefeitura.local",
        name: "Recebedor",
      },
    });
    await prisma.stock.create({
      data: {
        currentQuantity: 10,
        productId: product.id,
        warehouseId: source.id,
      },
    });
    const transfer = await createTransferRequest(prisma, {
      createdById: user.id,
      destinationWarehouseId: destination.id,
      movementDate: new Date("2026-05-22T12:00:00.000Z"),
      observation: "Reposicao",
      productId: product.id,
      quantity: 4,
      sourceWarehouseId: source.id,
    });

    await receiveTransferRequest(prisma, {
      receivedAt: new Date("2026-05-22T15:30:00.000Z"),
      receivedById: receiver.id,
      requestId: transfer.id,
    });

    const receivedTransfer = await prisma.transferRequest.findUniqueOrThrow({
      where: { id: transfer.id },
    });
    const destinationStock = await prisma.stock.findUniqueOrThrow({
      where: {
        warehouseId_productId: {
          warehouseId: destination.id,
          productId: product.id,
        },
      },
    });
    const movements = await prisma.stockMovement.findMany({
      orderBy: { createdAt: "asc" },
    });

    expect(receivedTransfer.status).toBe(TransferRequestStatus.RECEIVED);
    expect(receivedTransfer.receivedById).toBe(receiver.id);
    expect(receivedTransfer.receivedAt?.toISOString()).toBe(
      "2026-05-22T15:30:00.000Z",
    );
    expect(destinationStock.currentQuantity).toBe(4);
    expect(movements.map((movement) => movement.type)).toEqual([
      MovementType.TRANSFERENCIA_SAIDA,
      MovementType.TRANSFERENCIA_ENTRADA,
    ]);
  });
});
