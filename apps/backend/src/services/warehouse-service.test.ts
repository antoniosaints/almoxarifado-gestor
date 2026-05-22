import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { createBaseFixture, resetDatabase } from "../test/database.js";
import { createWarehouse } from "./warehouse-service.js";

describe("warehouse service", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
  });

  it("rejects a second general warehouse", async () => {
    const { warehouseCategory } = await createBaseFixture(prisma);

    await createWarehouse(prisma, {
      name: "Central",
      categoryId: warehouseCategory.id,
      isGeneral: true,
      active: true,
    });

    await expect(
      createWarehouse(prisma, {
        name: "Central reserva",
        categoryId: warehouseCategory.id,
        isGeneral: true,
        active: true,
      }),
    ).rejects.toThrow("Ja existe um almoxarifado geral cadastrado.");
  });
});
