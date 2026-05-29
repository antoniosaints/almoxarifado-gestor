import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { createBaseFixture, resetDatabase } from "../test/database.js";
import {
  createUnitConversion,
  updateProduct,
} from "./product-service.js";

describe("product service", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
  });

  it("rejects unit conversions with invalid factors", async () => {
    const { product } = await createBaseFixture(prisma);
    const box = await prisma.unitOfMeasure.create({
      data: {
        abbreviation: "CX",
        name: "Caixa",
      },
    });

    await expect(
      createUnitConversion(prisma, product.id, {
        active: true,
        factorToBase: 0,
        fromUnitId: box.id,
      }),
    ).rejects.toThrow("Informe um fator de conversão maior que zero.");
  });

  it("blocks changing the base unit after stock exists", async () => {
    const { product, productCategory, unit, warehouseCategory } =
      await createBaseFixture(prisma);
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
    await prisma.stock.create({
      data: {
        currentQuantity: 1,
        productId: product.id,
        warehouseId: warehouse.id,
      },
    });

    await expect(
      updateProduct(prisma, product.id, {
        active: true,
        categoryId: productCategory.id,
        description: null,
        minimumQuantity: 0,
        name: product.name,
        unitId: box.id,
      }),
    ).rejects.toThrow("Não é possível alterar a unidade base de um produto com histórico ou estoque.");

    await expect(
      prisma.product.findUniqueOrThrow({ where: { id: product.id } }),
    ).resolves.toMatchObject({
      unitId: unit.id,
    });
  });
});
