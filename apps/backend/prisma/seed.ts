import { MovementType, PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../src/services/auth-service.js";
import {
  restoreDefaultProductCategories,
  restoreDefaultUnits,
  restoreDefaultWarehouseCategories,
} from "../src/services/default-catalog-service.js";
import { ensureDefaultOperatorPermissionProfile } from "../src/services/permission-profile-service.js";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@prefeitura.local" },
    update: {
      name: "Administrador",
      passwordHash: await hashPassword("admin123"),
      role: UserRole.ADMIN,
      active: true,
      isDefaultAdmin: true,
    },
    create: {
      email: "admin@prefeitura.local",
      name: "Administrador",
      passwordHash: await hashPassword("admin123"),
      role: UserRole.ADMIN,
      active: true,
      isDefaultAdmin: true,
    },
  });

  const categories = await restoreDefaultWarehouseCategories(prisma);

  const [generalCategory, healthCategory, educationCategory, worksCategory] =
    categories;

  const central = await prisma.warehouse.upsert({
    where: { name: "Almoxarifado Central" },
    update: {
      description: "Almoxarifado geral da prefeitura",
      categoryId: generalCategory.id,
      isGeneral: true,
      active: true,
    },
    create: {
      name: "Almoxarifado Central",
      description: "Almoxarifado geral da prefeitura",
      categoryId: generalCategory.id,
      isGeneral: true,
      active: true,
    },
  });

  const [, healthWarehouse] =
    await Promise.all([
      Promise.resolve(central),
      prisma.warehouse.upsert({
        where: { name: "Almoxarifado da Saude" },
        update: { categoryId: healthCategory.id, active: true },
        create: {
          name: "Almoxarifado da Saude",
          description: "Apoio a saude municipal",
          categoryId: healthCategory.id,
        },
      }),
      prisma.warehouse.upsert({
        where: { name: "Almoxarifado da Educacao" },
        update: { categoryId: educationCategory.id, active: true },
        create: {
          name: "Almoxarifado da Educacao",
          description: "Apoio as escolas municipais",
          categoryId: educationCategory.id,
        },
      }),
      prisma.warehouse.upsert({
        where: { name: "Almoxarifado de Obras" },
        update: { categoryId: worksCategory.id, active: true },
        create: {
          name: "Almoxarifado de Obras",
          description: "Materiais para manutencao urbana",
          categoryId: worksCategory.id,
        },
      }),
    ]);

  const operatorProfile = await ensureDefaultOperatorPermissionProfile(prisma);
  const operator = await prisma.user.upsert({
    where: { email: "operador.saude@prefeitura.local" },
    update: {
      name: "Operador da Saude",
      passwordHash: await hashPassword("operador123"),
      permissionProfileId: operatorProfile.id,
      role: UserRole.OPERATOR,
      active: true,
    },
    create: {
      email: "operador.saude@prefeitura.local",
      name: "Operador da Saude",
      passwordHash: await hashPassword("operador123"),
      permissionProfileId: operatorProfile.id,
      role: UserRole.OPERATOR,
    },
  });

  await prisma.userWarehouse.upsert({
    where: {
      userId_warehouseId: {
        userId: operator.id,
        warehouseId: healthWarehouse.id,
      },
    },
    update: {},
    create: {
      userId: operator.id,
      warehouseId: healthWarehouse.id,
    },
  });

  const productCategories = await restoreDefaultProductCategories(prisma);

  const units = await restoreDefaultUnits(prisma);

  const [office, cleaning, medicine, food] = productCategories;
  const [unit, box, pack, liter, kilogram] = units;

  await Promise.all([
    prisma.product.upsert({
      where: { code: "0000001" },
      update: { name: "Papel A4", categoryId: office.id, unitId: pack.id },
      create: {
        code: "0000001",
        name: "Papel A4",
        description: "Pacote com folhas brancas",
        categoryId: office.id,
        unitId: pack.id,
      },
    }),
    prisma.product.upsert({
      where: { code: "0000002" },
      update: { name: "Caneta azul", categoryId: office.id, unitId: box.id },
      create: {
        code: "0000002",
        name: "Caneta azul",
        description: "Caixa com canetas esferograficas",
        categoryId: office.id,
        unitId: box.id,
      },
    }),
    prisma.product.upsert({
      where: { code: "0000003" },
      update: {
        name: "Agua sanitaria",
        categoryId: cleaning.id,
        unitId: liter.id,
      },
      create: {
        code: "0000003",
        name: "Agua sanitaria",
        description: "Reposicao para limpeza institucional",
        categoryId: cleaning.id,
        unitId: liter.id,
      },
    }),
    prisma.product.upsert({
      where: { code: "0000004" },
      update: {
        name: "Soro fisiologico",
        categoryId: medicine.id,
        unitId: unit.id,
      },
      create: {
        code: "0000004",
        name: "Soro fisiologico",
        description: "Frasco para unidades de saude",
        categoryId: medicine.id,
        unitId: unit.id,
      },
    }),
    prisma.product.upsert({
      where: { code: "0000005" },
      update: { name: "Arroz", categoryId: food.id, unitId: kilogram.id },
      create: {
        code: "0000005",
        name: "Arroz",
        description: "Item basico de merenda escolar",
        categoryId: food.id,
        unitId: kilogram.id,
      },
    }),
  ]);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
