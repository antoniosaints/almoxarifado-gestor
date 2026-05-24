import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler, currentUser, requireRole } from "../lib/http.js";
import { assertWarehouseAccess, warehouseScope } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import {
  importInvoiceXml,
  previewInvoiceXml,
} from "../services/invoice-xml-service.js";
import {
  idParam,
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

invoiceRoutes.delete(
  "/:id",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const user = currentUser(response);
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id },
      include: {
        movements: {
          select: {
            id: true,
            productId: true,
            quantity: true,
            stockId: true,
            warehouseId: true,
          },
        },
      },
    });

    await prisma.$transaction(async (transaction) => {
      await transaction.auditLog.create({
        data: {
          action: "DELETE",
          details: JSON.stringify({
            cnpj: invoice.cnpj,
            movementCount: invoice.movements.length,
            movementIds: invoice.movements.map((movement) => movement.id),
            number: invoice.number,
          }),
          entity: "Invoice",
          entityId: invoice.id,
          userId: user.id,
        },
      });

      await transaction.invoice.delete({
        where: { id },
      });
    });

    response.status(204).send();
  }),
);
