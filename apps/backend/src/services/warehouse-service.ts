import type { PrismaClient } from "@prisma/client";
import { AppError } from "../lib/errors.js";

export type WarehouseInput = {
  active: boolean;
  categoryId: string;
  description?: string | null;
  isGeneral: boolean;
  name: string;
};

async function assertGeneralWarehouseAvailable(
  prisma: PrismaClient,
  isGeneral: boolean,
  warehouseId?: string,
) {
  if (!isGeneral) {
    return;
  }

  const generalWarehouse = await prisma.warehouse.findFirst({
    where: {
      isGeneral: true,
      NOT: warehouseId ? { id: warehouseId } : undefined,
    },
  });

  if (generalWarehouse) {
    throw new AppError(409, "Ja existe um almoxarifado geral cadastrado.");
  }
}

export async function createWarehouse(prisma: PrismaClient, input: WarehouseInput) {
  await assertGeneralWarehouseAvailable(prisma, input.isGeneral);

  return prisma.warehouse.create({
    data: {
      active: input.active,
      categoryId: input.categoryId,
      description: input.description,
      isGeneral: input.isGeneral,
      name: input.name,
    },
    include: {
      category: true,
    },
  });
}

export async function updateWarehouse(
  prisma: PrismaClient,
  warehouseId: string,
  input: WarehouseInput,
) {
  await assertGeneralWarehouseAvailable(prisma, input.isGeneral, warehouseId);

  return prisma.warehouse.update({
    where: { id: warehouseId },
    data: {
      active: input.active,
      categoryId: input.categoryId,
      description: input.description,
      isGeneral: input.isGeneral,
      name: input.name,
    },
    include: {
      category: true,
    },
  });
}
