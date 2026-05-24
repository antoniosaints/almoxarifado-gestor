-- Add report personalization settings and protect the seeded default admin.
ALTER TABLE "User" ADD COLUMN "isDefaultAdmin" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User"
SET "isDefaultAdmin" = true
WHERE "email" = 'admin@prefeitura.local';

ALTER TABLE "SystemSettings" ADD COLUMN "reportLogoUrl" TEXT;
ALTER TABLE "SystemSettings" ADD COLUMN "reportPrimaryColor" TEXT NOT NULL DEFAULT '#0f766e';
ALTER TABLE "SystemSettings" ADD COLUMN "reportFooterText" TEXT NOT NULL DEFAULT 'Documento gerado pelo sistema de almoxarifado municipal.';
ALTER TABLE "SystemSettings" ADD COLUMN "reportResponsibleName" TEXT;
ALTER TABLE "SystemSettings" ADD COLUMN "reportResponsibleRole" TEXT;
