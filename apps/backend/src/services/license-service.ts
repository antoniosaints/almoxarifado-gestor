import type {
  ManagerLicense,
  ManagerSubscriber,
  PrismaClient,
} from "@prisma/client";
import { createHash, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";

const stateId = "system";
const dayMs = 24 * 60 * 60 * 1000;
const validationIntervalMs = dayMs;
const warningWindowDays = 3;
const validationTimeoutMs = 5_000;

type ManagerLicenseWithSubscriber = ManagerLicense & {
  subscriber: ManagerSubscriber;
};

type LicenseValidationStatus = {
  blockWrites: boolean;
  checkedAt: string | null;
  daysUntilExpiration: number | null;
  expiresAt: string | null;
  lastError?: string | null;
  licenseKey: string | null;
  message: string;
  mode: "managed" | "unmanaged";
  offline: boolean;
  status: string;
  subscriberName?: string | null;
  systemKey?: string | null;
  valid: boolean;
  warningLevel: "none" | "warning" | "expires_today" | "blocked" | "unvalidated";
};

type RemoteValidationPayload = {
  blockWrites?: boolean;
  checkedAt?: string | null;
  daysUntilExpiration?: number | null;
  expiresAt?: string | null;
  licenseKey?: string | null;
  message?: string | null;
  status?: string | null;
  subscriberName?: string | null;
  systemKey?: string | null;
  valid?: boolean;
  warningLevel?: LicenseValidationStatus["warningLevel"];
};

function configuredLicenseKey() {
  return process.env.LICENSE_SYSTEM?.trim() || null;
}

function configuredValidationUrl() {
  return process.env.URL_VALIDATION_LICENSE?.trim() || null;
}

function isControlConfigured() {
  return Boolean(configuredLicenseKey() && configuredValidationUrl());
}

function hashSecret(value: string) {
  return createHash("sha256").update(value).digest();
}

function secretsMatch(provided: string, expected: string) {
  return timingSafeEqual(hashSecret(provided), hashSecret(expected));
}

function addMilliseconds(date: Date, milliseconds: number) {
  return new Date(date.getTime() + milliseconds);
}

function endOfLicenseDay(value: Date) {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate() + 1,
    ) - 1,
  );
}

function daysUntilExpiration(expiresAt: Date | null, now = new Date()) {
  if (!expiresAt) {
    return null;
  }

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const expirationDay = Date.UTC(
    expiresAt.getUTCFullYear(),
    expiresAt.getUTCMonth(),
    expiresAt.getUTCDate(),
  );

  return Math.ceil((expirationDay - today) / dayMs);
}

function expirationWarningLevel(
  blockWrites: boolean,
  expiresAt: Date | null,
  now = new Date(),
): LicenseValidationStatus["warningLevel"] {
  if (blockWrites) {
    return "blocked";
  }

  const days = daysUntilExpiration(expiresAt, now);

  if (days === null) {
    return "none";
  }

  if (days === 0) {
    return "expires_today";
  }

  if (days > 0 && days <= warningWindowDays) {
    return "warning";
  }

  return "none";
}

function validationMessage(
  status: string,
  warningLevel: LicenseValidationStatus["warningLevel"],
  expiresAt: Date | null,
) {
  if (status === "CANCELLED") {
    return "Licença cancelada. Entre em contato com o responsável pelo sistema.";
  }

  if (status === "PENDING") {
    return "Licença pendente de validação no modo manager.";
  }

  if (warningLevel === "blocked") {
    return "Licença vencida. Entre em contato com o responsável pelo sistema.";
  }

  if (warningLevel === "expires_today") {
    return "A licença vence hoje. Para evitar bloqueio de ações, entre em contato com o responsável pelo sistema.";
  }

  if (warningLevel === "warning") {
    const days = daysUntilExpiration(expiresAt) ?? warningWindowDays;
    return `A licença vence em ${days} ${days === 1 ? "dia" : "dias"}. Entre em contato com o responsável pelo sistema.`;
  }

  return "Licença ativa.";
}

