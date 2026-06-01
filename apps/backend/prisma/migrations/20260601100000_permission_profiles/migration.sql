CREATE TABLE "PermissionProfile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PermissionProfilePermission" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "profileId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PermissionProfilePermission_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PermissionProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "User" ADD COLUMN "permissionProfileId" TEXT;

CREATE UNIQUE INDEX "PermissionProfile_name_key" ON "PermissionProfile"("name");
CREATE INDEX "PermissionProfile_active_idx" ON "PermissionProfile"("active");
CREATE INDEX "PermissionProfile_name_idx" ON "PermissionProfile"("name");
CREATE UNIQUE INDEX "PermissionProfilePermission_profileId_key_key" ON "PermissionProfilePermission"("profileId", "key");
CREATE INDEX "PermissionProfilePermission_key_idx" ON "PermissionProfilePermission"("key");
CREATE INDEX "User_permissionProfileId_idx" ON "User"("permissionProfileId");

INSERT INTO "PermissionProfile" ("id", "name", "description", "active", "createdAt", "updatedAt")
VALUES (
  'default_operator_profile',
  'Operador padrao',
  'Perfil criado automaticamente para preservar os acessos operacionais existentes dos operadores.',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

INSERT INTO "PermissionProfilePermission" ("id", "profileId", "key", "createdAt")
VALUES
  ('default_operator_profile_create_products', 'default_operator_profile', 'CREATE_PRODUCTS', CURRENT_TIMESTAMP),
  ('default_operator_profile_approve_transfers', 'default_operator_profile', 'APPROVE_TRANSFERS', CURRENT_TIMESTAMP);

UPDATE "User"
SET "permissionProfileId" = 'default_operator_profile'
WHERE "role" = 'OPERATOR' AND "permissionProfileId" IS NULL;
