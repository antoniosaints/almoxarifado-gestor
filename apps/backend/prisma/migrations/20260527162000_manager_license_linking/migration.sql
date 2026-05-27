-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ManagerLicense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriberId" TEXT NOT NULL,
    "systemKey" TEXT NOT NULL,
    "licenseKey" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'MONTHLY',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "seats" INTEGER NOT NULL DEFAULT 1,
    "startsAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "validatedAt" DATETIME,
    "linkedAt" DATETIME,
    "linkedDomain" TEXT,
    "linkedIp" TEXT,
    "linkedUserAgent" TEXT,
    "lastValidationAt" DATETIME,
    "lastValidationDomain" TEXT,
    "lastValidationIp" TEXT,
    "lastValidationUserAgent" TEXT,
    "validationCount" INTEGER NOT NULL DEFAULT 0,
    "validationBlockedAt" DATETIME,
    "validationBlockedReason" TEXT,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "monthlyValue" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ManagerLicense_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "ManagerSubscriber" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_ManagerLicense" (
    "cancelledAt",
    "cancellationReason",
    "createdAt",
    "expiresAt",
    "id",
    "licenseKey",
    "monthlyValue",
    "seats",
    "startsAt",
    "status",
    "subscriberId",
    "systemKey",
    "type",
    "updatedAt",
    "validatedAt"
)
SELECT
    "cancelledAt",
    "cancellationReason",
    "createdAt",
    "expiresAt",
    "id",
    "licenseKey",
    "monthlyValue",
    "seats",
    "startsAt",
    "status",
    "subscriberId",
    "systemKey",
    "type",
    "updatedAt",
    "validatedAt"
FROM "ManagerLicense";

DROP TABLE "ManagerLicense";
ALTER TABLE "new_ManagerLicense" RENAME TO "ManagerLicense";

CREATE UNIQUE INDEX "ManagerLicense_licenseKey_key" ON "ManagerLicense"("licenseKey");
CREATE INDEX "ManagerLicense_subscriberId_idx" ON "ManagerLicense"("subscriberId");
CREATE INDEX "ManagerLicense_systemKey_idx" ON "ManagerLicense"("systemKey");
CREATE INDEX "ManagerLicense_status_idx" ON "ManagerLicense"("status");
CREATE INDEX "ManagerLicense_expiresAt_idx" ON "ManagerLicense"("expiresAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