function toIso(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

function unmanagedStatus(): LicenseValidationStatus {
  return {
    blockWrites: false,
    checkedAt: null,
    daysUntilExpiration: null,
    expiresAt: null,
    licenseKey: null,
    message: "Controle de licença não configurado.",
    mode: "unmanaged",
    offline: false,
    status: "UNMANAGED",
    valid: true,
    warningLevel: "none",
  };
}

function normalizeStoredStatus(state: {
  blockWrites: boolean;
  checkedAt: Date | null;
  expiresAt: Date | null;
  lastError: string | null;
  licenseKey: string | null;
  message: string | null;
  mode: string;
  status: string;
  valid: boolean;
}) {
  const expired = Boolean(state.expiresAt && endOfLicenseDay(state.expiresAt) < new Date());
  const blockedStatus = ["CANCELLED", "EXPIRED", "INVALID", "PENDING", "UNVALIDATED"].includes(
    state.status,
  );
  const blockWrites = state.blockWrites || expired || blockedStatus;
  const status = expired ? "EXPIRED" : state.status;
  const warningLevel = expirationWarningLevel(blockWrites, state.expiresAt);

  return {
    blockWrites,
    checkedAt: toIso(state.checkedAt),
    daysUntilExpiration: daysUntilExpiration(state.expiresAt),
    expiresAt: toIso(state.expiresAt),
    lastError: state.lastError,
    licenseKey: state.licenseKey,
    message:
      blockWrites && expired
        ? validationMessage("EXPIRED", warningLevel, state.expiresAt)
        : (state.message ?? validationMessage(status, warningLevel, state.expiresAt)),
    mode: state.mode === "managed" ? "managed" : "unmanaged",
    offline: false,
    status,
    valid: state.valid && !blockWrites,
    warningLevel,
  } satisfies LicenseValidationStatus;
}

function statusFromRemote(payload: RemoteValidationPayload) {
  const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : null;
  const blockWrites = Boolean(payload.blockWrites);
  const status = payload.status?.trim() || (payload.valid ? "ACTIVE" : "INVALID");
  const warningLevel =
    payload.warningLevel ?? expirationWarningLevel(blockWrites, expiresAt);

  return {
    blockWrites,
    checkedAt: payload.checkedAt ?? new Date().toISOString(),
    daysUntilExpiration:
      payload.daysUntilExpiration ?? daysUntilExpiration(expiresAt),
    expiresAt: toIso(expiresAt),
    licenseKey: payload.licenseKey ?? configuredLicenseKey(),
    message:
      payload.message ??
      validationMessage(status, warningLevel, expiresAt),
    mode: "managed",
    offline: false,
    status,
    subscriberName: payload.subscriberName ?? null,
    systemKey: payload.systemKey ?? null,
    valid: Boolean(payload.valid),
    warningLevel,
  } satisfies LicenseValidationStatus;
}

function statusForUnvalidatedLicense(message: string, lastError: string) {
  return {
    blockWrites: true,
    checkedAt: null,
    daysUntilExpiration: null,
    expiresAt: null,
    lastError,
    licenseKey: configuredLicenseKey(),
    message,
    mode: "managed",
    offline: true,
    status: "UNVALIDATED",
    valid: false,
    warningLevel: "unvalidated",
  } satisfies LicenseValidationStatus;
}

async function persistStatus(
  prismaClient: PrismaClient,
  status: LicenseValidationStatus,
  lastError: string | null = null,
) {
  const checkedAt = status.checkedAt ? new Date(status.checkedAt) : new Date();
  const nextCheckAt = addMilliseconds(checkedAt, validationIntervalMs);

  await prismaClient.licenseValidationState.upsert({
    create: {
      blockWrites: status.blockWrites,
      checkedAt,
      expiresAt: status.expiresAt ? new Date(status.expiresAt) : null,
      id: stateId,
      lastError,
      licenseKey: status.licenseKey,
      message: status.message,
      mode: status.mode,
      nextCheckAt,
      status: status.status,
      valid: status.valid,
    },
    update: {
      blockWrites: status.blockWrites,
      checkedAt,
      expiresAt: status.expiresAt ? new Date(status.expiresAt) : null,
      lastError,
      licenseKey: status.licenseKey,
      message: status.message,
      mode: status.mode,
      nextCheckAt,
      status: status.status,
      valid: status.valid,
    },
    where: { id: stateId },
  });
}

async function requestRemoteValidation() {
  const url = configuredValidationUrl();
  const licenseKey = configuredLicenseKey();

  if (!url || !licenseKey) {
    return unmanagedStatus();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), validationTimeoutMs);

  try {
    const response = await fetch(url, {
      body: JSON.stringify({ licenseKey }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Validação retornou HTTP ${response.status}.`);
    }

    return statusFromRemote((await response.json()) as RemoteValidationPayload);
  } finally {
    clearTimeout(timeout);
  }
}

function shouldRefresh(state: { nextCheckAt: Date | null } | null, now = new Date()) {
  return !state?.nextCheckAt || state.nextCheckAt <= now;
}

export async function getClientLicenseStatus(prismaClient: PrismaClient) {
  if (!isControlConfigured()) {
    return unmanagedStatus();
  }

  const state = await prismaClient.licenseValidationState.findUnique({
    where: { id: stateId },
  });

  if (state?.blockWrites) {
    return normalizeStoredStatus(state);
  }

  if (state && !shouldRefresh(state)) {
    return normalizeStoredStatus(state);
  }

  try {
    const remoteStatus = await requestRemoteValidation();
    await persistStatus(prismaClient, remoteStatus);
    return remoteStatus;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha desconhecida na validação.";

    if (state) {
      await prismaClient.licenseValidationState.update({
        data: { lastError: message },
        where: { id: stateId },
      });

      return {
        ...normalizeStoredStatus({ ...state, lastError: message }),
        offline: true,
      } satisfies LicenseValidationStatus;
    }

    const unvalidated = statusForUnvalidatedLicense(
      "Não foi possível validar a licença. As ações de escrita ficam bloqueadas até a primeira validação.",
      message,
    );
    await persistStatus(prismaClient, unvalidated, message);
    return unvalidated;
  }
}

export async function validateManagerLicenseForClient(
  prismaClient: PrismaClient,
  licenseKey: string,
) {
  const normalizedKey = licenseKey.trim();

  if (!normalizedKey) {
    throw new AppError(400, "Informe a chave da licença.");
  }

  const license = await prismaClient.managerLicense.findUnique({
    include: { subscriber: true },
    where: { licenseKey: normalizedKey },
  });

  if (!license) {
    return {
      blockWrites: true,
      checkedAt: new Date().toISOString(),
      daysUntilExpiration: null,
      expiresAt: null,
      licenseKey: normalizedKey,
      message: "Licença não encontrada no modo manager.",
      mode: "managed",
      offline: false,
      status: "INVALID",
      valid: false,
      warningLevel: "blocked",
    } satisfies LicenseValidationStatus;
  }

  return managerLicenseStatus(license);
}

function managerLicenseStatus(license: ManagerLicenseWithSubscriber) {
  const now = new Date();
  const expiresAt = license.expiresAt;
  const expired = Boolean(expiresAt && endOfLicenseDay(expiresAt) < now);
  const startsInFuture = license.startsAt > now;
  const cancelled = license.status === "CANCELLED";
  const pending = license.status === "PENDING" || startsInFuture;
  const blockWrites = cancelled || pending || expired;
  const status = expired
    ? "EXPIRED"
    : startsInFuture
      ? "PENDING"
      : license.status;
  const warningLevel = expirationWarningLevel(blockWrites, expiresAt, now);

  return {
    blockWrites,
    checkedAt: now.toISOString(),
    daysUntilExpiration: daysUntilExpiration(expiresAt, now),
    expiresAt: toIso(expiresAt),
    licenseKey: license.licenseKey,
    message: validationMessage(status, warningLevel, expiresAt),
    mode: "managed",
    offline: false,
    status,
    subscriberName: license.subscriber.name,
    systemKey: license.systemKey,
    valid: !blockWrites && status === "ACTIVE",
    warningLevel,
  } satisfies LicenseValidationStatus;
}

export function assertValidationSecret(secret: unknown) {
  const expected = process.env.SECRET_VALIDATION_LICENSE?.trim();
  const provided = typeof secret === "string" ? secret.trim() : "";

  if (!expected) {
    throw new AppError(503, "Validação de licenças não configurada no manager.");
  }

  if (!provided || !secretsMatch(provided, expected)) {
    throw new AppError(403, "Segredo de validação inválido.");
  }
}

export const enforceLicenseWriteAccess: RequestHandler = async (request, _response, next) => {
  if (!["DELETE", "PATCH", "POST", "PUT"].includes(request.method)) {
    next();
    return;
  }

  try {
    const status = await getClientLicenseStatus(prisma);

    if (status.mode === "managed" && status.blockWrites) {
      next(new AppError(403, status.message, "LICENSE_WRITE_BLOCKED"));
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};
