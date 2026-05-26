import {
  FleetDriverStatus,
  FleetMaintenanceStatus,
  FleetVehicleStatus,
  type FleetPrimaryControlUnit,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";
import { AppError } from "../lib/errors.js";

const vehicleInclude = {
  currentDriver: true,
  currentStructure: true,
} satisfies Prisma.FleetVehicleInclude;

const driverInclude = {
  currentVehicles: {
    include: {
      currentStructure: true,
    },
    orderBy: { plate: "asc" },
  },
} satisfies Prisma.FleetDriverInclude;

const maintenanceInclude = {
  responsibleUser: {
    select: { email: true, id: true, name: true, role: true },
  },
  vehicle: {
    include: vehicleInclude,
  },
} satisfies Prisma.FleetMaintenanceInclude;

const transferInclude = {
  destinationStructure: true,
  driver: true,
  originStructure: true,
  responsibleUser: {
    select: { email: true, id: true, name: true, role: true },
  },
  vehicle: {
    include: vehicleInclude,
  },
} satisfies Prisma.FleetVehicleTransferInclude;

const fuelingInclude = {
  driver: true,
  vehicle: {
    include: vehicleInclude,
  },
} satisfies Prisma.FleetFuelingInclude;

const readingInclude = {
  driver: true,
  registeredBy: {
    select: { email: true, id: true, name: true, role: true },
  },
  structure: true,
  vehicle: {
    include: vehicleInclude,
  },
} satisfies Prisma.FleetVehicleReadingInclude;

export const fleetPermissions = [
  "fleet.view",
  "fleet.vehicle.create",
  "fleet.vehicle.edit",
  "fleet.vehicle.inactivate",
  "fleet.fueling.register",
  "fleet.maintenance.register",
  "fleet.reading.register",
  "fleet.vehicle.transfer",
  "fleet.driver.manage",
  "fleet.reports.view",
  "fleet.settings.manage",
] as const;

export const defaultFleetSettings = {
  beltAlertPercent: 80,
  driverLicenseAlertDays: 30,
  fuelTypes: "Gasolina\nEtanol\nDiesel\nDiesel S10\nFlex",
  id: "fleet",
  maintenanceAlertDays: 30,
  maintenanceTypes: "Preventiva\nCorretiva\nPreditiva\nEmergencial",
  oilAlertPercent: 80,
  preventiveServiceTypes:
    "Troca de oleo\nFiltro de oleo\nFiltro de ar\nCorreia\nRevisao geral\nAlinhamento\nBalanceamento\nPneus\nLubrificacao\nFreios",
  primaryControlUnit: "BOTH" as FleetPrimaryControlUnit,
  vehicleTypes: "Passeio\nCaminhao\nOnibus\nMaquina",
};

type VehicleInput = {
  acquisitionDate?: Date | null;
  acquisitionValue: number;
  brand: string;
  chassis: string | null;
  color: string | null;
  currentDriverId?: string | null;
  currentHourmeter?: number | null;
  currentOdometer: number;
  currentStructureId?: string | null;
  fuelType: string;
  manufactureYear?: number | null;
  model: string;
  modelYear?: number | null;
  notes: string | null;
  plate: string;
  renavam: string | null;
  status: FleetVehicleStatus;
  tankCapacity: number;
  vehicleType: string;
};

type DriverInput = {
  cpf: string | null;
  email: string | null;
  licenseCategory: string | null;
  licenseExpiresAt?: Date | null;
  licenseIssuedAt?: Date | null;
  licenseNumber: string | null;
  licenseStatus: string | null;
  name: string;
  notes: string | null;
  phone: string | null;
  status: FleetDriverStatus;
};

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(left: Date, right: Date) {
  return Math.ceil((right.getTime() - left.getTime()) / 86_400_000);
}

function listFromText(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function healthFromPercent(percent: number, alertPercent: number) {
  if (percent >= 100) {
    return "OVERDUE";
  }

  if (percent >= alertPercent) {
    return "ATTENTION";
  }

  return "OK";
}

function driverLicenseHealth(
  driver: { licenseExpiresAt?: Date | string | null },
  alertDays: number,
) {
  if (!driver.licenseExpiresAt) {
    return "UNKNOWN";
  }

  const expiration = new Date(driver.licenseExpiresAt);
  const today = new Date();

  if (expiration < today) {
    return "EXPIRED";
  }

  if (expiration <= addDays(today, alertDays)) {
    return "EXPIRING";
  }

  return "VALID";
}

function lifecycleProgress({
  alertPercent,
  currentHourmeter,
  currentOdometer,
  intervalDays,
  intervalHours,
  intervalKm,
  referenceDate,
  referenceHourmeter,
  referenceOdometer,
}: {
  alertPercent: number;
  currentHourmeter?: unknown;
  currentOdometer?: number | null;
  intervalDays?: number | null;
  intervalHours?: unknown;
  intervalKm?: number | null;
  referenceDate?: Date | string | null;
  referenceHourmeter?: unknown;
  referenceOdometer?: number | null;
}) {
  const values: number[] = [];
  const kmUsed =
    currentOdometer !== null && currentOdometer !== undefined && referenceOdometer !== null && referenceOdometer !== undefined
      ? Math.max(0, currentOdometer - referenceOdometer)
      : null;
  const hoursUsed =
    currentHourmeter !== null && currentHourmeter !== undefined && referenceHourmeter !== null && referenceHourmeter !== undefined
      ? Math.max(0, toNumber(currentHourmeter) - toNumber(referenceHourmeter))
      : null;
  const daysUsed = referenceDate ? Math.max(0, daysBetween(new Date(referenceDate), new Date())) : null;

  if (intervalKm && kmUsed !== null) {
    values.push((kmUsed / intervalKm) * 100);
  }

  if (intervalHours && hoursUsed !== null) {
    values.push((hoursUsed / toNumber(intervalHours)) * 100);
  }

  if (intervalDays && daysUsed !== null) {
    values.push((daysUsed / intervalDays) * 100);
  }

  const percent = values.length ? Math.max(...values) : 0;

  return {
    daysUsed,
    hoursUsed,
    kmUsed,
    percent,
    status: healthFromPercent(percent, alertPercent),
  };
}

async function getFleetSettings(prisma: PrismaClient) {
  return prisma.fleetSettings.upsert({
    create: defaultFleetSettings,
    update: {},
    where: { id: "fleet" },
  });
}

async function assertDriverCanBeAllocated(
  prisma: PrismaClient,
  driverId: string | null | undefined,
) {
  if (!driverId) {
    return;
  }

  const settings = await getFleetSettings(prisma);
  const driver = await prisma.fleetDriver.findUniqueOrThrow({
    where: { id: driverId },
  });
  const health = driverLicenseHealth(driver, settings.driverLicenseAlertDays);

  if (health === "EXPIRED") {
    throw new AppError(400, "Motorista com CNH vencida nao pode ser alocado.");
  }
}

async function assertNotLowerThanCurrent(
  prisma: PrismaClient,
  vehicleId: string,
  {
    hourmeter,
    odometer,
  }: {
    hourmeter?: number | null;
    odometer?: number | null;
  },
) {
  const vehicle = await prisma.fleetVehicle.findUniqueOrThrow({
    where: { id: vehicleId },
  });

  if (odometer !== null && odometer !== undefined && odometer < vehicle.currentOdometer) {
    throw new AppError(400, "O odometro nao pode ser menor que a ultima leitura.");
  }

  if (
    hourmeter !== null &&
    hourmeter !== undefined &&
    vehicle.currentHourmeter !== null &&
    vehicle.currentHourmeter !== undefined &&
    hourmeter < toNumber(vehicle.currentHourmeter)
  ) {
    throw new AppError(400, "O horimetro nao pode ser menor que a ultima leitura.");
  }

  return vehicle;
}

function vehicleMeterUpdates({
  hourmeter,
  odometer,
}: {
  hourmeter?: number | null;
  odometer?: number | null;
}) {
  return {
    currentHourmeter:
      hourmeter !== null && hourmeter !== undefined ? hourmeter : undefined,
    currentOdometer:
      odometer !== null && odometer !== undefined ? odometer : undefined,
  };
}

export async function listFleetStructures(prisma: PrismaClient) {
  return prisma.fleetStructure.findMany({ orderBy: { name: "asc" } });
}

export async function upsertFleetSettings(
  prisma: PrismaClient,
  input: typeof defaultFleetSettings,
) {
  return prisma.fleetSettings.upsert({
    create: input,
    update: input,
    where: { id: "fleet" },
  });
}

export { getFleetSettings };

export async function createFleetStructure(
  prisma: PrismaClient,
  input: Prisma.FleetStructureUncheckedCreateInput,
) {
  return prisma.fleetStructure.create({ data: input });
}

export async function updateFleetStructure(
  prisma: PrismaClient,
  id: string,
  input: Prisma.FleetStructureUncheckedUpdateInput,
) {
  return prisma.fleetStructure.update({ data: input, where: { id } });
}

export async function listFleetDrivers(prisma: PrismaClient) {
  const settings = await getFleetSettings(prisma);
  const drivers = await prisma.fleetDriver.findMany({
    include: driverInclude,
    orderBy: { name: "asc" },
  });

  return drivers.map((driver) => ({
    ...driver,
    cnhHealth: driverLicenseHealth(driver, settings.driverLicenseAlertDays),
  }));
}

export async function createFleetDriver(prisma: PrismaClient, input: DriverInput) {
  const driver = await prisma.fleetDriver.create({
    data: input,
    include: driverInclude,
  });
  const settings = await getFleetSettings(prisma);

  return {
    ...driver,
    cnhHealth: driverLicenseHealth(driver, settings.driverLicenseAlertDays),
  };
}

export async function updateFleetDriver(
  prisma: PrismaClient,
  id: string,
  input: DriverInput,
) {
  const driver = await prisma.fleetDriver.update({
    data: input,
    include: driverInclude,
    where: { id },
  });
  const settings = await getFleetSettings(prisma);

  return {
    ...driver,
    cnhHealth: driverLicenseHealth(driver, settings.driverLicenseAlertDays),
  };
}

export async function inactivateFleetDriver(prisma: PrismaClient, id: string) {
  return prisma.fleetDriver.update({
    data: { status: FleetDriverStatus.INACTIVE },
    include: driverInclude,
    where: { id },
  });
}

export async function listFleetVehicles(prisma: PrismaClient) {
  return prisma.fleetVehicle.findMany({
    include: vehicleInclude,
    orderBy: { plate: "asc" },
  });
}

export async function createFleetVehicle(prisma: PrismaClient, input: VehicleInput) {
  await assertDriverCanBeAllocated(prisma, input.currentDriverId);

  return prisma.fleetVehicle.create({
    data: input,
    include: vehicleInclude,
  });
}

export async function updateFleetVehicle(
  prisma: PrismaClient,
  id: string,
  input: VehicleInput,
) {
  await assertDriverCanBeAllocated(prisma, input.currentDriverId);

  return prisma.fleetVehicle.update({
    data: input,
    include: vehicleInclude,
    where: { id },
  });
}

export async function inactivateFleetVehicle(prisma: PrismaClient, id: string) {
  return prisma.fleetVehicle.update({
    data: { status: FleetVehicleStatus.INACTIVE },
    include: vehicleInclude,
    where: { id },
  });
}

export async function createFleetReading(
  prisma: PrismaClient,
  input: Prisma.FleetVehicleReadingUncheckedCreateInput,
) {
  await assertNotLowerThanCurrent(prisma, input.vehicleId, {
    hourmeter: input.hourmeter === null || input.hourmeter === undefined ? null : Number(input.hourmeter),
    odometer: input.odometer ?? null,
  });

  const reading = await prisma.$transaction(async (tx) => {
    const created = await tx.fleetVehicleReading.create({
      data: input,
      include: readingInclude,
    });
    await tx.fleetVehicle.update({
      data: vehicleMeterUpdates({
        hourmeter: input.hourmeter === null || input.hourmeter === undefined ? null : Number(input.hourmeter),
        odometer: input.odometer ?? null,
      }),
      where: { id: input.vehicleId },
    });
    return created;
  });

  return reading;
}

export async function listFleetReadings(prisma: PrismaClient) {
  return prisma.fleetVehicleReading.findMany({
    include: readingInclude,
    orderBy: { readingDate: "desc" },
  });
}

export async function createFleetFueling(
  prisma: PrismaClient,
  input: Omit<Prisma.FleetFuelingUncheckedCreateInput, "totalPrice"> & {
    totalPrice?: number | null;
  },
) {
  await assertNotLowerThanCurrent(prisma, input.vehicleId, {
    hourmeter: input.hourmeter === null || input.hourmeter === undefined ? null : Number(input.hourmeter),
    odometer: input.odometer ?? null,
  });

  const totalPrice =
    input.totalPrice !== null && input.totalPrice !== undefined
      ? input.totalPrice
      : Number(input.quantity) * Number(input.unitPrice);

  return prisma.$transaction(async (tx) => {
    const fueling = await tx.fleetFueling.create({
      data: {
        ...input,
        totalPrice,
      },
      include: fuelingInclude,
    });
    await tx.fleetVehicle.update({
      data: vehicleMeterUpdates({
        hourmeter: input.hourmeter === null || input.hourmeter === undefined ? null : Number(input.hourmeter),
        odometer: input.odometer ?? null,
      }),
      where: { id: input.vehicleId },
    });
    return fueling;
  });
}

export async function listFleetFuelings(prisma: PrismaClient) {
  return prisma.fleetFueling.findMany({
    include: fuelingInclude,
    orderBy: { fuelingDate: "desc" },
  });
}

export async function createFleetAllocation(
  prisma: PrismaClient,
  input: Prisma.FleetVehicleAllocationUncheckedCreateInput,
) {
  await assertDriverCanBeAllocated(prisma, input.driverId);
  const vehicle = await prisma.fleetVehicle.findUniqueOrThrow({
    where: { id: input.vehicleId },
  });

  return prisma.$transaction(async (tx) => {
    await tx.fleetVehicleAllocation.updateMany({
      data: { endDate: input.startDate },
      where: {
        endDate: null,
        vehicleId: input.vehicleId,
      },
    });
    const allocation = await tx.fleetVehicleAllocation.create({
      data: {
        ...input,
        originStructureId: vehicle.currentStructureId,
      },
    });
    await tx.fleetVehicle.update({
      data: {
        currentDriverId: input.driverId ?? undefined,
        currentStructureId: input.destinationStructureId,
      },
      where: { id: input.vehicleId },
    });
    return allocation;
  });
}

export async function listFleetAllocations(prisma: PrismaClient) {
  return prisma.fleetVehicleAllocation.findMany({
    include: {
      destinationStructure: true,
      originStructure: true,
      vehicle: { include: vehicleInclude },
    },
    orderBy: { startDate: "desc" },
  });
}

export async function createFleetTransfer(
  prisma: PrismaClient,
  input: Prisma.FleetVehicleTransferUncheckedCreateInput,
) {
  await assertDriverCanBeAllocated(prisma, input.driverId);
  const vehicle = await assertNotLowerThanCurrent(prisma, input.vehicleId, {
    hourmeter: input.hourmeter === null || input.hourmeter === undefined ? null : Number(input.hourmeter),
    odometer: input.odometer ?? null,
  });

  return prisma.$transaction(async (tx) => {
    await tx.fleetVehicleAllocation.updateMany({
      data: { endDate: input.transferDate },
      where: {
        endDate: null,
        vehicleId: input.vehicleId,
      },
    });
    const transfer = await tx.fleetVehicleTransfer.create({
      data: {
        ...input,
        originStructureId: vehicle.currentStructureId,
      },
      include: transferInclude,
    });
    await tx.fleetVehicleAllocation.create({
      data: {
        destinationStructureId: input.destinationStructureId,
        driverId: input.driverId ?? null,
        originStructureId: vehicle.currentStructureId,
        responsibleUserId: input.responsibleUserId,
        startDate: input.transferDate,
        vehicleId: input.vehicleId,
      },
    });
    await tx.fleetVehicle.update({
      data: {
        currentDriverId: input.driverId ?? vehicle.currentDriverId,
        currentStructureId: input.destinationStructureId,
        status: FleetVehicleStatus.TRANSFERRED,
        ...vehicleMeterUpdates({
          hourmeter: input.hourmeter === null || input.hourmeter === undefined ? null : Number(input.hourmeter),
          odometer: input.odometer ?? null,
        }),
      },
      where: { id: input.vehicleId },
    });
    return transfer;
  });
}

export async function listFleetTransfers(prisma: PrismaClient) {
  return prisma.fleetVehicleTransfer.findMany({
    include: transferInclude,
    orderBy: { transferDate: "desc" },
  });
}

export async function createFleetMaintenance(
  prisma: PrismaClient,
  input: Omit<Prisma.FleetMaintenanceUncheckedCreateInput, "totalCost"> & {
    totalCost?: number | null;
  },
) {
  const totalCost =
    input.totalCost !== null && input.totalCost !== undefined
      ? Number(input.totalCost)
      : Number(input.laborCost ?? 0) + Number(input.partsCost ?? 0);

  return prisma.$transaction(async (tx) => {
    const maintenance = await tx.fleetMaintenance.create({
      data: {
        ...input,
        totalCost,
      },
      include: maintenanceInclude,
    });
    const nextStatus =
      input.status === FleetMaintenanceStatus.COMPLETED
        ? FleetVehicleStatus.ACTIVE
        : input.status === FleetMaintenanceStatus.CANCELLED
          ? undefined
          : FleetVehicleStatus.MAINTENANCE;
    await tx.fleetVehicle.update({
      data: {
        status: nextStatus,
        ...vehicleMeterUpdates({
          hourmeter: input.hourmeter === null || input.hourmeter === undefined ? null : Number(input.hourmeter),
          odometer: input.odometer ?? null,
        }),
      },
      where: { id: input.vehicleId },
    });

    if (input.status === FleetMaintenanceStatus.COMPLETED && input.performedServices) {
      const serviceText = String(input.performedServices).toLocaleLowerCase("pt-BR");
      await tx.fleetScheduledService.updateMany({
        data: {
          lastDoneAt: input.completedAt ?? new Date(),
          lastHourmeter: input.hourmeter,
          lastOdometer: input.odometer,
        },
        where: {
          active: true,
          vehicleId: input.vehicleId,
          OR: serviceText
            .split(/\r?\n|,|;/)
            .map((service) => service.trim())
            .filter(Boolean)
            .map((service) => ({
              serviceType: { contains: service },
            })),
        },
      });
    }

    return maintenance;
  });
}

export async function listFleetMaintenances(prisma: PrismaClient) {
  return prisma.fleetMaintenance.findMany({
    include: maintenanceInclude,
    orderBy: [{ openedAt: "desc" }, { createdAt: "desc" }],
  });
}

export async function createFleetScheduledService(
  prisma: PrismaClient,
  input: Prisma.FleetScheduledServiceUncheckedCreateInput,
) {
  return prisma.fleetScheduledService.create({ data: input });
}

export async function listFleetScheduledServices(prisma: PrismaClient) {
  const settings = await getFleetSettings(prisma);
  const services = await prisma.fleetScheduledService.findMany({
    include: { vehicle: { include: vehicleInclude } },
    orderBy: [{ active: "desc" }, { serviceType: "asc" }],
  });

  return services.map((service) => ({
    ...service,
    health: service.vehicle
      ? lifecycleProgress({
          alertPercent: 100 - Math.min(settings.maintenanceAlertDays, 90) / 3,
          currentHourmeter: service.vehicle.currentHourmeter,
          currentOdometer: service.vehicle.currentOdometer,
          intervalDays: service.intervalDays,
          intervalHours: service.intervalHours,
          intervalKm: service.intervalKm,
          referenceDate: service.lastDoneAt,
          referenceHourmeter: service.lastHourmeter,
          referenceOdometer: service.lastOdometer,
        })
      : null,
  }));
}

export async function createFleetOilControl(
  prisma: PrismaClient,
  input: Prisma.FleetOilControlUncheckedCreateInput,
) {
  return prisma.fleetOilControl.create({ data: input });
}

export async function listFleetOilControls(prisma: PrismaClient) {
  const settings = await getFleetSettings(prisma);
  const controls = await prisma.fleetOilControl.findMany({
    include: { vehicle: { include: vehicleInclude } },
    orderBy: { lastChangeDate: "desc" },
  });

  return controls.map((control) => ({
    ...control,
    health: lifecycleProgress({
      alertPercent: settings.oilAlertPercent,
      currentHourmeter: control.vehicle.currentHourmeter,
      currentOdometer: control.vehicle.currentOdometer,
      intervalDays: control.intervalDays,
      intervalHours: control.intervalHours,
      intervalKm: control.intervalKm,
      referenceDate: control.lastChangeDate,
      referenceHourmeter: control.lastHourmeter,
      referenceOdometer: control.lastOdometer,
    }),
  }));
}

export async function createFleetBeltControl(
  prisma: PrismaClient,
  input: Prisma.FleetBeltControlUncheckedCreateInput,
) {
  return prisma.fleetBeltControl.create({ data: input });
}

export async function listFleetBeltControls(prisma: PrismaClient) {
  const settings = await getFleetSettings(prisma);
  const controls = await prisma.fleetBeltControl.findMany({
    include: { vehicle: { include: vehicleInclude } },
    orderBy: { installedAt: "desc" },
  });

  return controls.map((control) => ({
    ...control,
    health: lifecycleProgress({
      alertPercent: settings.beltAlertPercent,
      currentHourmeter: control.vehicle.currentHourmeter,
      currentOdometer: control.vehicle.currentOdometer,
      intervalDays: control.lifetimeDays,
      intervalHours: control.lifetimeHours,
      intervalKm: control.lifetimeKm,
      referenceDate: control.installedAt,
      referenceHourmeter: control.installHourmeter,
      referenceOdometer: control.installOdometer,
    }),
  }));
}

export async function createFleetTire(
  prisma: PrismaClient,
  input: Prisma.FleetTireUncheckedCreateInput,
) {
  return prisma.fleetTire.create({ data: input });
}

export async function listFleetTires(prisma: PrismaClient) {
  return prisma.fleetTire.findMany({
    include: { vehicle: { include: vehicleInclude } },
    orderBy: [{ vehicle: { plate: "asc" } }, { position: "asc" }],
  });
}

export async function getFleetVehicleHistory(prisma: PrismaClient, vehicleId: string) {
  const [vehicle, readings, fuelings, allocations, transfers, maintenances, scheduledServices, oilControls, beltControls, tires] =
    await Promise.all([
      prisma.fleetVehicle.findUniqueOrThrow({
        include: vehicleInclude,
        where: { id: vehicleId },
      }),
      prisma.fleetVehicleReading.findMany({
        include: readingInclude,
        orderBy: { readingDate: "desc" },
        where: { vehicleId },
      }),
      prisma.fleetFueling.findMany({
        include: fuelingInclude,
        orderBy: { fuelingDate: "desc" },
        where: { vehicleId },
      }),
      prisma.fleetVehicleAllocation.findMany({
        include: {
          destinationStructure: true,
          originStructure: true,
        },
        orderBy: { startDate: "desc" },
        where: { vehicleId },
      }),
      prisma.fleetVehicleTransfer.findMany({
        include: transferInclude,
        orderBy: { transferDate: "desc" },
        where: { vehicleId },
      }),
      prisma.fleetMaintenance.findMany({
        include: maintenanceInclude,
        orderBy: { openedAt: "desc" },
        where: { vehicleId },
      }),
      listFleetScheduledServices(prisma).then((items) =>
        items.filter((item) => item.vehicleId === vehicleId),
      ),
      listFleetOilControls(prisma).then((items) =>
        items.filter((item) => item.vehicleId === vehicleId),
      ),
      listFleetBeltControls(prisma).then((items) =>
        items.filter((item) => item.vehicleId === vehicleId),
      ),
      prisma.fleetTire.findMany({ where: { vehicleId } }),
    ]);

  return {
    allocations,
    beltControls,
    fuelings,
    maintenances,
    oilControls,
    readings,
    scheduledServices,
    tires,
    transfers,
    vehicle,
  };
}

function fuelingMetrics(fuelings: Array<{ hourmeter?: unknown; odometer?: number | null; quantity: unknown; totalPrice: unknown; vehicleId: string }>) {
  const sorted = [...fuelings].sort((left, right) => left.vehicleId.localeCompare(right.vehicleId));
  const byVehicle = new Map<string, typeof sorted>();

  for (const fueling of sorted) {
    const items = byVehicle.get(fueling.vehicleId) ?? [];
    items.push(fueling);
    byVehicle.set(fueling.vehicleId, items);
  }

  let km = 0;
  let hours = 0;
  let liters = 0;
  let total = 0;

  for (const items of byVehicle.values()) {
    const ordered = [...items].sort((left, right) => (left.odometer ?? 0) - (right.odometer ?? 0));

    for (let index = 0; index < ordered.length; index += 1) {
      const item = ordered[index];
      const previous = ordered[index - 1];

      liters += toNumber(item.quantity);
      total += toNumber(item.totalPrice);

      if (previous?.odometer && item.odometer && item.odometer > previous.odometer) {
        km += item.odometer - previous.odometer;
      }

      if (
        previous?.hourmeter !== null &&
        previous?.hourmeter !== undefined &&
        item.hourmeter !== null &&
        item.hourmeter !== undefined &&
        toNumber(item.hourmeter) > toNumber(previous.hourmeter)
      ) {
        hours += toNumber(item.hourmeter) - toNumber(previous.hourmeter);
      }
    }
  }

  return {
    averageCostPerHour: hours ? total / hours : 0,
    averageCostPerKm: km ? total / km : 0,
    averageKmPerLiter: liters && km ? km / liters : 0,
    averageLitersPerHour: hours ? liters / hours : 0,
    hours,
    km,
    liters,
    total,
  };
}

export async function getFleetDashboard(prisma: PrismaClient) {
  const settings = await getFleetSettings(prisma);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [vehicles, drivers, fuelings, maintenances, oilControls, beltControls, scheduledServices] =
    await Promise.all([
      prisma.fleetVehicle.findMany({ include: vehicleInclude }),
      prisma.fleetDriver.findMany({ include: driverInclude }),
      prisma.fleetFueling.findMany({ include: fuelingInclude }),
      prisma.fleetMaintenance.findMany({ include: maintenanceInclude }),
      listFleetOilControls(prisma),
      listFleetBeltControls(prisma),
      listFleetScheduledServices(prisma),
    ]);
  const metrics = fuelingMetrics(fuelings);
  const monthlyFuelCost = fuelings
    .filter((fueling) => fueling.fuelingDate >= monthStart)
    .reduce((total, fueling) => total + toNumber(fueling.totalPrice), 0);
  const monthlyMaintenanceCost = maintenances
    .filter((maintenance) => maintenance.openedAt >= monthStart)
    .reduce((total, maintenance) => total + toNumber(maintenance.totalCost), 0);
  const cnhExpired = drivers.filter(
    (driver) => driverLicenseHealth(driver, settings.driverLicenseAlertDays) === "EXPIRED",
  );
  const cnhExpiring = drivers.filter(
    (driver) => driverLicenseHealth(driver, settings.driverLicenseAlertDays) === "EXPIRING",
  );
  const oilAlerts = oilControls.filter((control) => control.health.status !== "OK");
  const beltAlerts = beltControls.filter((control) => control.health.status !== "OK");
  const serviceAlerts = scheduledServices.filter(
    (service) => service.health && service.health.status !== "OK",
  );
  const vehicleCosts = vehicles
    .map((vehicle) => {
      const fuelCost = fuelings
        .filter((fueling) => fueling.vehicleId === vehicle.id)
        .reduce((total, fueling) => total + toNumber(fueling.totalPrice), 0);
      const maintenanceCost = maintenances
        .filter((maintenance) => maintenance.vehicleId === vehicle.id)
        .reduce((total, maintenance) => total + toNumber(maintenance.totalCost), 0);

      return {
        fuelCost,
        maintenanceCost,
        totalCost: fuelCost + maintenanceCost,
        vehicle,
      };
    })
    .sort((left, right) => right.totalCost - left.totalCost);

  return {
    alerts: {
      belt: beltAlerts,
      cnhExpired,
      cnhExpiring,
      maintenanceOpen: maintenances.filter((maintenance) =>
        maintenance.status === FleetMaintenanceStatus.OPEN ||
        maintenance.status === FleetMaintenanceStatus.IN_PROGRESS ||
        maintenance.status === FleetMaintenanceStatus.WAITING_PART,
      ),
      oil: oilAlerts,
      services: serviceAlerts,
      vehiclesInMaintenance: vehicles.filter(
        (vehicle) => vehicle.status === FleetVehicleStatus.MAINTENANCE,
      ),
      vehiclesNoDriver: vehicles.filter((vehicle) => !vehicle.currentDriverId),
    },
    costs: {
      byVehicle: vehicleCosts,
      monthlyFuelCost,
      monthlyMaintenanceCost,
      totalFuelCost: metrics.total,
    },
    metrics,
    totals: {
      activeVehicles: vehicles.filter((vehicle) => vehicle.status === FleetVehicleStatus.ACTIVE).length,
      cnhExpired: cnhExpired.length,
      cnhExpiring: cnhExpiring.length,
      drivers: drivers.length,
      inactiveVehicles: vehicles.filter((vehicle) => vehicle.status === FleetVehicleStatus.INACTIVE).length,
      maintenanceVehicles: vehicles.filter((vehicle) => vehicle.status === FleetVehicleStatus.MAINTENANCE).length,
      pendingPreventiveServices: serviceAlerts.length,
      totalVehicles: vehicles.length,
    },
  };
}

export async function getFleetReports(prisma: PrismaClient) {
  const [vehicles, drivers, fuelings, maintenances, transfers, structures, dashboard] =
    await Promise.all([
      listFleetVehicles(prisma),
      listFleetDrivers(prisma),
      listFleetFuelings(prisma),
      listFleetMaintenances(prisma),
      listFleetTransfers(prisma),
      listFleetStructures(prisma),
      getFleetDashboard(prisma),
    ]);
  const fuelByStructure = structures.map((structure) => {
    const vehicleIds = vehicles
      .filter((vehicle) => vehicle.currentStructureId === structure.id)
      .map((vehicle) => vehicle.id);
    const total = fuelings
      .filter((fueling) => vehicleIds.includes(fueling.vehicleId))
      .reduce((sum, fueling) => sum + toNumber(fueling.totalPrice), 0);

    return {
      structure,
      total,
      vehicles: vehicleIds.length,
    };
  });

  return {
    cnhAlerts: {
      expired: dashboard.alerts.cnhExpired,
      expiring: dashboard.alerts.cnhExpiring,
    },
    costsByStructure: fuelByStructure,
    costsByVehicle: dashboard.costs.byVehicle,
    drivers,
    fuelings,
    maintenances,
    transfers,
    vehicles,
    vehiclesByStructure: structures.map((structure) => ({
      structure,
      vehicles: vehicles.filter((vehicle) => vehicle.currentStructureId === structure.id),
    })),
  };
}

export function fleetSettingsLists(settings: Awaited<ReturnType<typeof getFleetSettings>>) {
  return {
    fuelTypes: listFromText(settings.fuelTypes),
    maintenanceTypes: listFromText(settings.maintenanceTypes),
    preventiveServiceTypes: listFromText(settings.preventiveServiceTypes),
    vehicleTypes: listFromText(settings.vehicleTypes),
  };
}
