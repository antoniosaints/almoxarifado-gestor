import { Router } from "express";
import { asyncHandler } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import {
  assertValidationSecret,
  getClientLicenseStatus,
  licenseValidationRequestInfo,
  refreshClientLicenseStatus,
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
    const baseRequestInfo = licenseValidationRequestInfo(request);
    const requestInfo = {
      ...baseRequestInfo,
      domain: input.instanceDomain ?? baseRequestInfo.domain,
    };

    response.json(
      await validateManagerLicenseForClient(prisma, input.licenseKey, requestInfo),
    );
  }),
);

licenseRoutes.get(
  "/status",
  asyncHandler(async (request, response) => {
    response.json(
      await getClientLicenseStatus(prisma, licenseValidationRequestInfo(request)),
    );
  }),
);

licenseRoutes.post(
  "/refresh",
  asyncHandler(async (request, response) => {
    response.json(
      await refreshClientLicenseStatus(prisma, licenseValidationRequestInfo(request)),
    );
  }),
);
