import type { Prisma, PrismaClient } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { storeUploadAsset } from "./upload-service.js";

export const settingsId = "system";

export const settingsAssetSlots = {
  "brand-logo": {
    field: "logoUrl",
    key: "brand-logo",
  },
  favicon: {
    field: "faviconUrl",
    key: "favicon",
  },
  "login-background": {
    field: "loginBackgroundUrl",
    key: "login-background",
  },
  "login-image": {
    field: "loginImageUrl",
    key: "login-image",
  },
  "report-logo": {
    field: "reportLogoUrl",
    key: "report-logo",
  },
} as const;

export type SettingsAssetSlot = keyof typeof settingsAssetSlots;

export const defaultSettings = {
  id: settingsId,
  loginSubtitle: "Entre com seu usuário para acompanhar o estoque municipal.",
  loginTitle: "Almoxarifado Municipal",
  primaryColor: "#0f766e",
  reportFooterText: "Documento gerado pelo sistema de almoxarifado municipal.",
  reportPrimaryColor: "#0f766e",
  reportTitle: "GEMA - Gestão Municipal de Almoxarifado",
  systemName: "Prefeitura",
};

export function getSystemSettings(prisma: PrismaClient) {
  return prisma.systemSettings.upsert({
    where: { id: settingsId },
    update: {},
    create: defaultSettings,
  });
}

export function isSettingsAssetSlot(value: string): value is SettingsAssetSlot {
  return value in settingsAssetSlots;
}

export async function uploadSystemSettingsAsset(
  prisma: PrismaClient,
  {
    buffer,
    contentType,
    slot,
  }: {
    buffer: Buffer;
    contentType: string;
    slot: string;
  },
) {
  if (!isSettingsAssetSlot(slot)) {
    throw new AppError(404, "Tipo de upload não encontrado.");
  }

  const config = settingsAssetSlots[slot];
  const upload = await storeUploadAsset({
    buffer,
    contentType,
    key: config.key,
    namespace: "settings",
  });
  const data = {
    [config.field]: upload.url,
  } as Prisma.SystemSettingsUncheckedUpdateInput;
  const settings = await prisma.systemSettings.upsert({
    where: { id: settingsId },
    update: data,
    create: {
      ...defaultSettings,
      ...data,
    } as Prisma.SystemSettingsUncheckedCreateInput,
  });

  return {
    driver: upload.driver,
    field: config.field,
    key: upload.key,
    settings,
    slot,
    url: upload.url,
  };
}
