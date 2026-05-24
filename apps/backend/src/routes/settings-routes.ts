import { UserRole } from "@prisma/client";
import { Router } from "express";
import { AppError } from "../lib/errors.js";
import { asyncHandler, currentUser, requireRole } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { passwordMatches } from "../services/auth-service.js";
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
    const { password } = systemResetInput.parse(request.body);
    const user = currentUser(response);
    const admin = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    if (!passwordMatches(password, admin.passwordHash)) {
      throw new AppError(401, "Senha do admin invalida.");
    }

    const deleted = await prisma.$transaction(async (transaction) => {
      const auditLogs = await transaction.auditLog.deleteMany();
      const transferRequests = await transaction.transferRequest.deleteMany();
      const entryRequests = await transaction.entryRequest.deleteMany();
      const movements = await transaction.stockMovement.deleteMany();
      const invoices = await transaction.invoice.deleteMany();
      const stocks = await transaction.stock.deleteMany();
      const warehouseAssignments = await transaction.userWarehouse.deleteMany();
      const products = await transaction.product.deleteMany();
      const units = await transaction.unitOfMeasure.deleteMany();
      const productCategories = await transaction.productCategory.deleteMany();
      const warehouses = await transaction.warehouse.deleteMany();
      const warehouseCategories = await transaction.warehouseCategory.deleteMany();

      return {
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
      };
    });

    response.json({ deleted, ok: true });
  }),
);
