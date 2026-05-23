import { MovementType, Prisma, UserRole } from "@prisma/client";
import { Router } from "express";
import { AppError } from "../lib/errors.js";
import { asyncHandler, currentUser, requireRole } from "../lib/http.js";
import { warehouseScope } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import { passwordMatches } from "../services/auth-service.js";
import {
  idParam,
  minimumStockInput,
  stockBulkAdminInput,
} from "../validators/inputs.js";

export const stockRoutes = Router();

const stockInclude = {
  product: {
    include: {
      category: true,
      unit: true,
    },
  },
  warehouse: {
    include: {
      category: true,
    },
  },
} as const;

async function assertCurrentAdminPassword(userId: string, password: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!passwordMatches(password, user.passwordHash)) {
    throw new AppError(401, "Senha do admin invalida.");
  }
}

stockRoutes.get(
  "/",
  asyncHandler(async (_request, response) => {
    response.json(
      await prisma.stock.findMany({
        where: {
          warehouse: warehouseScope(currentUser(response)),
        },
        include: stockInclude,
        orderBy: [{ warehouse: { name: "asc" } }, { product: { name: "asc" } }],
      }),
    );
  }),
);

stockRoutes.put(
  "/:id/minimum",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const data = minimumStockInput.parse(request.body);
    response.json(
      await prisma.stock.update({
        where: { id },
        data,
        include: stockInclude,
      }),
    );
  }),
);

stockRoutes.post(
  "/bulk-zero",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const user = currentUser(response);
    const input = stockBulkAdminInput.parse(request.body);
    await assertCurrentAdminPassword(user.id, input.password);

    const stocks = await prisma.stock.findMany({
      where: {
        id: { in: input.stockIds },
      },
      include: stockInclude,
    });

    if (stocks.length !== new Set(input.stockIds).size) {
      throw new AppError(404, "Um ou mais estoques selecionados nao foram encontrados.");
    }

    const movementDate = new Date();

    await prisma.$transaction(
      stocks.flatMap((stock) => {
        const operations: Prisma.PrismaPromise<unknown>[] = [
          prisma.stock.update({
            where: { id: stock.id },
            data: {
              currentQuantity: 0,
              lastMovementAt: movementDate,
              totalValue: 0,
            },
          }),
        ];

        if (stock.currentQuantity > 0) {
          operations.push(
            prisma.stockMovement.create({
              data: {
                destinationNote: "Zerado por ajuste administrativo.",
                movementDate,
                observation: "Estoque zerado por acao administrativa em lote.",
                productId: stock.productId,
                quantity: stock.currentQuantity,
                responsibleUserId: user.id,
                type: MovementType.SAIDA,
                warehouseId: stock.warehouseId,
              },
            }),
          );
        }

        return operations;
      }),
    );

    response.json({
      count: stocks.length,
      stocks: await prisma.stock.findMany({
        where: { id: { in: input.stockIds } },
        include: stockInclude,
        orderBy: [{ warehouse: { name: "asc" } }, { product: { name: "asc" } }],
      }),
    });
  }),
);

stockRoutes.post(
  "/bulk-delete",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const user = currentUser(response);
    const input = stockBulkAdminInput.parse(request.body);
    await assertCurrentAdminPassword(user.id, input.password);

    const found = await prisma.stock.count({
      where: {
        id: { in: input.stockIds },
      },
    });

    if (found !== new Set(input.stockIds).size) {
      throw new AppError(404, "Um ou mais estoques selecionados nao foram encontrados.");
    }

    await prisma.stock.deleteMany({
      where: {
        id: { in: input.stockIds },
      },
    });

    response.json({ count: found });
  }),
);

stockRoutes.delete(
  "/:id",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const stock = await prisma.stock.findUniqueOrThrow({
      where: { id },
    });
    const movementCount = await prisma.stockMovement.count({
      where: {
        productId: stock.productId,
        warehouseId: stock.warehouseId,
      },
    });

    if (movementCount) {
      response.status(409).json({
        message: "Este estoque possui movimentacoes e nao pode ser removido.",
      });
      return;
    }

    await prisma.stock.delete({ where: { id } });
    response.status(204).send();
  }),
);
