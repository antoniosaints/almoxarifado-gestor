-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FleetSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'fleet',
    "driverLicenseAlertDays" INTEGER NOT NULL DEFAULT 30,
    "maintenanceAlertDays" INTEGER NOT NULL DEFAULT 30,
    "oilAlertPercent" INTEGER NOT NULL DEFAULT 80,
    "beltAlertPercent" INTEGER NOT NULL DEFAULT 80,
    "primaryControlUnit" TEXT NOT NULL DEFAULT 'BOTH',
    "vehicleTypes" TEXT NOT NULL DEFAULT 'Passeio
Caminhao
Onibus
Maquina',
    "fuelTypes" TEXT NOT NULL DEFAULT 'Gasolina
Etanol
Diesel
Diesel S10
Flex',
    "maintenanceTypes" TEXT NOT NULL DEFAULT 'Preventiva
Corretiva
Preditiva
Emergencial',
    "preventiveServiceTypes" TEXT NOT NULL DEFAULT 'Troca de oleo
Filtro de oleo
Filtro de ar
Correia
Revisao geral
Alinhamento
Balanceamento
Pneus
Lubrificacao
Freios',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_FleetSettings" ("beltAlertPercent", "createdAt", "driverLicenseAlertDays", "fuelTypes", "id", "maintenanceAlertDays", "maintenanceTypes", "oilAlertPercent", "preventiveServiceTypes", "primaryControlUnit", "updatedAt", "vehicleTypes") SELECT "beltAlertPercent", "createdAt", "driverLicenseAlertDays", "fuelTypes", "id", "maintenanceAlertDays", "maintenanceTypes", "oilAlertPercent", "preventiveServiceTypes", "primaryControlUnit", "updatedAt", "vehicleTypes" FROM "FleetSettings";
DROP TABLE "FleetSettings";
ALTER TABLE "new_FleetSettings" RENAME TO "FleetSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
