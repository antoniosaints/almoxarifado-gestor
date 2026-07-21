import { RequestStatus, UserRole } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { createBaseFixture, resetDatabase } from "../test/database.js";
import {
  approveEntryRequest,
  createAdHocOutputRequest,
  createEntryRequest,
  getEntryRequestOfficeLetter,
  rejectEntryRequest,
  undoEntryRequest,
  updateEntryRequest,
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

  it("creates an ad hoc output request from the general warehouse without debiting stock", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const generalWarehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        isGeneral: true,
        name: "Almoxarifado Central",
      },
    });
    await prisma.stock.create({
      data: {
        currentQuantity: 10,
        productId: product.id,
        totalValue: 100,
        unitPriceAverage: 10,
        warehouseId: generalWarehouse.id,
      },
    });

    const request = await createAdHocOutputRequest(prisma, {
      items: [{ productId: product.id, quantity: 4 }],
      movementDate: new Date("2026-06-24T12:00:00.000Z"),
      observation: "Saida para evento municipal",
      reason: "Reposicao de material para evento",
      productId: product.id,
      quantity: 4,
      requestedById: user.id,
      warehouseId: generalWarehouse.id,
    });

    expect(request).toMatchObject({
      quantity: 4,
      status: RequestStatus.PENDING,
      type: "AD_HOC_OUTPUT",
    });
    const stock = await prisma.stock.findUniqueOrThrow({
      where: {
        warehouseId_productId: {
          productId: product.id,
          warehouseId: generalWarehouse.id,
        },
      },
    });
    expect(stock.currentQuantity).toBe(10);
    expect(Number(stock.totalValue)).toBe(100);
    expect(await prisma.stockMovement.count()).toBe(0);
  });

  it("approves an ad hoc output request by debiting only the general warehouse", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const generalWarehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        isGeneral: true,
        name: "Almoxarifado Central",
      },
    });
    await prisma.stock.create({
      data: {
        currentQuantity: 10,
        productId: product.id,
        totalValue: 100,
        unitPriceAverage: 10,
        warehouseId: generalWarehouse.id,
      },
    });
    const request = await createAdHocOutputRequest(prisma, {
      items: [{ productId: product.id, quantity: 4 }],
      movementDate: new Date("2026-06-24T12:00:00.000Z"),
      observation: "Saida para evento municipal",
      reason: "Reposicao de material para evento",
      productId: product.id,
      quantity: 4,
      requestedById: user.id,
      warehouseId: generalWarehouse.id,
    });

    const result = await approveEntryRequest(prisma, {
      requestId: request.id,
      reviewedById: user.id,
    });

    const stock = await prisma.stock.findUniqueOrThrow({
      where: {
        warehouseId_productId: {
          productId: product.id,
          warehouseId: generalWarehouse.id,
        },
      },
    });
    const movements = await prisma.stockMovement.findMany();

    expect(result.summary).toMatchObject({
      approvedQuantity: 4,
      sourceAfter: 6,
      sourceBefore: 10,
    });
    expect(stock.currentQuantity).toBe(6);
    expect(Number(stock.totalValue)).toBe(60);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      productId: product.id,
      quantity: 4,
      type: "SAIDA",
      warehouseId: generalWarehouse.id,
    });
    await expect(
      prisma.entryRequest.findUniqueOrThrow({ where: { id: request.id } }),
    ).resolves.toMatchObject({
      quantity: 4,
      status: RequestStatus.APPROVED,
      type: "AD_HOC_OUTPUT",
    });
  });

  it("generates an office letter for an ad hoc output request", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const generalWarehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        isGeneral: true,
        name: "Almoxarifado Central",
      },
    });
    await prisma.stock.create({
      data: {
        currentQuantity: 10,
        productId: product.id,
        warehouseId: generalWarehouse.id,
      },
    });
    const request = await createAdHocOutputRequest(prisma, {
      items: [{ productId: product.id, quantity: 4 }],
      movementDate: new Date("2026-06-24T12:00:00.000Z"),
      observation: "Saida para evento municipal",
      reason: "Reposicao de material para evento",
      productId: product.id,
      quantity: 4,
      requestedById: user.id,
      warehouseId: generalWarehouse.id,
    });

    const letter = await getEntryRequestOfficeLetter(prisma, request.id, user.name);

    expect(letter).toMatchObject({
      items: [
        {
          productName: product.name,
          quantity: 4,
          unit: "UN",
        },
      ],
      numberFormatted: "001/2026",
      request: {
        id: request.id,
        status: RequestStatus.PENDING,
        warehouseId: generalWarehouse.id,
      },
      year: 2026,
    });
    expect(letter.contentHtml).toContain("Papel A4");
  });

  it("rejects an ad hoc output request above the current general stock", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const generalWarehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        isGeneral: true,
        name: "Almoxarifado Central",
      },
    });
    await prisma.stock.create({
      data: {
        currentQuantity: 2,
        productId: product.id,
        warehouseId: generalWarehouse.id,
      },
    });

    await expect(
      createAdHocOutputRequest(prisma, {
        items: [{ productId: product.id, quantity: 3 }],
        movementDate: new Date("2026-06-24T12:00:00.000Z"),
        reason: "Reposicao de material para evento",
        productId: product.id,
        quantity: 3,
        requestedById: user.id,
        warehouseId: generalWarehouse.id,
      }),
    ).rejects.toMatchObject({
      message: "Quantidade insuficiente no estoque geral.",
      status: 409,
    });
  });

  it("frees the office number when a request is rejected", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
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
    await prisma.stock.create({
      data: {
        currentQuantity: 0,
        productId: product.id,
        warehouseId: warehouse.id,
      },
    });

    async function createRequest(quantity: number) {
      return createEntryRequest(prisma, {
        movementDate: new Date("2026-05-22T12:00:00.000Z"),
        productId: product.id,
        quantity,
        requestedById: operator.id,
        warehouseId: warehouse.id,
      });
    }

    const first = await createRequest(1);
    const second = await createRequest(2);
    const third = await createRequest(3);

    expect(first.officeNumber).toBe(1);
    expect(second.officeNumber).toBe(2);
    expect(third.officeNumber).toBe(3);

    await rejectEntryRequest(prisma, third.id, user.id);

    // A rejeitada deixa de ocupar o número...
    await expect(
      prisma.entryRequest.findUniqueOrThrow({ where: { id: third.id } }),
    ).resolves.toMatchObject({
      officeNumber: null,
      officeYear: null,
      status: RequestStatus.REJECTED,
    });

    // ...e o ofício dela não reatribui um número novo.
    const rejectedLetter = await getEntryRequestOfficeLetter(
      prisma,
      third.id,
      user.name,
    );
    expect(rejectedLetter.number).toBeNull();
    expect(rejectedLetter.numberFormatted).toBe("");

    // A próxima solicitação reaproveita o número 3.
    const fourth = await createRequest(4);
    expect(fourth.officeNumber).toBe(3);

    // Rejeitando um número do meio, ele também volta a ser usado.
    await rejectEntryRequest(prisma, second.id, user.id);

    const fifth = await createRequest(5);
    expect(fifth.officeNumber).toBe(2);
  });

  it("requires a reason for an ad hoc output request", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const generalWarehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        isGeneral: true,
        name: "Almoxarifado Central",
      },
    });
    await prisma.stock.create({
      data: {
        currentQuantity: 10,
        productId: product.id,
        warehouseId: generalWarehouse.id,
      },
    });

    await expect(
      createAdHocOutputRequest(prisma, {
        items: [{ productId: product.id, quantity: 2 }],
        movementDate: new Date("2026-06-24T12:00:00.000Z"),
        productId: product.id,
        quantity: 2,
        requestedById: user.id,
        warehouseId: generalWarehouse.id,
      }),
    ).rejects.toMatchObject({
      message: "Informe o motivo da solicitação.",
      status: 400,
    });
  });

  it("updates a pending entry request items", async () => {
    const { product, productCategory, unit, warehouseCategory } =
      await createBaseFixture(prisma);
    const secondProduct = await prisma.product.create({
      data: {
        categoryId: productCategory.id,
        code: "0000002",
        name: "Caneta azul",
        unitId: unit.id,
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
        { currentQuantity: 0, productId: product.id, warehouseId: warehouse.id },
        {
          currentQuantity: 0,
          productId: secondProduct.id,
          warehouseId: warehouse.id,
        },
      ],
    });
    const request = await createEntryRequest(prisma, {
      movementDate: new Date("2026-05-22T12:00:00.000Z"),
      productId: product.id,
      quantity: 5,
      requestedById: operator.id,
      warehouseId: warehouse.id,
    });

    await updateEntryRequest(prisma, request.id, {
      items: [{ productId: secondProduct.id, quantity: 7 }],
      movementDate: new Date("2026-05-25T12:00:00.000Z"),
      observation: "Ajuste do pedido",
      productId: secondProduct.id,
      quantity: 7,
      requestedById: operator.id,
      warehouseId: warehouse.id,
    });

    const items = await prisma.entryRequestItem.findMany({
      where: { requestId: request.id },
    });
    const updated = await prisma.entryRequest.findUniqueOrThrow({
      where: { id: request.id },
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ productId: secondProduct.id, quantity: 7 });
    expect(updated).toMatchObject({
      observation: "Ajuste do pedido",
      productId: secondProduct.id,
      quantity: 7,
      status: RequestStatus.PENDING,
    });
  });

  it("blocks editing a request that was already reviewed", async () => {
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
        name: "Almoxarifado da Saude",
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
        currentQuantity: 0,
        productId: product.id,
        warehouseId: warehouse.id,
      },
    });
    const request = await createEntryRequest(prisma, {
      movementDate: new Date("2026-05-22T12:00:00.000Z"),
      productId: product.id,
      quantity: 5,
      requestedById: operator.id,
      warehouseId: warehouse.id,
    });
    await approveEntryRequest(prisma, {
      requestId: request.id,
      reviewedById: user.id,
    });

    await expect(
      updateEntryRequest(prisma, request.id, {
        items: [{ productId: product.id, quantity: 3 }],
        movementDate: new Date("2026-05-22T12:00:00.000Z"),
        productId: product.id,
        quantity: 3,
        requestedById: operator.id,
        warehouseId: warehouse.id,
      }),
    ).rejects.toMatchObject({
      message: "Só é possível editar solicitações pendentes.",
      status: 409,
    });
  });

  it("undoes an approved entry request and restores stock", async () => {
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
        name: "Almoxarifado da Saude",
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
      quantity: 6,
      requestedById: operator.id,
      warehouseId: warehouse.id,
    });
    await approveEntryRequest(prisma, {
      requestId: request.id,
      reviewedById: user.id,
    });

    const undone = await undoEntryRequest(prisma, request.id);

    const generalStock = await prisma.stock.findUniqueOrThrow({
      where: {
        warehouseId_productId: {
          productId: product.id,
          warehouseId: generalWarehouse.id,
        },
      },
    });
    const destinationStock = await prisma.stock.findUniqueOrThrow({
      where: {
        warehouseId_productId: {
          productId: product.id,
          warehouseId: warehouse.id,
        },
      },
    });

    expect(undone).toMatchObject({
      reviewedAt: null,
      reviewedById: null,
      status: RequestStatus.PENDING,
    });
    expect(generalStock.currentQuantity).toBe(10);
    expect(destinationStock.currentQuantity).toBe(3);
    expect(await prisma.stockMovement.count()).toBe(0);
  });

  it("undoes an approved ad hoc output and restores stock value", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const generalWarehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        isGeneral: true,
        name: "Almoxarifado Central",
      },
    });
    await prisma.stock.create({
      data: {
        currentQuantity: 10,
        productId: product.id,
        totalValue: 100,
        unitPriceAverage: 10,
        warehouseId: generalWarehouse.id,
      },
    });
    const request = await createAdHocOutputRequest(prisma, {
      items: [{ productId: product.id, quantity: 4 }],
      movementDate: new Date("2026-06-24T12:00:00.000Z"),
      reason: "Reposicao de material para evento",
      productId: product.id,
      quantity: 4,
      requestedById: user.id,
      warehouseId: generalWarehouse.id,
    });
    await approveEntryRequest(prisma, {
      requestId: request.id,
      reviewedById: user.id,
    });

    await undoEntryRequest(prisma, request.id);

    const stock = await prisma.stock.findUniqueOrThrow({
      where: {
        warehouseId_productId: {
          productId: product.id,
          warehouseId: generalWarehouse.id,
        },
      },
    });

    expect(stock.currentQuantity).toBe(10);
    expect(Number(stock.totalValue)).toBe(100);
    expect(await prisma.stockMovement.count()).toBe(0);
    await expect(
      prisma.entryRequest.findUniqueOrThrow({ where: { id: request.id } }),
    ).resolves.toMatchObject({ status: RequestStatus.PENDING });
  });

  it("undoes a rejected request without touching stock", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const warehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado da Saude",
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
      productId: product.id,
      quantity: 5,
      requestedById: operator.id,
      warehouseId: warehouse.id,
    });
    await rejectEntryRequest(prisma, request.id, user.id);

    const undone = await undoEntryRequest(prisma, request.id);

    expect(undone).toMatchObject({
      reviewedById: null,
      status: RequestStatus.PENDING,
    });
    expect(await prisma.stockMovement.count()).toBe(0);
  });

  it("renders the request items as an HTML table variable in the office letter", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const generalWarehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        isGeneral: true,
        name: "Almoxarifado Central",
      },
    });
    await prisma.stock.create({
      data: {
        currentQuantity: 10,
        productId: product.id,
        warehouseId: generalWarehouse.id,
      },
    });
    await prisma.officeLetterTemplate.create({
      data: {
        contentHtml: "<p>Itens:</p>{{itens_solicitados_tabela}}",
        name: "Modelo com tabela",
        subject: "Solicitacao de material",
      },
    });
    const request = await createAdHocOutputRequest(prisma, {
      items: [{ productId: product.id, quantity: 4 }],
      movementDate: new Date("2026-06-24T12:00:00.000Z"),
      reason: "Reposicao de material para evento",
      productId: product.id,
      quantity: 4,
      requestedById: user.id,
      warehouseId: generalWarehouse.id,
    });

    const letter = await getEntryRequestOfficeLetter(prisma, request.id, user.name);

    expect(letter.contentHtml).toContain("<table");
    expect(letter.contentHtml).toContain("<th");
    expect(letter.contentHtml).toContain(product.name);
    expect(letter.contentHtml).not.toContain("&lt;table");
  });
});
