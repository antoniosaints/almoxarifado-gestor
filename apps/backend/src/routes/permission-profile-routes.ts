import { Router } from "express";
import { asyncHandler, currentUser, requirePermission } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import {
  createPermissionProfile,
  deletePermissionProfile,
  listAvailablePermissions,
  listPermissionProfiles,
  updatePermissionProfile,
} from "../services/permission-profile-service.js";
import { idParam, permissionProfileInput } from "../validators/inputs.js";

export const permissionProfileRoutes = Router();

permissionProfileRoutes.use(requirePermission("MANAGE_USERS"));

permissionProfileRoutes.get(
  "/permissions",
  asyncHandler(async (_request, response) => {
    response.json(listAvailablePermissions());
  }),
);

permissionProfileRoutes.get(
  "/",
  asyncHandler(async (_request, response) => {
    response.json(await listPermissionProfiles(prisma));
  }),
);

permissionProfileRoutes.post(
  "/",
  asyncHandler(async (request, response) => {
    const input = permissionProfileInput.parse(request.body);
    response
      .status(201)
      .json(await createPermissionProfile(prisma, input, currentUser(response)));
  }),
);

permissionProfileRoutes.put(
  "/:id",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const input = permissionProfileInput.parse(request.body);
    response.json(
      await updatePermissionProfile(prisma, id, input, currentUser(response)),
    );
  }),
);

permissionProfileRoutes.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    await deletePermissionProfile(prisma, id, currentUser(response));
    response.status(204).send();
  }),
);
