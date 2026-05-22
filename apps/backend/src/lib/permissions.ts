import { UserRole, type PrismaClient } from "@prisma/client";
import type { SessionUser } from "./auth.js";
import { AppError } from "./errors.js";

export async function assertWarehouseAccess(
  prisma: PrismaClient,
  user: SessionUser,
  warehouseId: string,
) {
  if (user.role === UserRole.ADMIN) {
    return;
  }

  const assignment = await prisma.userWarehouse.findUnique({
    where: {
      userId_warehouseId: {
        userId: user.id,
        warehouseId,
      },
    },
  });

  if (!assignment) {
    throw new AppError(403, "Este almoxarifado nao esta liberado para voce.");
  }
}

export function warehouseScope(user: SessionUser) {
  if (user.role === UserRole.ADMIN) {
    return {};
  }

  return {
    userAssignments: {
      some: {
        userId: user.id,
      },
    },
  };
}
