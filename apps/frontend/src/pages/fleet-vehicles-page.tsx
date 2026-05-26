import { Eye, Pencil, Plus, Power } from "lucide-react";
import { useState, type FormEvent } from "react";
import { DataTable } from "@/components/domain/data-table";
import { LoadingLine, ResourceError } from "@/components/domain/feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api, useApiResource } from "@/lib/api";
import {
  dateInputValue,
  vehicleStatusLabels,
  vehicleStatusVariant,
} from "@/lib/fleet";
import type {
  FleetDriver,
  FleetFueling,
  FleetMaintenance,
  FleetReading,
  FleetSettings,
  FleetStructure,
  FleetTransfer,
  FleetVehicle,
  FleetVehicleStatus,
} from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

type VehicleDraft = {
  acquisitionDate: string;
  acquisitionValue: string;
  brand: string;
  chassis: string;
  color: string;
  currentDriverId: string;
  currentHourmeter: string;
  currentOdometer: string;
  currentStructureId: string;
  fuelType: string;
  id?: string;
  manufactureYear: string;
  model: string;
  modelYear: string;
  notes: string;
  plate: string;
  renavam: string;
  status: FleetVehicleStatus;
  tankCapacity: string;
  vehicleType: string;
};

type VehicleHistory = {
  fuelings: FleetFueling[];
  maintenances: FleetMaintenance[];
  readings: FleetReading[];
  transfers: FleetTransfer[];
  vehicle: FleetVehicle;
};

function emptyVehicleDraft(settings?: FleetSettings | null): VehicleDraft {
  return {
    acquisitionDate: "",
    acquisitionValue: "0",
    brand: "",
    chassis: "",
    color: "",
    currentDriverId: "",
    currentHourmeter: "",
    currentOdometer: "0",
    currentStructureId: "",
    fuelType: settings?.lists.fuelTypes[0] ?? "Diesel",
    manufactureYear: "",
    model: "",
    modelYear: "",
    notes: "",
    plate: "",
    renavam: "",
    status: "ACTIVE",
    tankCapacity: "0",
    vehicleType: settings?.lists.vehicleTypes[0] ?? "Passeio",
  };
}

function draftFromVehicle(vehicle: FleetVehicle): VehicleDraft {
  return {
    acquisitionDate: dateInputValue(vehicle.acquisitionDate),
    acquisitionValue: String(vehicle.acquisitionValue ?? 0),
    brand: vehicle.brand,
    chassis: vehicle.chassis ?? "",
    color: vehicle.color ?? "",
    currentDriverId: vehicle.currentDriverId ?? "",
    currentHourmeter: vehicle.currentHourmeter ? String(vehicle.currentHourmeter) : "",
    currentOdometer: String(vehicle.currentOdometer),
    currentStructureId: vehicle.currentStructureId ?? "",
    fuelType: vehicle.fuelType,
    id: vehicle.id,
    manufactureYear: vehicle.manufactureYear ? String(vehicle.manufactureYear) : "",
    model: vehicle.model,
    modelYear: vehicle.modelYear ? String(vehicle.modelYear) : "",
    notes: vehicle.notes ?? "",
    plate: vehicle.plate,
    renavam: vehicle.renavam ?? "",
    status: vehicle.status,
    tankCapacity: String(vehicle.tankCapacity ?? 0),
    vehicleType: vehicle.vehicleType,
  };
}

function payloadFromDraft(draft: VehicleDraft) {
  return {
    acquisitionDate: draft.acquisitionDate || null,
    acquisitionValue: Number(draft.acquisitionValue || 0),
    brand: draft.brand,
    chassis: draft.chassis || null,
    color: draft.color || null,
    currentDriverId: draft.currentDriverId || null,
    currentHourmeter: draft.currentHourmeter ? Number(draft.currentHourmeter) : null,
    currentOdometer: Number(draft.currentOdometer || 0),
    currentStructureId: draft.currentStructureId || null,
    fuelType: draft.fuelType,
    manufactureYear: draft.manufactureYear ? Number(draft.manufactureYear) : null,
    model: draft.model,
    modelYear: draft.modelYear ? Number(draft.modelYear) : null,
    notes: draft.notes || null,
    plate: draft.plate,
    renavam: draft.renavam || null,
    status: draft.status,
    tankCapacity: Number(draft.tankCapacity || 0),
    vehicleType: draft.vehicleType,
  };
}

