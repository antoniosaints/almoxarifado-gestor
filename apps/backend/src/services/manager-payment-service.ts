import {
  ManagerBillingPaymentMethod,
  ManagerBillingPaymentStatus,
  ManagerBillingStatus,
  ManagerGatewayProvider,
  type ManagerPaymentGatewayConfig,
  type PrismaClient,
} from "@prisma/client";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AppError } from "../lib/errors.js";
import { settleManagerBillingPaid } from "./manager-service.js";

type GatewayConfigInput = {
  accessToken: string | null;
  active: boolean;
  clientId: string | null;
  clientSecret: string | null;
  publicKey: string | null;
  webhookSecret: string | null;
};

type MercadoPagoPaymentPayload = {
  additional_info?: unknown;
  barcode?: { content?: string | null } | null;
  date_approved?: string | null;
  date_of_expiration?: string | null;
  external_reference?: string | null;
  id?: number | string | null;
  payment_method_id?: string | null;
  payment_type_id?: string | null;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string | null;
      qr_code_base64?: string | null;
      ticket_url?: string | null;
    } | null;
  } | null;
  status?: string | null;
  status_detail?: string | null;
  transaction_amount?: number | string | null;
  transaction_details?: {
    barcode?: { content?: string | null } | null;
    external_resource_url?: string | null;
    ticket_url?: string | null;
  } | null;
};

const provider = ManagerGatewayProvider.MERCADO_PAGO;
const mercadoPagoApiUrl =
  process.env.MERCADO_PAGO_API_URL?.replace(/\/+$/, "") ??
  "https://api.mercadopago.com";
const mercadoPagoAuthUrl =
  process.env.MERCADO_PAGO_AUTH_URL ??
  "https://auth.mercadopago.com/authorization";

function gatewayLabel() {
  return "Mercado Pago";
}

function cleanToken(value: string | null | undefined) {
  return value?.trim() || null;
}

function configuredAccessToken(config: ManagerPaymentGatewayConfig | null) {
  return (
    cleanToken(config?.accessToken) ??
    cleanToken(process.env.MERCADO_PAGO_ACCESS_TOKEN)
  );
}

function configuredWebhookSecret(config: ManagerPaymentGatewayConfig | null) {
  return (
    cleanToken(config?.webhookSecret) ??
    cleanToken(process.env.MERCADO_PAGO_WEBHOOK_SECRET)
  );
}

function maskSecret(value: string | null | undefined) {
  const cleaned = cleanToken(value);

  if (!cleaned) {
    return null;
  }

  return `•••• ${cleaned.slice(-4)}`;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function safeJson(value: unknown) {
  return JSON.stringify(value, null, 0);
}

function documentInfo(document: string | null | undefined) {
  const digits = document?.replace(/\D/g, "") ?? "";

  if (digits.length === 11) {
    return { number: digits, type: "CPF" };
  }

  if (digits.length === 14) {
    return { number: digits, type: "CNPJ" };
  }

  return null;
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/);
  const firstName = parts.shift() ?? name;
  const lastName = parts.join(" ") || firstName;

  return { firstName, lastName };
}

function paymentMethodId(method: ManagerBillingPaymentMethod) {
  return method === ManagerBillingPaymentMethod.PIX ? "pix" : "bolbradesco";
}

function statusFromMercadoPago(status: string | null | undefined) {
  if (status === "approved") {
    return ManagerBillingPaymentStatus.APPROVED;
  }

  if (status === "cancelled" || status === "canceled") {
    return ManagerBillingPaymentStatus.CANCELLED;
  }

  if (status === "refunded" || status === "charged_back") {
    return ManagerBillingPaymentStatus.REFUNDED;
  }

  if (status === "rejected") {
    return ManagerBillingPaymentStatus.REJECTED;
  }

  if (status === "expired") {
    return ManagerBillingPaymentStatus.EXPIRED;
  }

  return ManagerBillingPaymentStatus.PENDING;
}

