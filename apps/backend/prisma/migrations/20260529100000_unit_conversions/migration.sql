CREATE TABLE "UnitConversion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "fromUnitId" TEXT NOT NULL,
  "factorToBase" DECIMAL NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "UnitConversion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UnitConversion_fromUnitId_fkey" FOREIGN KEY ("fromUnitId") REFERENCES "UnitOfMeasure" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UnitConversion_productId_fromUnitId_key" ON "UnitConversion"("productId", "fromUnitId");
CREATE INDEX "UnitConversion_fromUnitId_idx" ON "UnitConversion"("fromUnitId");

ALTER TABLE "StockMovement" ADD COLUMN "sourceQuantity" DECIMAL;
ALTER TABLE "StockMovement" ADD COLUMN "sourceUnitId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN "conversionFactor" DECIMAL;
ALTER TABLE "StockMovement" ADD COLUMN "sourceUnitPrice" DECIMAL;
CREATE INDEX "StockMovement_sourceUnitId_idx" ON "StockMovement"("sourceUnitId");

ALTER TABLE "EntryRequest" ADD COLUMN "sourceQuantity" DECIMAL;
ALTER TABLE "EntryRequest" ADD COLUMN "sourceUnitId" TEXT;
ALTER TABLE "EntryRequest" ADD COLUMN "conversionFactor" DECIMAL;
CREATE INDEX "EntryRequest_sourceUnitId_idx" ON "EntryRequest"("sourceUnitId");

ALTER TABLE "EntryRequestItem" ADD COLUMN "sourceQuantity" DECIMAL;
ALTER TABLE "EntryRequestItem" ADD COLUMN "sourceUnitId" TEXT;
ALTER TABLE "EntryRequestItem" ADD COLUMN "conversionFactor" DECIMAL;
CREATE INDEX "EntryRequestItem_sourceUnitId_idx" ON "EntryRequestItem"("sourceUnitId");

ALTER TABLE "TransferRequest" ADD COLUMN "sourceQuantity" DECIMAL;
ALTER TABLE "TransferRequest" ADD COLUMN "sourceUnitId" TEXT;
ALTER TABLE "TransferRequest" ADD COLUMN "conversionFactor" DECIMAL;
CREATE INDEX "TransferRequest_sourceUnitId_idx" ON "TransferRequest"("sourceUnitId");

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EntryRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sourceQuantity" DECIMAL,
    "sourceUnitId" TEXT,
    "conversionFactor" DECIMAL,
    "observation" TEXT,
    "movementDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" DATETIME,
    "officeNumber" INTEGER,
    "officeYear" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EntryRequest_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EntryRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EntryRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EntryRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "EntryRequest_sourceUnitId_fkey" FOREIGN KEY ("sourceUnitId") REFERENCES "UnitOfMeasure" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EntryRequest" ("conversionFactor", "createdAt", "id", "movementDate", "observation", "officeNumber", "officeYear", "productId", "quantity", "requestedById", "reviewedAt", "reviewedById", "sourceQuantity", "sourceUnitId", "status", "updatedAt", "warehouseId") SELECT "conversionFactor", "createdAt", "id", "movementDate", "observation", "officeNumber", "officeYear", "productId", "quantity", "requestedById", "reviewedAt", "reviewedById", "sourceQuantity", "sourceUnitId", "status", "updatedAt", "warehouseId" FROM "EntryRequest";
DROP TABLE "EntryRequest";
ALTER TABLE "new_EntryRequest" RENAME TO "EntryRequest";
CREATE INDEX "EntryRequest_sourceUnitId_idx" ON "EntryRequest"("sourceUnitId");
CREATE UNIQUE INDEX "EntryRequest_warehouseId_officeYear_officeNumber_key" ON "EntryRequest"("warehouseId", "officeYear", "officeNumber");
CREATE TABLE "new_EntryRequestItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sourceQuantity" DECIMAL,
    "sourceUnitId" TEXT,
    "conversionFactor" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EntryRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "EntryRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EntryRequestItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "EntryRequestItem_sourceUnitId_fkey" FOREIGN KEY ("sourceUnitId") REFERENCES "UnitOfMeasure" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_EntryRequestItem" ("conversionFactor", "createdAt", "id", "productId", "quantity", "requestId", "sourceQuantity", "sourceUnitId", "updatedAt") SELECT "conversionFactor", "createdAt", "id", "productId", "quantity", "requestId", "sourceQuantity", "sourceUnitId", "updatedAt" FROM "EntryRequestItem";
