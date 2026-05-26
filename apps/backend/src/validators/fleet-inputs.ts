import {
  FleetDriverStatus,
  FleetMaintenanceStatus,
  FleetMaintenanceType,
  FleetPrimaryControlUnit,
  FleetVehicleStatus,
} from "@prisma/client";
import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => value || null);

const optionalDate = z.coerce.date().optional().nullable();
const optionalNumber = z.coerce.number().optional().nullable();
const optionalInt = z.coerce.number().int().optional().nullable();

export const fleetStructureInput = z.object({
  active: z.boolean().default(true),
  name: z.string().trim().min(2, "Informe a estrutura."),
  notes: optionalText,
  type: optionalText,
});

export const fleetDriverInput = z.object({
  cpf: optionalText,
  email: optionalText,
  licenseCategory: optionalText,
  licenseExpiresAt: optionalDate,
  licenseIssuedAt: optionalDate,
  licenseNumber: optionalText,
  licenseStatus: optionalText,
  name: z.string().trim().min(2, "Informe o motorista."),
  notes: optionalText,
  phone: optionalText,
  status: z.nativeEnum(FleetDriverStatus).default(FleetDriverStatus.ACTIVE),
});

export const fleetVehicleInput = z.object({
  acquisitionDate: optionalDate,
  acquisitionValue: z.coerce.number().min(0).default(0),
  brand: z.string().trim().min(2, "Informe a marca."),
  chassis: optionalText,
  color: optionalText,
  currentDriverId: z.string().min(1).optional().nullable(),
  currentHourmeter: optionalNumber,
  currentOdometer: z.coerce.number().int().min(0).default(0),
  currentStructureId: z.string().min(1).optional().nullable(),
  fuelType: z.string().trim().min(2, "Informe o combustivel."),
  manufactureYear: optionalInt,
  model: z.string().trim().min(1, "Informe o modelo."),
  modelYear: optionalInt,
  notes: optionalText,
  plate: z.string().trim().min(3, "Informe a placa.").transform((value) => value.toUpperCase()),
  renavam: optionalText,
  status: z.nativeEnum(FleetVehicleStatus).default(FleetVehicleStatus.ACTIVE),
  tankCapacity: z.coerce.number().min(0).default(0),
  vehicleType: z.string().trim().min(2, "Informe o tipo."),
});

export const fleetReadingInput = z.object({
  driverId: z.string().min(1).optional().nullable(),
  hourmeter: optionalNumber,
  notes: optionalText,
  odometer: optionalInt,
  readingDate: z.coerce.date(),
  structureId: z.string().min(1).optional().nullable(),
  vehicleId: z.string().min(1, "Escolha o veiculo."),
});

export const fleetFuelingInput = z.object({
  driverId: z.string().min(1).optional().nullable(),
  fiscalDocument: optionalText,
  fuelType: z.string().trim().min(2, "Informe o combustivel."),
  fuelingDate: z.coerce.date(),
  hourmeter: optionalNumber,
  notes: optionalText,
  odometer: optionalInt,
  quantity: z.coerce.number().positive("Informe a quantidade."),
  supplier: optionalText,
  totalPrice: z.coerce.number().min(0).optional().nullable(),
  unitPrice: z.coerce.number().min(0, "Informe o valor por litro."),
  vehicleId: z.string().min(1, "Escolha o veiculo."),
});

export const fleetAllocationInput = z.object({
  destinationStructureId: z.string().min(1, "Escolha o destino."),
  driverId: z.string().min(1).optional().nullable(),
  notes: optionalText,
  reason: optionalText,
  startDate: z.coerce.date(),
  vehicleId: z.string().min(1, "Escolha o veiculo."),
});

export const fleetTransferInput = z.object({
  destinationStructureId: z.string().min(1, "Escolha o destino."),
  driverId: z.string().min(1).optional().nullable(),
  hourmeter: optionalNumber,
  notes: optionalText,
  odometer: optionalInt,
  transferDate: z.coerce.date(),
  vehicleCondition: optionalText,
  vehicleId: z.string().min(1, "Escolha o veiculo."),
});

export const fleetMaintenanceInput = z.object({
  completedAt: optionalDate,
  hourmeter: optionalNumber,
  laborCost: z.coerce.number().min(0).default(0),
  notes: optionalText,
  odometer: optionalInt,
  openedAt: z.coerce.date(),
  partsCost: z.coerce.number().min(0).default(0),
  partsUsed: optionalText,
  performedServices: optionalText,
  problemDescription: z.string().trim().min(2, "Descreva a manutencao."),
  status: z.nativeEnum(FleetMaintenanceStatus).default(FleetMaintenanceStatus.OPEN),
  supplier: optionalText,
  totalCost: z.coerce.number().min(0).optional().nullable(),
  type: z.nativeEnum(FleetMaintenanceType),
  vehicleId: z.string().min(1, "Escolha o veiculo."),
});

export const fleetScheduledServiceInput = z.object({
  active: z.boolean().default(true),
  intervalDays: optionalInt,
  intervalHours: optionalNumber,
  intervalKm: optionalInt,
  lastDoneAt: optionalDate,
  lastHourmeter: optionalNumber,
  lastOdometer: optionalInt,
  limitDate: optionalDate,
  notes: optionalText,
  serviceType: z.string().trim().min(2, "Informe o servico."),
  triggerFirst: z.boolean().default(true),
  vehicleId: z.string().min(1).optional().nullable(),
  vehicleType: optionalText,
});

export const fleetOilControlInput = z.object({
  intervalDays: optionalInt,
  intervalHours: optionalNumber,
  intervalKm: optionalInt,
  lastChangeDate: z.coerce.date(),
  lastHourmeter: optionalNumber,
  lastOdometer: optionalInt,
  notes: optionalText,
  oilType: z.string().trim().min(2, "Informe o oleo."),
  vehicleId: z.string().min(1, "Escolha o veiculo."),
});

export const fleetBeltControlInput = z.object({
  beltType: z.string().trim().min(2, "Informe a correia."),
  installHourmeter: optionalNumber,
  installOdometer: optionalInt,
  installedAt: z.coerce.date(),
  lifetimeDays: optionalInt,
  lifetimeHours: optionalNumber,
  lifetimeKm: optionalInt,
  notes: optionalText,
  vehicleId: z.string().min(1, "Escolha o veiculo."),
});

export const fleetTireInput = z.object({
  brand: optionalText,
  estimatedLifeKm: optionalInt,
  installedAt: optionalDate,
  installedKm: optionalInt,
  model: optionalText,
  notes: optionalText,
  position: z.string().trim().min(1, "Informe a posicao."),
  serialNumber: optionalText,
  status: z.string().trim().min(2).default("ACTIVE"),
  vehicleId: z.string().min(1, "Escolha o veiculo."),
});

export const fleetSettingsInput = z.object({
  beltAlertPercent: z.coerce.number().int().min(1).max(100),
  driverLicenseAlertDays: z.coerce.number().int().min(1).max(365),
  fuelTypes: z.string().trim().min(2),
  maintenanceAlertDays: z.coerce.number().int().min(1).max(365),
  maintenanceTypes: z.string().trim().min(2),
  oilAlertPercent: z.coerce.number().int().min(1).max(100),
  preventiveServiceTypes: z.string().trim().min(2),
  primaryControlUnit: z.nativeEnum(FleetPrimaryControlUnit),
  vehicleTypes: z.string().trim().min(2),
});
