-- CreateTable
CREATE TABLE "FleetStructure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FleetDriver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "cpf" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "licenseNumber" TEXT,
    "licenseCategory" TEXT,
    "licenseIssuedAt" DATETIME,
    "licenseExpiresAt" DATETIME,
    "licenseStatus" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FleetVehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plate" TEXT NOT NULL,
    "renavam" TEXT,
    "chassis" TEXT,
    "vehicleType" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "manufactureYear" INTEGER,
    "modelYear" INTEGER,
    "color" TEXT,
    "fuelType" TEXT NOT NULL,
    "tankCapacity" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currentOdometer" INTEGER NOT NULL DEFAULT 0,
    "currentHourmeter" DECIMAL,
    "currentStructureId" TEXT,
    "currentDriverId" TEXT,
    "acquisitionDate" DATETIME,
    "acquisitionValue" DECIMAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FleetVehicle_currentStructureId_fkey" FOREIGN KEY ("currentStructureId") REFERENCES "FleetStructure" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FleetVehicle_currentDriverId_fkey" FOREIGN KEY ("currentDriverId") REFERENCES "FleetDriver" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FleetVehicleReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,
    "structureId" TEXT,
    "registeredById" TEXT,
    "readingDate" DATETIME NOT NULL,
    "odometer" INTEGER,
    "hourmeter" DECIMAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FleetVehicleReading_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FleetVehicleReading_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "FleetDriver" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FleetVehicleReading_structureId_fkey" FOREIGN KEY ("structureId") REFERENCES "FleetStructure" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FleetVehicleReading_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FleetFueling" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,
    "fuelingDate" DATETIME NOT NULL,
    "fuelType" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "unitPrice" DECIMAL NOT NULL,
    "totalPrice" DECIMAL NOT NULL,
    "supplier" TEXT,
    "odometer" INTEGER,
    "hourmeter" DECIMAL,
    "fiscalDocument" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FleetFueling_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FleetFueling_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "FleetDriver" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FleetVehicleAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "originStructureId" TEXT,
    "destinationStructureId" TEXT NOT NULL,
    "driverId" TEXT,
    "responsibleUserId" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FleetVehicleAllocation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FleetVehicleAllocation_originStructureId_fkey" FOREIGN KEY ("originStructureId") REFERENCES "FleetStructure" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FleetVehicleAllocation_destinationStructureId_fkey" FOREIGN KEY ("destinationStructureId") REFERENCES "FleetStructure" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FleetVehicleAllocation_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FleetVehicleTransfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "originStructureId" TEXT,
    "destinationStructureId" TEXT NOT NULL,
    "transferDate" DATETIME NOT NULL,
    "responsibleUserId" TEXT,
    "driverId" TEXT,
    "odometer" INTEGER,
    "hourmeter" DECIMAL,
    "vehicleCondition" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FleetVehicleTransfer_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FleetVehicleTransfer_originStructureId_fkey" FOREIGN KEY ("originStructureId") REFERENCES "FleetStructure" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FleetVehicleTransfer_destinationStructureId_fkey" FOREIGN KEY ("destinationStructureId") REFERENCES "FleetStructure" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FleetVehicleTransfer_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FleetVehicleTransfer_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "FleetDriver" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FleetMaintenance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "problemDescription" TEXT NOT NULL,
    "performedServices" TEXT,
    "partsUsed" TEXT,
    "supplier" TEXT,
    "laborCost" DECIMAL NOT NULL DEFAULT 0,
    "partsCost" DECIMAL NOT NULL DEFAULT 0,
    "totalCost" DECIMAL NOT NULL DEFAULT 0,
    "odometer" INTEGER,
    "hourmeter" DECIMAL,
    "responsibleUserId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FleetMaintenance_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FleetMaintenance_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FleetScheduledService" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT,
    "vehicleType" TEXT,
    "serviceType" TEXT NOT NULL,
    "intervalKm" INTEGER,
    "intervalHours" DECIMAL,
    "intervalDays" INTEGER,
    "limitDate" DATETIME,
    "triggerFirst" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastDoneAt" DATETIME,
    "lastOdometer" INTEGER,
    "lastHourmeter" DECIMAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FleetScheduledService_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FleetOilControl" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "oilType" TEXT NOT NULL,
    "lastChangeDate" DATETIME NOT NULL,
    "lastOdometer" INTEGER,
    "lastHourmeter" DECIMAL,
    "intervalKm" INTEGER,
    "intervalHours" DECIMAL,
    "intervalDays" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FleetOilControl_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FleetBeltControl" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "beltType" TEXT NOT NULL,
    "installedAt" DATETIME NOT NULL,
    "installOdometer" INTEGER,
    "installHourmeter" DECIMAL,
    "lifetimeKm" INTEGER,
    "lifetimeHours" DECIMAL,
    "lifetimeDays" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FleetBeltControl_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FleetTire" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleId" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "serialNumber" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "installedAt" DATETIME,
    "installedKm" INTEGER,
    "estimatedLifeKm" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FleetTire_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FleetSettings" (
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