DROP TABLE "EntryRequestItem";
ALTER TABLE "new_EntryRequestItem" RENAME TO "EntryRequestItem";
CREATE INDEX "EntryRequestItem_requestId_idx" ON "EntryRequestItem"("requestId");
CREATE INDEX "EntryRequestItem_productId_idx" ON "EntryRequestItem"("productId");
CREATE INDEX "EntryRequestItem_sourceUnitId_idx" ON "EntryRequestItem"("sourceUnitId");
CREATE TABLE "new_StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sourceWarehouseId" TEXT,
    "destinationWarehouseId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL,
    "sourceQuantity" DECIMAL,
    "sourceUnitId" TEXT,
    "conversionFactor" DECIMAL,
    "sourceUnitPrice" DECIMAL,
    "destinationNote" TEXT,
    "observation" TEXT,
    "invoiceId" TEXT,
    "stockId" TEXT,
    "movementDate" DATETIME NOT NULL,
    "responsibleUserId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StockMovement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "Warehouse" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "Warehouse" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_sourceUnitId_fkey" FOREIGN KEY ("sourceUnitId") REFERENCES "UnitOfMeasure" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StockMovement" ("conversionFactor", "createdAt", "destinationNote", "destinationWarehouseId", "id", "invoiceId", "movementDate", "observation", "productId", "quantity", "responsibleUserId", "sourceQuantity", "sourceUnitId", "sourceUnitPrice", "sourceWarehouseId", "stockId", "type", "unitPrice", "updatedAt", "warehouseId") SELECT "conversionFactor", "createdAt", "destinationNote", "destinationWarehouseId", "id", "invoiceId", "movementDate", "observation", "productId", "quantity", "responsibleUserId", "sourceQuantity", "sourceUnitId", "sourceUnitPrice", "sourceWarehouseId", "stockId", "type", "unitPrice", "updatedAt", "warehouseId" FROM "StockMovement";
DROP TABLE "StockMovement";
ALTER TABLE "new_StockMovement" RENAME TO "StockMovement";
CREATE INDEX "StockMovement_stockId_idx" ON "StockMovement"("stockId");
CREATE INDEX "StockMovement_sourceUnitId_idx" ON "StockMovement"("sourceUnitId");
CREATE TABLE "new_TransferRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceWarehouseId" TEXT NOT NULL,
    "destinationWarehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sourceQuantity" DECIMAL,
    "sourceUnitId" TEXT,
    "conversionFactor" DECIMAL,
    "observation" TEXT,
    "movementDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_RECEIPT',
    "createdById" TEXT NOT NULL,
    "receivedById" TEXT,
    "receivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TransferRequest_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransferRequest_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "Warehouse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransferRequest_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransferRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransferRequest_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TransferRequest_sourceUnitId_fkey" FOREIGN KEY ("sourceUnitId") REFERENCES "UnitOfMeasure" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TransferRequest" ("conversionFactor", "createdAt", "createdById", "destinationWarehouseId", "id", "movementDate", "observation", "productId", "quantity", "receivedAt", "receivedById", "sourceQuantity", "sourceUnitId", "sourceWarehouseId", "status", "updatedAt") SELECT "conversionFactor", "createdAt", "createdById", "destinationWarehouseId", "id", "movementDate", "observation", "productId", "quantity", "receivedAt", "receivedById", "sourceQuantity", "sourceUnitId", "sourceWarehouseId", "status", "updatedAt" FROM "TransferRequest";
DROP TABLE "TransferRequest";
ALTER TABLE "new_TransferRequest" RENAME TO "TransferRequest";
CREATE INDEX "TransferRequest_sourceUnitId_idx" ON "TransferRequest"("sourceUnitId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
