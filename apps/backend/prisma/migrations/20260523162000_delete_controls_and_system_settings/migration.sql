-- Add controlled deletion audit and system personalization settings.
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "details" TEXT,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'system',
    "systemName" TEXT NOT NULL DEFAULT 'Prefeitura',
    "logoUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#0f766e',
    "loginBackgroundUrl" TEXT,
    "loginTitle" TEXT NOT NULL DEFAULT 'Almoxarifado Municipal',
    "loginSubtitle" TEXT NOT NULL DEFAULT 'Entre com seu usuario para acompanhar o estoque municipal.',
    "loginImageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "SystemSettings" (
    "id",
    "systemName",
    "primaryColor",
    "loginTitle",
    "loginSubtitle",
    "updatedAt"
) VALUES (
    'system',
    'Prefeitura',
    '#0f766e',
    'Almoxarifado Municipal',
    'Entre com seu usuario para acompanhar o estoque municipal.',
    CURRENT_TIMESTAMP
);

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
    CONSTRAINT "StockMovement_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "Stock" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_StockMovement" (
    "id",
    "type",
    "warehouseId",
    "productId",
    "sourceWarehouseId",
    "destinationWarehouseId",
    "quantity",
    "unitPrice",
    "destinationNote",
    "observation",
    "invoiceId",
    "stockId",
    "movementDate",
    "responsibleUserId",
    "createdAt",
    "updatedAt"
)
SELECT
    "StockMovement"."id",
    "StockMovement"."type",
    "StockMovement"."warehouseId",
    "StockMovement"."productId",
    "StockMovement"."sourceWarehouseId",
    "StockMovement"."destinationWarehouseId",
    "StockMovement"."quantity",
    "StockMovement"."unitPrice",
    "StockMovement"."destinationNote",
    "StockMovement"."observation",
    "StockMovement"."invoiceId",
    (
      SELECT "Stock"."id"
      FROM "Stock"
      WHERE "Stock"."warehouseId" = "StockMovement"."warehouseId"
        AND "Stock"."productId" = "StockMovement"."productId"
      LIMIT 1
    ),
    "StockMovement"."movementDate",
    "StockMovement"."responsibleUserId",
    "StockMovement"."createdAt",
    "StockMovement"."updatedAt"
FROM "StockMovement";

DROP TABLE "StockMovement";
ALTER TABLE "new_StockMovement" RENAME TO "StockMovement";

CREATE INDEX "StockMovement_stockId_idx" ON "StockMovement"("stockId");
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
