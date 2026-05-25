import { UserRole } from "@prisma/client";
import { Router } from "express";
import { AppError } from "../lib/errors.js";
import { asyncHandler, currentUser, requireRole } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { passwordMatches } from "../services/auth-service.js";
import {
  restoreDefaultProductCategories,
  restoreDefaultUnits,
  restoreDefaultWarehouseCategories,
} from "../services/default-catalog-service.js";
import { defaultSettings, getSystemSettings, settingsId } from "../services/settings-service.js";
import { systemResetInput, systemSettingsInput } from "../validators/inputs.js";

export const publicSettingsRoutes = Router();
export const settingsRoutes = Router();

publicSettingsRoutes.get(
  "/public",
  asyncHandler(async (_request, response) => {
    response.json(await getSystemSettings(prisma));
  }),
);

settingsRoutes.get(
  "/",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (_request, response) => {
    response.json(await getSystemSettings(prisma));
  }),
);

settingsRoutes.put(
  "/",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const data = systemSettingsInput.parse(request.body);
    const user = currentUser(response);
    const settings = await prisma.systemSettings.upsert({
      where: { id: settingsId },
      update: data,
      create: {
        ...defaultSettings,
        ...data,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        details: JSON.stringify({
          fields: Object.keys(data),
        }),
        entity: "SystemSettings",
        entityId: settings.id,
        userId: user.id,
      },
    });

    response.json(settings);
  }),
);

settingsRoutes.post(
  "/reset-data",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const input = systemResetInput.parse(request.body);
    const user = currentUser(response);
    const admin = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    if (!passwordMatches(input.password, admin.passwordHash)) {
      throw new AppError(401, "Senha do admin inválida.");
    }

    const result = await prisma.$transaction(async (transaction) => {
      const auditLogs = await transaction.auditLog.deleteMany();
      const transferRequests = await transaction.transferRequest.deleteMany();
      const entryRequests = await transaction.entryRequest.deleteMany();
      const movements = await transaction.stockMovement.deleteMany();
      const invoices = await transaction.invoice.deleteMany();
      const stocks = await transaction.stock.deleteMany();
      const warehouseAssignments = await transaction.userWarehouse.deleteMany();
      const products = await transaction.product.deleteMany();
      const warehouses = await transaction.warehouse.deleteMany();
      const units =
        input.units === "RESET_DEFAULTS"
          ? await transaction.unitOfMeasure.deleteMany()
          : { count: 0 };
      const productCategories =
        input.productCategories === "RESET_DEFAULTS"
          ? await transaction.productCategory.deleteMany()
          : { count: 0 };
      const warehouseCategories =
        input.warehouseCategories === "RESET_DEFAULTS"
          ? await transaction.warehouseCategory.deleteMany()
          : { count: 0 };
      const restored = {
        productCategories:
          input.productCategories === "RESET_DEFAULTS"
            ? (await restoreDefaultProductCategories(transaction)).length
            : 0,
        units:
          input.units === "RESET_DEFAULTS"
            ? (await restoreDefaultUnits(transaction)).length
            : 0,
        warehouseCategories:
          input.warehouseCategories === "RESET_DEFAULTS"
            ? (await restoreDefaultWarehouseCategories(transaction)).length
            : 0,
      };

      return {
        deleted: {
          auditLogs: auditLogs.count,
          entryRequests: entryRequests.count,
          invoices: invoices.count,
          movements: movements.count,
          productCategories: productCategories.count,
          products: products.count,
          stocks: stocks.count,
          transferRequests: transferRequests.count,
          units: units.count,
          warehouseAssignments: warehouseAssignments.count,
          warehouseCategories: warehouseCategories.count,
          warehouses: warehouses.count,
        },
        restored,
      };
    });

    response.json({
      ...result,
      catalogReset: {
        productCategories: input.productCategories,
        units: input.units,
        warehouseCategories: input.warehouseCategories,
      },
      ok: true,
    });
  }),
);
