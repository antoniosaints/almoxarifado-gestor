import type { PrismaClient } from "@prisma/client";

export async function resetDatabase(prisma: PrismaClient) {
  await prisma.auditLog.deleteMany();
  await prisma.transferRequest.deleteMany();
  await prisma.entryRequest.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.userWarehouse.deleteMany();
  await prisma.product.deleteMany();
  await prisma.unitOfMeasure.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.warehouseCategory.deleteMany();
  await prisma.systemSettings.deleteMany();
  await prisma.user.deleteMany();
}

export async function createBaseFixture(prisma: PrismaClient) {
  const user = await prisma.user.create({
    data: {
      email: "tester@prefeitura.local",
      name: "Usuario de teste",
    },
  });
  const warehouseCategory = await prisma.warehouseCategory.create({
    data: {
      name: "Teste",
      description: "Categoria usada nos testes",
    },
  });
  const productCategory = await prisma.productCategory.create({
    data: {
      name: "Expediente",
      description: "Itens para testes",
    },
  });
  const unit = await prisma.unitOfMeasure.create({
    data: {
      name: "Unidade",
      abbreviation: "UN",
    },
  });
  const product = await prisma.product.create({
    data: {
      code: "0000001",
      name: "Papel A4",
      categoryId: productCategory.id,
      unitId: unit.id,
    },
  });

  return {
    product,
    productCategory,
    unit,
    user,
    warehouseCategory,
  };
}
