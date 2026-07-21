-- AlterTable
ALTER TABLE "EntryRequest" ADD COLUMN "reason" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "entryRequestId" TEXT,
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
    CONSTRAINT "StockMovement_sourceUnitId_fkey" FOREIGN KEY ("sourceUnitId") REFERENCES "UnitOfMeasure" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_entryRequestId_fkey" FOREIGN KEY ("entryRequestId") REFERENCES "EntryRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StockMovement" ("conversionFactor", "createdAt", "destinationNote", "destinationWarehouseId", "id", "invoiceId", "movementDate", "observation", "productId", "quantity", "responsibleUserId", "sourceQuantity", "sourceUnitId", "sourceUnitPrice", "sourceWarehouseId", "stockId", "type", "unitPrice", "updatedAt", "warehouseId") SELECT "conversionFactor", "createdAt", "destinationNote", "destinationWarehouseId", "id", "invoiceId", "movementDate", "observation", "productId", "quantity", "responsibleUserId", "sourceQuantity", "sourceUnitId", "sourceUnitPrice", "sourceWarehouseId", "stockId", "type", "unitPrice", "updatedAt", "warehouseId" FROM "StockMovement";
DROP TABLE "StockMovement";
ALTER TABLE "new_StockMovement" RENAME TO "StockMovement";
CREATE INDEX "StockMovement_stockId_idx" ON "StockMovement"("stockId");
CREATE INDEX "StockMovement_sourceUnitId_idx" ON "StockMovement"("sourceUnitId");
CREATE INDEX "StockMovement_entryRequestId_idx" ON "StockMovement"("entryRequestId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
