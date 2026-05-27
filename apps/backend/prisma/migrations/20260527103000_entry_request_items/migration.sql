CREATE TABLE "EntryRequestItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "requestId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "EntryRequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "EntryRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EntryRequestItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "EntryRequestItem" (
  "id",
  "requestId",
  "productId",
  "quantity",
  "createdAt",
  "updatedAt"
)
SELECT
  'legacy-' || "id",
  "id",
  "productId",
  "quantity",
  "createdAt",
  "updatedAt"
FROM "EntryRequest";

CREATE INDEX "EntryRequestItem_requestId_idx" ON "EntryRequestItem"("requestId");
CREATE INDEX "EntryRequestItem_productId_idx" ON "EntryRequestItem"("productId");
