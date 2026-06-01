import { Router } from "express";
import { asyncHandler, requirePermission } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { idParam, productCategoryInput } from "../validators/inputs.js";

export const productCategoryRoutes = Router();

productCategoryRoutes.get(
  "/",
  asyncHandler(async (_request, response) => {
    response.json(await prisma.productCategory.findMany({ orderBy: { name: "asc" } }));
  }),
);

productCategoryRoutes.post(
  "/",
  requirePermission("MANAGE_CATEGORIES"),
  asyncHandler(async (request, response) => {
    const data = productCategoryInput.parse(request.body);
    response.status(201).json(await prisma.productCategory.create({ data }));
  }),
);

productCategoryRoutes.put(
  "/:id",
  requirePermission("MANAGE_CATEGORIES"),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const data = productCategoryInput.parse(request.body);
    response.json(await prisma.productCategory.update({ where: { id }, data }));
  }),
);

productCategoryRoutes.delete(
  "/:id",
  requirePermission("MANAGE_CATEGORIES"),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    await prisma.productCategory.delete({ where: { id } });
    response.status(204).send();
  }),
);
