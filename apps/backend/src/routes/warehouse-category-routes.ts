import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler, requireRole } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { idParam, warehouseCategoryInput } from "../validators/inputs.js";

export const warehouseCategoryRoutes = Router();

warehouseCategoryRoutes.get(
  "/",
  asyncHandler(async (_request, response) => {
    response.json(
      await prisma.warehouseCategory.findMany({
        orderBy: { name: "asc" },
      }),
    );
  }),
);

warehouseCategoryRoutes.post(
  "/",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const data = warehouseCategoryInput.parse(request.body);
    response.status(201).json(await prisma.warehouseCategory.create({ data }));
  }),
);

warehouseCategoryRoutes.put(
  "/:id",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const data = warehouseCategoryInput.parse(request.body);
    response.json(await prisma.warehouseCategory.update({ where: { id }, data }));
  }),
);

warehouseCategoryRoutes.delete(
  "/:id",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    await prisma.warehouseCategory.delete({ where: { id } });
    response.status(204).send();
  }),
);
