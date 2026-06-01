import { UserRole } from "@prisma/client";
import { Router } from "express";
import { AppError } from "../lib/errors.js";
import { asyncHandler, requirePermission, requireRole } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import {
  importProductsCsv,
  previewProductsCsvImport,
} from "../services/product-csv-import-service.js";
import {
  createProduct,
  createUnitConversion,
  deleteUnitConversion,
  updateProduct,
  updateUnitConversion,
} from "../services/product-service.js";
import { productConversionsInclude } from "../services/unit-conversion-service.js";
import {
  idParam,
  productCsvImportInput,
  productCsvPreviewInput,
  productInput,
  unitConversionInput,
} from "../validators/inputs.js";

export const productRoutes = Router();

function routeParam(value: string | string[] | undefined) {
  const normalized = Array.isArray(value) ? value[0] : value;

  if (!normalized) {
    throw new AppError(400, "Parametro invalido.");
  }

  return normalized;
}

productRoutes.get(
  "/",
  asyncHandler(async (_request, response) => {
    response.json(
      await prisma.product.findMany({
        include: {
          category: true,
          unit: true,
          ...productConversionsInclude,
        },
        orderBy: { code: "asc" },
      }),
    );
  }),
);

productRoutes.post(
  "/import-csv/preview",
  requirePermission("IMPORT_PRODUCTS_CSV"),
  asyncHandler(async (request, response) => {
    const input = productCsvPreviewInput.parse(request.body);

    response.json(await previewProductsCsvImport(prisma, input));
  }),
);

productRoutes.post(
  "/import-csv",
  requirePermission("IMPORT_PRODUCTS_CSV"),
  asyncHandler(async (request, response) => {
    const input = productCsvImportInput.parse(request.body);

    response.status(201).json(await importProductsCsv(prisma, input));
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
          ...productConversionsInclude,
        },
      }),
    );
  }),
);

productRoutes.get(
  "/:id/unit-conversions",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    response.json(
      await prisma.unitConversion.findMany({
        include: {
          fromUnit: true,
        },
        orderBy: { fromUnit: { abbreviation: "asc" } },
        where: { productId: id },
      }),
    );
  }),
);

productRoutes.post(
  "/:id/unit-conversions",
  requirePermission("MANAGE_UNIT_CONVERSIONS"),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const data = unitConversionInput.parse(request.body);
    response.status(201).json(await createUnitConversion(prisma, id, data));
  }),
);

productRoutes.put(
  "/:id/unit-conversions/:conversionId",
  requirePermission("MANAGE_UNIT_CONVERSIONS"),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const conversionId = routeParam(request.params.conversionId);
    const data = unitConversionInput.parse(request.body);
    response.json(await updateUnitConversion(prisma, id, conversionId, data));
  }),
);

productRoutes.delete(
  "/:id/unit-conversions/:conversionId",
  requirePermission("MANAGE_UNIT_CONVERSIONS"),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const conversionId = routeParam(request.params.conversionId);
    await deleteUnitConversion(prisma, id, conversionId);
    response.status(204).send();
  }),
);

productRoutes.post(
  "/",
  requirePermission("CREATE_PRODUCTS"),
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
