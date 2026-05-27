-- CreateTable
CREATE TABLE "LicenseValidationState" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'system',
    "mode" TEXT NOT NULL DEFAULT 'unmanaged',
    "licenseKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNMANAGED',
    "valid" BOOLEAN NOT NULL DEFAULT true,
    "blockWrites" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" DATETIME,
    "nextCheckAt" DATETIME,
    "expiresAt" DATETIME,
    "message" TEXT,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "LicenseValidationState_licenseKey_idx" ON "LicenseValidationState"("licenseKey");

-- CreateIndex
CREATE INDEX "LicenseValidationState_status_idx" ON "LicenseValidationState"("status");
