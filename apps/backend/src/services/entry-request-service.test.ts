import { RequestStatus, UserRole } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { createBaseFixture, resetDatabase } from "../test/database.js";
import {
  approveEntryRequest,
  createEntryRequest,
} from "./entry-request-service.js";

describe("entry request service", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
  });

  it("creates an operator entry request without changing stock", async () => {
    const { product, warehouseCategory } = await createBaseFixture(prisma);
    const warehouse = await prisma.warehouse.create({
      data: {
        name: "Almoxarifado da Saude",
        categoryId: warehouseCategory.id,
      },
    });
    const operator = await prisma.user.create({
      data: {
        email: "operador@prefeitura.local",
        name: "Operador",
        role: UserRole.OPERATOR,
      },
    });
    await prisma.stock.create({
      data: {
        currentQuantity: 0,
        productId: product.id,
        warehouseId: warehouse.id,
      },
    });

    const request = await createEntryRequest(prisma, {
      movementDate: new Date("2026-05-22T12:00:00.000Z"),
      observation: "Reposicao solicitada",
      productId: product.id,
      quantity: 5,
      requestedById: operator.id,
      warehouseId: warehouse.id,
    });

    expect(request.status).toBe(RequestStatus.PENDING);
    const stock = await prisma.stock.findUniqueOrThrow({
      where: {
        warehouseId_productId: {
          productId: product.id,
          warehouseId: warehouse.id,
        },
      },
    });
    expect(stock.currentQuantity).toBe(0);
    expect(await prisma.stockMovement.count()).toBe(0);
  });

  it("assigns office letter numbers per warehouse and year", async () => {
    const { product, warehouseCategory } = await createBaseFixture(prisma);
    const healthWarehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado da Saude",
      },
    });
    const educationWarehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado da Educacao",
      },
    });
    const operator = await prisma.user.create({
      data: {
        email: "operador@prefeitura.local",
        name: "Operador",
        role: UserRole.OPERATOR,
      },
    });

    await prisma.stock.createMany({
      data: [
        {
          currentQuantity: 0,
          productId: product.id,
          warehouseId: healthWarehouse.id,
        },
        {
          currentQuantity: 0,
          productId: product.id,
          warehouseId: educationWarehouse.id,
        },
      ],
    });

    const healthFirst = await createEntryRequest(prisma, {
      movementDate: new Date("2026-05-22T12:00:00.000Z"),
      productId: product.id,
      quantity: 5,
      requestedById: operator.id,
      warehouseId: healthWarehouse.id,
    });
    const educationFirst = await createEntryRequest(prisma, {
      movementDate: new Date("2026-05-23T12:00:00.000Z"),
      productId: product.id,
      quantity: 3,
      requestedById: operator.id,
      warehouseId: educationWarehouse.id,
    });
    const healthSecond = await createEntryRequest(prisma, {
      movementDate: new Date("2026-05-24T12:00:00.000Z"),
      productId: product.id,
      quantity: 2,
      requestedById: operator.id,
      warehouseId: healthWarehouse.id,
    });

    expect((healthFirst as { officeNumber?: number }).officeNumber).toBe(1);
    expect((healthFirst as { officeYear?: number }).officeYear).toBe(2026);
    expect((educationFirst as { officeNumber?: number }).officeNumber).toBe(1);
    expect((educationFirst as { officeYear?: number }).officeYear).toBe(2026);
    expect((healthSecond as { officeNumber?: number }).officeNumber).toBe(2);
    expect((healthSecond as { officeYear?: number }).officeYear).toBe(2026);
  });

  it("rejects an entry request when the product has no stock record in the warehouse", async () => {
    const { product, warehouseCategory } = await createBaseFixture(prisma);
    const warehouse = await prisma.warehouse.create({
      data: {
        name: "Almoxarifado da Saude",
        categoryId: warehouseCategory.id,
      },
    });
    const operator = await prisma.user.create({
      data: {
        email: "operador@prefeitura.local",
        name: "Operador",
        role: UserRole.OPERATOR,
      },
    });

    await expect(
      createEntryRequest(prisma, {
        movementDate: new Date("2026-05-22T12:00:00.000Z"),
        productId: product.id,
        quantity: 5,
        requestedById: operator.id,
        warehouseId: warehouse.id,
      }),
    ).rejects.toMatchObject({
      message: "Solicite apenas produtos já cadastrados no estoque deste almoxarifado.",
      status: 400,
    });
  });

  it("approves a request by moving stock from the general warehouse", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const generalWarehouse = await prisma.warehouse.create({
      data: {
        name: "Almoxarifado Central",
        categoryId: warehouseCategory.id,
        isGeneral: true,
      },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        name: "Almoxarifado da Educacao",
        categoryId: warehouseCategory.id,
      },
    });
    const operator = await prisma.user.create({
      data: {
        email: "operador@prefeitura.local",
        name: "Operador",
        role: UserRole.OPERATOR,
      },
    });
    await prisma.stock.create({
      data: {
        currentQuantity: 13,
        productId: product.id,
        warehouseId: generalWarehouse.id,
      },
    });
    await prisma.stock.create({
      data: {
        currentQuantity: 0,
        productId: product.id,
        warehouseId: warehouse.id,
      },
    });
    const invoice = await prisma.invoice.create({
      data: {
        cnpj: "12345678000190",
        companyName: "Fornecedor Municipal",
        issueDate: new Date("2026-05-20T12:00:00.000Z"),
        number: "NF-2026-001",
      },
    });
    const request = await createEntryRequest(prisma, {
      movementDate: new Date("2026-05-22T12:00:00.000Z"),
      productId: product.id,
      quantity: 8,
      requestedById: operator.id,
      warehouseId: warehouse.id,
    });

    await approveEntryRequest(prisma, {
      invoiceId: invoice.id,
      requestId: request.id,
      reviewedById: user.id,
    });

    const approvedRequest = await prisma.entryRequest.findUniqueOrThrow({
      where: { id: request.id },
    });
    const stock = await prisma.stock.findUniqueOrThrow({
      where: {
        warehouseId_productId: {
          warehouseId: warehouse.id,
          productId: product.id,
        },
      },
    });
    const generalStock = await prisma.stock.findUniqueOrThrow({
      where: {
        warehouseId_productId: {
          warehouseId: generalWarehouse.id,
          productId: product.id,
        },
      },
    });
    const movements = await prisma.stockMovement.findMany({
      orderBy: { createdAt: "asc" },
    });

    expect(approvedRequest.status).toBe(RequestStatus.APPROVED);
    expect(approvedRequest.reviewedById).toBe(user.id);
    expect(stock.currentQuantity).toBe(8);
    expect(generalStock.currentQuantity).toBe(5);
    expect(movements.map((movement) => movement.type)).toEqual([
      "TRANSFERENCIA_SAIDA",
      "TRANSFERENCIA_ENTRADA",
    ]);
    expect(movements[1]?.invoiceId).toBe(invoice.id);
  });

  it("approves every item in a multi-product entry request", async () => {
    const { product, productCategory, unit, user, warehouseCategory } =
      await createBaseFixture(prisma);
    const secondProduct = await prisma.product.create({
      data: {
        categoryId: productCategory.id,
        code: "0000002",
        name: "Caneta azul",
        unitId: unit.id,
      },
    });
    const generalWarehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        isGeneral: true,
        name: "Almoxarifado Central",
      },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado da Educacao",
      },
    });
    const operator = await prisma.user.create({
      data: {
        email: "operador@prefeitura.local",
        name: "Operador",
        role: UserRole.OPERATOR,
      },
    });

    await prisma.stock.createMany({
      data: [
        {
          currentQuantity: 12,
          productId: product.id,
          warehouseId: generalWarehouse.id,
        },
        {
          currentQuantity: 9,
          productId: secondProduct.id,
          warehouseId: generalWarehouse.id,
        },
        {
          currentQuantity: 1,
          productId: product.id,
          warehouseId: warehouse.id,
        },
        {
          currentQuantity: 2,
          productId: secondProduct.id,
          warehouseId: warehouse.id,
        },
      ],
    });

    const request = await createEntryRequest(prisma, {
      items: [
        { productId: product.id, quantity: 5 },
        { productId: secondProduct.id, quantity: 3 },
      ],
      movementDate: new Date("2026-05-22T12:00:00.000Z"),
      productId: product.id,
      quantity: 5,
      requestedById: operator.id,
      warehouseId: warehouse.id,
    });
    const requestItems = await prisma.entryRequestItem.findMany({
      orderBy: { createdAt: "asc" },
      where: { requestId: request.id },
    });

    const result = await approveEntryRequest(prisma, {
      items: [
        { id: requestItems[0]?.id, quantity: 4 },
        { id: requestItems[1]?.id, quantity: 2 },
      ],
      requestId: request.id,
      reviewedById: user.id,
    });

    const destinationStocks = await prisma.stock.findMany({
      orderBy: { productId: "asc" },
      where: { warehouseId: warehouse.id },
    });
    const generalStocks = await prisma.stock.findMany({
      orderBy: { productId: "asc" },
      where: { warehouseId: generalWarehouse.id },
    });
    const movements = await prisma.stockMovement.findMany();

    expect(result.itemSummaries).toHaveLength(2);
    expect(result.movements).toHaveLength(2);
    expect(movements).toHaveLength(4);
    expect(
      destinationStocks.find((stock) => stock.productId === product.id)
        ?.currentQuantity,
    ).toBe(5);
    expect(
      destinationStocks.find((stock) => stock.productId === secondProduct.id)
        ?.currentQuantity,
    ).toBe(4);
    expect(
      generalStocks.find((stock) => stock.productId === product.id)
        ?.currentQuantity,
    ).toBe(8);
    expect(
      generalStocks.find((stock) => stock.productId === secondProduct.id)
        ?.currentQuantity,
    ).toBe(7);
  });

  it("approves a request with an adjusted quantity and returns stock summary", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const generalWarehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        isGeneral: true,
        name: "Almoxarifado Central",
      },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado da Saúde",
      },
    });
    const operator = await prisma.user.create({
      data: {
        email: "operador@prefeitura.local",
        name: "Operador",
        role: UserRole.OPERATOR,
      },
    });

    await prisma.stock.create({
      data: {
        currentQuantity: 10,
        productId: product.id,
        warehouseId: generalWarehouse.id,
      },
    });
    await prisma.stock.create({
      data: {
        currentQuantity: 3,
        productId: product.id,
        warehouseId: warehouse.id,
      },
    });
    const request = await createEntryRequest(prisma, {
      movementDate: new Date("2026-05-22T12:00:00.000Z"),
      productId: product.id,
      quantity: 8,
      requestedById: operator.id,
      warehouseId: warehouse.id,
    });

    const result = await approveEntryRequest(prisma, {
      quantity: 6,
      requestId: request.id,
      reviewedById: user.id,
    });

    expect(result.summary).toMatchObject({
      approvedQuantity: 6,
      destinationAfter: 9,
      destinationBefore: 3,
      sourceAfter: 4,
      sourceBefore: 10,
    });
    await expect(
      prisma.entryRequest.findUniqueOrThrow({ where: { id: request.id } }),
    ).resolves.toMatchObject({
      quantity: 6,
      status: RequestStatus.APPROVED,
    });
  });
});
