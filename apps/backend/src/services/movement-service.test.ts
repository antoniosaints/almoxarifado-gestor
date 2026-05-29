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

  it("records a free stock entry with zero average and total value", async () => {
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
      unitPrice: 0,
      userId: user.id,
      observation: "Doacao",
    });

    const stock = await prisma.stock.findUniqueOrThrow({
      where: {
        warehouseId_productId: {
          warehouseId: warehouse.id,
          productId: product.id,
        },
      },
    });

    expect(Number(movement.unitPrice)).toBe(0);
    expect(stock.currentQuantity).toBe(8);
    expect(Number(stock.unitPriceAverage)).toBe(0);
    expect(Number(stock.totalValue)).toBe(0);
  });

  it("uses zero cost entries in the weighted average for donations", async () => {
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
      quantity: 10,
      movementDate: new Date("2026-05-23T12:00:00.000Z"),
      unitPrice: 0,
      userId: user.id,
      observation: "Doacao",
    });

    const stock = await prisma.stock.findUniqueOrThrow({
      where: {
        warehouseId_productId: {
          warehouseId: warehouse.id,
          productId: product.id,
        },
      },
    });

    expect(stock.currentQuantity).toBe(20);
    expect(Number(stock.unitPriceAverage)).toBe(10);
    expect(Number(stock.totalValue)).toBe(200);
  });

  it("converts entry quantity and unit price to the product base unit", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const box = await prisma.unitOfMeasure.create({
      data: {
        abbreviation: "CX",
        name: "Caixa",
      },
    });
    await prisma.unitConversion.create({
      data: {
        factorToBase: 10,
        fromUnitId: box.id,
        productId: product.id,
      },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        isGeneral: true,
        name: "Almoxarifado Central",
      },
    });

    const { movement } = await createEntry(prisma, {
      movementDate: new Date("2026-05-22T12:00:00.000Z"),
      productId: product.id,
      quantity: 2,
      unitId: box.id,
      unitPrice: 250,
      userId: user.id,
      warehouseId: warehouse.id,
    });

    const stock = await prisma.stock.findUniqueOrThrow({
      where: {
        warehouseId_productId: {
          productId: product.id,
          warehouseId: warehouse.id,
        },
      },
    });

    expect(stock.currentQuantity).toBe(20);
    expect(Number(stock.unitPriceAverage)).toBe(25);
    expect(Number(stock.totalValue)).toBe(500);
    expect(movement.quantity).toBe(20);
    expect(Number(movement.unitPrice)).toBe(25);
    expect(Number(movement.sourceQuantity)).toBe(2);
    expect(movement.sourceUnitId).toBe(box.id);
    expect(Number(movement.conversionFactor)).toBe(10);
    expect(Number(movement.sourceUnitPrice)).toBe(250);
  });

  it("converts output quantities while keeping the average price stable", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const box = await prisma.unitOfMeasure.create({
      data: {
        abbreviation: "CX",
        name: "Caixa",
      },
    });
    await prisma.unitConversion.create({
      data: {
        factorToBase: 10,
        fromUnitId: box.id,
        productId: product.id,
      },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Saude",
      },
    });
    await createEntry(prisma, {
      movementDate: new Date("2026-05-22T12:00:00.000Z"),
      productId: product.id,
      quantity: 20,
      unitPrice: 25,
      userId: user.id,
      warehouseId: warehouse.id,
    });

    const { movement } = await createOutput(prisma, {
      destinationNote: "Unidade basica",
      movementDate: new Date("2026-05-23T12:00:00.000Z"),
      productId: product.id,
      quantity: 1,
      unitId: box.id,
      userId: user.id,
      warehouseId: warehouse.id,
    });

    const stock = await prisma.stock.findUniqueOrThrow({
      where: {
        warehouseId_productId: {
          productId: product.id,
          warehouseId: warehouse.id,
        },
      },
    });

    expect(stock.currentQuantity).toBe(10);
    expect(Number(stock.unitPriceAverage)).toBe(25);
    expect(Number(stock.totalValue)).toBe(250);
    expect(movement.quantity).toBe(10);
    expect(Number(movement.sourceQuantity)).toBe(1);
    expect(movement.sourceUnitId).toBe(box.id);
  });

  it("rejects converted quantities that do not produce an integer base quantity", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const box = await prisma.unitOfMeasure.create({
      data: {
        abbreviation: "CX",
        name: "Caixa",
      },
    });
    await prisma.unitConversion.create({
      data: {
        factorToBase: 2.5,
        fromUnitId: box.id,
        productId: product.id,
      },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado Central",
      },
    });

    await expect(
      createEntry(prisma, {
        movementDate: new Date("2026-05-22T12:00:00.000Z"),
        productId: product.id,
        quantity: 1,
        unitId: box.id,
        userId: user.id,
        warehouseId: warehouse.id,
      }),
    ).rejects.toThrow("A conversão precisa resultar em uma quantidade inteira na unidade base.");
  });

  it("rejects movements when the selected unit has no product conversion", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const box = await prisma.unitOfMeasure.create({
      data: {
        abbreviation: "CX",
        name: "Caixa",
      },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado Central",
      },
    });

    await expect(
      createEntry(prisma, {
        movementDate: new Date("2026-05-22T12:00:00.000Z"),
        productId: product.id,
        quantity: 1,
        unitId: box.id,
        userId: user.id,
        warehouseId: warehouse.id,
      }),
    ).rejects.toThrow("Configure a conversão desta unidade no produto antes de movimentar.");
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
