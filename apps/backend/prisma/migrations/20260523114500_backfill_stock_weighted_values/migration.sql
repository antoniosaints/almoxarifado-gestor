-- Backfill existing stock valuation from priced entry movements when available.
UPDATE "Stock"
SET "unitPriceAverage" = COALESCE(
  (
    SELECT ROUND(
      SUM("StockMovement"."quantity" * "StockMovement"."unitPrice") * 1.0 /
        SUM("StockMovement"."quantity"),
      2
    )
    FROM "StockMovement"
    WHERE "StockMovement"."warehouseId" = "Stock"."warehouseId"
      AND "StockMovement"."productId" = "Stock"."productId"
      AND "StockMovement"."type" = 'ENTRADA'
      AND "StockMovement"."unitPrice" IS NOT NULL
  ),
  "unitPriceAverage"
);

UPDATE "Stock"
SET "totalValue" = ROUND("currentQuantity" * "unitPriceAverage", 2);
