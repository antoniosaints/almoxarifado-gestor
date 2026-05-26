-- CreateTable
CREATE TABLE "ManagerSubscriber" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "state" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ManagerLicense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriberId" TEXT NOT NULL,
    "systemKey" TEXT NOT NULL,
    "licenseKey" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'MONTHLY',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "seats" INTEGER NOT NULL DEFAULT 1,
    "startsAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "validatedAt" DATETIME,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "monthlyValue" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ManagerLicense_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "ManagerSubscriber" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManagerBilling" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriberId" TEXT NOT NULL,
    "licenseId" TEXT,
    "systemKey" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL NOT NULL DEFAULT 0,
    "dueDate" DATETIME NOT NULL,
    "paidAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ManagerBilling_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "ManagerSubscriber" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ManagerBilling_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "ManagerLicense" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagerSubscriber_document_key" ON "ManagerSubscriber"("document");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerSubscriber_email_key" ON "ManagerSubscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerLicense_licenseKey_key" ON "ManagerLicense"("licenseKey");

-- CreateIndex
CREATE INDEX "ManagerLicense_subscriberId_idx" ON "ManagerLicense"("subscriberId");

-- CreateIndex
CREATE INDEX "ManagerLicense_systemKey_idx" ON "ManagerLicense"("systemKey");

-- CreateIndex
CREATE INDEX "ManagerLicense_status_idx" ON "ManagerLicense"("status");

-- CreateIndex
CREATE INDEX "ManagerLicense_expiresAt_idx" ON "ManagerLicense"("expiresAt");

-- CreateIndex
CREATE INDEX "ManagerBilling_subscriberId_idx" ON "ManagerBilling"("subscriberId");

-- CreateIndex
CREATE INDEX "ManagerBilling_licenseId_idx" ON "ManagerBilling"("licenseId");

-- CreateIndex
CREATE INDEX "ManagerBilling_systemKey_idx" ON "ManagerBilling"("systemKey");

-- CreateIndex
CREATE INDEX "ManagerBilling_status_idx" ON "ManagerBilling"("status");

-- CreateIndex
CREATE INDEX "ManagerBilling_dueDate_idx" ON "ManagerBilling"("dueDate");
