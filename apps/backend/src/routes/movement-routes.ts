import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler, currentUser, requireRole } from "../lib/http.js";
import { assertWarehouseAccess, warehouseScope } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  createEntry,
  createOutput,
} from "../services/movement-service.js";
import { createTransferRequest } from "../services/transfer-request-service.js";
import {
  entryInput,
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
          product: {
            include: {
              unit: true,
            },
          },
          responsibleUser: true,
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
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const input = entryInput.parse(request.body);
    response.status(201).json(
      await createEntry(prisma, {
        ...input,
        userId: currentUser(response).id,
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
