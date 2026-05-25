import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler, currentUser, requireRole } from "../lib/http.js";
import { assertWarehouseAccess, warehouseScope } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  importWarehouseCsv,
  previewWarehouseCsvImport,
} from "../services/stock-csv-import-service.js";
import { createWarehouse, updateWarehouse } from "../services/warehouse-service.js";
import {
  idParam,
  warehouseCsvImportInput,
  warehouseCsvPreviewInput,
  warehouseIdParam,
  warehouseInput,
} from "../validators/inputs.js";

export const warehouseRoutes = Router();

const warehouseInclude = {
  category: true,
  stocks: {
    include: {
      product: {
        include: {
          category: true,
          unit: true,
        },
      },
    },
  },
} as const;

function withWarehouseSummary<
  T extends {
    stocks: Array<{ currentQuantity: number; minimumQuantity: number }>;
    movements?: Array<{ movementDate: Date }>;
  },
>(warehouse: T) {
  return {
    ...warehouse,
    summary: {
      lowStockItems: warehouse.stocks.filter(
        (stock) =>
          stock.currentQuantity > 0 && stock.currentQuantity <= stock.minimumQuantity,
      ).length,
      outOfStockItems: warehouse.stocks.filter((stock) => stock.currentQuantity === 0)
        .length,
      stockedProducts: warehouse.stocks.filter((stock) => stock.currentQuantity > 0)
        .length,
      lastMovementAt: warehouse.movements?.[0]?.movementDate ?? null,
    },
  };
}

warehouseRoutes.get(
  "/",
  asyncHandler(async (_request, response) => {
    const warehouses = await prisma.warehouse.findMany({
      where: warehouseScope(currentUser(response)),
      include: {
        ...warehouseInclude,
        movements: {
          orderBy: { movementDate: "desc" },
          select: { movementDate: true },
          take: 1,
        },
      },
      orderBy: [{ isGeneral: "desc" }, { name: "asc" }],
    });

    response.json(warehouses.map(withWarehouseSummary));
  }),
);

warehouseRoutes.get(
  "/:warehouseId/stocks",
  asyncHandler(async (request, response) => {
    const { warehouseId } = warehouseIdParam.parse(request.params);
    await assertWarehouseAccess(prisma, currentUser(response), warehouseId);
    response.json(
      await prisma.stock.findMany({
        where: { warehouseId },
        include: {
          product: {
            include: {
              category: true,
              unit: true,
            },
          },
          warehouse: {
            include: { category: true },
          },
        },
        orderBy: { product: { name: "asc" } },
      }),
    );
  }),
);

warehouseRoutes.post(
  "/:warehouseId/import-csv/preview",
  asyncHandler(async (request, response) => {
    const { warehouseId } = warehouseIdParam.parse(request.params);
    const input = warehouseCsvPreviewInput.parse(request.body);
    await assertWarehouseAccess(prisma, currentUser(response), warehouseId);

    response.json(
      await previewWarehouseCsvImport(prisma, {
        ...input,
        warehouseId,
      }),
    );
  }),
);

warehouseRoutes.post(
  "/:warehouseId/import-csv",
  asyncHandler(async (request, response) => {
    const { warehouseId } = warehouseIdParam.parse(request.params);
    const user = currentUser(response);
    const input = warehouseCsvImportInput.parse(request.body);
    await assertWarehouseAccess(prisma, user, warehouseId);

    response.status(201).json(
      await importWarehouseCsv(prisma, {
        ...input,
        userId: user.id,
        warehouseId,
      }),
    );
  }),
);

warehouseRoutes.get(
  "/:id",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    await assertWarehouseAccess(prisma, currentUser(response), id);
    const warehouse = await prisma.warehouse.findUniqueOrThrow({
      where: { id },
      include: {
        ...warehouseInclude,
        movements: {
          include: {
            destinationWarehouse: true,
            product: {
              include: {
                unit: true,
              },
            },
            sourceWarehouse: true,
          },
          orderBy: { movementDate: "desc" },
          take: 25,
        },
      },
    });
    response.json(withWarehouseSummary(warehouse));
  }),
);

warehouseRoutes.post(
  "/",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const data = warehouseInput.parse(request.body);
    response.status(201).json(await createWarehouse(prisma, data));
  }),
);

warehouseRoutes.put(
  "/:id",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const data = warehouseInput.parse(request.body);
    response.json(await updateWarehouse(prisma, id, data));
  }),
);

warehouseRoutes.delete(
  "/:id",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    await prisma.warehouse.delete({ where: { id } });
    response.status(204).send();
  }),
);
