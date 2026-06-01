import { Router } from "express";
import { asyncHandler, requirePermission } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { idParam, unitInput } from "../validators/inputs.js";

export const unitRoutes = Router();

unitRoutes.get(
  "/",
  asyncHandler(async (_request, response) => {
    response.json(await prisma.unitOfMeasure.findMany({ orderBy: { name: "asc" } }));
  }),
);

unitRoutes.post(
  "/",
  requirePermission("MANAGE_UNITS"),
  asyncHandler(async (request, response) => {
    const data = unitInput.parse(request.body);
    response.status(201).json(await prisma.unitOfMeasure.create({ data }));
  }),
);

unitRoutes.put(
  "/:id",
  requirePermission("MANAGE_UNITS"),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const data = unitInput.parse(request.body);
    response.json(await prisma.unitOfMeasure.update({ where: { id }, data }));
  }),
);

unitRoutes.delete(
  "/:id",
  requirePermission("MANAGE_UNITS"),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    await prisma.unitOfMeasure.delete({ where: { id } });
    response.status(204).send();
  }),
);
