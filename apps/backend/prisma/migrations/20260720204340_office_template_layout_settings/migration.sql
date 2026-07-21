-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OfficeLetterTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT NOT NULL,
    "headerImageUrl" TEXT,
    "headerText" TEXT,
    "headerAlignment" TEXT NOT NULL DEFAULT 'LEFT',
    "contentHtml" TEXT NOT NULL,
    "footerText" TEXT,
    "marginTop" INTEGER NOT NULL DEFAULT 25,
    "marginRight" INTEGER NOT NULL DEFAULT 20,
    "marginBottom" INTEGER NOT NULL DEFAULT 20,
    "marginLeft" INTEGER NOT NULL DEFAULT 20,
    "fontFamily" TEXT NOT NULL DEFAULT 'Arial',
    "fontSize" INTEGER NOT NULL DEFAULT 12,
    "variables" TEXT NOT NULL DEFAULT '[]',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_OfficeLetterTemplate" ("active", "contentHtml", "createdAt", "description", "footerText", "headerAlignment", "headerImageUrl", "headerText", "id", "name", "subject", "updatedAt", "variables") SELECT "active", "contentHtml", "createdAt", "description", "footerText", "headerAlignment", "headerImageUrl", "headerText", "id", "name", "subject", "updatedAt", "variables" FROM "OfficeLetterTemplate";
DROP TABLE "OfficeLetterTemplate";
ALTER TABLE "new_OfficeLetterTemplate" RENAME TO "OfficeLetterTemplate";
CREATE INDEX "OfficeLetterTemplate_active_idx" ON "OfficeLetterTemplate"("active");
CREATE INDEX "OfficeLetterTemplate_name_idx" ON "OfficeLetterTemplate"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
