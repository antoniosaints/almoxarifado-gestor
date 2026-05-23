-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "companyTradeName" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "stateRegistration" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "municipalRegistration" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "companyAddress" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "companyCity" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "companyState" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "companyZipCode" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "companyPhone" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "invoiceKey" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "series" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "totalValue" DECIMAL NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceKey_key" ON "Invoice"("invoiceKey");
