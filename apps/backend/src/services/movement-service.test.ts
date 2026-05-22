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
