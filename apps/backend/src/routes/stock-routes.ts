import { MovementType, Prisma, UserRole } from "@prisma/client";
import { Router } from "express";
import { AppError } from "../lib/errors.js";
import { asyncHandler, currentUser, requirePermission, requireRole } from "../lib/http.js";
import { warehouseScope } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import { passwordMatches } from "../services/auth-service.js";
import { productConversionsInclude } from "../services/unit-conversion-service.js";
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
      ...productConversionsInclude,
    },
  },
  warehouse: {
    include: {
      category: true,
    },
  },
} as const;

type StockForDeletion = {
  currentQuantity: number;
  id: string;
  minimumQuantity: number;
  productId: string;
  warehouseId: string;
  product?: {
    code: string;
    name: string;
  };
  warehouse?: {
    name: string;
  };
};

async function assertCurrentAdminPassword(userId: string, password: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!passwordMatches(password, user.passwordHash)) {
    throw new AppError(401, "Senha do admin inválida.");
  }
}

function movementWhereForStocks(stocks: StockForDeletion[]) {
  return {
    OR: stocks.flatMap((stock) => [
      { stockId: stock.id },
      {
        productId: stock.productId,
        stockId: null,
        warehouseId: stock.warehouseId,
      },
    ]),
  };
}

function movementBelongsToStock(
  movement: { productId: string; stockId: string | null; warehouseId: string },
  stock: StockForDeletion,
) {
  return (
    movement.stockId === stock.id ||
    (!movement.stockId &&
      movement.productId === stock.productId &&
      movement.warehouseId === stock.warehouseId)
  );
}

function stockDeletionDetails(
  stock: StockForDeletion,
  movements: Array<{
    id: string;
    invoiceId: string | null;
    productId: string;
    stockId: string | null;
    warehouseId: string;
  }>,
) {
  const stockMovements = movements.filter((movement) =>
    movementBelongsToStock(movement, stock),
  );

  return JSON.stringify({
    currentQuantity: stock.currentQuantity,
    invoiceIds: [
      ...new Set(
        stockMovements
          .map((movement) => movement.invoiceId)
          .filter((invoiceId): invoiceId is string => Boolean(invoiceId)),
      ),
    ],
    minimumQuantity: stock.minimumQuantity,
    movementCount: stockMovements.length,
    movementIds: stockMovements.map((movement) => movement.id),
    product: stock.product
      ? {
          code: stock.product.code,
          id: stock.productId,
          name: stock.product.name,
        }
      : { id: stock.productId },
    warehouse: stock.warehouse
      ? {
          id: stock.warehouseId,
          name: stock.warehouse.name,
        }
      : { id: stock.warehouseId },
  });
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
  requirePermission("ZERO_STOCKS"),
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
      throw new AppError(404, "Um ou mais estoques selecionados não foram encontrados.");
    }

    const movementDate = new Date();

    await prisma.$transaction(
      stocks.flatMap((stock) => {
        const operations: Prisma.PrismaPromise<unknown>[] = [
          prisma.auditLog.create({
            data: {
              action: "ZERO",
              details: JSON.stringify({
                previousQuantity: stock.currentQuantity,
                productId: stock.productId,
                warehouseId: stock.warehouseId,
              }),
              entity: "Stock",
              entityId: stock.id,
              userId: user.id,
            },
          }),
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
                observation: "Estoque zerado por ação administrativa em lote.",
                productId: stock.productId,
                quantity: stock.currentQuantity,
                responsibleUserId: user.id,
                stockId: stock.id,
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
  requirePermission("DELETE_STOCKS"),
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
      throw new AppError(404, "Um ou mais estoques selecionados não foram encontrados.");
    }

    const movements = await prisma.stockMovement.findMany({
      where: movementWhereForStocks(stocks),
      select: {
        id: true,
        invoiceId: true,
        productId: true,
        stockId: true,
        warehouseId: true,
      },
    });

    await prisma.$transaction(async (transaction) => {
      await transaction.auditLog.createMany({
        data: stocks.map((stock) => ({
          action: "DELETE",
          details: stockDeletionDetails(stock, movements),
          entity: "Stock",
          entityId: stock.id,
          userId: user.id,
        })),
      });

      await transaction.stockMovement.deleteMany({
        where: {
          id: { in: movements.map((movement) => movement.id) },
        },
      });

      await transaction.stock.deleteMany({
        where: {
          id: { in: input.stockIds },
        },
      });
    });

    response.json({ count: stocks.length, movementCount: movements.length });
  }),
);

stockRoutes.delete(
  "/:id",
  requirePermission("DELETE_STOCKS"),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const user = currentUser(response);
    const stock = await prisma.stock.findUniqueOrThrow({
      where: { id },
      include: stockInclude,
    });
    const movements = await prisma.stockMovement.findMany({
      where: movementWhereForStocks([stock]),
      select: {
        id: true,
        invoiceId: true,
        productId: true,
        stockId: true,
        warehouseId: true,
      },
    });

    await prisma.$transaction(async (transaction) => {
      await transaction.auditLog.create({
        data: {
          action: "DELETE",
          details: stockDeletionDetails(stock, movements),
          entity: "Stock",
          entityId: stock.id,
          userId: user.id,
        },
      });

      await transaction.stockMovement.deleteMany({
        where: {
          id: { in: movements.map((movement) => movement.id) },
        },
      });

      await transaction.stock.delete({ where: { id } });
    });

    response.status(204).send();
  }),
);
