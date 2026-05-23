import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler, currentUser } from "../lib/http.js";
import { assertWarehouseAccess, warehouseScope } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  importInvoiceXml,
  previewInvoiceXml,
} from "../services/invoice-xml-service.js";
import {
  invoiceInput,
  invoiceXmlImportInput,
  invoiceXmlPreviewInput,
} from "../validators/inputs.js";

export const invoiceRoutes = Router();

invoiceRoutes.get(
  "/",
  asyncHandler(async (_request, response) => {
    const user = currentUser(response);
    const scopedMovementWhere = {
      warehouse: warehouseScope(user),
    };

    response.json(
      await prisma.invoice.findMany({
        include: {
          movements: {
            where: user.role === UserRole.ADMIN ? undefined : scopedMovementWhere,
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
          },
        },
        orderBy: [{ issueDate: "desc" }, { number: "asc" }],
        where:
          user.role === UserRole.ADMIN
            ? undefined
            : {
                movements: {
                  some: scopedMovementWhere,
                },
              },
      }),
    );
  }),
);

invoiceRoutes.post(
  "/",
  asyncHandler(async (request, response) => {
    const input = invoiceInput.parse(request.body);
    response.status(201).json(
      await prisma.invoice.create({
        data: input,
      }),
    );
  }),
);

invoiceRoutes.post(
  "/import-xml/preview",
  asyncHandler(async (request, response) => {
    const input = invoiceXmlPreviewInput.parse(request.body);

    response.json(await previewInvoiceXml(prisma, input));
  }),
);

invoiceRoutes.post(
  "/import-xml",
  asyncHandler(async (request, response) => {
    const user = currentUser(response);
    const input = invoiceXmlImportInput.parse(request.body);
    await assertWarehouseAccess(prisma, user, input.warehouseId);

    response.status(201).json(
      await importInvoiceXml(prisma, {
        ...input,
        userId: user.id,
      }),
    );
  }),
);
