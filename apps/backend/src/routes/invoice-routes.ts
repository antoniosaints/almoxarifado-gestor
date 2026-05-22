import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler, requireRole } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { invoiceInput } from "../validators/inputs.js";

export const invoiceRoutes = Router();

invoiceRoutes.use(requireRole(UserRole.ADMIN));

invoiceRoutes.get(
  "/",
  asyncHandler(async (_request, response) => {
    response.json(
      await prisma.invoice.findMany({
        include: {
          movements: {
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
