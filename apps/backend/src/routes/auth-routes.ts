import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { loginWithPassword } from "../services/auth-service.js";
import { loginInput } from "../validators/inputs.js";

export const authRoutes = Router();

authRoutes.post(
  "/login",
  asyncHandler(async (request, response) => {
    const input = loginInput.parse(request.body);
    response.json(await loginWithPassword(prisma, input.email, input.password));
  }),
);
