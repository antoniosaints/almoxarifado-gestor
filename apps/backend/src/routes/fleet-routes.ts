import { UserRole } from "@prisma/client";
import { Router } from "express";
import { asyncHandler, currentUser, requireRole } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import {
  createFleetAllocation,
  createFleetBeltControl,
  createFleetDriver,
  createFleetFueling,
  createFleetMaintenance,
  createFleetOilControl,
  createFleetReading,
  createFleetScheduledService,
  createFleetStructure,
  createFleetTire,
  createFleetTransfer,
  createFleetVehicle,
  fleetPermissions,
  fleetSettingsLists,
  getFleetDashboard,
  getFleetReports,
  getFleetSettings,
  getFleetVehicleHistory,
  inactivateFleetDriver,
  inactivateFleetVehicle,
  listFleetAllocations,
  listFleetBeltControls,
  listFleetDrivers,
  listFleetFuelings,
  listFleetMaintenances,
  listFleetOilControls,
  listFleetReadings,
  listFleetScheduledServices,
  listFleetStructures,
  listFleetTires,
  listFleetTransfers,
  listFleetVehicles,
  updateFleetDriver,
  updateFleetStructure,
  updateFleetVehicle,
  upsertFleetSettings,
} from "../services/fleet-service.js";
import { idParam } from "../validators/inputs.js";
import {
  fleetAllocationInput,
  fleetBeltControlInput,
  fleetDriverInput,
  fleetFuelingInput,
  fleetMaintenanceInput,
  fleetOilControlInput,
  fleetReadingInput,
  fleetScheduledServiceInput,
  fleetSettingsInput,
  fleetStructureInput,
  fleetTireInput,
  fleetTransferInput,
  fleetVehicleInput,
} from "../validators/fleet-inputs.js";

export const fleetRoutes = Router();

fleetRoutes.get(
  "/permissions",
  asyncHandler(async (_request, response) => {
    response.json(fleetPermissions);
  }),
);

fleetRoutes.get(
  "/dashboard",
  asyncHandler(async (_request, response) => {
    response.json(await getFleetDashboard(prisma));
  }),
);

fleetRoutes.get(
  "/reports",
  requireRole(UserRole.ADMIN, UserRole.OPERATOR),
  asyncHandler(async (_request, response) => {
    response.json(await getFleetReports(prisma));
  }),
);

fleetRoutes.get(
  "/settings",
  asyncHandler(async (_request, response) => {
    const settings = await getFleetSettings(prisma);

    response.json({
      ...settings,
      lists: fleetSettingsLists(settings),
    });
  }),
);

fleetRoutes.put(
  "/settings",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const input = fleetSettingsInput.parse(request.body);
    const settings = await upsertFleetSettings(prisma, {
      ...input,
      id: "fleet",
    });

    response.json({
      ...settings,
      lists: fleetSettingsLists(settings),
    });
  }),
);

fleetRoutes.get(
  "/structures",
  asyncHandler(async (_request, response) => {
    response.json(await listFleetStructures(prisma));
  }),
);

fleetRoutes.post(
  "/structures",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    response.status(201).json(
      await createFleetStructure(prisma, fleetStructureInput.parse(request.body)),
    );
  }),
);

fleetRoutes.put(
  "/structures/:id",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);

    response.json(
      await updateFleetStructure(prisma, id, fleetStructureInput.parse(request.body)),
    );
  }),
);

fleetRoutes.get(
  "/drivers",
  asyncHandler(async (_request, response) => {
    response.json(await listFleetDrivers(prisma));
  }),
);

fleetRoutes.post(
  "/drivers",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    response.status(201).json(
      await createFleetDriver(prisma, fleetDriverInput.parse(request.body)),
    );
  }),
);

fleetRoutes.put(
  "/drivers/:id",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);

    response.json(await updateFleetDriver(prisma, id, fleetDriverInput.parse(request.body)));
  }),
);

fleetRoutes.delete(
  "/drivers/:id",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);

    response.json(await inactivateFleetDriver(prisma, id));
  }),
);

fleetRoutes.get(
  "/vehicles",
  asyncHandler(async (_request, response) => {
    response.json(await listFleetVehicles(prisma));
  }),
);

fleetRoutes.get(
  "/vehicles/:id/history",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);

    response.json(await getFleetVehicleHistory(prisma, id));
  }),
);

