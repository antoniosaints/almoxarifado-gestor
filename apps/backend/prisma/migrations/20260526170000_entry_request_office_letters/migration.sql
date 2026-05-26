ALTER TABLE "EntryRequest" ADD COLUMN "officeNumber" INTEGER;
ALTER TABLE "EntryRequest" ADD COLUMN "officeYear" INTEGER;
ALTER TABLE "SystemSettings" ADD COLUMN "officeLogoUrl" TEXT;

CREATE UNIQUE INDEX "EntryRequest_warehouseId_officeYear_officeNumber_key" ON "EntryRequest"("warehouseId", "officeYear", "officeNumber");
