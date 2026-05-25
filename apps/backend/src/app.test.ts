import { UserRole } from "@prisma/client";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { createAccessToken } from "./lib/auth.js";
import { prisma } from "./lib/prisma.js";
import { hashPassword } from "./services/auth-service.js";
import { createBaseFixture, resetDatabase } from "./test/database.js";

function authorizationFor(user: {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}) {
  return `Bearer ${createAccessToken(user)}`;
}

function countPdfPages(body: Buffer) {
  return (body.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length;
}

describe("api", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
  });

  it("returns a session from login", async () => {
    await prisma.user.create({
      data: {
        email: "admin@prefeitura.local",
        name: "Administrador",
        passwordHash: await hashPassword("admin123"),
        role: UserRole.ADMIN,
      },
    });

    const response = await request(app).post("/auth/login").send({
      email: "admin@prefeitura.local",
      password: "admin123",
    });

    expect(response.status).toBe(200);
    expect(response.body.user.name).toBe("Administrador");
    expect(response.body.token).toEqual(expect.any(String));
  });

  it("creates products with automatic seven digit codes", async () => {
    const { productCategory, unit, user } = await createBaseFixture(prisma);

    const response = await request(app)
      .post("/products")
      .set("Authorization", authorizationFor({ ...user, role: UserRole.ADMIN }))
      .send({
        name: "Caneta preta",
        description: "Caixa para atendimento",
        categoryId: productCategory.id,
        unitId: unit.id,
        active: true,
      });

    expect(response.status).toBe(201);
    expect(response.body.code).toBe("0000002");
  });

  it("rejects transfer from a non-general warehouse", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const source = await prisma.warehouse.create({
      data: {
        name: "Saude",
        categoryId: warehouseCategory.id,
      },
    });
    const destination = await prisma.warehouse.create({
      data: {
        name: "Educacao",
        categoryId: warehouseCategory.id,
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { email: "admin@prefeitura.local", name: "Administrador" },
    });
    await prisma.stock.create({
      data: {
        warehouseId: source.id,
        productId: product.id,
        currentQuantity: 3,
      },
    });

    const response = await request(app)
      .post("/movements/transfer")
      .set("Authorization", authorizationFor({ ...user, role: UserRole.ADMIN }))
      .send({
        sourceWarehouseId: source.id,
        destinationWarehouseId: destination.id,
        productId: product.id,
        quantity: 1,
        movementDate: "2026-05-22T12:00:00.000Z",
      });

    expect(response.status).toBe(403);
    expect(response.body.message).toBe(
      "Apenas o almoxarifado geral pode transferir produtos.",
    );
  });

  it("limits operator warehouse list to assigned warehouses", async () => {
    const { warehouseCategory } = await createBaseFixture(prisma);
    const assignedWarehouse = await prisma.warehouse.create({
      data: {
        name: "Almoxarifado da Saude",
        categoryId: warehouseCategory.id,
      },
    });
    await prisma.warehouse.create({
      data: {
        name: "Almoxarifado Central",
        categoryId: warehouseCategory.id,
        isGeneral: true,
      },
    });
    const operator = await prisma.user.create({
      data: {
        email: "operador@prefeitura.local",
        name: "Operador",
        role: UserRole.OPERATOR,
        warehouseAssignments: {
          create: {
            warehouseId: assignedWarehouse.id,
          },
        },
      },
    });

    const response = await request(app)
      .get("/warehouses")
      .set("Authorization", authorizationFor(operator));

    expect(response.status).toBe(200);
    expect(response.body.map((warehouse: { id: string }) => warehouse.id)).toEqual([
      assignedWarehouse.id,
    ]);
  });

  it("lists only products stocked in the selected warehouse for entry requests", async () => {
    const { product, productCategory, unit, warehouseCategory } =
      await createBaseFixture(prisma);
    const warehouse = await prisma.warehouse.create({
      data: {
        name: "Almoxarifado da Saude",
        categoryId: warehouseCategory.id,
      },
    });
    const unavailableProduct = await prisma.product.create({
      data: {
        categoryId: productCategory.id,
        code: "0000002",
        name: "Caneta sem saldo",
        unitId: unit.id,
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
    const response = await request(app)
      .get(`/entry-requests/available-products?warehouseId=${warehouse.id}`)
      .set("Authorization", authorizationFor(operator));

    expect(response.status).toBe(200);
    expect(response.body.map((item: { id: string }) => item.id)).toEqual([product.id]);
  });

  it("lets operators create products for local stock entries", async () => {
    const { productCategory, unit } = await createBaseFixture(prisma);
    const operator = await prisma.user.create({
      data: {
        email: "operador@prefeitura.local",
        name: "Operador",
        role: UserRole.OPERATOR,
      },
    });

    const response = await request(app)
      .post("/products")
      .set("Authorization", authorizationFor(operator))
      .send({
        name: "Caneta preta",
        description: "Caixa para atendimento",
        categoryId: productCategory.id,
        unitId: unit.id,
        active: true,
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      code: "0000002",
      name: "Caneta preta",
    });
  });

  it("lets operators create direct stock entries in assigned warehouses", async () => {
    const { product, warehouseCategory } = await createBaseFixture(prisma);
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
        warehouseAssignments: {
          create: {
            warehouseId: warehouse.id,
          },
        },
      },
    });

    const response = await request(app)
      .post("/movements/entry")
      .set("Authorization", authorizationFor(operator))
      .send({
        minimumQuantity: 2,
        movementDate: "2026-05-22T12:00:00.000Z",
        productId: product.id,
        quantity: 4,
        unitPrice: 99,
        warehouseId: warehouse.id,
      });

    expect(response.status).toBe(201);
    expect(response.body.stock).toMatchObject({
      currentQuantity: 4,
      minimumQuantity: 2,
      productId: product.id,
      totalValue: "396",
      unitPriceAverage: "99",
      warehouseId: warehouse.id,
    });
    expect(response.body.movement.invoiceId).toBeNull();
    expect(response.body.movement.unitPrice).toBe("99");
  });

  it("lets admins create entry requests without changing stock", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const generalWarehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        isGeneral: true,
        name: "Almoxarifado Central",
      },
    });
    const destinationWarehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado da Saude",
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
        warehouseId: destinationWarehouse.id,
      },
    });

    const response = await request(app)
      .post("/entry-requests")
      .set("Authorization", authorizationFor({ ...user, role: UserRole.ADMIN }))
      .send({
        movementDate: "2026-05-25T12:00:00.000Z",
        productId: product.id,
        quantity: 3,
        warehouseId: destinationWarehouse.id,
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      productId: product.id,
      quantity: 3,
      status: "PENDING",
      warehouseId: destinationWarehouse.id,
    });
    await expect(
      prisma.stock.findUniqueOrThrow({
        where: {
          warehouseId_productId: {
            productId: product.id,
            warehouseId: generalWarehouse.id,
          },
        },
      }),
    ).resolves.toMatchObject({ currentQuantity: 10 });
    await expect(
      prisma.stock.findUniqueOrThrow({
        where: {
          warehouseId_productId: {
            productId: product.id,
            warehouseId: destinationWarehouse.id,
          },
        },
      }),
    ).resolves.toMatchObject({ currentQuantity: 0 });
  });

  it("lets admins create operators assigned to warehouses", async () => {
    const { user, warehouseCategory } = await createBaseFixture(prisma);
    const warehouse = await prisma.warehouse.create({
      data: {
        name: "Almoxarifado de Obras",
        categoryId: warehouseCategory.id,
      },
    });

    const response = await request(app)
      .post("/users")
      .set("Authorization", authorizationFor({ ...user, role: UserRole.ADMIN }))
      .send({
        active: true,
        email: "obras@prefeitura.local",
        name: "Operador de Obras",
        password: "senha123",
        role: UserRole.OPERATOR,
        warehouseIds: [warehouse.id],
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      email: "obras@prefeitura.local",
      role: UserRole.OPERATOR,
      warehouseAssignments: [{ warehouseId: warehouse.id }],
    });
  });

  it("keeps the default admin protected from removal and demotion", async () => {
    const { user } = await createBaseFixture(prisma);
    const defaultAdmin = await prisma.user.create({
      data: {
        active: true,
        email: "admin@prefeitura.local",
        isDefaultAdmin: true,
        name: "Administrador",
        role: UserRole.ADMIN,
      },
    });

    const demotion = await request(app)
      .put(`/users/${defaultAdmin.id}`)
      .set("Authorization", authorizationFor({ ...user, role: UserRole.ADMIN }))
      .send({
        active: true,
        email: "admin@prefeitura.local",
        name: "Administrador",
        role: UserRole.OPERATOR,
        warehouseIds: [],
      });

    expect(demotion.status).toBe(403);
    expect(demotion.body.message).toBe(
      "O usuario admin default deve permanecer como Admin.",
    );

    const profileUpdate = await request(app)
      .put(`/users/${defaultAdmin.id}`)
      .set("Authorization", authorizationFor({ ...user, role: UserRole.ADMIN }))
      .send({
        active: true,
        email: "admin@prefeitura.local",
        name: "Administrador Geral",
        role: UserRole.ADMIN,
        warehouseIds: [],
      });

    expect(profileUpdate.status).toBe(200);
    expect(profileUpdate.body).toMatchObject({
      isDefaultAdmin: true,
      name: "Administrador Geral",
      role: UserRole.ADMIN,
    });

    const removal = await request(app)
      .delete(`/users/${defaultAdmin.id}`)
      .set("Authorization", authorizationFor({ ...user, role: UserRole.ADMIN }));

    expect(removal.status).toBe(403);
    expect(removal.body.message).toBe("O usuario admin default nao pode ser excluido.");
    await expect(
      prisma.user.findUnique({ where: { id: defaultAdmin.id } }),
    ).resolves.toMatchObject({
      isDefaultAdmin: true,
      role: UserRole.ADMIN,
    });
  });

  it("prevents admins from deleting their own user", async () => {
    const { user } = await createBaseFixture(prisma);

    const response = await request(app)
      .delete(`/users/${user.id}`)
      .set("Authorization", authorizationFor({ ...user, role: UserRole.ADMIN }));

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Voce nao pode excluir seu proprio usuario.");
    await expect(prisma.user.findUnique({ where: { id: user.id } })).resolves.toBeTruthy();
  });

  it("deletes a stock item with its movements and audit trail", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const warehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado Central",
        isGeneral: true,
      },
    });
    const stock = await prisma.stock.create({
      data: {
        currentQuantity: 2,
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
    await prisma.stockMovement.create({
      data: {
        invoiceId: invoice.id,
        movementDate: new Date("2026-05-22T12:00:00.000Z"),
        productId: product.id,
        quantity: 2,
        responsibleUserId: user.id,
        stockId: stock.id,
        type: "ENTRADA",
        warehouseId: warehouse.id,
      },
    });

    const response = await request(app)
      .delete(`/stocks/${stock.id}`)
      .set("Authorization", authorizationFor({ ...user, role: UserRole.ADMIN }));

    expect(response.status).toBe(204);
    await expect(prisma.stock.findUnique({ where: { id: stock.id } })).resolves.toBeNull();
    await expect(
      prisma.stockMovement.findMany({ where: { stockId: stock.id } }),
    ).resolves.toEqual([]);
    await expect(
      prisma.auditLog.findFirst({
        where: {
          action: "DELETE",
          entity: "Stock",
          entityId: stock.id,
        },
      }),
    ).resolves.toMatchObject({
      userId: user.id,
    });
  });

  it("deletes an individual movement from the general movements list", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const warehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado Central",
      },
    });
    const stock = await prisma.stock.create({
      data: {
        currentQuantity: 3,
        productId: product.id,
        warehouseId: warehouse.id,
      },
    });
    const movement = await prisma.stockMovement.create({
      data: {
        movementDate: new Date("2026-05-22T12:00:00.000Z"),
        productId: product.id,
        quantity: 3,
        responsibleUserId: user.id,
        stockId: stock.id,
        type: "ENTRADA",
        unitPrice: 18,
        warehouseId: warehouse.id,
      },
    });

    const response = await request(app)
      .delete(`/movements/${movement.id}`)
      .set("Authorization", authorizationFor({ ...user, role: UserRole.ADMIN }));

    expect(response.status).toBe(204);
    await expect(
      prisma.stockMovement.findUnique({ where: { id: movement.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.auditLog.findFirst({
        where: {
          action: "DELETE",
          entity: "StockMovement",
          entityId: movement.id,
        },
      }),
    ).resolves.toMatchObject({
      userId: user.id,
    });
  });

  it("zeros selected stocks after admin password confirmation", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const admin = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword("admin123"),
        role: UserRole.ADMIN,
      },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado Central",
      },
    });
    const stock = await prisma.stock.create({
      data: {
        currentQuantity: 7,
        minimumQuantity: 2,
        productId: product.id,
        warehouseId: warehouse.id,
      },
    });

    const response = await request(app)
      .post("/stocks/bulk-zero")
      .set("Authorization", authorizationFor(admin))
      .send({
        password: "admin123",
        stockIds: [stock.id],
      });

    expect(response.status).toBe(200);
    expect(response.body.stocks[0]).toMatchObject({
      currentQuantity: 0,
      id: stock.id,
    });
    await expect(
      prisma.stockMovement.findFirstOrThrow({
        where: {
          productId: product.id,
          quantity: 7,
          type: "SAIDA",
          warehouseId: warehouse.id,
        },
      }),
    ).resolves.toBeTruthy();
  });

  it("deletes selected stocks after admin password confirmation", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const admin = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword("admin123"),
        role: UserRole.ADMIN,
      },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado Central",
      },
    });
    const stock = await prisma.stock.create({
      data: {
        currentQuantity: 0,
        productId: product.id,
        warehouseId: warehouse.id,
      },
    });
    await prisma.stockMovement.create({
      data: {
        movementDate: new Date("2026-05-22T12:00:00.000Z"),
        productId: product.id,
        quantity: 1,
        responsibleUserId: admin.id,
        stockId: stock.id,
        type: "ENTRADA",
        warehouseId: warehouse.id,
      },
    });

    const response = await request(app)
      .post("/stocks/bulk-delete")
      .set("Authorization", authorizationFor(admin))
      .send({
        password: "admin123",
        stockIds: [stock.id],
      });

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
    expect(response.body.movementCount).toBe(1);
    await expect(prisma.stock.findUnique({ where: { id: stock.id } })).resolves.toBeNull();
    await expect(
      prisma.stockMovement.findMany({ where: { stockId: stock.id } }),
    ).resolves.toEqual([]);
  });

  it("resets system data after admin password confirmation while keeping users and settings", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const admin = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword("admin123"),
        role: UserRole.ADMIN,
      },
    });
    await prisma.user.create({
      data: {
        email: "operador@prefeitura.local",
        name: "Operador",
        role: UserRole.OPERATOR,
      },
    });
    const sourceWarehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        isGeneral: true,
        name: "Almoxarifado Central",
      },
    });
    const destinationWarehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado da Saude",
      },
    });
    const stock = await prisma.stock.create({
      data: {
        currentQuantity: 10,
        productId: product.id,
        warehouseId: sourceWarehouse.id,
      },
    });
    const invoice = await prisma.invoice.create({
      data: {
        cnpj: "12345678000190",
        companyName: "Fornecedor Municipal",
        issueDate: new Date("2026-05-20T12:00:00.000Z"),
        number: "NF-RESET",
      },
    });
    await prisma.stockMovement.create({
      data: {
        invoiceId: invoice.id,
        movementDate: new Date("2026-05-22T12:00:00.000Z"),
        productId: product.id,
        quantity: 10,
        responsibleUserId: admin.id,
        stockId: stock.id,
        type: "ENTRADA",
        warehouseId: sourceWarehouse.id,
      },
    });
    await prisma.userWarehouse.create({
      data: {
        userId: admin.id,
        warehouseId: sourceWarehouse.id,
      },
    });
    await prisma.entryRequest.create({
      data: {
        movementDate: new Date("2026-05-23T12:00:00.000Z"),
        productId: product.id,
        quantity: 1,
        requestedById: admin.id,
        warehouseId: sourceWarehouse.id,
      },
    });
    await prisma.transferRequest.create({
      data: {
        createdById: admin.id,
        destinationWarehouseId: destinationWarehouse.id,
        movementDate: new Date("2026-05-24T12:00:00.000Z"),
        productId: product.id,
        quantity: 2,
        sourceWarehouseId: sourceWarehouse.id,
      },
    });
    await prisma.auditLog.create({
      data: {
        action: "TEST",
        entity: "System",
        entityId: "fixture",
        userId: admin.id,
      },
    });
    await prisma.systemSettings.create({
      data: {
        id: "system",
        loginSubtitle: "Entre com seguranca.",
        loginTitle: "Almoxarifado",
        primaryColor: "#112233",
        reportFooterText: "Rodape preservado.",
        reportPrimaryColor: "#445566",
        systemName: "ALMOX",
      },
    });

    const denied = await request(app)
      .post("/settings/reset-data")
      .set("Authorization", authorizationFor(admin))
      .send({ password: "senha-errada" });

    expect(denied.status).toBe(401);
    await expect(prisma.warehouse.count()).resolves.toBe(2);

    const response = await request(app)
      .post("/settings/reset-data")
      .set("Authorization", authorizationFor(admin))
      .send({ password: "admin123" });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.deleted.movements).toBe(1);
    await expect(prisma.user.count()).resolves.toBe(2);
    await expect(
      prisma.systemSettings.findUnique({ where: { id: "system" } }),
    ).resolves.toMatchObject({
      reportFooterText: "Rodape preservado.",
      systemName: "ALMOX",
    });
    await expect(prisma.auditLog.count()).resolves.toBe(0);
    await expect(prisma.entryRequest.count()).resolves.toBe(0);
    await expect(prisma.transferRequest.count()).resolves.toBe(0);
    await expect(prisma.stockMovement.count()).resolves.toBe(0);
    await expect(prisma.invoice.count()).resolves.toBe(0);
    await expect(prisma.stock.count()).resolves.toBe(0);
    await expect(prisma.userWarehouse.count()).resolves.toBe(0);
    await expect(prisma.product.count()).resolves.toBe(0);
    await expect(prisma.unitOfMeasure.count()).resolves.toBe(0);
    await expect(prisma.productCategory.count()).resolves.toBe(0);
    await expect(prisma.warehouse.count()).resolves.toBe(0);
    await expect(prisma.warehouseCategory.count()).resolves.toBe(0);
  });

  it("saves favicon and image data urls in system settings", async () => {
    const { user } = await createBaseFixture(prisma);
    const admin = await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN },
    });
    const imageDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB";

    const response = await request(app)
      .put("/settings")
      .set("Authorization", authorizationFor(admin))
      .send({
        faviconUrl: imageDataUrl,
        loginBackgroundUrl: imageDataUrl,
        loginImageUrl: imageDataUrl,
        loginSubtitle: "Entre com seguranca.",
        loginTitle: "Almoxarifado",
        logoUrl: imageDataUrl,
        primaryColor: "#112233",
        reportFooterText: "Rodape do relatorio.",
        reportLogoUrl: imageDataUrl,
        reportPrimaryColor: "#445566",
        reportTitle: "Relatorio Municipal",
        systemName: "ALMOX",
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      faviconUrl: imageDataUrl,
      logoUrl: imageDataUrl,
      reportLogoUrl: imageDataUrl,
    });
  });

  it("deletes invoices without deleting stock movements", async () => {
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
        issueDate: new Date("2026-05-20T12:00:00.000Z"),
        number: "NF-2026-003",
      },
    });
    const movement = await prisma.stockMovement.create({
      data: {
        invoiceId: invoice.id,
        movementDate: new Date("2026-05-22T12:00:00.000Z"),
        productId: product.id,
        quantity: 3,
        responsibleUserId: user.id,
        type: "ENTRADA",
        warehouseId: warehouse.id,
      },
    });

    const response = await request(app)
      .delete(`/invoices/${invoice.id}`)
      .set("Authorization", authorizationFor({ ...user, role: UserRole.ADMIN }));

    expect(response.status).toBe(204);
    await expect(
      prisma.invoice.findUnique({ where: { id: invoice.id } }),
    ).resolves.toBeNull();
    await expect(
      prisma.stockMovement.findUnique({ where: { id: movement.id } }),
    ).resolves.toMatchObject({ invoiceId: null });
    await expect(
      prisma.auditLog.findFirst({
        where: {
          action: "DELETE",
          entity: "Invoice",
          entityId: invoice.id,
        },
      }),
    ).resolves.toMatchObject({ userId: user.id });
  });

  it("lists invoice movements for fiscal note management", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const warehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        isGeneral: true,
        name: "Almoxarifado Central",
      },
    });
    const invoice = await prisma.invoice.create({
      data: {
        cnpj: "12345678000190",
        companyName: "Fornecedor Municipal",
        issueDate: new Date("2026-05-20T12:00:00.000Z"),
        number: "NF-2026-002",
      },
    });
    await prisma.stockMovement.create({
      data: {
        invoiceId: invoice.id,
        movementDate: new Date("2026-05-22T12:00:00.000Z"),
        productId: product.id,
        quantity: 3,
        responsibleUserId: user.id,
        type: "ENTRADA",
        warehouseId: warehouse.id,
      },
    });

    const response = await request(app)
      .get("/invoices")
      .set("Authorization", authorizationFor({ ...user, role: UserRole.ADMIN }));

    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject({
      id: invoice.id,
      movements: [
        {
          product: {
            id: product.id,
          },
          warehouse: {
            id: warehouse.id,
          },
        },
      ],
    });
  });

  it("limits operator invoice list to assigned warehouse movements", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const assignedWarehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado da Saude",
      },
    });
    const blockedWarehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado de Obras",
      },
    });
    const assignedInvoice = await prisma.invoice.create({
      data: {
        cnpj: "12345678000190",
        companyName: "Fornecedor Saude",
        issueDate: new Date("2026-05-20T12:00:00.000Z"),
        number: "NF-SAude",
      },
    });
    const blockedInvoice = await prisma.invoice.create({
      data: {
        cnpj: "98765432000110",
        companyName: "Fornecedor Obras",
        issueDate: new Date("2026-05-21T12:00:00.000Z"),
        number: "NF-Obras",
      },
    });
    const operator = await prisma.user.create({
      data: {
        email: "operador@prefeitura.local",
        name: "Operador",
        role: UserRole.OPERATOR,
        warehouseAssignments: {
          create: {
            warehouseId: assignedWarehouse.id,
          },
        },
      },
    });

    await prisma.stockMovement.createMany({
      data: [
        {
          invoiceId: assignedInvoice.id,
          movementDate: new Date("2026-05-22T12:00:00.000Z"),
          productId: product.id,
          quantity: 3,
          responsibleUserId: user.id,
          type: "ENTRADA",
          warehouseId: assignedWarehouse.id,
        },
        {
          invoiceId: blockedInvoice.id,
          movementDate: new Date("2026-05-22T12:00:00.000Z"),
          productId: product.id,
          quantity: 5,
          responsibleUserId: user.id,
          type: "ENTRADA",
          warehouseId: blockedWarehouse.id,
        },
      ],
    });

    const response = await request(app)
      .get("/invoices")
      .set("Authorization", authorizationFor(operator));

    expect(response.status).toBe(200);
    expect(response.body.map((invoice: { id: string }) => invoice.id)).toEqual([
      assignedInvoice.id,
    ]);
    expect(response.body[0].movements).toHaveLength(1);
    expect(response.body[0].movements[0].warehouse.id).toBe(assignedWarehouse.id);
  });

  it("imports invoice XML, maps products and updates stock", async () => {
    const { product, productCategory, unit, user, warehouseCategory } =
      await createBaseFixture(prisma);
    const warehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        isGeneral: true,
        name: "Almoxarifado Central",
      },
    });
    const mappedProduct = await prisma.product.create({
      data: {
        categoryId: productCategory.id,
        code: "0000002",
        name: "Clips 26mm",
        unitId: unit.id,
      },
    });
    const xml = `
      <nfeProc>
        <NFe>
          <infNFe Id="NFe41260512345678000190550010000001231000001234">
            <ide>
              <serie>1</serie>
              <nNF>123</nNF>
              <dhEmi>2026-05-22T09:30:00-03:00</dhEmi>
            </ide>
            <emit>
              <CNPJ>12345678000190</CNPJ>
              <xNome>Fornecedor Municipal LTDA</xNome>
              <xFant>Fornecedor Municipal</xFant>
              <IE>1234567890</IE>
              <IM>998877</IM>
              <enderEmit>
                <xLgr>Rua Central</xLgr>
                <nro>100</nro>
                <xBairro>Centro</xBairro>
                <xMun>Curitiba</xMun>
                <UF>PR</UF>
                <CEP>80000000</CEP>
                <fone>4133334444</fone>
              </enderEmit>
            </emit>
            <det nItem="1">
              <prod>
                <cProd>PAP-EXT</cProd>
                <xProd>Papel A4</xProd>
                <uCom>PCT</uCom>
                <qCom>2.0000</qCom>
                <vUnCom>25.50</vUnCom>
                <vProd>51.00</vProd>
              </prod>
            </det>
            <det nItem="2">
              <prod>
                <cProd>CLP-001</cProd>
                <xProd>Clips galvanizado</xProd>
                <uCom>CX</uCom>
                <qCom>5.0000</qCom>
                <vUnCom>8.00</vUnCom>
                <vProd>40.00</vProd>
              </prod>
            </det>
            <total>
              <ICMSTot>
                <vNF>91.00</vNF>
              </ICMSTot>
            </total>
          </infNFe>
        </NFe>
      </nfeProc>
    `;

    const preview = await request(app)
      .post("/invoices/import-xml/preview")
      .set("Authorization", authorizationFor({ ...user, role: UserRole.ADMIN }))
      .send({ xml });

    expect(preview.status).toBe(200);
    expect(preview.body.invoice).toMatchObject({
      companyName: "Fornecedor Municipal LTDA",
      number: "123",
      totalValue: 91,
    });
    expect(preview.body.items).toMatchObject([
      {
        code: "PAP-EXT",
        index: 0,
        name: "Papel A4",
        suggestedProduct: {
          id: product.id,
        },
      },
      {
        code: "CLP-001",
        index: 1,
        name: "Clips galvanizado",
        suggestedProduct: null,
      },
    ]);

    const response = await request(app)
      .post("/invoices/import-xml")
      .set("Authorization", authorizationFor({ ...user, role: UserRole.ADMIN }))
      .send({
        categoryId: productCategory.id,
        productMappings: [{ itemIndex: 1, productId: mappedProduct.id }],
        warehouseId: warehouse.id,
        xml,
      });

    expect(response.status).toBe(201);
    expect(response.body.invoice).toMatchObject({
      cnpj: "12345678000190",
      companyAddress: "Rua Central, 100, Centro",
      companyCity: "Curitiba",
      companyName: "Fornecedor Municipal LTDA",
      companyPhone: "4133334444",
      companyState: "PR",
      companyTradeName: "Fornecedor Municipal",
      companyZipCode: "80000000",
      invoiceKey: "41260512345678000190550010000001231000001234",
      number: "123",
      series: "1",
      stateRegistration: "1234567890",
    });
    expect(response.body.invoice.movements).toHaveLength(2);

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
      totalValue: expect.anything(),
    });

    await expect(
      prisma.stock.findUnique({
        where: {
          warehouseId_productId: {
            productId: mappedProduct.id,
            warehouseId: warehouse.id,
          },
        },
      }),
    ).resolves.toMatchObject({ currentQuantity: 5 });
    await expect(
      prisma.product.findFirst({ where: { name: "Clips galvanizado" } }),
    ).resolves.toBeNull();
    await expect(
      prisma.unitOfMeasure.findUnique({ where: { abbreviation: "CX" } }),
    ).resolves.toMatchObject({ name: "CX" });
  });

  it("returns admin insights for KPI dashboard", async () => {
    const { user } = await createBaseFixture(prisma);

    const response = await request(app)
      .get("/insights")
      .set("Authorization", authorizationFor({ ...user, role: UserRole.ADMIN }));

    expect(response.status).toBe(200);
    expect(response.body.totals.products).toBe(1);
    expect(response.body.topProducts).toEqual([]);
  });

  it("exports stock balance report as a PDF", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const warehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado Central",
      },
    });

    await prisma.stock.create({
      data: {
        currentQuantity: 8,
        minimumQuantity: 2,
        productId: product.id,
        warehouseId: warehouse.id,
      },
    });

    const response = await request(app)
      .get("/reports/stocks")
      .set("Authorization", authorizationFor({ ...user, role: UserRole.ADMIN }));

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(response.headers["content-disposition"]).toContain("relatorio-saldos.pdf");
    expect(countPdfPages(response.body)).toBe(1);
  });

  it("exports invoice reports without empty duplicate pages", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const warehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado Central",
      },
    });
    const linkedInvoice = await prisma.invoice.create({
      data: {
        cnpj: "17404232000108",
        companyName: "CAS Internet",
        issueDate: new Date("2026-05-21T12:00:00.000Z"),
        number: "41425387",
      },
    });

    await prisma.invoice.create({
      data: {
        cnpj: "17404232000108",
        companyName: "CAS Internet",
        issueDate: new Date("2026-05-21T12:00:00.000Z"),
        number: "41425387",
      },
    });
    await prisma.stock.create({
      data: {
        currentQuantity: 10,
        productId: product.id,
        warehouseId: warehouse.id,
      },
    });
    await prisma.stockMovement.create({
      data: {
        invoiceId: linkedInvoice.id,
        movementDate: new Date("2026-05-22T12:00:00.000Z"),
        productId: product.id,
        quantity: 10,
        responsibleUserId: user.id,
        type: "ENTRADA",
        unitPrice: 35,
        warehouseId: warehouse.id,
      },
    });

    const response = await request(app)
      .get("/reports/invoices?number=41425387")
      .set("Authorization", authorizationFor({ ...user, role: UserRole.ADMIN }));

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(countPdfPages(response.body)).toBe(1);
  });
});
