import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler, currentUser, requireRole } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import {
  createUser,
  deleteUser,
  listUsers,
  safeUser,
  updateUser,
} from "../services/user-service.js";
import {
  idParam,
  userCreateInput,
  userUpdateInput,
} from "../validators/inputs.js";

export const userRoutes = Router();

userRoutes.use(requireRole(UserRole.ADMIN));

userRoutes.get(
  "/",
  asyncHandler(async (_request, response) => {
    response.json(await listUsers(prisma));
  }),
);

userRoutes.get(
  "/:id",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id },
      include: {
        warehouseAssignments: {
          include: {
            warehouse: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });

    response.json(safeUser(user));
  }),
);

userRoutes.post(
  "/",
  asyncHandler(async (request, response) => {
    const input = userCreateInput.parse(request.body);
    response.status(201).json(await createUser(prisma, input));
  }),
);

userRoutes.put(
  "/:id",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const input = userUpdateInput.parse(request.body);
    response.json(await updateUser(prisma, id, input));
  }),
);

userRoutes.delete(
  "/:id",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const user = currentUser(response);

    await deleteUser(prisma, id, user.id);
    response.status(204).send();
  }),
);
