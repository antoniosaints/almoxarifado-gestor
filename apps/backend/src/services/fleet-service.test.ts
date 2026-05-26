import { FleetDriverStatus, FleetVehicleStatus } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma.js";
import { createBaseFixture, resetDatabase } from "../test/database.js";
import {
  createFleetAllocation,
  createFleetDriver,
  createFleetReading,
  createFleetStructure,
  createFleetVehicle,
  getFleetDashboard,
} from "./fleet-service.js";

function baseVehicleInput(overrides: Partial<Parameters<typeof createFleetVehicle>[1]> = {}) {
  return {
    acquisitionDate: new Date("2026-01-10T12:00:00.000Z"),
    acquisitionValue: 120000,
    brand: "Fiat",
    chassis: "9BWZZZ377VT004251",
    color: "Branco",
    currentHourmeter: 50,
    currentOdometer: 1000,
    fuelType: "Diesel",
    manufactureYear: 2025,
    model: "Ducato",
    modelYear: 2026,
    notes: null,
    plate: "ABC1D23",
    renavam: "12345678901",
    status: FleetVehicleStatus.ACTIVE,
    tankCapacity: 80,
    vehicleType: "Van",
    ...overrides,
  };
}

describe("fleet service", () => {
  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await resetDatabase(prisma);
    await prisma.$disconnect();
  });

  it("updates vehicle meters and rejects lower odometer readings", async () => {
    const { user } = await createBaseFixture(prisma);
    const vehicle = await createFleetVehicle(prisma, baseVehicleInput());

    await createFleetReading(prisma, {
      hourmeter: 55,
      odometer: 1200,
      readingDate: new Date("2026-05-25T12:00:00.000Z"),
      registeredById: user.id,
      vehicleId: vehicle.id,
    });

    await expect(
      prisma.fleetVehicle.findUniqueOrThrow({ where: { id: vehicle.id } }),
    ).resolves.toMatchObject({
      currentOdometer: 1200,
    });

    await expect(
      createFleetReading(prisma, {
        hourmeter: 54,
        odometer: 1199,
        readingDate: new Date("2026-05-26T12:00:00.000Z"),
        registeredById: user.id,
        vehicleId: vehicle.id,
      }),
    ).rejects.toThrow("odometro");
  });

  it("keeps a single active allocation and blocks expired driver licenses", async () => {
    const { user } = await createBaseFixture(prisma);
    const origin = await createFleetStructure(prisma, {
      name: "Garagem Central",
      type: "Garagem",
    });
    const destination = await createFleetStructure(prisma, {
      name: "Secretaria de Obras",
      type: "Secretaria",
    });
    const nextDestination = await createFleetStructure(prisma, {
      name: "Secretaria de Saude",
      type: "Secretaria",
    });
    const driver = await createFleetDriver(prisma, {
      cpf: "11122233344",
      email: "motorista@prefeitura.local",
      licenseCategory: "D",
      licenseExpiresAt: new Date("2099-12-31T12:00:00.000Z"),
      licenseIssuedAt: new Date("2020-01-10T12:00:00.000Z"),
      licenseNumber: "12345678900",
      licenseStatus: "Regular",
      name: "Motorista Ativo",
      notes: null,
      phone: "11999990000",
      status: FleetDriverStatus.ACTIVE,
    });
    const expiredDriver = await createFleetDriver(prisma, {
      cpf: "55566677788",
      email: "vencido@prefeitura.local",
      licenseCategory: "B",
      licenseExpiresAt: new Date("2020-01-01T12:00:00.000Z"),
      licenseIssuedAt: new Date("2015-01-10T12:00:00.000Z"),
      licenseNumber: "99887766554",
      licenseStatus: "Vencida",
      name: "Motorista Vencido",
      notes: null,
      phone: null,
      status: FleetDriverStatus.ACTIVE,
    });
    const vehicle = await createFleetVehicle(
      prisma,
      baseVehicleInput({ currentStructureId: origin.id }),
    );

    await createFleetAllocation(prisma, {
      destinationStructureId: destination.id,
      driverId: driver.id,
      notes: "Uso diario",
      reason: "Atendimento de obras",
      responsibleUserId: user.id,
      startDate: new Date("2026-05-25T12:00:00.000Z"),
      vehicleId: vehicle.id,
    });
    await createFleetAllocation(prisma, {
      destinationStructureId: nextDestination.id,
      driverId: driver.id,
      notes: null,
      reason: "Realocacao",
      responsibleUserId: user.id,
      startDate: new Date("2026-06-01T12:00:00.000Z"),
      vehicleId: vehicle.id,
    });

    const activeAllocations = await prisma.fleetVehicleAllocation.findMany({
      where: { endDate: null, vehicleId: vehicle.id },
    });
    const vehicleAfterAllocation = await prisma.fleetVehicle.findUniqueOrThrow({
      where: { id: vehicle.id },
    });

    expect(activeAllocations).toHaveLength(1);
    expect(activeAllocations[0].destinationStructureId).toBe(nextDestination.id);
    expect(vehicleAfterAllocation.currentStructureId).toBe(nextDestination.id);
    expect(vehicleAfterAllocation.currentDriverId).toBe(driver.id);

    await expect(
      createFleetAllocation(prisma, {
        destinationStructureId: origin.id,
        driverId: expiredDriver.id,
        notes: null,
        reason: "Teste CNH",
        responsibleUserId: user.id,
        startDate: new Date("2026-06-05T12:00:00.000Z"),
        vehicleId: vehicle.id,
      }),
    ).rejects.toThrow("CNH vencida");
  });

  it("summarizes fuel, maintenance and alert indicators for the dashboard", async () => {
    const vehicle = await createFleetVehicle(prisma, baseVehicleInput());

    await prisma.fleetFueling.createMany({
      data: [
        {
          fuelType: "Diesel",
          fuelingDate: new Date("2026-05-10T12:00:00.000Z"),
          odometer: 1000,
          quantity: 10,
          totalPrice: 50,
          unitPrice: 5,
          vehicleId: vehicle.id,
        },
        {
          fuelType: "Diesel",
          fuelingDate: new Date("2026-05-20T12:00:00.000Z"),
          odometer: 1100,
          quantity: 10,
          totalPrice: 60,
          unitPrice: 6,
          vehicleId: vehicle.id,
        },
      ],
    });

    const dashboard = await getFleetDashboard(prisma);

    expect(dashboard.totals.totalVehicles).toBe(1);
    expect(dashboard.totals.activeVehicles).toBe(1);
    expect(dashboard.metrics.averageKmPerLiter).toBe(5);
    expect(dashboard.costs.totalFuelCost).toBe(110);
    expect(dashboard.alerts.vehiclesNoDriver).toHaveLength(1);
  });
});