-- CreateIndex
CREATE UNIQUE INDEX "FleetStructure_name_key" ON "FleetStructure"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FleetDriver_cpf_key" ON "FleetDriver"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "FleetVehicle_plate_key" ON "FleetVehicle"("plate");

-- CreateIndex
CREATE INDEX "FleetVehicle_currentStructureId_idx" ON "FleetVehicle"("currentStructureId");

-- CreateIndex
CREATE INDEX "FleetVehicle_currentDriverId_idx" ON "FleetVehicle"("currentDriverId");

-- CreateIndex
CREATE INDEX "FleetVehicle_status_idx" ON "FleetVehicle"("status");

-- CreateIndex
CREATE INDEX "FleetVehicleReading_vehicleId_readingDate_idx" ON "FleetVehicleReading"("vehicleId", "readingDate");

-- CreateIndex
CREATE INDEX "FleetFueling_vehicleId_fuelingDate_idx" ON "FleetFueling"("vehicleId", "fuelingDate");

-- CreateIndex
CREATE INDEX "FleetFueling_driverId_idx" ON "FleetFueling"("driverId");

-- CreateIndex
CREATE INDEX "FleetVehicleAllocation_vehicleId_endDate_idx" ON "FleetVehicleAllocation"("vehicleId", "endDate");

-- CreateIndex
CREATE INDEX "FleetVehicleAllocation_destinationStructureId_idx" ON "FleetVehicleAllocation"("destinationStructureId");

-- CreateIndex
CREATE INDEX "FleetVehicleTransfer_vehicleId_transferDate_idx" ON "FleetVehicleTransfer"("vehicleId", "transferDate");

-- CreateIndex
CREATE INDEX "FleetMaintenance_vehicleId_openedAt_idx" ON "FleetMaintenance"("vehicleId", "openedAt");

-- CreateIndex
CREATE INDEX "FleetMaintenance_status_idx" ON "FleetMaintenance"("status");

-- CreateIndex
CREATE INDEX "FleetScheduledService_vehicleId_idx" ON "FleetScheduledService"("vehicleId");

-- CreateIndex
CREATE INDEX "FleetScheduledService_vehicleType_idx" ON "FleetScheduledService"("vehicleType");

-- CreateIndex
CREATE INDEX "FleetOilControl_vehicleId_idx" ON "FleetOilControl"("vehicleId");

-- CreateIndex
CREATE INDEX "FleetBeltControl_vehicleId_idx" ON "FleetBeltControl"("vehicleId");

-- CreateIndex
CREATE INDEX "FleetTire_vehicleId_idx" ON "FleetTire"("vehicleId");

-- CreateIndex
CREATE INDEX "FleetTire_serialNumber_idx" ON "FleetTire"("serialNumber");
