import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler, currentUser, requireRole } from "../lib/http.js";
import { assertWarehouseAccess, warehouseScope } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  approveEntryRequest,
  createEntryRequest,
  rejectEntryRequest,
} from "../services/entry-request-service.js";
import {
  entryRequestApprovalInput,
  entryRequestInput,
  idParam,
} from "../validators/inputs.js";

export const entryRequestRoutes = Router();

const entryRequestInclude = {
  product: {
    include: {
      unit: true,
    },
  },
  requestedBy: {
    select: {
      email: true,
      id: true,
      name: true,
    },
  },
  reviewedBy: {
    select: {
      email: true,
      id: true,
      name: true,
    },
  },
  warehouse: {
    include: {
      category: true,
    },
  },
} as const;

entryRequestRoutes.get(
  "/available-products",
  asyncHandler(async (request, response) => {
    const warehouseId =
      typeof request.query.warehouseId === "string" && request.query.warehouseId
        ? request.query.warehouseId
        : undefined;

    response.json(
      await prisma.product.findMany({
        where: {
          active: true,
          stocks: {
            some: warehouseId
              ? { warehouseId }
              : {
                  currentQuantity: { gt: 0 },
                  warehouse: {
                    active: true,
                    isGeneral: true,
                  },
                },
          },
        },
        include: {
          category: true,
          unit: true,
        },
        orderBy: { code: "asc" },
      }),
    );
  }),
);

entryRequestRoutes.get(
  "/",
  asyncHandler(async (_request, response) => {
    const user = currentUser(response);

    response.json(
      await prisma.entryRequest.findMany({
        where: {
          warehouse: warehouseScope(user),
        },
        include: entryRequestInclude,
        orderBy: { createdAt: "desc" },
      }),
    );
  }),
);

entryRequestRoutes.post(
  "/",
  requireRole(UserRole.OPERATOR),
  asyncHandler(async (request, response) => {
    const user = currentUser(response);
    const input = entryRequestInput.parse(request.body);
    await assertWarehouseAccess(prisma, user, input.warehouseId);

    response.status(201).json(
      await createEntryRequest(prisma, {
        ...input,
        requestedById: user.id,
      }),
    );
  }),
);

entryRequestRoutes.post(
  "/:id/approve",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const input = entryRequestApprovalInput.parse(request.body ?? {});

    response.json(
      await approveEntryRequest(prisma, {
        invoiceId: input.invoiceId,
        requestId: id,
        reviewedById: currentUser(response).id,
      }),
    );
  }),
);

entryRequestRoutes.post(
  "/:id/reject",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    response.json(
      await rejectEntryRequest(prisma, id, currentUser(response).id),
    );
  }),
);
