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

  it("lists only products stocked in the general warehouse for entry requests", async () => {
    const { product, productCategory, unit, warehouseCategory } =
      await createBaseFixture(prisma);
    const generalWarehouse = await prisma.warehouse.create({
      data: {
        name: "Almoxarifado Central",
        categoryId: warehouseCategory.id,
        isGeneral: true,
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
        currentQuantity: 9,
        productId: product.id,
        warehouseId: generalWarehouse.id,
      },
    });
    await prisma.stock.create({
      data: {
        currentQuantity: 0,
        productId: unavailableProduct.id,
        warehouseId: generalWarehouse.id,
      },
    });

    const response = await request(app)
      .get("/entry-requests/available-products")
      .set("Authorization", authorizationFor(operator));

    expect(response.status).toBe(200);
    expect(response.body.map((item: { id: string }) => item.id)).toEqual([product.id]);
  });

  it("blocks operators from product creation", async () => {
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

    expect(response.status).toBe(403);
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

  it("refuses to delete a stock item that already has movements", async () => {
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
    await prisma.stockMovement.create({
      data: {
        movementDate: new Date("2026-05-22T12:00:00.000Z"),
        productId: product.id,
        quantity: 2,
        responsibleUserId: user.id,
        type: "ENTRADA",
        warehouseId: warehouse.id,
      },
    });

    const response = await request(app)
      .delete(`/stocks/${stock.id}`)
      .set("Authorization", authorizationFor({ ...user, role: UserRole.ADMIN }));

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      "Este estoque possui movimentacoes e nao pode ser removido.",
    );
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
});
