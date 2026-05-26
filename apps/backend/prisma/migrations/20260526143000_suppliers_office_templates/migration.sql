-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tradeName" TEXT,
    "cnpj" TEXT NOT NULL,
    "stateRegistration" TEXT,
    "municipalRegistration" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OfficeLetterTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "variables" TEXT NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierId" TEXT,
    "companyName" TEXT NOT NULL,
    "companyTradeName" TEXT,
    "cnpj" TEXT NOT NULL,
    "stateRegistration" TEXT,
    "municipalRegistration" TEXT,
    "companyAddress" TEXT,
    "companyCity" TEXT,
    "companyState" TEXT,
    "companyZipCode" TEXT,
    "companyPhone" TEXT,
    "invoiceKey" TEXT,
    "number" TEXT NOT NULL,
    "series" TEXT,
    "issueDate" DATETIME NOT NULL,
    "totalValue" DECIMAL NOT NULL DEFAULT 0,
    "observation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("cnpj", "companyAddress", "companyCity", "companyName", "companyPhone", "companyState", "companyTradeName", "companyZipCode", "createdAt", "id", "invoiceKey", "issueDate", "municipalRegistration", "number", "observation", "series", "stateRegistration", "totalValue", "updatedAt")
SELECT "cnpj", "companyAddress", "companyCity", "companyName", "companyPhone", "companyState", "companyTradeName", "companyZipCode", "createdAt", "id", "invoiceKey", "issueDate", "municipalRegistration", "number", "observation", "series", "stateRegistration", "totalValue", "updatedAt" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_cnpj_key" ON "Supplier"("cnpj");

-- CreateIndex
CREATE INDEX "Supplier_active_idx" ON "Supplier"("active");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "OfficeLetterTemplate_active_idx" ON "OfficeLetterTemplate"("active");

-- CreateIndex
CREATE INDEX "OfficeLetterTemplate_name_idx" ON "OfficeLetterTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceKey_key" ON "Invoice"("invoiceKey");

-- CreateIndex
CREATE INDEX "Invoice_supplierId_idx" ON "Invoice"("supplierId");
