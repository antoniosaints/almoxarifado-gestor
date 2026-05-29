import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { createBaseFixture, resetDatabase } from "../test/database.js";
import { importInvoiceXml, previewInvoiceXml } from "./invoice-xml-service.js";

function invoiceXml(unit: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc>
  <NFe>
    <infNFe Id="NFe35260512345678000190550010000000451000000450">
      <ide>
        <nNF>45</nNF>
        <serie>1</serie>
        <dhEmi>2026-05-25T10:00:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>12345678000190</CNPJ>
        <xNome>Fornecedor Municipal LTDA</xNome>
      </emit>
      <det nItem="1">
        <prod>
          <cProd>0000001</cProd>
          <xProd>Papel A4</xProd>
          <uCom>${unit}</uCom>
          <qCom>2.0000</qCom>
          <vUnCom>250.0000000000</vUnCom>
          <vProd>500.00</vProd>
        </prod>
      </det>
      <total>
        <ICMSTot>
          <vNF>500.00</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>`;
}

describe("invoice XML service", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
  });

  it("imports XML items using product unit conversions", async () => {
    const { product, productCategory, user, warehouseCategory } =
      await createBaseFixture(prisma);
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

    const result = await importInvoiceXml(prisma, {
      categoryId: productCategory.id,
      minimumQuantity: 0,
      productMappings: [{ itemIndex: 0, productId: product.id }],
      userId: user.id,
      warehouseId: warehouse.id,
      xml: invoiceXml("CX"),
    });

    expect(result.invoice.movements[0]).toMatchObject({
      quantity: 20,
      sourceUnitId: box.id,
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
      currentQuantity: 20,
    });
  });

  it("marks XML preview items as blocked when conversion is missing", async () => {
    const { product } = await createBaseFixture(prisma);
    await prisma.unitOfMeasure.create({
      data: {
        abbreviation: "CX",
        name: "Caixa",
      },
    });

    const preview = await previewInvoiceXml(prisma, { xml: invoiceXml("CX") });

    expect(preview.items[0]).toMatchObject({
      canImport: false,
      suggestedProduct: {
        id: product.id,
      },
      unit: "CX",
    });
    expect(preview.items[0].errors).toContain(
      "Configure a conversão desta unidade no produto antes de importar.",
    );
  });
});
