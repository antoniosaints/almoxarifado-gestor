import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler, requireRole } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { createProduct, updateProduct } from "../services/product-service.js";
import { idParam, productInput } from "../validators/inputs.js";

export const productRoutes = Router();

productRoutes.get(
  "/",
  asyncHandler(async (_request, response) => {
    response.json(
      await prisma.product.findMany({
        include: {
          category: true,
          unit: true,
        },
        orderBy: { code: "asc" },
      }),
    );
  }),
);

productRoutes.get(
  "/:id",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    response.json(
      await prisma.product.findUniqueOrThrow({
        where: { id },
        include: {
          category: true,
          unit: true,
        },
      }),
    );
  }),
);

productRoutes.post(
  "/",
  asyncHandler(async (request, response) => {
    const data = productInput.parse(request.body);
    response.status(201).json(await createProduct(prisma, data));
  }),
);

productRoutes.put(
  "/:id",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const data = productInput.parse(request.body);
    response.json(await updateProduct(prisma, id, data));
  }),
);

productRoutes.delete(
  "/:id",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    await prisma.product.delete({ where: { id } });
    response.status(204).send();
  }),
);
