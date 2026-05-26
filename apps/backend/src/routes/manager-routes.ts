import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler, requireRole } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import {
  cancelManagerBilling,
  cancelManagerLicense,
  createManagerBilling,
  createManagerLicense,
  createManagerSubscriber,
  deactivateManagerSubscriber,
  getManagerDashboard,
  listManagerBillings,
  listManagerLicenses,
  listManagerSubscribers,
  markManagerBillingPaid,
  updateManagerBilling,
  updateManagerLicense,
  updateManagerSubscriber,
  validateManagerLicense,
} from "../services/manager-service.js";
import {
  idParam,
  managerBillingInput,
  managerLicenseCancelInput,
  managerLicenseInput,
  managerSubscriberInput,
} from "../validators/inputs.js";

export const managerRoutes = Router();

managerRoutes.use(requireRole(UserRole.ADMIN));

managerRoutes.get(
  "/dashboard",
  asyncHandler(async (_request, response) => {
    response.json(await getManagerDashboard(prisma));
  }),
);

managerRoutes.get(
  "/subscribers",
  asyncHandler(async (_request, response) => {
    response.json(await listManagerSubscribers(prisma));
  }),
);

managerRoutes.post(
  "/subscribers",
  asyncHandler(async (request, response) => {
    const input = managerSubscriberInput.parse(request.body);

    response.status(201).json(await createManagerSubscriber(prisma, input));
  }),
);

managerRoutes.put(
  "/subscribers/:id",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const input = managerSubscriberInput.parse(request.body);

    response.json(await updateManagerSubscriber(prisma, id, input));
  }),
);

managerRoutes.delete(
  "/subscribers/:id",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);

    response.json(await deactivateManagerSubscriber(prisma, id));
  }),
);

managerRoutes.get(
  "/licenses",
  asyncHandler(async (_request, response) => {
    response.json(await listManagerLicenses(prisma));
  }),
);

managerRoutes.post(
  "/licenses",
  asyncHandler(async (request, response) => {
    const input = managerLicenseInput.parse(request.body);

    response.status(201).json(await createManagerLicense(prisma, input));
  }),
);

managerRoutes.put(
  "/licenses/:id",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const input = managerLicenseInput.parse(request.body);

    response.json(await updateManagerLicense(prisma, id, input));
  }),
);

managerRoutes.post(
  "/licenses/:id/validate",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);

    response.json(await validateManagerLicense(prisma, id));
  }),
);

managerRoutes.post(
  "/licenses/:id/cancel",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const input = managerLicenseCancelInput.parse(request.body);

    response.json(await cancelManagerLicense(prisma, id, input.reason));
  }),
);

managerRoutes.get(
  "/billings",
  asyncHandler(async (_request, response) => {
    response.json(await listManagerBillings(prisma));
  }),
);

managerRoutes.post(
  "/billings",
  asyncHandler(async (request, response) => {
    const input = managerBillingInput.parse(request.body);

    response.status(201).json(await createManagerBilling(prisma, input));
  }),
);

managerRoutes.put(
  "/billings/:id",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const input = managerBillingInput.parse(request.body);

    response.json(await updateManagerBilling(prisma, id, input));
  }),
);

managerRoutes.post(
  "/billings/:id/pay",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);

    response.json(await markManagerBillingPaid(prisma, id));
  }),
);

managerRoutes.post(
  "/billings/:id/cancel",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);

    response.json(await cancelManagerBilling(prisma, id));
  }),
);
