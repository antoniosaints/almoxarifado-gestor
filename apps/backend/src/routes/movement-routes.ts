import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler, currentUser, requirePermission, requireRole } from "../lib/http.js";
import { assertWarehouseAccess, warehouseScope } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  createEntry,
  createOutput,
  deleteStockMovement,
} from "../services/movement-service.js";
import { createTransferRequest } from "../services/transfer-request-service.js";
import {
  entryInput,
  idParam,
  movementQuery,
  outputInput,
  transferInput,
} from "../validators/inputs.js";

export const movementRoutes = Router();

movementRoutes.get(
  "/",
  asyncHandler(async (request, response) => {
    const query = movementQuery.parse(request.query);
    const user = currentUser(response);

    if (query.warehouseId) {
      await assertWarehouseAccess(prisma, user, query.warehouseId);
    }

    response.json(
      await prisma.stockMovement.findMany({
        where: {
          movementDate:
            query.from || query.to
              ? {
                  gte: query.from,
                  lte: query.to,
                }
              : undefined,
          productId: query.productId,
          type: query.type,
          warehouseId: query.warehouseId,
          warehouse: warehouseScope(user),
        },
        include: {
          destinationWarehouse: true,
          invoice: {
            include: {
              supplier: true,
            },
          },
          product: {
            include: {
              unit: true,
            },
          },
          responsibleUser: true,
          sourceUnit: true,
          sourceWarehouse: true,
          warehouse: true,
        },
        orderBy: { movementDate: "desc" },
      }),
    );
  }),
);

movementRoutes.post(
  "/entry",
  asyncHandler(async (request, response) => {
    const user = currentUser(response);
    const input = entryInput.parse(request.body);
    await assertWarehouseAccess(prisma, user, input.warehouseId);
    response.status(201).json(
      await createEntry(prisma, {
        ...input,
        invoiceId: input.invoiceId ?? null,
        unitPrice: input.unitPrice ?? null,
        userId: user.id,
      }),
    );
  }),
);

movementRoutes.post(
  "/output",
  asyncHandler(async (request, response) => {
    const input = outputInput.parse(request.body);
    await assertWarehouseAccess(prisma, currentUser(response), input.warehouseId);
    response.status(201).json(
      await createOutput(prisma, {
        ...input,
        userId: currentUser(response).id,
      }),
    );
  }),
);

movementRoutes.post(
  "/transfer",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const input = transferInput.parse(request.body);
    response.status(201).json(
      await createTransferRequest(prisma, {
        ...input,
        createdById: currentUser(response).id,
      }),
    );
  }),
);

movementRoutes.delete(
  "/:id",
  requirePermission("DELETE_STOCKS"),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const user = currentUser(response);
    const movement = await prisma.stockMovement.findUniqueOrThrow({
      where: { id },
      select: { warehouseId: true },
    });

    await assertWarehouseAccess(prisma, user, movement.warehouseId);
    await deleteStockMovement(prisma, {
      movementId: id,
      userId: user.id,
    });

    response.status(204).send();
  }),
);
