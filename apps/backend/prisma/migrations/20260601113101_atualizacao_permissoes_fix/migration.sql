-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PermissionProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PermissionProfile" ("active", "createdAt", "description", "id", "name", "updatedAt") SELECT "active", "createdAt", "description", "id", "name", "updatedAt" FROM "PermissionProfile";
DROP TABLE "PermissionProfile";
ALTER TABLE "new_PermissionProfile" RENAME TO "PermissionProfile";
CREATE UNIQUE INDEX "PermissionProfile_name_key" ON "PermissionProfile"("name");
CREATE INDEX "PermissionProfile_active_idx" ON "PermissionProfile"("active");
CREATE INDEX "PermissionProfile_name_idx" ON "PermissionProfile"("name");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isDefaultAdmin" BOOLEAN NOT NULL DEFAULT false,
    "permissionProfileId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_permissionProfileId_fkey" FOREIGN KEY ("permissionProfileId") REFERENCES "PermissionProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("active", "createdAt", "email", "id", "isDefaultAdmin", "name", "passwordHash", "permissionProfileId", "role", "updatedAt") SELECT "active", "createdAt", "email", "id", "isDefaultAdmin", "name", "passwordHash", "permissionProfileId", "role", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_permissionProfileId_idx" ON "User"("permissionProfileId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
