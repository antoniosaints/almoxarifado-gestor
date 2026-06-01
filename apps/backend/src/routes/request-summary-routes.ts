import { RequestStatus, TransferRequestStatus, UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler, currentUser } from "../lib/http.js";
import { hasPermission, warehouseScope } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";

export const requestSummaryRoutes = Router();

requestSummaryRoutes.get(
  "/summary",
  asyncHandler(async (_request, response) => {
    const user = currentUser(response);
    const [pendingEntryRequests, pendingReceipts] = await Promise.all([
      hasPermission(user, "APPROVE_REQUESTS")
        ? prisma.entryRequest.count({
            where: { status: RequestStatus.PENDING },
          })
        : Promise.resolve(0),
      hasPermission(user, "APPROVE_TRANSFERS")
        ? prisma.transferRequest.count({
            where: {
              destinationWarehouse:
                user.role === UserRole.ADMIN ? undefined : warehouseScope(user),
              status: TransferRequestStatus.PENDING_RECEIPT,
            },
          })
        : Promise.resolve(0),
    ]);

    response.json({
      pendingEntryRequests,
      pendingReceipts,
      total: pendingEntryRequests + pendingReceipts,
    });
  }),
);
