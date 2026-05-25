import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { createBaseFixture, resetDatabase } from "../test/database.js";
import {
  importWarehouseCsv,
  previewWarehouseCsvImport,
} from "./stock-csv-import-service.js";

const csvHeader =
  "numero_nota;cnpj_empresa;nome_empresa;data_nota;codigo_produto;nome_produto;unidade;quantidade;valor_unitario;valor_total;observacao";

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
      "NF-10;12345678000190;Fornecedor Municipal;2026-05-25;0000001;Papel A4;UN;2;10,50;99,00;Compra mensal",
      "NF-11;;;2026-05-25;CLP-001;Clips galvanizado;CX;1;5,00;5,00;",
    ].join("\n");

    const preview = await previewWarehouseCsvImport(prisma, {
      csv,
      warehouseId: warehouse.id,
    });

    expect(preview.rows[0]).toMatchObject({
      canImport: true,
      cnpj: "12345678000190",
      invoiceNumber: "NF-10",
      productCode: "0000001",
      suggestedProduct: {
        id: product.id,
      },
      unit: "UN",
    });
    expect(preview.rows[0].warnings).toContain(
      "Valor total diverge da quantidade multiplicada pelo valor unitario.",
    );
    expect(preview.rows[1]).toMatchObject({
      canImport: false,
      invoiceNumber: "NF-11",
    });
    expect(preview.rows[1].errors).toEqual(
      expect.arrayContaining([
        "Informe o CNPJ da empresa para linhas com numero de nota.",
        "Informe o nome da empresa para linhas com numero de nota.",
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
      "NF-20;12345678000190;Fornecedor Municipal;2026-05-25;0000001;Papel A4;UN;2;10,50;21,00;Compra mensal",
      "; ; ; ;CLP-001;Clips galvanizado;CX;3;5,00;15,00;Sem nota",
      "; ; ; ;IGN-001;Item ignorado;UN;1;1,00;1,00;Nao importar",
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
      "NF-30;12345678000190;Fornecedor Municipal;2026-05-25;0000001;Papel A4;UN;2;10,00;20,00;",
    ].join("\n");

    await expect(
      importWarehouseCsv(prisma, {
        csv,
        rows: [{ action: "IMPORT", productId: product.id, rowIndex: 0 }],
        userId: user.id,
        warehouseId: warehouse.id,
      }),
    ).rejects.toThrow("A nota NF-30 ja possui movimentacoes importadas.");
  });
});