fleetRoutes.post(
  "/vehicles",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    response.status(201).json(
      await createFleetVehicle(prisma, fleetVehicleInput.parse(request.body)),
    );
  }),
);

fleetRoutes.put(
  "/vehicles/:id",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);

    response.json(await updateFleetVehicle(prisma, id, fleetVehicleInput.parse(request.body)));
  }),
);

fleetRoutes.delete(
  "/vehicles/:id",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);

    response.json(await inactivateFleetVehicle(prisma, id));
  }),
);

fleetRoutes.get(
  "/readings",
  asyncHandler(async (_request, response) => {
    response.json(await listFleetReadings(prisma));
  }),
);

fleetRoutes.post(
  "/readings",
  asyncHandler(async (request, response) => {
    const user = currentUser(response);
    const input = fleetReadingInput.parse(request.body);

    response.status(201).json(
      await createFleetReading(prisma, {
        ...input,
        registeredById: user.id,
      }),
    );
  }),
);

fleetRoutes.get(
  "/fuelings",
  asyncHandler(async (_request, response) => {
    response.json(await listFleetFuelings(prisma));
  }),
);

fleetRoutes.post(
  "/fuelings",
  asyncHandler(async (request, response) => {
    response.status(201).json(
      await createFleetFueling(prisma, fleetFuelingInput.parse(request.body)),
    );
  }),
);

fleetRoutes.get(
  "/allocations",
  asyncHandler(async (_request, response) => {
    response.json(await listFleetAllocations(prisma));
  }),
);

fleetRoutes.post(
  "/allocations",
  asyncHandler(async (request, response) => {
    const user = currentUser(response);
    const input = fleetAllocationInput.parse(request.body);

    response.status(201).json(
      await createFleetAllocation(prisma, {
        ...input,
        responsibleUserId: user.id,
      }),
    );
  }),
);

fleetRoutes.get(
  "/transfers",
  asyncHandler(async (_request, response) => {
    response.json(await listFleetTransfers(prisma));
  }),
);

fleetRoutes.post(
  "/transfers",
  asyncHandler(async (request, response) => {
    const user = currentUser(response);
    const input = fleetTransferInput.parse(request.body);

    response.status(201).json(
      await createFleetTransfer(prisma, {
        ...input,
        responsibleUserId: user.id,
      }),
    );
  }),
);

fleetRoutes.get(
  "/maintenances",
  asyncHandler(async (_request, response) => {
    response.json(await listFleetMaintenances(prisma));
  }),
);

fleetRoutes.post(
  "/maintenances",
  asyncHandler(async (request, response) => {
    const user = currentUser(response);
    const input = fleetMaintenanceInput.parse(request.body);

    response.status(201).json(
      await createFleetMaintenance(prisma, {
        ...input,
        responsibleUserId: user.id,
      }),
    );
  }),
);

fleetRoutes.get(
  "/scheduled-services",
  asyncHandler(async (_request, response) => {
    response.json(await listFleetScheduledServices(prisma));
  }),
);

fleetRoutes.post(
  "/scheduled-services",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    response.status(201).json(
      await createFleetScheduledService(
        prisma,
        fleetScheduledServiceInput.parse(request.body),
      ),
    );
  }),
);

fleetRoutes.get(
  "/oil-controls",
  asyncHandler(async (_request, response) => {
    response.json(await listFleetOilControls(prisma));
  }),
);

fleetRoutes.post(
  "/oil-controls",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    response.status(201).json(
      await createFleetOilControl(prisma, fleetOilControlInput.parse(request.body)),
    );
  }),
);

fleetRoutes.get(
  "/belt-controls",
  asyncHandler(async (_request, response) => {
    response.json(await listFleetBeltControls(prisma));
  }),
);

fleetRoutes.post(
  "/belt-controls",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    response.status(201).json(
      await createFleetBeltControl(prisma, fleetBeltControlInput.parse(request.body)),
    );
  }),
);

fleetRoutes.get(
  "/tires",
  asyncHandler(async (_request, response) => {
    response.json(await listFleetTires(prisma));
  }),
);

fleetRoutes.post(
  "/tires",
  requireRole(UserRole.ADMIN),
  asyncHandler(async (request, response) => {
    response.status(201).json(await createFleetTire(prisma, fleetTireInput.parse(request.body)));
  }),
);
