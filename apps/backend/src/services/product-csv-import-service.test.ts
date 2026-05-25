import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { createBaseFixture, resetDatabase } from "../test/database.js";
import {
  importProductsCsv,
  previewProductsCsvImport,
} from "./product-csv-import-service.js";

const csvHeader = "id;nome;unidade;minimo;categoria";

describe("product CSV import service", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
  });

  it("previews products with generated codes, units and categories", async () => {
    await createBaseFixture(prisma);
    const csv = [
      csvHeader,
      ";Clips galvanizado;CX;12;Expediente",
      "0000042;Detergente;UN;5;Limpeza",
    ].join("\n");

    const preview = await previewProductsCsvImport(prisma, { csv });

    expect(preview.rows).toHaveLength(2);
    expect(preview.rows[0]).toMatchObject({
      canImport: true,
      categoryName: "Expediente",
      code: null,
      minimumQuantity: 12,
      productName: "Clips galvanizado",
      unit: "CX",
    });
    expect(preview.rows[1]).toMatchObject({
      canImport: true,
      code: "0000042",
      unit: "UN",
    });
  });

  it("imports products and creates missing catalog references", async () => {
    await createBaseFixture(prisma);
    const csv = [
      csvHeader,
      ";Clips galvanizado;CX;12;Expediente",
      "0000042;Detergente;UN;5;Limpeza",
    ].join("\n");

    const result = await importProductsCsv(prisma, { csv });

    expect(result.importedRows).toBe(2);
    await expect(
      prisma.product.findFirstOrThrow({
        where: { name: "Clips galvanizado" },
        include: { category: true, unit: true },
      }),
    ).resolves.toMatchObject({
      code: "0000002",
      minimumQuantity: 12,
      unit: { abbreviation: "CX" },
    });
    await expect(
      prisma.product.findUniqueOrThrow({
        where: { code: "0000042" },
        include: { category: true },
      }),
    ).resolves.toMatchObject({
      category: { name: "Limpeza" },
      minimumQuantity: 5,
      name: "Detergente",
    });
  });
});