function paymentData(payload: MercadoPagoPaymentPayload) {
  const transactionData = payload.point_of_interaction?.transaction_data;
  const transactionDetails = payload.transaction_details;

  return {
    barcode:
      payload.barcode?.content ??
      transactionDetails?.barcode?.content ??
      null,
    expiresAt: payload.date_of_expiration
      ? new Date(payload.date_of_expiration)
      : null,
    paidAt: payload.date_approved ? new Date(payload.date_approved) : null,
    providerPaymentId: payload.id ? String(payload.id) : null,
    qrCode: transactionData?.qr_code ?? null,
    qrCodeBase64: transactionData?.qr_code_base64 ?? null,
    status: statusFromMercadoPago(payload.status),
    statusDetail: payload.status_detail ?? null,
    ticketUrl:
      transactionData?.ticket_url ??
      transactionDetails?.ticket_url ??
      transactionDetails?.external_resource_url ??
      null,
  };
}

async function ensureMercadoPagoConfig(prisma: PrismaClient) {
  return prisma.managerPaymentGatewayConfig.upsert({
    create: {
      active: false,
      label: gatewayLabel(),
      provider,
    },
    update: {},
    where: { provider },
  });
}

async function activeMercadoPagoConfig(prisma: PrismaClient) {
  const config = await ensureMercadoPagoConfig(prisma);
  const accessToken = configuredAccessToken(config);

  if (!config.active) {
    throw new AppError(409, "Ative o gateway Mercado Pago antes de faturar.");
  }

  if (!accessToken) {
    throw new AppError(409, "Configure o access token do Mercado Pago.");
  }

  return { accessToken, config };
}

