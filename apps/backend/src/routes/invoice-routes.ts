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
  getActiveSupplierOrThrow,
  invoiceSnapshotFromSupplier,
} from "../services/supplier-service.js";
import {
  idParam,
  invoiceXmlImportInput,
  invoiceXmlPreviewInput,
  supplierBackedInvoiceInput,
} from "../validators/inputs.js";

export const invoiceRoutes = Router();

invoiceRoutes.get(
  "/",
  asyncHandler(async (request, response) => {
    const user = currentUser(response);
    const supplierId =
      typeof request.query.supplierId === "string" && request.query.supplierId
        ? request.query.supplierId
        : undefined;
    const scopedMovementWhere = {
      warehouse: warehouseScope(user),
    };

    response.json(
      await prisma.invoice.findMany({
        include: {
          supplier: true,
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
              sourceUnit: true,
              warehouse: true,
            },
            orderBy: { movementDate: "desc" },
          },
        },
        orderBy: [{ issueDate: "desc" }, { number: "asc" }],
        where:
          user.role === UserRole.ADMIN
            ? { supplierId }
            : {
                supplierId,
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
    const input = supplierBackedInvoiceInput.parse(request.body);
    const supplier = await getActiveSupplierOrThrow(prisma, input.supplierId);
    response.status(201).json(
      await prisma.invoice.create({
        data: {
          invoiceKey: input.invoiceKey,
          issueDate: input.issueDate,
          number: input.number,
          observation: input.observation,
          series: input.series,
          supplierId: supplier.id,
          totalValue: input.totalValue ?? 0,
          ...invoiceSnapshotFromSupplier(supplier),
        },
        include: { supplier: true },
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
