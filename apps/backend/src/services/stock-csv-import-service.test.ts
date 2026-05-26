import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { createBaseFixture, resetDatabase } from "../test/database.js";
import {
  importWarehouseCsv,
  previewWarehouseCsvImport,
} from "./stock-csv-import-service.js";

const csvHeader =
  "nome_produto;unidade;quantidade;valor_unitario;observacao;numero_nota;cnpj_empresa;nome_empresa;data_nota";

describe("stock CSV import service", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
  });

  it("previews rows with product suggestions and validation warnings", async () => {
    const { product, warehouseCategory } = await createBaseFixture(prisma);
    const warehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado Central",
      },
    });
    const csv = [
      csvHeader,
      "Papel A4;UN;2;10,50;Compra mensal;NF-10;12345678000190;Fornecedor Municipal;25/05/2026",
      "Clips galvanizado;CX;1;5,00;;NF-11;;;25/05/2026",
    ].join("\n");

    const preview = await previewWarehouseCsvImport(prisma, {
      csv,
      warehouseId: warehouse.id,
    });

    expect(preview.rows[0]).toMatchObject({
      canImport: true,
      cnpj: "12345678000190",
      issueDate: new Date("2026-05-25T00:00:00.000Z"),
      invoiceNumber: "NF-10",
      suggestedProduct: {
        id: product.id,
      },
      totalValue: 21,
      unit: "UN",
    });
    expect(preview.rows[0].warnings).toEqual([]);
    expect(preview.rows[1]).toMatchObject({
      canImport: false,
      invoiceNumber: "NF-11",
    });
    expect(preview.rows[1].errors).toEqual(
      expect.arrayContaining([
        "Informe o CNPJ da empresa para linhas com número de nota.",
        "Informe o nome da empresa para linhas com número de nota.",
      ]),
    );
  });

  it("imports mapped and newly created products inside one transaction", async () => {
    const { product, productCategory, user, warehouseCategory } =
      await createBaseFixture(prisma);
    const warehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado Central",
      },
    });
    const csv = [
      csvHeader,
      "Papel A4;UN;2;10,50;Compra mensal;NF-20;12345678000190;Fornecedor Municipal;25/05/2026",
      "Clips galvanizado;CX;3;5,00;Sem nota;;;;",
      "Item ignorado;UN;1;1,00;Não importar;;;;",
    ].join("\n");

    const result = await importWarehouseCsv(prisma, {
      categoryId: productCategory.id,
      csv,
      minimumQuantity: 2,
      rows: [
        { action: "IMPORT", productId: product.id, rowIndex: 0 },
        { action: "IMPORT", createProduct: true, rowIndex: 1 },
        { action: "SKIP", rowIndex: 2 },
      ],
      userId: user.id,
      warehouseId: warehouse.id,
    });

    expect(result.importedRows).toBe(2);
    expect(result.skippedRows).toBe(1);
    expect(result.invoiceCount).toBe(1);
    await expect(
      prisma.invoice.findFirst({
        where: {
          cnpj: "12345678000190",
          number: "NF-20",
        },
      }),
    ).resolves.toMatchObject({
      companyName: "Fornecedor Municipal",
      number: "NF-20",
    });
    const supplierRows = await prisma.$queryRawUnsafe<
      Array<{ cnpj: string; name: string; supplierId: string | null }>
    >(
      `SELECT s.cnpj, s.name, i.supplierId
       FROM Invoice i
       LEFT JOIN Supplier s ON s.id = i.supplierId
       WHERE i.number = ?`,
      "NF-20",
    );
    expect(supplierRows[0]).toMatchObject({
      cnpj: "12345678000190",
      name: "Fornecedor Municipal",
      supplierId: expect.any(String),
    });
    await expect(
      prisma.stock.findUnique({
        where: {
          warehouseId_productId: {
            productId: product.id,
            warehouseId: warehouse.id,
          },
        },
      }),
    ).resolves.toMatchObject({
      currentQuantity: 2,
      minimumQuantity: 2,
    });
    const createdProduct = await prisma.product.findFirstOrThrow({
      where: { name: "Clips galvanizado" },
    });
    await expect(
      prisma.stock.findUnique({
        where: {
          warehouseId_productId: {
            productId: createdProduct.id,
            warehouseId: warehouse.id,
          },
        },
      }),
    ).resolves.toMatchObject({ currentQuantity: 3 });
    await expect(
      prisma.product.findFirst({ where: { name: "Item ignorado" } }),
    ).resolves.toBeNull();
  });

  it("blocks importing a CSV invoice that already has movements", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const warehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado Central",
      },
    });
    const invoice = await prisma.invoice.create({
      data: {
        cnpj: "12345678000190",
        companyName: "Fornecedor Municipal",
        issueDate: new Date("2026-05-25T12:00:00.000Z"),
        number: "NF-30",
      },
    });
    await prisma.stockMovement.create({
      data: {
        invoiceId: invoice.id,
        movementDate: new Date("2026-05-25T12:00:00.000Z"),
        productId: product.id,
        quantity: 1,
        responsibleUserId: user.id,
        type: "ENTRADA",
        warehouseId: warehouse.id,
      },
    });
    const csv = [
      csvHeader,
      "Papel A4;UN;2;10,00;;NF-30;12345678000190;Fornecedor Municipal;25/05/2026",
    ].join("\n");

    await expect(
      importWarehouseCsv(prisma, {
        csv,
        rows: [{ action: "IMPORT", productId: product.id, rowIndex: 0 }],
        userId: user.id,
        warehouseId: warehouse.id,
      }),
    ).rejects.toThrow("A nota NF-30 já possui movimentações importadas.");
  });
});
