import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler, currentUser, requirePermission } from "../lib/http.js";
import { assertWarehouseAccess, warehouseScope } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  cancelTransferRequest,
  receiveTransferRequest,
} from "../services/transfer-request-service.js";
import { productConversionsInclude } from "../services/unit-conversion-service.js";
import { idParam } from "../validators/inputs.js";

export const transferRequestRoutes = Router();

const transferRequestInclude = {
  createdBy: {
    select: {
      email: true,
      id: true,
      name: true,
    },
  },
  destinationWarehouse: {
    include: {
      category: true,
    },
  },
  product: {
    include: {
      unit: true,
      ...productConversionsInclude,
    },
  },
  receivedBy: {
    select: {
      email: true,
      id: true,
      name: true,
    },
  },
  sourceWarehouse: {
    include: {
      category: true,
    },
  },
  sourceUnit: true,
} as const;

transferRequestRoutes.get(
  "/",
  asyncHandler(async (_request, response) => {
    const user = currentUser(response);

    response.json(
      await prisma.transferRequest.findMany({
        where:
          user.role === UserRole.ADMIN
            ? {}
            : {
                destinationWarehouse: warehouseScope(user),
              },
        include: transferRequestInclude,
        orderBy: { createdAt: "desc" },
      }),
    );
  }),
);

transferRequestRoutes.post(
  "/:id/receive",
  requirePermission("APPROVE_TRANSFERS"),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const user = currentUser(response);
    const transfer = await prisma.transferRequest.findUniqueOrThrow({
      where: { id },
      select: {
        destinationWarehouseId: true,
      },
    });

    await assertWarehouseAccess(prisma, user, transfer.destinationWarehouseId);

    response.json(
      await receiveTransferRequest(prisma, {
        receivedById: user.id,
        requestId: id,
      }),
    );
  }),
);

transferRequestRoutes.post(
  "/:id/cancel",
  requirePermission("APPROVE_TRANSFERS"),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const user = currentUser(response);
    const transfer = await prisma.transferRequest.findUniqueOrThrow({
      where: { id },
      select: {
        destinationWarehouseId: true,
      },
    });

    await assertWarehouseAccess(prisma, user, transfer.destinationWarehouseId);

    response.json(
      await cancelTransferRequest(prisma, {
        cancelledById: user.id,
        requestId: id,
      }),
    );
  }),
);
