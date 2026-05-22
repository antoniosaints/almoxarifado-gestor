import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler, currentUser, requireRole } from "../lib/http.js";
import { warehouseScope } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import { idParam, minimumStockInput } from "../validators/inputs.js";

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
