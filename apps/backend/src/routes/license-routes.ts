import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import {
  assertValidationSecret,
  getClientLicenseStatus,
  validateManagerLicenseForClient,
} from "../services/license-service.js";
import { licenseValidationInput } from "../validators/inputs.js";

export const publicLicenseValidationRoutes = Router();
export const licenseRoutes = Router();

publicLicenseValidationRoutes.post(
  "/",
  asyncHandler(async (request, response) => {
    assertValidationSecret(request.query.secret);
    const input = licenseValidationInput.parse(request.body);

    response.json(await validateManagerLicenseForClient(prisma, input.licenseKey));
  }),
);

licenseRoutes.get(
  "/status",
  asyncHandler(async (_request, response) => {
    response.json(await getClientLicenseStatus(prisma));
  }),
);
