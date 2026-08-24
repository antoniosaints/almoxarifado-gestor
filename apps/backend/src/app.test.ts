import { UserRole } from "@prisma/client";
import { createHmac } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
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

async function createPermissionProfile(name: string, permissions: string[]) {
  return prisma.permissionProfile.create({
    data: {
      name,
      permissions: {
        create: permissions.map((key) => ({ key })),
      },
    },
  });
}

function countPdfPages(body: Buffer) {
  return (body.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? []).length;
}

function tinyPngBuffer() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64",
  );
}

describe("api", () => {
  beforeEach(async () => {
    vi.unstubAllGlobals();
    delete process.env.LICENSE_SYSTEM;
    delete process.env.SECRET_VALIDATION_LICENSE;
    delete process.env.URL_VALIDATION_LICENSE;
    await resetDatabase(prisma);
    rmSync(path.join(process.cwd(), "uploads", "settings"), {
      force: true,
      recursive: true,
    });
    rmSync(path.join(process.cwd(), "uploads", "office-template-images"), {
      force: true,
      recursive: true,
    });
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    rmSync(path.join(process.cwd(), "uploads", "settings"), {
      force: true,
      recursive: true,
    });
    rmSync(path.join(process.cwd(), "uploads", "office-template-images"), {
      force: true,
      recursive: true,
    });
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

  it("requires the create-products permission for operator product creation", async () => {
    const { productCategory, unit } = await createBaseFixture(prisma);
    const profile = await createPermissionProfile("Cadastro de produtos", [
      "CREATE_PRODUCTS",
    ]);
    const blockedOperator = await prisma.user.create({
      data: {
        email: "bloqueado@prefeitura.local",
        name: "Operador bloqueado",
        role: UserRole.OPERATOR,
      },
    });
    const operator = await prisma.user.create({
      data: {
        email: "operador@prefeitura.local",
        name: "Operador",
        permissionProfileId: profile.id,
        role: UserRole.OPERATOR,
      },
    });

    const denied = await request(app)
      .post("/products")
      .set("Authorization", authorizationFor(blockedOperator))
      .send({
        name: "Caneta sem permissao",
        description: "Caixa para atendimento",
        categoryId: productCategory.id,
        unitId: unit.id,
        active: true,
      });

    expect(denied.status).toBe(403);

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

  it("lets admins create permission profiles and assign them to operators", async () => {
    const { user, warehouseCategory } = await createBaseFixture(prisma);
    const warehouse = await prisma.warehouse.create({
      data: {
        name: "Almoxarifado da Cultura",
        categoryId: warehouseCategory.id,
      },
    });
    const adminAuth = authorizationFor({ ...user, role: UserRole.ADMIN });

    const profile = await request(app)
      .post("/permission-profiles")
      .set("Authorization", adminAuth)
      .send({
        active: true,
        description: "Pode acessar produtos e aprovar solicitacoes.",
        name: "Catalogo e aprovacoes",
        permissions: ["ACCESS_PRODUCTS", "APPROVE_REQUESTS"],
      });

    expect(profile.status).toBe(201);
    expect(profile.body).toMatchObject({
      active: true,
      name: "Catalogo e aprovacoes",
      permissions: [
        { key: "ACCESS_PRODUCTS" },
        { key: "APPROVE_REQUESTS" },
      ],
    });

    const createdUser = await request(app)
      .post("/users")
      .set("Authorization", adminAuth)
      .send({
        active: true,
        email: "catalogo@prefeitura.local",
        name: "Operador de catalogo",
        password: "senha123",
        permissionProfileId: profile.body.id,
        role: UserRole.OPERATOR,
        warehouseIds: [warehouse.id],
      });

    expect(createdUser.status).toBe(201);
    expect(createdUser.body).toMatchObject({
      email: "catalogo@prefeitura.local",
      permissionProfileId: profile.body.id,
      permissionProfile: {
        id: profile.body.id,
        name: "Catalogo e aprovacoes",
      },
      permissions: ["ACCESS_PRODUCTS", "APPROVE_REQUESTS"],
      role: UserRole.OPERATOR,
      warehouseAssignments: [{ warehouseId: warehouse.id }],
    });
  });

  it("prevents permission-managing operators from granting permissions they do not have", async () => {
    const { user } = await createBaseFixture(prisma);
    const profile = await createPermissionProfile("Gestor limitado", [
      "MANAGE_USERS",
    ]);
    const operator = await prisma.user.create({
      data: {
        active: true,
        email: "gestor.limitado@prefeitura.local",
        name: "Gestor limitado",
        permissionProfileId: profile.id,
        role: UserRole.OPERATOR,
      },
    });

    const forbiddenProfile = await request(app)
      .post("/permission-profiles")
      .set("Authorization", authorizationFor(operator))
      .send({
        active: true,
        name: "Perfil indevido",
        permissions: ["MANAGE_USERS", "MANAGE_SETTINGS"],
      });

    expect(forbiddenProfile.status).toBe(403);

    const adminPromotion = await request(app)
      .put(`/users/${operator.id}`)
      .set("Authorization", authorizationFor(operator))
      .send({
        active: true,
        email: "gestor.limitado@prefeitura.local",
        name: "Gestor limitado",
        permissionProfileId: profile.id,
        role: UserRole.ADMIN,
        warehouseIds: [],
      });

    expect(adminPromotion.status).toBe(403);

    const adminUpdate = await request(app)
      .put(`/users/${user.id}`)
      .set("Authorization", authorizationFor(operator))
      .send({
        active: true,
        email: "tester@prefeitura.local",
        name: "Usuario de teste",
        role: UserRole.ADMIN,
        warehouseIds: [],
      });

    expect(adminUpdate.status).toBe(403);
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
      "O usuário admin default deve permanecer como Admin.",
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
    expect(removal.body.message).toBe("O usuário admin default não pode ser excluído.");
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
    expect(response.body.message).toBe("Você não pode excluir seu próprio usuário.");
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
      prisma.stock.findUniqueOrThrow({ where: { id: stock.id } }),
    ).resolves.toMatchObject({
      currentQuantity: 0,
    });
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
      .send({
        password: "admin123",
        productCategories: "KEEP",
        units: "KEEP",
        warehouseCategories: "KEEP",
      });

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
    await expect(prisma.unitOfMeasure.count()).resolves.toBe(1);
    await expect(prisma.productCategory.count()).resolves.toBe(1);
    await expect(prisma.warehouse.count()).resolves.toBe(0);
    await expect(prisma.warehouseCategory.count()).resolves.toBe(1);
  });

  it("restores default product, warehouse category and unit catalogs when requested", async () => {
    const { user } = await createBaseFixture(prisma);
    const admin = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword("admin123"),
        role: UserRole.ADMIN,
      },
    });
    await prisma.productCategory.create({
      data: {
        description: "Temporaria",
        name: "Categoria temporaria",
      },
    });
    await prisma.unitOfMeasure.create({
      data: {
        abbreviation: "TMP",
        name: "Temporaria",
      },
    });
    await prisma.warehouseCategory.create({
      data: {
        color: "#000000",
        icon: "box",
        name: "Categoria temporaria de almoxarifado",
      },
    });

    const response = await request(app)
      .post("/settings/reset-data")
      .set("Authorization", authorizationFor(admin))
      .send({
        password: "admin123",
        productCategories: "RESET_DEFAULTS",
        units: "RESET_DEFAULTS",
        warehouseCategories: "RESET_DEFAULTS",
      });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.restored).toMatchObject({
      productCategories: expect.any(Number),
      units: expect.any(Number),
      warehouseCategories: expect.any(Number),
    });
    expect(response.body.restored.productCategories).toBeGreaterThan(0);
    expect(response.body.restored.units).toBeGreaterThan(0);
    expect(response.body.restored.warehouseCategories).toBeGreaterThan(0);
    await expect(prisma.product.count()).resolves.toBe(0);
    await expect(prisma.warehouse.count()).resolves.toBe(0);
    await expect(
      prisma.productCategory.findUnique({
        where: { name: "Categoria temporaria" },
      }),
    ).resolves.toBeNull();
    await expect(
      prisma.unitOfMeasure.findUnique({ where: { abbreviation: "TMP" } }),
    ).resolves.toBeNull();
    await expect(
      prisma.warehouseCategory.findUnique({
        where: { name: "Categoria temporaria de almoxarifado" },
      }),
    ).resolves.toBeNull();
    await expect(
      prisma.productCategory.findUnique({
        where: { name: "Material de expediente" },
      }),
    ).resolves.toMatchObject({ name: "Material de expediente" });
    await expect(
      prisma.unitOfMeasure.findUnique({ where: { abbreviation: "UN" } }),
    ).resolves.toMatchObject({ name: "Unidade" });
    await expect(
      prisma.warehouseCategory.findUnique({ where: { name: "Geral" } }),
    ).resolves.toMatchObject({ name: "Geral" });
  });

  it("manages suppliers and requires supplier selection for manual invoices", async () => {
    const { user } = await createBaseFixture(prisma);
    const admin = await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN },
    });
    const auth = authorizationFor(admin);

    const missingSupplier = await request(app)
      .post("/invoices")
      .set("Authorization", auth)
      .send({
        issueDate: "2026-05-20T12:00:00.000Z",
        number: "NF-FORNECEDOR",
      });

    expect(missingSupplier.status).toBe(400);
    expect(missingSupplier.body.message).toBe("Escolha um fornecedor.");

    const createdSupplier = await request(app)
      .post("/suppliers")
      .set("Authorization", auth)
      .send({
        address: "Rua Central, 100",
        city: "Curitiba",
        cnpj: "12.345.678/0001-90",
        name: "Papelaria Municipal LTDA",
        phone: "4133334444",
        state: "PR",
        tradeName: "Papelaria Centro",
        zipCode: "80000000",
      });

    expect(createdSupplier.status).toBe(201);
    expect(createdSupplier.body).toMatchObject({
      active: true,
      cnpj: "12345678000190",
      name: "Papelaria Municipal LTDA",
      tradeName: "Papelaria Centro",
    });

    const duplicateSupplier = await request(app)
      .post("/suppliers")
      .set("Authorization", auth)
      .send({
        cnpj: "12345678000190",
        name: "Fornecedor duplicado",
      });

    expect(duplicateSupplier.status).toBe(409);

    const list = await request(app)
      .get("/suppliers?search=papelaria")
      .set("Authorization", auth);

    expect(list.status).toBe(200);
    expect(list.body[0]).toMatchObject({
      id: createdSupplier.body.id,
      name: "Papelaria Municipal LTDA",
    });

    const invoice = await request(app)
      .post("/invoices")
      .set("Authorization", auth)
      .send({
        issueDate: "2026-05-21T12:00:00.000Z",
        number: "NF-101",
        supplierId: createdSupplier.body.id,
      });

    expect(invoice.status).toBe(201);
    expect(invoice.body).toMatchObject({
      cnpj: "12345678000190",
      companyAddress: "Rua Central, 100",
      companyCity: "Curitiba",
      companyName: "Papelaria Municipal LTDA",
      companyPhone: "4133334444",
      companyState: "PR",
      companyTradeName: "Papelaria Centro",
      companyZipCode: "80000000",
      supplier: {
        id: createdSupplier.body.id,
        name: "Papelaria Municipal LTDA",
      },
      supplierId: createdSupplier.body.id,
    });
  });

  it("manages office letter templates and rejects unknown variables", async () => {
    const { user } = await createBaseFixture(prisma);
    const admin = await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN },
    });
    const auth = authorizationFor(admin);

    const invalid = await request(app)
      .post("/office-templates")
      .set("Authorization", auth)
      .send({
        contentHtml: "<p>{{variavel_invalida}}</p>",
        name: "Oficio invalido",
        subject: "Assunto",
      });

    expect(invalid.status).toBe(400);
    expect(invalid.body.message).toBe(
      "Variavel de oficio nao permitida: {{variavel_invalida}}.",
    );

    const created = await request(app)
      .post("/office-templates")
      .set("Authorization", auth)
      .send({
        contentHtml: "<p>Empresa {{nome_empresa}} - {{cnpj_empresa}}</p>",
        description: "Modelo para fornecedores",
        name: "Comunicado ao fornecedor",
        subject: "Comunicado para {{nome_empresa}}",
      });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      active: true,
      name: "Comunicado ao fornecedor",
      variables: ["nome_empresa", "cnpj_empresa"],
    });

    const second = await request(app)
      .post("/office-templates")
      .set("Authorization", auth)
      .send({
        contentHtml: "<p>Modelo ativo</p>",
        name: "Modelo ativo",
        subject: "Assunto ativo",
      });

    expect(second.status).toBe(201);
    expect(second.body).toMatchObject({
      active: true,
      name: "Modelo ativo",
    });

    const list = await request(app)
      .get("/office-templates")
      .set("Authorization", auth);

    expect(list.status).toBe(200);
    expect(list.body.filter((template: { active: boolean }) => template.active)).toHaveLength(1);
    expect(list.body[0]).toMatchObject({
      id: second.body.id,
      subject: "Assunto ativo",
    });
    expect(
      list.body.find((template: { id: string }) => template.id === created.body.id),
    ).toMatchObject({
      active: false,
      subject: "Comunicado para {{nome_empresa}}",
    });
  });

  it("uploads office template images for detailed headers and body content", async () => {
    const { user } = await createBaseFixture(prisma);
    const admin = await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN },
    });

    const upload = await request(app)
      .post("/uploads/office-template-images")
      .set("Authorization", authorizationFor(admin))
      .set("Content-Type", "image/png")
      .send(tinyPngBuffer());

    expect(upload.status).toBe(201);
    expect(upload.body).toMatchObject({
      driver: "local",
      url: expect.stringMatching(
        /^\/uploads\/office-template-images\/office-template-image-[a-f0-9]{12}\.png\?v=\d+$/,
      ),
    });
    expect(existsSync(path.join(process.cwd(), upload.body.url.split("?")[0]))).toBe(
      true,
    );
  });

  it("renders an office letter for a non-general entry request", async () => {
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
    const admin = await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado da Saude",
      },
    });
    await prisma.stock.createMany({
      data: [
        {
          currentQuantity: 0,
          productId: product.id,
          warehouseId: warehouse.id,
        },
        {
          currentQuantity: 0,
          productId: secondProduct.id,
          warehouseId: warehouse.id,
        },
      ],
    });
    const auth = authorizationFor(admin);

    const uploadResponse = await request(app)
      .post("/uploads/settings/office-logo")
      .set("Authorization", auth)
      .set("Content-Type", "image/png")
      .send(tinyPngBuffer());

    expect(uploadResponse.status).toBe(201);

    const template = await request(app)
      .post("/office-templates")
      .set("Authorization", auth)
      .send({
        contentHtml:
          "<p><strong>OFICIO Nº {{oficio_numero_ano}}</strong></p>{{itens_solicitados_html}}",
        name: "Solicitacao de material",
        subject: "Solicitacao de material/equipamento",
      });

    expect(template.status).toBe(201);

    const createdRequest = await request(app)
      .post("/entry-requests")
      .set("Authorization", auth)
      .send({
        items: [
          { productId: product.id, quantity: 4 },
          { productId: secondProduct.id, quantity: 2 },
        ],
        movementDate: "2026-05-23T12:00:00.000Z",
        productId: product.id,
        quantity: 4,
        warehouseId: warehouse.id,
      });

    expect(createdRequest.status).toBe(201);

    const office = await request(app)
      .get(`/entry-requests/${createdRequest.body.id}/office-letter`)
      .set("Authorization", auth);

    expect(office.status).toBe(200);
    expect(office.body).toMatchObject({
      items: [
        {
          productName: "Papel A4",
          quantity: 4,
          unit: "UN",
        },
        {
          productName: "Caneta azul",
          quantity: 2,
          unit: "UN",
        },
      ],
      numberFormatted: "001/2026",
      subject: "Solicitacao de material/equipamento",
      year: 2026,
    });
    // O objeto `header` institucional foi removido (era código morto).
    expect(office.body.header).toBeUndefined();
    expect(office.body.contentHtml).toContain("OFICIO Nº 001/2026");
    expect(office.body.contentHtml).toContain("Papel A4 - 4 Unidade;");
    expect(office.body.contentHtml).toContain("Caneta azul - 2 Unidade.");
    expect(office.body.documentHtml).toContain('data-office-letter-document="true"');
    expect(office.body.documentHtml).toContain("OFICIO Nº 001/2026");
    expect(office.body.documentHtml).toContain("Papel A4 - 4 Unidade;");
    expect(office.body.documentHtml).not.toContain("/uploads/settings/office-logo");
    expect(office.body.documentHtml).not.toContain("Almoxarifado da Saude");
    expect(office.body.documentHtml).not.toContain("Teste");
  });

  it("does not expose backend PDF export for office letters", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const admin = await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado da Saude",
      },
    });
    await prisma.stock.create({
      data: {
        currentQuantity: 0,
        productId: product.id,
        warehouseId: warehouse.id,
      },
    });
    const auth = authorizationFor(admin);

    await request(app)
      .post("/uploads/settings/office-logo")
      .set("Authorization", auth)
      .set("Content-Type", "image/png")
      .send(tinyPngBuffer());

    const createdRequest = await request(app)
      .post("/entry-requests")
      .set("Authorization", auth)
      .send({
        movementDate: "2026-05-23T12:00:00.000Z",
        productId: product.id,
        quantity: 4,
        warehouseId: warehouse.id,
      });

    const office = await request(app)
      .get(`/entry-requests/${createdRequest.body.id}/office-letter`)
      .set("Authorization", auth);

    expect(office.status).toBe(200);
    expect(office.body.documentHtml).toContain("OF&Iacute;CIO");
    expect(office.body.documentHtml).not.toContain("/uploads/settings/office-logo");
    expect(office.body.documentHtml).not.toContain("Almoxarifado da Saude");
    expect(office.body.documentHtml).not.toContain("Teste");

    const pdf = await request(app)
      .get(`/entry-requests/${createdRequest.body.id}/office-letter/pdf`)
      .set("Authorization", auth);

    expect(pdf.status).toBe(404);
    expect(pdf.headers["content-type"]).not.toContain("application/pdf");
  });

  it("keeps office template upload images in document html for frontend rendering", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const admin = await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN },
    });
    const warehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado da Saude",
      },
    });
    await prisma.stock.create({
      data: {
        currentQuantity: 0,
        productId: product.id,
        warehouseId: warehouse.id,
      },
    });
    const auth = authorizationFor(admin);

    const imageUpload = await request(app)
      .post("/uploads/office-template-images")
      .set("Authorization", auth)
      .set("Content-Type", "image/png")
      .send(tinyPngBuffer());

    expect(imageUpload.status).toBe(201);

    const template = await request(app)
      .post("/office-templates")
      .set("Authorization", auth)
      .send({
        contentHtml: [
          '<article data-office-letter-document="true">',
          `<img src="${imageUpload.body.url}" alt="" style="width:120px;height:auto;" />`,
          "<p>OFICIO {{oficio_numero_ano}}</p>",
          "</article>",
        ].join(""),
        name: "Cabecalho com imagem",
        subject: "Solicitacao",
      });

    expect(template.status).toBe(201);

    const createdRequest = await request(app)
      .post("/entry-requests")
      .set("Authorization", auth)
      .send({
        movementDate: "2026-05-23T12:00:00.000Z",
        productId: product.id,
        quantity: 4,
        warehouseId: warehouse.id,
      });

    const office = await request(app)
      .get(`/entry-requests/${createdRequest.body.id}/office-letter`)
      .set("Authorization", auth);

    expect(office.status).toBe(200);
    expect(office.body.documentHtml).toContain(imageUpload.body.url);
    expect(office.body.documentHtml).toContain("OFICIO 001/2026");
  });

  it("uploads one settings asset per slot and stores only the public URL", async () => {
    const { user } = await createBaseFixture(prisma);
    const admin = await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN },
    });
    const uploadRoot = path.join(process.cwd(), "uploads", "settings");

    const firstUpload = await request(app)
      .post("/uploads/settings/favicon")
      .set("Authorization", authorizationFor(admin))
      .set("Content-Type", "image/png")
      .send(Buffer.from("png-content"));

    expect(firstUpload.status).toBe(201);
    expect(firstUpload.body).toMatchObject({
      field: "faviconUrl",
      url: expect.stringMatching(/^\/uploads\/settings\/favicon\.png\?v=\d+$/),
    });
    expect(existsSync(path.join(uploadRoot, "favicon.png"))).toBe(true);
    await expect(
      prisma.systemSettings.findUniqueOrThrow({ where: { id: "system" } }),
    ).resolves.toMatchObject({
      faviconUrl: firstUpload.body.url,
    });

    const secondUpload = await request(app)
      .post("/uploads/settings/favicon")
      .set("Authorization", authorizationFor(admin))
      .set("Content-Type", "image/jpeg")
      .send(Buffer.from("jpeg-content"));

    expect(secondUpload.status).toBe(201);
    expect(secondUpload.body.url).toMatch(
      /^\/uploads\/settings\/favicon\.jpg\?v=\d+$/,
    );
    expect(existsSync(path.join(uploadRoot, "favicon.png"))).toBe(false);
    expect(existsSync(path.join(uploadRoot, "favicon.jpg"))).toBe(true);
    await expect(
      prisma.systemSettings.findUniqueOrThrow({ where: { id: "system" } }),
    ).resolves.toMatchObject({
      faviconUrl: secondUpload.body.url,
    });
  });

  it("manages subscribers, licenses, billing and manager dashboard", async () => {
    const { user } = await createBaseFixture(prisma);
    const admin = await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN },
    });
    const auth = authorizationFor(admin);

    const subscriberResponse = await request(app)
      .post("/manager/subscribers")
      .set("Authorization", auth)
      .send({
        active: true,
        city: "Sao Paulo",
        document: "12345678000190",
        email: "cliente@example.com",
        name: "Cliente Municipal",
        phone: "11999990000",
        state: "SP",
      });

    expect(subscriberResponse.status).toBe(201);
    expect(subscriberResponse.body).toMatchObject({
      active: true,
      email: "cliente@example.com",
      name: "Cliente Municipal",
    });

    const licenseResponse = await request(app)
      .post("/manager/licenses")
      .set("Authorization", auth)
      .send({
        expiresAt: "2099-06-15",
        monthlyValue: 250,
        seats: 5,
        startsAt: "2026-05-01",
        subscriberId: subscriberResponse.body.id,
        systemKey: "Almoxarifado",
        type: "MONTHLY",
      });

    expect(licenseResponse.status).toBe(201);
    expect(licenseResponse.body).toMatchObject({
      status: "ACTIVE",
      subscriberId: subscriberResponse.body.id,
      systemKey: "Almoxarifado",
    });
    expect(licenseResponse.body.licenseKey).toEqual(expect.any(String));

    const validatedLicense = await request(app)
      .post(`/manager/licenses/${licenseResponse.body.id}/validate`)
      .set("Authorization", auth)
      .send({});

    expect(validatedLicense.status).toBe(200);
    expect(validatedLicense.body.status).toBe("ACTIVE");

    const billingResponse = await request(app)
      .post("/manager/billings")
      .set("Authorization", auth)
      .send({
        amount: 250,
        dueDate: "2020-01-10",
        licenseId: licenseResponse.body.id,
        reference: "2026-05",
        status: "OPEN",
        subscriberId: subscriberResponse.body.id,
        systemKey: "Almoxarifado",
      });

    expect(billingResponse.status).toBe(201);
    expect(billingResponse.body).toMatchObject({
      reference: "2026-05",
      status: "OPEN",
      systemKey: "Almoxarifado",
    });

    const overdueDashboard = await request(app)
      .get("/manager/dashboard")
      .set("Authorization", auth);

    expect(overdueDashboard.status).toBe(200);
    expect(overdueDashboard.body.totals.overdueBillings).toBe(1);
    expect(overdueDashboard.body.totals.overdueAmount).toBe(250);

    const paidBilling = await request(app)
      .post(`/manager/billings/${billingResponse.body.id}/pay`)
      .set("Authorization", auth)
      .send({});

    expect(paidBilling.status).toBe(200);
    expect(paidBilling.body.status).toBe("PAID");

    const dashboard = await request(app)
      .get("/manager/dashboard")
      .set("Authorization", auth);

    expect(dashboard.status).toBe(200);
    expect(dashboard.body.totals).toMatchObject({
      averageTicket: 250,
      linkedLicenses: 0,
      totalLicenses: 1,
      totalRevenue: 250,
    });
    expect(dashboard.body.revenueBySystem).toEqual([
      { name: "Almoxarifado", value: 250 },
    ]);
    expect(dashboard.body.licenseStatusBreakdown).toEqual([
      { name: "Ativas", value: 1 },
    ]);
    expect(dashboard.body.billingStatusBreakdown).toEqual([
      { name: "Pagas", value: 1 },
    ]);
    expect(dashboard.body.monthlyRevenueTrend).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 250 }),
      ]),
    );

    const cancelledLicense = await request(app)
      .post(`/manager/licenses/${licenseResponse.body.id}/cancel`)
      .set("Authorization", auth)
      .send({ reason: "Contrato encerrado" });

    expect(cancelledLicense.status).toBe(200);
    expect(cancelledLicense.body).toMatchObject({
      cancellationReason: "Contrato encerrado",
      status: "CANCELLED",
    });
  });

  it("generates Mercado Pago Pix, settles by webhook and exports manager PDFs", async () => {
    const { user } = await createBaseFixture(prisma);
    const admin = await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN },
    });
    const auth = authorizationFor(admin);
    const subscriber = await prisma.managerSubscriber.create({
      data: {
        document: "12345678000190",
        email: "pix@example.com",
        name: "Cliente Pix",
      },
    });
    const license = await prisma.managerLicense.create({
      data: {
        expiresAt: new Date("2026-05-15T12:00:00.000Z"),
        licenseKey: "ALMO-PIX-001",
        monthlyValue: 250,
        startsAt: new Date("2026-05-01T12:00:00.000Z"),
        subscriberId: subscriber.id,
        systemKey: "Almoxarifado",
      },
    });
    const billing = await prisma.managerBilling.create({
      data: {
        amount: 250,
        dueDate: new Date("2026-05-20T12:00:00.000Z"),
        licenseId: license.id,
        reference: "2026-05",
        subscriberId: subscriber.id,
        systemKey: "Almoxarifado",
      },
    });
    let paymentCreateHeaders: Record<string, string> | undefined;
    let paymentCreatePayload: Record<string, unknown> | undefined;
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit): Promise<any> => {
      const target = String(url);

      if (target.endsWith("/v1/payments") && init?.method === "POST") {
        paymentCreateHeaders = init.headers as Record<string, string>;
        paymentCreatePayload = JSON.parse(String(init.body)) as Record<string, unknown>;

        return {
          json: async () => ({
            external_reference: `${billing.id}-mp`,
            id: 123,
            point_of_interaction: {
              transaction_data: {
                qr_code: "pix-copia-e-cola",
                qr_code_base64: tinyPngBuffer().toString("base64"),
                ticket_url: "https://www.mercadopago.com.br/payments/123/ticket",
              },
            },
            status: "pending",
            status_detail: "pending_waiting_transfer",
          }),
          ok: true,
          status: 201,
        };
      }

      if (target.endsWith("/v1/payments/123")) {
        return {
          json: async () => ({
            date_approved: "2026-05-12T12:00:00.000Z",
            external_reference: `${billing.id}-mp`,
            id: 123,
            point_of_interaction: {
              transaction_data: {
                qr_code: "pix-copia-e-cola",
                qr_code_base64: tinyPngBuffer().toString("base64"),
                ticket_url: "https://www.mercadopago.com.br/payments/123/ticket",
              },
            },
            status: "approved",
            status_detail: "accredited",
          }),
          ok: true,
          status: 200,
        };
      }

      throw new Error(`Unexpected fetch: ${target}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const gateway = await request(app)
      .put("/manager/gateways/mercado-pago")
      .set("Authorization", auth)
      .send({
        accessToken: "APP_USR-test",
        active: true,
        webhookSecret: "mp-secret",
      });

    expect(gateway.status).toBe(200);
    expect(gateway.body).toMatchObject({
      active: true,
      configured: true,
      provider: "MERCADO_PAGO",
    });

    const paymentResponse = await request(app)
      .post(`/manager/billings/${billing.id}/faturar`)
      .set("Authorization", auth)
      .send({
        gatewayProvider: "MERCADO_PAGO",
        method: "PIX",
        mode: "GATEWAY",
      });

    expect(paymentResponse.status).toBe(200);
    expect(paymentCreateHeaders).toMatchObject({
      "X-Idempotency-Key": expect.any(String),
    });
    expect(paymentCreatePayload).toMatchObject({
      external_reference: expect.stringContaining(billing.id),
      metadata: {
        billing_id: billing.id,
        license_id: license.id,
        subscriber_id: subscriber.id,
      },
      notification_url: expect.stringContaining("/manager/webhooks/mercado-pago"),
      payer: {
        email: "pix@example.com",
        first_name: "Cliente",
        identification: {
          number: "12345678000190",
          type: "CNPJ",
        },
        last_name: "Pix",
      },
      payment_method_id: "pix",
      transaction_amount: 250,
    });
    expect(paymentResponse.body.payments[0]).toMatchObject({
      method: "PIX",
      providerPaymentId: "123",
      qrCode: "pix-copia-e-cola",
      status: "PENDING",
    });

    const createdPayment = paymentResponse.body.payments[0];
    fetchMock.mockImplementationOnce(async (): Promise<any> => ({
      json: async () => ({
        date_approved: "2026-05-12T12:00:00.000Z",
        external_reference: createdPayment.externalReference,
        id: 123,
        status: "approved",
        status_detail: "accredited",
      }),
      ok: true,
      status: 200,
    }));

    const requestId = "mp-request-123";
    const timestamp = "1760000000";
    const signature = `ts=${timestamp},v1=${createHmac("sha256", "mp-secret")
      .update(`id:123;request-id:${requestId};ts:${timestamp};`)
      .digest("hex")}`;
    const webhook = await request(app)
      .post("/manager/webhooks/mercado-pago?type=payment&data.id=123")
      .set("x-request-id", requestId)
      .set("x-signature", signature)
      .send({ data: { id: "123" }, type: "payment" });

    expect(webhook.status).toBe(200);
    await expect(
      prisma.managerBilling.findUniqueOrThrow({ where: { id: billing.id } }),
    ).resolves.toMatchObject({
      status: "PAID",
    });
    await expect(
      prisma.managerLicense.findUniqueOrThrow({ where: { id: license.id } }),
    ).resolves.toMatchObject({
      expiresAt: new Date("2026-06-15T12:00:00.000Z"),
      status: "ACTIVE",
    });

    const billingPdf = await request(app)
      .get(`/manager/billings/${billing.id}/pdf`)
      .set("Authorization", auth);
    const licensePdf = await request(app)
      .get(`/manager/licenses/${license.id}/pdf`)
      .set("Authorization", auth);

    expect(billingPdf.status).toBe(200);
    expect(billingPdf.headers["content-type"]).toContain("application/pdf");
    expect(countPdfPages(billingPdf.body)).toBeGreaterThanOrEqual(1);
    expect(licensePdf.status).toBe(200);
    expect(licensePdf.headers["content-type"]).toContain("application/pdf");
  });

  it("cancels pending Mercado Pago payments when cancelling manager billings", async () => {
    const { user } = await createBaseFixture(prisma);
    const admin = await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN },
    });
    const auth = authorizationFor(admin);
    const subscriber = await prisma.managerSubscriber.create({
      data: {
        document: "12345678000190",
        email: "cancel@example.com",
        name: "Cliente Cancelamento",
      },
    });
    const license = await prisma.managerLicense.create({
      data: {
        licenseKey: "ALMO-CANCEL-001",
        monthlyValue: 250,
        startsAt: new Date("2026-05-01T12:00:00.000Z"),
        subscriberId: subscriber.id,
        systemKey: "Almoxarifado",
      },
    });
    const billing = await prisma.managerBilling.create({
      data: {
        amount: 250,
        dueDate: new Date("2026-05-20T12:00:00.000Z"),
        licenseId: license.id,
        reference: "2026-05",
        subscriberId: subscriber.id,
        systemKey: "Almoxarifado",
      },
    });
    const gateway = await prisma.managerPaymentGatewayConfig.create({
      data: {
        accessToken: "APP_USR-test",
        active: true,
        label: "Mercado Pago",
        provider: "MERCADO_PAGO",
      },
    });
    const payment = await prisma.managerBillingPayment.create({
      data: {
        amount: 250,
        billingId: billing.id,
        externalReference: `${billing.id}-cancel`,
        gatewayConfigId: gateway.id,
        method: "PIX",
        provider: "MERCADO_PAGO",
        providerPaymentId: "321",
        status: "PENDING",
      },
    });
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit): Promise<any> => {
      const target = String(url);

      if (target.endsWith("/v1/payments/321") && init?.method === "PUT") {
        return {
          json: async () => ({
            external_reference: payment.externalReference,
            id: 321,
            status: "cancelled",
            status_detail: "cancelled_by_collector",
          }),
          ok: true,
          status: 200,
        };
      }

      throw new Error(`Unexpected fetch: ${target}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const response = await request(app)
      .post(`/manager/billings/${billing.id}/cancel`)
      .set("Authorization", auth)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("CANCELLED");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/payments/321"),
      expect.objectContaining({
        body: JSON.stringify({ status: "cancelled" }),
        method: "PUT",
      }),
    );
    await expect(
      prisma.managerBillingPayment.findUniqueOrThrow({ where: { id: payment.id } }),
    ).resolves.toMatchObject({
      cancelledAt: expect.any(Date),
      status: "CANCELLED",
    });
  });

  it("deletes manager billings only while they have not been paid or approved", async () => {
    const { user } = await createBaseFixture(prisma);
    const admin = await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN },
    });
    const auth = authorizationFor(admin);
    const subscriber = await prisma.managerSubscriber.create({
      data: {
        email: "delete-billing@example.com",
        name: "Cliente Exclusao",
      },
    });
    const openBilling = await prisma.managerBilling.create({
      data: {
        amount: 250,
        dueDate: new Date("2026-05-20T12:00:00.000Z"),
        reference: "2026-05",
        subscriberId: subscriber.id,
        systemKey: "Almoxarifado",
      },
    });
    const paidBilling = await prisma.managerBilling.create({
      data: {
        amount: 300,
        dueDate: new Date("2026-05-20T12:00:00.000Z"),
        paidAt: new Date("2026-05-10T12:00:00.000Z"),
        reference: "2026-06",
        status: "PAID",
        subscriberId: subscriber.id,
        systemKey: "Almoxarifado",
      },
    });
    const approvedPaymentBilling = await prisma.managerBilling.create({
      data: {
        amount: 320,
        dueDate: new Date("2026-05-20T12:00:00.000Z"),
        reference: "2026-07",
        subscriberId: subscriber.id,
        systemKey: "Almoxarifado",
      },
    });
    await prisma.managerBillingPayment.create({
      data: {
        amount: 320,
        billingId: approvedPaymentBilling.id,
        externalReference: `${approvedPaymentBilling.id}-approved`,
        method: "PIX",
        paidAt: new Date("2026-05-11T12:00:00.000Z"),
        provider: "MERCADO_PAGO",
        providerPaymentId: "approved-123",
        status: "APPROVED",
      },
    });

    const deleted = await request(app)
      .delete(`/manager/billings/${openBilling.id}`)
      .set("Authorization", auth);

    expect(deleted.status).toBe(204);
    await expect(
      prisma.managerBilling.findUnique({ where: { id: openBilling.id } }),
    ).resolves.toBeNull();

    const rejected = await request(app)
      .delete(`/manager/billings/${paidBilling.id}`)
      .set("Authorization", auth);

    expect(rejected.status).toBe(409);
    expect(rejected.body.message).toMatch(/paga/i);
    await expect(
      prisma.managerBilling.findUnique({ where: { id: paidBilling.id } }),
    ).resolves.toMatchObject({ status: "PAID" });

    const approvedPaymentRejected = await request(app)
      .delete(`/manager/billings/${approvedPaymentBilling.id}`)
      .set("Authorization", auth);

    expect(approvedPaymentRejected.status).toBe(409);
    expect(approvedPaymentRejected.body.message).toMatch(/efetivado|paga/i);
  });

  it("validates manager licenses through the shared validation endpoint secret", async () => {
    process.env.SECRET_VALIDATION_LICENSE = "secretvalidador";
    const { user } = await createBaseFixture(prisma);
    const admin = await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN },
    });
    const auth = authorizationFor(admin);

    const subscriberResponse = await request(app)
      .post("/manager/subscribers")
      .set("Authorization", auth)
      .send({
        active: true,
        city: "Sao Paulo",
        document: "12345678000191",
        email: "validacao@example.com",
        name: "Cliente validacao",
        phone: "11999990001",
        state: "SP",
      });
    const licenseResponse = await request(app)
      .post("/manager/licenses")
      .set("Authorization", auth)
      .send({
        expiresAt: "2099-06-15",
        monthlyValue: 250,
        seats: 5,
        startsAt: "2026-05-01",
        subscriberId: subscriberResponse.body.id,
        systemKey: "Almoxarifado",
        type: "MONTHLY",
      });

    await request(app)
      .post(`/manager/licenses/${licenseResponse.body.id}/validate`)
      .set("Authorization", auth)
      .send({});

    const deniedResponse = await request(app)
      .post("/validation?secret=segredo-incorreto")
      .send({ licenseKey: licenseResponse.body.licenseKey });

    expect(deniedResponse.status).toBe(403);

    const response = await request(app)
      .post("/api/validation?secret=secretvalidador")
      .set("User-Agent", "cliente-almoxarifado/1.0")
      .set("X-Forwarded-For", "203.0.113.10")
      .set("X-License-Domain", "almox.cliente.gov.br")
      .send({ licenseKey: licenseResponse.body.licenseKey });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      blockWrites: false,
      licenseKey: licenseResponse.body.licenseKey,
      status: "LINKED",
      systemKey: "Almoxarifado",
      valid: true,
    });
    expect(response.body.expiresAt).toEqual(expect.any(String));

    await expect(
      prisma.managerLicense.findUniqueOrThrow({
        where: { id: licenseResponse.body.id },
      }),
    ).resolves.toMatchObject({
      linkedDomain: "almox.cliente.gov.br",
      linkedIp: "203.0.113.10",
      linkedUserAgent: "cliente-almoxarifado/1.0",
      status: "LINKED",
      validationCount: 1,
    });

    const reusedResponse = await request(app)
      .post("/api/validation?secret=secretvalidador")
      .set("User-Agent", "cliente-almoxarifado/1.0")
      .set("X-Forwarded-For", "198.51.100.44")
      .set("X-License-Domain", "outra-instalacao.gov.br")
      .send({ licenseKey: licenseResponse.body.licenseKey });

    expect(reusedResponse.status).toBe(200);
    expect(reusedResponse.body).toMatchObject({
      blockWrites: true,
      licenseKey: licenseResponse.body.licenseKey,
      status: "LINK_MISMATCH",
      valid: false,
    });
  });

  it("allows manager admins to manually mark an active license as linked", async () => {
    const { user } = await createBaseFixture(prisma);
    const admin = await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN },
    });
    const auth = authorizationFor(admin);
    const subscriber = await prisma.managerSubscriber.create({
      data: {
        email: "manual@example.com",
        name: "Cliente manual",
      },
    });
    const license = await prisma.managerLicense.create({
      data: {
        licenseKey: "ALMO-MANUAL-001",
        subscriberId: subscriber.id,
        systemKey: "Almoxarifado",
      },
    });

    const response = await request(app)
      .post(`/manager/licenses/${license.id}/link`)
      .set("Authorization", auth)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: license.id,
      status: "LINKED",
    });
    expect(response.body.linkedAt).toEqual(expect.any(String));
  });

  it("keeps client write operations free when license env vars are not configured", async () => {
    const { user } = await createBaseFixture(prisma);

    const response = await request(app)
      .post("/warehouse-categories")
      .set("Authorization", authorizationFor({ ...user, role: UserRole.ADMIN }))
      .send({
        description: "Categoria sem controle de licenca",
        name: "Sem licenca",
      });

    expect(response.status).toBe(201);
  });

  it("blocks client write operations after a configured license is expired", async () => {
    process.env.LICENSE_SYSTEM = "ALMO-EXPIRADA";
    process.env.URL_VALIDATION_LICENSE = "https://manager.example.com/validation?secret=secret";
    const { user } = await createBaseFixture(prisma);
    await prisma.licenseValidationState.create({
      data: {
        blockWrites: false,
        checkedAt: new Date("2026-05-20T12:00:00.000Z"),
        expiresAt: new Date("2020-01-01T23:59:59.999Z"),
        licenseKey: "ALMO-EXPIRADA",
        message: "Licença ativa.",
        mode: "managed",
        nextCheckAt: new Date("2099-01-01T00:00:00.000Z"),
        status: "ACTIVE",
        valid: true,
      },
    });

    const writeResponse = await request(app)
      .post("/warehouse-categories")
      .set("Authorization", authorizationFor({ ...user, role: UserRole.ADMIN }))
      .send({
        description: "Categoria bloqueada",
        name: "Bloqueada",
      });

    expect(writeResponse.status).toBe(403);
    expect(writeResponse.body).toMatchObject({
      code: "LICENSE_WRITE_BLOCKED",
      message: "Licença vencida. Entre em contato com o responsável pelo sistema.",
    });

    const readResponse = await request(app)
      .get("/warehouse-categories")
      .set("Authorization", authorizationFor({ ...user, role: UserRole.ADMIN }));

    expect(readResponse.status).toBe(200);
  });

  it("forces client license validation on demand even when the local state is blocked", async () => {
    process.env.LICENSE_SYSTEM = "ALMO-REVALIDADA";
    process.env.URL_VALIDATION_LICENSE =
      "https://manager.example.com/validation?secret=secret";
    const { user } = await createBaseFixture(prisma);
    const auth = authorizationFor({ ...user, role: UserRole.ADMIN });
    await prisma.licenseValidationState.create({
      data: {
        blockWrites: true,
        checkedAt: new Date("2026-05-20T12:00:00.000Z"),
        expiresAt: new Date("2020-01-01T23:59:59.999Z"),
        licenseKey: "ALMO-REVALIDADA",
        message: "Licença vencida. Entre em contato com o responsável pelo sistema.",
        mode: "managed",
        nextCheckAt: new Date("2099-01-01T00:00:00.000Z"),
        status: "EXPIRED",
        valid: false,
      },
    });
    const fetchMock = vi.fn(async () => ({
      json: async () => ({
        blockWrites: false,
        checkedAt: "2026-05-27T12:00:00.000Z",
        expiresAt: "2099-12-31T23:59:59.999Z",
        licenseKey: "ALMO-REVALIDADA",
        message: "Licença ativa.",
        status: "LINKED",
        valid: true,
        warningLevel: "none",
      }),
      ok: true,
      status: 200,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const refreshResponse = await request(app)
      .post("/license/refresh")
      .set("Authorization", auth)
      .send({});

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body).toMatchObject({
      blockWrites: false,
      licenseKey: "ALMO-REVALIDADA",
      message: "Licença ativa.",
      status: "LINKED",
      valid: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(
      prisma.licenseValidationState.findUniqueOrThrow({ where: { id: "system" } }),
    ).resolves.toMatchObject({
      blockWrites: false,
      licenseKey: "ALMO-REVALIDADA",
      status: "LINKED",
      valid: true,
    });

    const writeResponse = await request(app)
      .post("/warehouse-categories")
      .set("Authorization", auth)
      .send({
        description: "Categoria liberada por revalidacao",
        name: "Liberada",
      });

    expect(writeResponse.status).toBe(201);
  });

  it("serves public site content and protects site admin management", async () => {
    const { user } = await createBaseFixture(prisma);
    const admin = await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN },
    });
    const operator = await prisma.user.create({
      data: {
        email: "operador-site@prefeitura.local",
        name: "Operador site",
        role: UserRole.OPERATOR,
      },
    });

    const publicResponse = await request(app).get("/site/public");

    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body.settings).toMatchObject({
      primaryCtaLabel: "Falar com especialista",
      siteName: "GEMA Sistemas",
    });
    expect(publicResponse.body.systems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "frota", name: "Controle de Frota" }),
        expect.objectContaining({ key: "almoxarifado", name: "Almoxarifado" }),
      ]),
    );

    const unauthenticated = await request(app).get("/site/admin/content");

    expect(unauthenticated.status).toBe(401);

    const denied = await request(app)
      .put("/site/admin/settings")
      .set("Authorization", authorizationFor(operator))
      .send({
        headline: "Gestao municipal em um so lugar",
        primaryColor: "#0f766e",
        siteName: "GEMA Sistemas",
        whatsappNumber: "5599999999999",
      });

    expect(denied.status).toBe(403);

    const settingsResponse = await request(app)
      .put("/site/admin/settings")
      .set("Authorization", authorizationFor(admin))
      .send({
        contactEmail: "contato@gema.local",
        eyebrow: "Sistemas municipais",
        footerText: "GEMA Sistemas",
        headline: "Sistemas para gestao publica",
        logoUrl: "/uploads/site/logo.png",
        primaryColor: "#0f766e",
        primaryCtaLabel: "Chamar no WhatsApp",
        secondaryCtaLabel: "Conhecer solucoes",
        siteName: "GEMA Sistemas Municipais",
        subheadline: "Frota e almoxarifado com controle, relatorios e suporte.",
        whatsappMessage: "Ola, quero conhecer os sistemas municipais.",
        whatsappNumber: "5599999999999",
      });

    expect(settingsResponse.status).toBe(200);
    expect(settingsResponse.body).toMatchObject({
      contactEmail: "contato@gema.local",
      siteName: "GEMA Sistemas Municipais",
      whatsappNumber: "5599999999999",
    });

    const bannerResponse = await request(app)
      .post("/site/admin/banners")
      .set("Authorization", authorizationFor(admin))
      .send({
        active: true,
        buttonLabel: "Falar agora",
        buttonUrl: "whatsapp",
        imageUrl: "/uploads/site/banner.png",
        sortOrder: 2,
        subtitle: "Implantacao assistida para equipes municipais.",
        title: "Tecnologia pronta para sua rotina",
      });

    expect(bannerResponse.status).toBe(201);
    expect(bannerResponse.body).toMatchObject({
      active: true,
      title: "Tecnologia pronta para sua rotina",
    });

    const adminContent = await request(app)
      .get("/site/admin/content")
      .set("Authorization", authorizationFor(admin));

    expect(adminContent.status).toBe(200);
    expect(adminContent.body.banners).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "Tecnologia pronta para sua rotina" }),
      ]),
    );
  });

  it("rejects base64 image data in system settings payloads", async () => {
    const { user } = await createBaseFixture(prisma);
    const admin = await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN },
    });

    const response = await request(app)
      .put("/settings")
      .set("Authorization", authorizationFor(admin))
      .send({
        faviconUrl: "data:image/png;base64,iVBORw0KGgo=",
        loginBackgroundUrl: null,
        loginImageUrl: null,
        loginSubtitle: "Entre com seguranca.",
        loginTitle: "Almoxarifado",
        logoUrl: null,
        primaryColor: "#112233",
        reportFooterText: "Rodape do relatorio.",
        reportLogoUrl: null,
        reportPrimaryColor: "#445566",
        reportTitle: "Relatorio Municipal",
        systemName: "ALMOX",
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Informe uma URL válida.");
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
    const boxUnit = await prisma.unitOfMeasure.create({
      data: {
        abbreviation: "CX",
        name: "Caixa",
      },
    });
    const mappedProduct = await prisma.product.create({
      data: {
        categoryId: productCategory.id,
        code: "0000002",
        name: "Clips 26mm",
        unitId: boxUnit.id,
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
                <uCom>UN</uCom>
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
      supplier: {
        cnpj: "12345678000190",
        name: "Fornecedor Municipal LTDA",
      },
    });
    expect(response.body.invoice.supplierId).toEqual(expect.any(String));
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
    ).resolves.toMatchObject({ name: "Caixa" });
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

  it("filters zero stock balances from the exported PDF when requested", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const warehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado Central",
      },
    });

    await prisma.stock.create({
      data: {
        currentQuantity: 0,
        minimumQuantity: 2,
        productId: product.id,
        warehouseId: warehouse.id,
      },
    });
    const originalFindMany = prisma.stock.findMany.bind(prisma.stock);
    const findMany = vi
      .spyOn(prisma.stock, "findMany")
      .mockImplementation((...args) => originalFindMany(...args));

    const response = await request(app)
      .get("/reports/stocks?onlyWithStock=true")
      .set("Authorization", authorizationFor({ ...user, role: UserRole.ADMIN }));

    expect(response.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ currentQuantity: { gt: 0 } }),
      }),
    );
  });

  it("exports one movement audit record as a PDF with warehouse scope", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const admin = await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN },
    });
    const auth = authorizationFor(admin);
    const warehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado Central",
      },
    });
    const blockedWarehouse = await prisma.warehouse.create({
      data: {
        categoryId: warehouseCategory.id,
        name: "Almoxarifado Obras",
      },
    });
    const supplier = await request(app)
      .post("/suppliers")
      .set("Authorization", auth)
      .send({
        cnpj: "17404232000108",
        name: "CAS Internet",
      });
    const invoice = await request(app)
      .post("/invoices")
      .set("Authorization", auth)
      .send({
        issueDate: "2026-05-21T12:00:00.000Z",
        number: "41425387",
        supplierId: supplier.body.id,
      });
    const movement = await prisma.stockMovement.create({
      data: {
        invoiceId: invoice.body.id,
        movementDate: new Date("2026-05-22T12:00:00.000Z"),
        productId: product.id,
        quantity: 10,
        responsibleUserId: admin.id,
        type: "ENTRADA",
        unitPrice: 35,
        warehouseId: warehouse.id,
      },
    });
    const operator = await prisma.user.create({
      data: {
        email: "operador@prefeitura.local",
        name: "Operador",
        role: UserRole.OPERATOR,
        warehouseAssignments: {
          create: {
            warehouseId: blockedWarehouse.id,
          },
        },
      },
    });

    const response = await request(app)
      .get(`/reports/movements/${movement.id}`)
      .set("Authorization", auth);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(response.headers["content-disposition"]).toContain(
      `movimentacao-${movement.id}.pdf`,
    );
    expect(countPdfPages(response.body)).toBe(1);

    const denied = await request(app)
      .get(`/reports/movements/${movement.id}`)
      .set("Authorization", authorizationFor(operator));

    expect(denied.status).toBe(404);
  });

  it("embeds uploaded report logos from local uploads in PDFs", async () => {
    const { product, user, warehouseCategory } = await createBaseFixture(prisma);
    const admin = await prisma.user.update({
      where: { id: user.id },
      data: { role: UserRole.ADMIN },
    });
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

    const uploadResponse = await request(app)
      .post("/uploads/settings/report-logo")
      .set("Authorization", authorizationFor(admin))
      .set("Content-Type", "image/png")
      .send(tinyPngBuffer());

    expect(uploadResponse.status).toBe(201);
    expect(uploadResponse.body.url).toMatch(
      /^\/uploads\/settings\/report-logo\.png\?v=\d+$/,
    );

    const response = await request(app)
      .get("/reports/stocks")
      .set("Authorization", authorizationFor(admin));

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(response.body.toString("latin1")).toContain("/Subtype /Image");
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
