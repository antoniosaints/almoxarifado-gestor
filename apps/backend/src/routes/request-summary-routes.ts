import { RequestStatus, TransferRequestStatus, UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler, currentUser } from "../lib/http.js";
import { warehouseScope } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";

export const requestSummaryRoutes = Router();

requestSummaryRoutes.get(
  "/summary",
  asyncHandler(async (_request, response) => {
    const user = currentUser(response);
    const [pendingEntryRequests, pendingReceipts] = await Promise.all([
      user.role === UserRole.ADMIN
        ? prisma.entryRequest.count({
            where: { status: RequestStatus.PENDING },
          })
        : Promise.resolve(0),
      prisma.transferRequest.count({
        where: {
          destinationWarehouse:
            user.role === UserRole.ADMIN ? undefined : warehouseScope(user),
          status: TransferRequestStatus.PENDING_RECEIPT,
        },
      }),
    ]);

    response.json({
      pendingEntryRequests,
      pendingReceipts,
      total: pendingEntryRequests + pendingReceipts,
    });
  }),
);
