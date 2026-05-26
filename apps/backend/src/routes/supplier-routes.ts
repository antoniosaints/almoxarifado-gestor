import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler, requireRole } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { supplierInput, idParam } from "../validators/inputs.js";

export const supplierRoutes = Router();

supplierRoutes.get(
  "/",
  asyncHandler(async (request, response) => {
    const search =
      typeof request.query.search === "string" && request.query.search.trim()
        ? request.query.search.trim()
        : undefined;
    const active =
      request.query.active === "true"
        ? true
        : request.query.active === "false"
          ? false
          : undefined;

    response.json(
      await prisma.supplier.findMany({
        orderBy: [{ active: "desc" }, { name: "asc" }],
        where: {
          active,
          OR: search
            ? [
                { cnpj: { contains: search.replace(/\D/g, "") || search } },
                { name: { contains: search } },
                { tradeName: { contains: search } },
              ]
            : undefined,
        },
      }),
    );
  }),
);

supplierRoutes.post(
  "/",
  asyncHandler(async (request, response) => {
    const input = supplierInput.parse(request.body);

    response.status(201).json(
      await prisma.supplier.create({
        data: input,
      }),
    );
  }),
);

supplierRoutes.put(
  "/:id",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const input = supplierInput.parse(request.body);

    response.json(
      await prisma.supplier.update({
        data: input,
        where: { id },
      }),
    );
  }),
);

supplierRoutes.delete(
  "/:id",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const invoiceCount = await prisma.invoice.count({
      where: { supplierId: id },
    });

    if (invoiceCount) {
      await prisma.supplier.update({
        data: { active: false },
        where: { id },
      });
    } else {
      await prisma.supplier.delete({ where: { id } });
    }

    response.status(204).send();
  }),
);
