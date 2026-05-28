import { UserRole } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { asyncHandler, currentUser, requireRole } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import {
  buildManagerBillingPdf,
  buildManagerLicensePdf,
} from "../services/manager-pdf-service.js";
import {
  cancelOrRefundMercadoPagoPayment,
  completeMercadoPagoOAuth,
  generateMercadoPagoBillingPayment,
  listManagerGateways,
  processMercadoPagoWebhook,
  startMercadoPagoOAuth,
  updateMercadoPagoGatewayConfig,
} from "../services/manager-payment-service.js";
import {
  cancelManagerBilling,
  cancelManagerLicense,
  createManagerBilling,
  createManagerLicense,
  createManagerSubscriber,
  deactivateManagerSubscriber,
  getManagerDashboard,
  linkManagerLicense,
  listManagerBillings,
  listManagerLicenses,
  listManagerSubscribers,
  markManagerBillingPaid,
  settleManagerBillingPaid,
  updateManagerBilling,
  updateManagerLicense,
  updateManagerSubscriber,
  validateManagerLicense,
} from "../services/manager-service.js";
import {
  idParam,
  managerBillingInvoiceInput,
  managerBillingInput,
  managerGatewayConfigInput,
  managerLicenseCancelInput,
  managerLicenseInput,
  managerSubscriberInput,
} from "../validators/inputs.js";

export const managerPublicRoutes = Router();
export const managerRoutes = Router();

function firstHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function baseUrlFromRequest(request: Request) {
  const configured =
    process.env.MANAGER_PUBLIC_URL ??
    process.env.PUBLIC_API_URL ??
    process.env.API_PUBLIC_URL;

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const forwardedProto = firstHeaderValue(request.headers["x-forwarded-proto"]);
  const proto = forwardedProto ?? request.protocol ?? "http";
  const forwardedHost = firstHeaderValue(request.headers["x-forwarded-host"]);
  const host = forwardedHost ?? request.headers.host ?? "127.0.0.1:3333";

  return `${proto}://${host}`;
}

function sendPdf(response: Response, fileName: string, buffer: Buffer) {
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  response.send(buffer);
}

managerPublicRoutes.post(
  "/webhooks/mercado-pago",
  asyncHandler(async (request, response) => {
    const body = request.body as {
      data?: { id?: number | string | null } | null;
      type?: string | null;
    };
    const dataId =
      (typeof request.query["data.id"] === "string"
        ? request.query["data.id"]
        : undefined) ??
      (body.data?.id ? String(body.data.id) : undefined);
    const type =
      (typeof request.query.type === "string" ? request.query.type : undefined) ??
      body.type;

    if (!dataId || (type && type !== "payment")) {
      response.json({ received: true });
      return;
    }

    await processMercadoPagoWebhook(prisma, {
      dataId,
      requestId: firstHeaderValue(request.headers["x-request-id"]) ?? null,
      signature: firstHeaderValue(request.headers["x-signature"]) ?? null,
    });

    response.json({ received: true });
  }),
);

managerPublicRoutes.get(
  "/gateways/mercado-pago/oauth/callback",
  asyncHandler(async (request, response) => {
    const code = typeof request.query.code === "string" ? request.query.code : "";
    const state = typeof request.query.state === "string" ? request.query.state : "";

    await completeMercadoPagoOAuth(prisma, { code, state }, baseUrlFromRequest(request));

    response
      .type("html")
      .send(
        "<!doctype html><html><body><h1>Mercado Pago conectado</h1><p>Voce ja pode fechar esta janela e voltar ao manager.</p></body></html>",
      );
  }),
);

managerRoutes.use(requireRole(UserRole.ADMIN));

managerRoutes.get(
  "/gateways",
  asyncHandler(async (request, response) => {
    response.json(await listManagerGateways(prisma, baseUrlFromRequest(request)));
  }),
);

managerRoutes.put(
  "/gateways/mercado-pago",
  asyncHandler(async (request, response) => {
    const input = managerGatewayConfigInput.parse(request.body);

    response.json(
      await updateMercadoPagoGatewayConfig(
        prisma,
        input,
        baseUrlFromRequest(request),
      ),
    );
  }),
);

managerRoutes.post(
  "/gateways/mercado-pago/oauth/start",
  asyncHandler(async (request, response) => {
    response.json(await startMercadoPagoOAuth(prisma, baseUrlFromRequest(request)));
  }),
);

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
  "/licenses/:id/link",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);

    response.json(await linkManagerLicense(prisma, id));
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
  "/licenses/:id/pdf",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const pdf = await buildManagerLicensePdf(prisma, id, currentUser(response).name);

    sendPdf(response, pdf.fileName, pdf.buffer);
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
  "/billings/:id/faturar",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const input = managerBillingInvoiceInput.parse(request.body);

    if (input.mode === "MANUAL") {
      response.json(await settleManagerBillingPaid(prisma, id, input.paidAt ?? new Date()));
      return;
    }

    response.json(
      await generateMercadoPagoBillingPayment(
        prisma,
        id,
        input.method,
        baseUrlFromRequest(request),
      ),
    );
  }),
);

managerRoutes.get(
  "/billings/:id/pdf",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const pdf = await buildManagerBillingPdf(prisma, id, currentUser(response).name);

    sendPdf(response, pdf.fileName, pdf.buffer);
  }),
);

managerRoutes.post(
  "/billings/:id/cancel",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);

    response.json(await cancelManagerBilling(prisma, id));
  }),
);

managerRoutes.post(
  "/payments/:id/cancel",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);

    response.json(await cancelOrRefundMercadoPagoPayment(prisma, id));
  }),
);
