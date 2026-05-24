import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler, currentUser, requireRole } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { defaultSettings, getSystemSettings, settingsId } from "../services/settings-service.js";
import { systemSettingsInput } from "../validators/inputs.js";

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
