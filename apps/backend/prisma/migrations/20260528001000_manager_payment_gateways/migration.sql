-- CreateTable
CREATE TABLE "ManagerPaymentGatewayConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "publicKey" TEXT,
    "accessToken" TEXT,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "refreshToken" TEXT,
    "webhookSecret" TEXT,
    "accountId" TEXT,
    "liveMode" BOOLEAN NOT NULL DEFAULT false,
    "connectedAt" DATETIME,
    "tokenExpiresAt" DATETIME,
    "oauthState" TEXT,
    "oauthStateExpiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ManagerBillingPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "billingId" TEXT NOT NULL,
    "gatewayConfigId" TEXT,
    "provider" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerPaymentId" TEXT,
    "externalReference" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL DEFAULT 0,
    "statusDetail" TEXT,
    "qrCode" TEXT,
    "qrCodeBase64" TEXT,
    "ticketUrl" TEXT,
    "barcode" TEXT,
    "rawPayload" TEXT,
    "expiresAt" DATETIME,
    "paidAt" DATETIME,
    "cancelledAt" DATETIME,
    "refundedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ManagerBillingPayment_billingId_fkey" FOREIGN KEY ("billingId") REFERENCES "ManagerBilling" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ManagerBillingPayment_gatewayConfigId_fkey" FOREIGN KEY ("gatewayConfigId") REFERENCES "ManagerPaymentGatewayConfig" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagerPaymentGatewayConfig_provider_key" ON "ManagerPaymentGatewayConfig"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerBillingPayment_externalReference_key" ON "ManagerBillingPayment"("externalReference");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerBillingPayment_provider_providerPaymentId_key" ON "ManagerBillingPayment"("provider", "providerPaymentId");

-- CreateIndex
CREATE INDEX "ManagerBillingPayment_billingId_idx" ON "ManagerBillingPayment"("billingId");

-- CreateIndex
CREATE INDEX "ManagerBillingPayment_gatewayConfigId_idx" ON "ManagerBillingPayment"("gatewayConfigId");

-- CreateIndex
CREATE INDEX "ManagerBillingPayment_provider_idx" ON "ManagerBillingPayment"("provider");

-- CreateIndex
CREATE INDEX "ManagerBillingPayment_status_idx" ON "ManagerBillingPayment"("status");
