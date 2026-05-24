import type { PrismaClient } from "@prisma/client";

export const settingsId = "system";

export const defaultSettings = {
  id: settingsId,
  loginSubtitle: "Entre com seu usuario para acompanhar o estoque municipal.",
  loginTitle: "Almoxarifado Municipal",
  primaryColor: "#0f766e",
  reportFooterText: "Documento gerado pelo sistema de almoxarifado municipal.",
  reportPrimaryColor: "#0f766e",
  systemName: "Prefeitura",
};

export function getSystemSettings(prisma: PrismaClient) {
  return prisma.systemSettings.upsert({
    where: { id: settingsId },
    update: {},
    create: defaultSettings,
  });
}
