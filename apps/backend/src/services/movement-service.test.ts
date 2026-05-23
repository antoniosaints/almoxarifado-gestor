import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { createBaseFixture, resetDatabase } from "../test/database.js";
import { createEntry, createOutput } from "./movement-service.js";

describe("movement service", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
  });

  it("creates stock automatically on entry", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const warehouse = await prisma.warehouse.create({
      data: {
        name: "Central",
        categoryId: warehouseCategory.id,
        isGeneral: true,
      },
    });

    await createEntry(prisma, {
      warehouseId: warehouse.id,
      productId: product.id,
      quantity: 8,
      movementDate: new Date("2026-05-22T12:00:00.000Z"),
      userId: user.id,
      observation: "Reposicao",
    });

    const stock = await prisma.stock.findUniqueOrThrow({
      where: {
        warehouseId_productId: {
          warehouseId: warehouse.id,
          productId: product.id,
        },
      },
    });

    expect(stock.currentQuantity).toBe(8);
  });

  it("stores unit price on entries from the general warehouse", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const warehouse = await prisma.warehouse.create({
      data: {
        name: "Almoxarifado Central",
        categoryId: warehouseCategory.id,
        isGeneral: true,
      },
    });

    const { movement } = await createEntry(prisma, {
      warehouseId: warehouse.id,
      productId: product.id,
      quantity: 8,
      movementDate: new Date("2026-05-22T12:00:00.000Z"),
      unitPrice: 14.75,
      userId: user.id,
    });

    expect(Number(movement.unitPrice)).toBe(14.75);
  });

  it("calculates weighted average unit price when adding entry to existing stock", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const warehouse = await prisma.warehouse.create({
      data: {
        name: "Almoxarifado Central",
        categoryId: warehouseCategory.id,
        isGeneral: true,
      },
    });

    await createEntry(prisma, {
      warehouseId: warehouse.id,
      productId: product.id,
      quantity: 10,
      movementDate: new Date("2026-05-22T12:00:00.000Z"),
      unitPrice: 20,
      userId: user.id,
    });

    await createEntry(prisma, {
      warehouseId: warehouse.id,
      productId: product.id,
      quantity: 5,
      movementDate: new Date("2026-05-23T12:00:00.000Z"),
      unitPrice: 30,
      userId: user.id,
    });

    const stock = await prisma.stock.findUniqueOrThrow({
      where: {
        warehouseId_productId: {
          warehouseId: warehouse.id,
          productId: product.id,
        },
      },
    });

    expect(stock.currentQuantity).toBe(15);
    expect(Number(stock.unitPriceAverage)).toBeCloseTo(23.33, 2);
    expect(Number(stock.totalValue)).toBeCloseTo(349.95, 2);
  });

  it("keeps minimum quantity and average price when adding entries to existing stock", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const warehouse = await prisma.warehouse.create({
      data: {
        name: "Farmacia",
        categoryId: warehouseCategory.id,
      },
    });

    await createEntry(prisma, {
      warehouseId: warehouse.id,
      productId: product.id,
      quantity: 4,
      minimumQuantity: 3,
      movementDate: new Date("2026-05-22T12:00:00.000Z"),
      unitPrice: 12,
      userId: user.id,
    });

    await createEntry(prisma, {
      warehouseId: warehouse.id,
      productId: product.id,
      quantity: 6,
      minimumQuantity: 99,
      movementDate: new Date("2026-05-23T12:00:00.000Z"),
      unitPrice: 12,
      userId: user.id,
    });

    const stock = await prisma.stock.findUniqueOrThrow({
      where: {
        warehouseId_productId: {
          warehouseId: warehouse.id,
          productId: product.id,
        },
      },
    });

    expect(stock.minimumQuantity).toBe(3);
    expect(Number(stock.unitPriceAverage)).toBe(12);
    expect(Number(stock.totalValue)).toBe(120);
  });

  it("does not recalculate average unit price on ad hoc outputs", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const warehouse = await prisma.warehouse.create({
      data: {
        name: "Saude",
        categoryId: warehouseCategory.id,
      },
    });

    await createEntry(prisma, {
      warehouseId: warehouse.id,
      productId: product.id,
      quantity: 15,
      movementDate: new Date("2026-05-22T12:00:00.000Z"),
      unitPrice: 23.33,
      userId: user.id,
    });

    await createOutput(prisma, {
      warehouseId: warehouse.id,
      productId: product.id,
      quantity: 5,
      destinationNote: "Unidade basica",
      movementDate: new Date("2026-05-23T12:00:00.000Z"),
      userId: user.id,
    });

    const stock = await prisma.stock.findUniqueOrThrow({
      where: {
        warehouseId_productId: {
          warehouseId: warehouse.id,
          productId: product.id,
        },
      },
    });

    expect(stock.currentQuantity).toBe(10);
    expect(Number(stock.unitPriceAverage)).toBeCloseTo(23.33, 2);
    expect(Number(stock.totalValue)).toBeCloseTo(233.3, 2);
  });

  it("rejects ad hoc output with insufficient stock", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const warehouse = await prisma.warehouse.create({
      data: {
        name: "Saude",
        categoryId: warehouseCategory.id,
      },
    });

    await prisma.stock.create({
      data: {
        warehouseId: warehouse.id,
        productId: product.id,
        currentQuantity: 2,
      },
    });

    await expect(
      createOutput(prisma, {
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: 3,
        destinationNote: "Unidade basica",
        movementDate: new Date("2026-05-22T12:00:00.000Z"),
        userId: user.id,
      }),
    ).rejects.toThrow("Quantidade insuficiente em estoque.");
  });
});
