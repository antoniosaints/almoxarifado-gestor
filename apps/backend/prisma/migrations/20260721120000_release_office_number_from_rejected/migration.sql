-- Solicitacoes rejeitadas deixam de consumir numero de oficio: libera os
-- numeros ja gravados para que a proxima solicitacao os reaproveite.
UPDATE "EntryRequest"
SET "officeNumber" = NULL, "officeYear" = NULL
WHERE "status" = 'REJECTED';