export function FleetVehiclesPage() {
  const vehicles = useApiResource<FleetVehicle[]>("/fleet/vehicles", []);
  const drivers = useApiResource<FleetDriver[]>("/fleet/drivers", []);
  const structures = useApiResource<FleetStructure[]>("/fleet/structures", []);
  const settings = useApiResource<FleetSettings | null>("/fleet/settings", null);
  const [draft, setDraft] = useState<VehicleDraft | null>(null);
  const [history, setHistory] = useState<VehicleHistory | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft) {
      return;
    }

    try {
      await api<FleetVehicle>(
        draft.id ? `/fleet/vehicles/${draft.id}` : "/fleet/vehicles",
        {
          body: JSON.stringify(payloadFromDraft(draft)),
          method: draft.id ? "PUT" : "POST",
        },
      );
      setDraft(null);
      setMessage(null);
      await vehicles.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao salvar.");
    }
  }

  async function inactivate(id: string) {
    try {
      await api<FleetVehicle>(`/fleet/vehicles/${id}`, { method: "DELETE" });
      await vehicles.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao inativar.");
    }
  }

  async function openHistory(vehicle: FleetVehicle) {
    try {
      setHistory(await api<VehicleHistory>(`/fleet/vehicles/${vehicle.id}/history`));
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao carregar histórico.");
    }
  }

  if (vehicles.loading || drivers.loading || structures.loading || settings.loading) {
    return <LoadingLine label="Carregando veículos..." />;
  }

  if (vehicles.error || drivers.error || structures.error || settings.error) {
    return (
      <ResourceError
        message={vehicles.error ?? drivers.error ?? structures.error ?? settings.error ?? ""}
      />
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Cadastro e histórico</p>
          <h2 className="text-2xl font-semibold">Veículos</h2>
        </div>
        <Button onClick={() => setDraft(emptyVehicleDraft(settings.data))}>
          <Plus className="h-4 w-4" />
          Novo veículo
        </Button>
      </div>

      {message ? <ResourceError message={message} /> : null}

      <DataTable
        columns={[
          {
            cell: (vehicle) => (
              <>
                <p className="font-medium">{vehicle.plate}</p>
                <p className="text-xs text-muted-foreground">
                  {vehicle.brand} {vehicle.model}
                </p>
              </>
            ),
            header: "Veículo",
            key: "vehicle",
          },
          { cell: (vehicle) => vehicle.vehicleType, header: "Tipo", key: "type" },
          {
            cell: (vehicle) => vehicle.currentStructure?.name ?? "-",
            header: "Estrutura",
            key: "structure",
          },
          {
            cell: (vehicle) => vehicle.currentDriver?.name ?? "-",
            header: "Motorista",
            key: "driver",
          },
          {
            cell: (vehicle) => (
              <>
                <p>{vehicle.currentOdometer} km</p>
                <p className="text-xs text-muted-foreground">
                  {vehicle.currentHourmeter ? `${vehicle.currentHourmeter} h` : "Sem horímetro"}
                </p>
              </>
            ),
            header: "Uso",
            key: "usage",
          },
          {
            cell: (vehicle) => (
              <Badge variant={vehicleStatusVariant(vehicle.status)}>
                {vehicleStatusLabels[vehicle.status]}
              </Badge>
            ),
            header: "Status",
            key: "status",
          },
          {
            cell: (vehicle) => (
              <div className="flex justify-end gap-2">
                <Button
                  aria-label={`Histórico ${vehicle.plate}`}
                  onClick={() => void openHistory(vehicle)}
                  size="icon"
                  variant="outline"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  aria-label={`Editar ${vehicle.plate}`}
                  onClick={() => setDraft(draftFromVehicle(vehicle))}
                  size="icon"
                  variant="outline"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  aria-label={`Inativar ${vehicle.plate}`}
                  disabled={vehicle.status === "INACTIVE"}
                  onClick={() => void inactivate(vehicle.id)}
                  size="icon"
                  variant="outline"
                >
                  <Power className="h-4 w-4" />
                </Button>
              </div>
            ),
            cellClassName: "text-right",
            header: "Ações",
            headerClassName: "text-right",
            key: "actions",
          },
        ]}
        data={vehicles.data}
        emptyMessage="Nenhum veículo cadastrado."
        getRowId={(vehicle) => vehicle.id}
        searchPlaceholder="Buscar placa, modelo, estrutura ou motorista..."
        searchText={(vehicle) =>
          [
            vehicle.plate,
            vehicle.brand,
            vehicle.model,
            vehicle.vehicleType,
            vehicle.currentDriver?.name,
            vehicle.currentStructure?.name,
            vehicleStatusLabels[vehicle.status],
          ]
            .filter(Boolean)
            .join(" ")
        }
      />

      <Dialog onOpenChange={(open) => !open && setDraft(null)} open={Boolean(draft)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar veículo" : "Novo veículo"}</DialogTitle>
            <DialogDescription>
              Dados cadastrais, alocação atual, motorista e marcadores de uso.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <Form onSubmit={save}>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField>
                  <Label htmlFor="fleet-plate">Placa</Label>
                  <Input
                    id="fleet-plate"
                    onChange={(event) => setDraft({ ...draft, plate: event.target.value.toUpperCase() })}
                    required
                    value={draft.plate}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="fleet-renavam">Renavam</Label>
                  <Input
                    id="fleet-renavam"
                    onChange={(event) => setDraft({ ...draft, renavam: event.target.value })}
                    value={draft.renavam}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="fleet-chassis">Chassi</Label>
                  <Input
                    id="fleet-chassis"
                    onChange={(event) => setDraft({ ...draft, chassis: event.target.value })}
                    value={draft.chassis}
                  />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                <FormField>
                  <Label htmlFor="fleet-type">Tipo</Label>
                  <Select
                    id="fleet-type"
                    onChange={(event) => setDraft({ ...draft, vehicleType: event.target.value })}
                    value={draft.vehicleType}
                  >
                    {settings.data?.lists.vehicleTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField>
                  <Label htmlFor="fleet-brand">Marca</Label>
                  <Input
                    id="fleet-brand"
                    onChange={(event) => setDraft({ ...draft, brand: event.target.value })}
                    required
                    value={draft.brand}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="fleet-model">Modelo</Label>
                  <Input
                    id="fleet-model"
                    onChange={(event) => setDraft({ ...draft, model: event.target.value })}
                    required
                    value={draft.model}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="fleet-color">Cor</Label>
                  <Input
                    id="fleet-color"
                    onChange={(event) => setDraft({ ...draft, color: event.target.value })}
                    value={draft.color}
                  />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                <FormField>
                  <Label htmlFor="fleet-year">Ano fab.</Label>
                  <Input
                    id="fleet-year"
                    onChange={(event) => setDraft({ ...draft, manufactureYear: event.target.value })}
                    type="number"
                    value={draft.manufactureYear}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="fleet-model-year">Ano modelo</Label>
                  <Input
                    id="fleet-model-year"
                    onChange={(event) => setDraft({ ...draft, modelYear: event.target.value })}
                    type="number"
                    value={draft.modelYear}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="fleet-fuel">Combustível</Label>
                  <Select
                    id="fleet-fuel"
                    onChange={(event) => setDraft({ ...draft, fuelType: event.target.value })}
                    value={draft.fuelType}
                  >
                    {settings.data?.lists.fuelTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField>
                  <Label htmlFor="fleet-tank">Tanque</Label>
                  <Input
                    id="fleet-tank"
                    min={0}
                    onChange={(event) => setDraft({ ...draft, tankCapacity: event.target.value })}
                    step="0.01"
                    type="number"
                    value={draft.tankCapacity}
                  />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-4">
                <FormField>
                  <Label htmlFor="fleet-odometer">Km atual</Label>
                  <Input
                    id="fleet-odometer"
                    min={0}
                    onChange={(event) => setDraft({ ...draft, currentOdometer: event.target.value })}
                    type="number"
                    value={draft.currentOdometer}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="fleet-hourmeter">Horímetro</Label>
                  <Input
                    id="fleet-hourmeter"
                    min={0}
                    onChange={(event) => setDraft({ ...draft, currentHourmeter: event.target.value })}
                    step="0.1"
                    type="number"
                    value={draft.currentHourmeter}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="fleet-structure">Estrutura</Label>
                  <Select
                    id="fleet-structure"
                    onChange={(event) => setDraft({ ...draft, currentStructureId: event.target.value })}
                    value={draft.currentStructureId}
                  >
                    <option value="">Sem estrutura</option>
                    {structures.data.map((structure) => (
                      <option key={structure.id} value={structure.id}>{structure.name}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField>
                  <Label htmlFor="fleet-driver">Motorista</Label>
                  <Select
                    id="fleet-driver"
                    onChange={(event) => setDraft({ ...draft, currentDriverId: event.target.value })}
                    value={draft.currentDriverId}
                  >
                    <option value="">Sem motorista</option>
                    {drivers.data.map((driver) => (
                      <option key={driver.id} value={driver.id}>{driver.name}</option>
                    ))}
                  </Select>
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField>
                  <Label htmlFor="fleet-status">Status</Label>
                  <Select
                    id="fleet-status"
                    onChange={(event) =>
                      setDraft({ ...draft, status: event.target.value as FleetVehicleStatus })
                    }
                    value={draft.status}
                  >
                    {Object.entries(vehicleStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField>
                  <Label htmlFor="fleet-acquisition-date">Aquisição</Label>
                  <Input
                    id="fleet-acquisition-date"
                    onChange={(event) => setDraft({ ...draft, acquisitionDate: event.target.value })}
                    type="date"
                    value={draft.acquisitionDate}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="fleet-acquisition-value">Valor</Label>
                  <Input
                    id="fleet-acquisition-value"
                    min={0}
                    onChange={(event) => setDraft({ ...draft, acquisitionValue: event.target.value })}
                    step="0.01"
                    type="number"
                    value={draft.acquisitionValue}
                  />
                </FormField>
              </div>
              <FormField>
                <Label htmlFor="fleet-notes">Observações</Label>
                <Textarea
                  id="fleet-notes"
                  onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                  value={draft.notes}
                />
              </FormField>
              <Button type="submit">Salvar veículo</Button>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => !open && setHistory(null)} open={Boolean(history)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Histórico do veículo</DialogTitle>
            <DialogDescription>
              {history?.vehicle.plate} - {history?.vehicle.brand} {history?.vehicle.model}
            </DialogDescription>
          </DialogHeader>
          {history ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="font-semibold">Leituras</p>
                <div className="mt-3 space-y-2 text-sm">
                  {history.readings.slice(0, 5).map((reading) => (
                    <div className="rounded-md bg-muted p-2" key={reading.id}>
                      {formatDate(reading.readingDate)} | {reading.odometer ?? "-"} km
                    </div>
                  ))}
                  {!history.readings.length ? <p className="text-muted-foreground">Sem leituras.</p> : null}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <p className="font-semibold">Abastecimentos</p>
                <div className="mt-3 space-y-2 text-sm">
                  {history.fuelings.slice(0, 5).map((fueling) => (
                    <div className="rounded-md bg-muted p-2" key={fueling.id}>
                      {formatDate(fueling.fuelingDate)} | {fueling.quantity} l |{" "}
                      {formatCurrency(Number(fueling.totalPrice))}
                    </div>
                  ))}
                  {!history.fuelings.length ? <p className="text-muted-foreground">Sem abastecimentos.</p> : null}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <p className="font-semibold">Manutenções</p>
                <div className="mt-3 space-y-2 text-sm">
                  {history.maintenances.slice(0, 5).map((maintenance) => (
                    <div className="rounded-md bg-muted p-2" key={maintenance.id}>
                      {formatDate(maintenance.openedAt)} | {maintenance.problemDescription}
                    </div>
                  ))}
                  {!history.maintenances.length ? <p className="text-muted-foreground">Sem manutenções.</p> : null}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <p className="font-semibold">Transferências</p>
                <div className="mt-3 space-y-2 text-sm">
                  {history.transfers.slice(0, 5).map((transfer) => (
                    <div className="rounded-md bg-muted p-2" key={transfer.id}>
                      {formatDate(transfer.transferDate)} | {transfer.originStructure?.name ?? "-"} →{" "}
                      {transfer.destinationStructure.name}
                    </div>
                  ))}
                  {!history.transfers.length ? <p className="text-muted-foreground">Sem transferências.</p> : null}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