async function mercadoPagoRequest<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
) {
  const response = await fetch(`${mercadoPagoApiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : "Falha na comunicação com o Mercado Pago.";

    throw new AppError(response.status, message);
  }

  return payload as T;
}

export function managerGatewayPublicData(
  config: ManagerPaymentGatewayConfig,
  baseUrl: string,
) {
  const accessToken = configuredAccessToken(config);
  const webhookSecret = configuredWebhookSecret(config);

  return {
    accountId: config.accountId,
    active: config.active,
    accessTokenPreview:
      config.accessToken ? maskSecret(config.accessToken) : accessToken ? "Configurado via env" : null,
    availableMethods: ["PIX", "BOLETO"] as const,
    clientId: config.clientId,
    clientSecretConfigured: Boolean(config.clientSecret),
    configured: Boolean(accessToken),
    connectedAt: config.connectedAt?.toISOString() ?? null,
    id: config.id,
    label: config.label,
    liveMode: config.liveMode,
    provider: config.provider,
    publicKeyPreview: maskSecret(config.publicKey),
    redirectUri: `${baseUrl}/manager/gateways/mercado-pago/oauth/callback`,
    webhookSecretConfigured: Boolean(webhookSecret),
    webhookUrl: `${baseUrl}/manager/webhooks/mercado-pago`,
  };
}

export async function listManagerGateways(prisma: PrismaClient, baseUrl: string) {
  const config = await ensureMercadoPagoConfig(prisma);

  return [managerGatewayPublicData(config, baseUrl)];
}

export async function updateMercadoPagoGatewayConfig(
  prisma: PrismaClient,
  input: GatewayConfigInput,
  baseUrl: string,
) {
  const current = await ensureMercadoPagoConfig(prisma);
  const config = await prisma.managerPaymentGatewayConfig.upsert({
    create: {
      accessToken: input.accessToken,
      active: input.active,
      clientId: input.clientId,
      clientSecret: input.clientSecret,
      label: gatewayLabel(),
      provider,
      publicKey: input.publicKey,
      webhookSecret: input.webhookSecret,
    },
    update: {
      accessToken: input.accessToken ?? current.accessToken,
      active: input.active,
      clientId: input.clientId ?? current.clientId,
      clientSecret: input.clientSecret ?? current.clientSecret,
      publicKey: input.publicKey ?? current.publicKey,
      webhookSecret: input.webhookSecret ?? current.webhookSecret,
    },
    where: { provider },
  });

  return managerGatewayPublicData(config, baseUrl);
}

export async function startMercadoPagoOAuth(prisma: PrismaClient, baseUrl: string) {
  const config = await ensureMercadoPagoConfig(prisma);
  const clientId = cleanToken(config.clientId ?? process.env.MERCADO_PAGO_CLIENT_ID);

  if (!clientId) {
    throw new AppError(409, "Configure o Client ID do Mercado Pago.");
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = `${baseUrl}/manager/gateways/mercado-pago/oauth/callback`;

  await prisma.managerPaymentGatewayConfig.update({
    data: {
      oauthState: state,
      oauthStateExpiresAt: addMinutes(new Date(), 15),
    },
    where: { provider },
  });

  const url = new URL(mercadoPagoAuthUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", redirectUri);

  return {
    authorizationUrl: url.toString(),
    redirectUri,
  };
}

export async function completeMercadoPagoOAuth(
  prisma: PrismaClient,
  input: { code: string; state: string },
  baseUrl: string,
) {
  const config = await ensureMercadoPagoConfig(prisma);
  const clientId = cleanToken(config.clientId ?? process.env.MERCADO_PAGO_CLIENT_ID);
  const clientSecret = cleanToken(
    config.clientSecret ?? process.env.MERCADO_PAGO_CLIENT_SECRET,
  );

  if (!clientId || !clientSecret) {
    throw new AppError(409, "Configure Client ID e Client Secret do Mercado Pago.");
  }

  if (
    !config.oauthState ||
    config.oauthState !== input.state ||
    !config.oauthStateExpiresAt ||
    config.oauthStateExpiresAt < new Date()
  ) {
    throw new AppError(400, "Autorização do Mercado Pago expirada ou inválida.");
  }

  const redirectUri = `${baseUrl}/manager/gateways/mercado-pago/oauth/callback`;
  const token = await mercadoPagoRequest<{
    access_token: string;
    expires_in?: number;
    live_mode?: boolean;
    public_key?: string;
    refresh_token?: string;
    user_id?: number | string;
  }>("", "/oauth/token", {
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code: input.code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      test_token: "false",
    }),
    headers: { Authorization: "" },
    method: "POST",
  });

  const updated = await prisma.managerPaymentGatewayConfig.update({
    data: {
      accessToken: token.access_token,
      accountId: token.user_id ? String(token.user_id) : null,
      active: true,
      connectedAt: new Date(),
      liveMode: Boolean(token.live_mode),
      oauthState: null,
      oauthStateExpiresAt: null,
      publicKey: token.public_key ?? config.publicKey,
      refreshToken: token.refresh_token ?? config.refreshToken,
      tokenExpiresAt: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000)
        : null,
    },
    where: { provider },
  });

  return managerGatewayPublicData(updated, baseUrl);
}

export async function generateMercadoPagoBillingPayment(
  prisma: PrismaClient,
  billingId: string,
  method: ManagerBillingPaymentMethod,
  baseUrl: string,
) {
  const billing = await prisma.managerBilling.findUnique({
    include: {
      license: true,
      subscriber: true,
    },
    where: { id: billingId },
  });

  if (!billing) {
    throw new AppError(404, "Cobrança não encontrada.");
  }

  if (billing.status === ManagerBillingStatus.PAID) {
    throw new AppError(409, "Esta cobrança já foi baixada.");
  }

  if (billing.status === ManagerBillingStatus.CANCELLED) {
    throw new AppError(409, "Esta cobrança está cancelada.");
  }

  if (Number(billing.amount) <= 0) {
    throw new AppError(400, "Informe um valor maior que zero para faturar.");
  }

  if (method === ManagerBillingPaymentMethod.BOLETO && !documentInfo(billing.subscriber.document)) {
    throw new AppError(400, "Informe CPF ou CNPJ do assinante para gerar boleto.");
  }

  const { accessToken, config } = await activeMercadoPagoConfig(prisma);
  const externalReference = `${billing.id}-${Date.now().toString(36)}`;
  const payment = await prisma.managerBillingPayment.create({
    data: {
      amount: billing.amount,
      billingId: billing.id,
      externalReference,
      gatewayConfigId: config.id,
      method,
      provider,
      status: ManagerBillingPaymentStatus.PENDING,
    },
  });
  const name = splitName(billing.subscriber.name);
  const identification = documentInfo(billing.subscriber.document);

  try {
    const payload = await mercadoPagoRequest<MercadoPagoPaymentPayload>(
      accessToken,
      "/v1/payments",
      {
        body: JSON.stringify({
          date_of_expiration: billing.dueDate.toISOString(),
          description:
            billing.description ??
            `${billing.systemKey} - ${billing.reference}`,
          external_reference: externalReference,
          metadata: {
            billing_id: billing.id,
            license_id: billing.licenseId,
            subscriber_id: billing.subscriberId,
          },
          notification_url: `${baseUrl}/manager/webhooks/mercado-pago`,
          payer: {
            email: billing.subscriber.email,
            first_name: name.firstName,
            identification,
            last_name: name.lastName,
          },
          payment_method_id: paymentMethodId(method),
          transaction_amount: Number(billing.amount),
        }),
        headers: {
          "X-Idempotency-Key": payment.id,
        },
        method: "POST",
      },
    );

    await updateLocalPaymentFromPayload(prisma, payment.id, payload);

    return prisma.managerBilling.findUniqueOrThrow({
      include: {
        license: true,
        payments: { orderBy: { createdAt: "desc" } },
        subscriber: true,
      },
      where: { id: billing.id },
    });
  } catch (error) {
    await prisma.managerBillingPayment.update({
      data: {
        rawPayload: safeJson({
          error: error instanceof Error ? error.message : "Falha desconhecida.",
        }),
        status: ManagerBillingPaymentStatus.REJECTED,
      },
      where: { id: payment.id },
    });

    throw error;
  }
}

async function updateLocalPaymentFromPayload(
  prisma: PrismaClient,
  paymentId: string,
  payload: MercadoPagoPaymentPayload,
) {
  const data = paymentData(payload);

  await prisma.managerBillingPayment.update({
    data: {
      barcode: data.barcode,
      cancelledAt:
        data.status === ManagerBillingPaymentStatus.CANCELLED
          ? new Date()
          : undefined,
      expiresAt: data.expiresAt,
      paidAt: data.paidAt,
      providerPaymentId: data.providerPaymentId,
      qrCode: data.qrCode,
      qrCodeBase64: data.qrCodeBase64,
      rawPayload: safeJson(payload),
      refundedAt:
        data.status === ManagerBillingPaymentStatus.REFUNDED
          ? new Date()
          : undefined,
      status: data.status,
      statusDetail: data.statusDetail,
      ticketUrl: data.ticketUrl,
    },
    where: { id: paymentId },
  });
}

async function findPaymentForMercadoPayload(
  prisma: PrismaClient,
  payload: MercadoPagoPaymentPayload,
) {
  const providerPaymentId = payload.id ? String(payload.id) : null;

  if (providerPaymentId) {
    const payment = await prisma.managerBillingPayment.findFirst({
      include: { billing: true },
      where: { provider, providerPaymentId },
    });

    if (payment) {
      return payment;
    }
  }

  if (payload.external_reference) {
    return prisma.managerBillingPayment.findUnique({
      include: { billing: true },
      where: { externalReference: payload.external_reference },
    });
  }

  return null;
}

export async function syncMercadoPagoPaymentPayload(
  prisma: PrismaClient,
  payload: MercadoPagoPaymentPayload,
) {
  const payment = await findPaymentForMercadoPayload(prisma, payload);

  if (!payment) {
    return null;
  }

  const data = paymentData(payload);
  const updatedPayment = await prisma.managerBillingPayment.update({
    data: {
      barcode: data.barcode,
      cancelledAt:
        data.status === ManagerBillingPaymentStatus.CANCELLED
          ? new Date()
          : payment.cancelledAt,
      expiresAt: data.expiresAt,
      paidAt: data.paidAt ?? payment.paidAt,
      providerPaymentId: data.providerPaymentId ?? payment.providerPaymentId,
      qrCode: data.qrCode,
      qrCodeBase64: data.qrCodeBase64,
      rawPayload: safeJson(payload),
      refundedAt:
        data.status === ManagerBillingPaymentStatus.REFUNDED
          ? new Date()
          : payment.refundedAt,
      status: data.status,
      statusDetail: data.statusDetail,
      ticketUrl: data.ticketUrl,
    },
    include: { billing: true },
    where: { id: payment.id },
  });

  if (data.status === ManagerBillingPaymentStatus.APPROVED) {
    await settleManagerBillingPaid(
      prisma,
      updatedPayment.billingId,
      data.paidAt ?? new Date(),
    );
  }

  if (
    data.status === ManagerBillingPaymentStatus.CANCELLED &&
    updatedPayment.billing.status !== ManagerBillingStatus.PAID
  ) {
    await prisma.managerBilling.update({
      data: { status: ManagerBillingStatus.CANCELLED },
      where: { id: updatedPayment.billingId },
    });
  }

  return updatedPayment;
}

export function verifyMercadoPagoWebhookSignature(input: {
  config: ManagerPaymentGatewayConfig | null;
  dataId: string | null;
  requestId: string | null;
  signature: string | null;
}) {
  const secret = configuredWebhookSecret(input.config);

  if (!secret) {
    return true;
  }

  if (!input.signature || !input.requestId || !input.dataId) {
    return false;
  }

  const parts = new Map(
    input.signature.split(",").map((part) => {
      const [key, ...value] = part.split("=");

      return [key?.trim(), value.join("=").trim()] as const;
    }),
  );
  const timestamp = parts.get("ts");
  const received = parts.get("v1");

  if (!timestamp || !received) {
    return false;
  }

  const manifest = `id:${input.dataId};request-id:${input.requestId};ts:${timestamp};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const receivedBuffer = Buffer.from(received, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export async function processMercadoPagoWebhook(
  prisma: PrismaClient,
  input: {
    dataId: string;
    requestId: string | null;
    signature: string | null;
  },
) {
  const config = await ensureMercadoPagoConfig(prisma);

  if (
    !verifyMercadoPagoWebhookSignature({
      config,
      dataId: input.dataId,
      requestId: input.requestId,
      signature: input.signature,
    })
  ) {
    throw new AppError(401, "Assinatura do Mercado Pago inválida.");
  }

  const accessToken = configuredAccessToken(config);

  if (!accessToken) {
    throw new AppError(409, "Mercado Pago não configurado.");
  }

  const payload = await mercadoPagoRequest<MercadoPagoPaymentPayload>(
    accessToken,
    `/v1/payments/${input.dataId}`,
  );

  return syncMercadoPagoPaymentPayload(prisma, payload);
}

export async function cancelOrRefundMercadoPagoPayment(
  prisma: PrismaClient,
  paymentId: string,
) {
  const payment = await prisma.managerBillingPayment.findUnique({
    include: { billing: true, gatewayConfig: true },
    where: { id: paymentId },
  });

  if (!payment) {
    throw new AppError(404, "Pagamento não encontrado.");
  }

  if (payment.provider !== provider || !payment.providerPaymentId) {
    throw new AppError(400, "Pagamento sem identificador do Mercado Pago.");
  }

  const accessToken = configuredAccessToken(payment.gatewayConfig);

  if (!accessToken) {
    throw new AppError(409, "Mercado Pago não configurado.");
  }

  if (
    payment.status === ManagerBillingPaymentStatus.APPROVED ||
    payment.billing.status === ManagerBillingStatus.PAID
  ) {
    const refund = await mercadoPagoRequest<unknown>(
      accessToken,
      `/v1/payments/${payment.providerPaymentId}/refunds`,
      {
        body: JSON.stringify({}),
        headers: {
          "X-Idempotency-Key": `${payment.id}-refund`,
          "X-Render-In-Process-Refunds": "true",
        },
        method: "POST",
      },
    );

    return prisma.managerBillingPayment.update({
      data: {
        rawPayload: safeJson(refund),
        refundedAt: new Date(),
        status: ManagerBillingPaymentStatus.REFUNDED,
      },
      where: { id: payment.id },
    });
  }

  const payload = await mercadoPagoRequest<MercadoPagoPaymentPayload>(
    accessToken,
    `/v1/payments/${payment.providerPaymentId}`,
    {
      body: JSON.stringify({ status: "cancelled" }),
      method: "PUT",
    },
  );

  await syncMercadoPagoPaymentPayload(prisma, payload);

  return prisma.managerBillingPayment.findUniqueOrThrow({
    where: { id: payment.id },
  });
}

export async function cancelOpenMercadoPagoPaymentsForBilling(
  prisma: PrismaClient,
  billingId: string,
) {
  const payments = await prisma.managerBillingPayment.findMany({
    where: {
      billingId,
      provider,
      status: ManagerBillingPaymentStatus.PENDING,
    },
  });
  const cancelledPayments = [];

  for (const payment of payments) {
    if (!payment.providerPaymentId) {
      cancelledPayments.push(
        await prisma.managerBillingPayment.update({
          data: {
            cancelledAt: new Date(),
            status: ManagerBillingPaymentStatus.CANCELLED,
          },
          where: { id: payment.id },
        }),
      );
      continue;
    }

    cancelledPayments.push(
      await cancelOrRefundMercadoPagoPayment(prisma, payment.id),
    );
  }

  return cancelledPayments;
}
