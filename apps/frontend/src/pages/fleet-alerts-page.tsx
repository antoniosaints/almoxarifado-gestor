import { Droplet, Plus, RotateCw, Wrench } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, useApiResource } from "@/lib/api";
import { healthLabel, healthVariant, todayDateInput } from "@/lib/fleet";
import type {
  FleetBeltControl,
  FleetOilControl,
  FleetScheduledService,
  FleetTire,
  FleetVehicle,
} from "@/lib/types";

type ControlKind = "service" | "oil" | "belt" | "tire";

type ControlDraft = {
  beltType: string;
  brand: string;
  estimatedLifeKm: string;
  installedAt: string;
  intervalDays: string;
  intervalHours: string;
  intervalKm: string;
  model: string;
  notes: string;
  oilType: string;
  position: string;
  serviceType: string;
  serialNumber: string;
  vehicleId: string;
};

function emptyDraft(vehicles: FleetVehicle[]): ControlDraft {
  return {
    beltType: "Correia dentada",
    brand: "",
    estimatedLifeKm: "",
    installedAt: todayDateInput(),
    intervalDays: "",
    intervalHours: "",
    intervalKm: "",
    model: "",
    notes: "",
    oilType: "Óleo do motor",
    position: "",
    serviceType: "Troca de óleo",
    serialNumber: "",
    vehicleId: vehicles[0]?.id ?? "",
  };
}

function vehicleLabel(vehicle?: FleetVehicle | null) {
  return vehicle ? `${vehicle.plate} - ${vehicle.model}` : "-";
}

export function FleetAlertsPage() {
  const vehicles = useApiResource<FleetVehicle[]>("/fleet/vehicles", []);
  const services = useApiResource<FleetScheduledService[]>("/fleet/scheduled-services", []);
  const oils = useApiResource<FleetOilControl[]>("/fleet/oil-controls", []);
  const belts = useApiResource<FleetBeltControl[]>("/fleet/belt-controls", []);
  const tires = useApiResource<FleetTire[]>("/fleet/tires", []);
  const [kind, setKind] = useState<ControlKind | null>(null);
  const [draft, setDraft] = useState<ControlDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const loading = vehicles.loading || services.loading || oils.loading || belts.loading || tires.loading;
  const error = vehicles.error || services.error || oils.error || belts.error || tires.error;

  function open(controlKind: ControlKind) {
    setKind(controlKind);
    setDraft(emptyDraft(vehicles.data));
  }

  async function reloadAll() {
    await Promise.all([services.reload(), oils.reload(), belts.reload(), tires.reload()]);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft || !kind) {
      return;
    }

    const payloads = {
      belt: {
        beltType: draft.beltType,
        installHourmeter: draft.intervalHours ? 0 : null,
        installOdometer: 0,
        installedAt: draft.installedAt,
        lifetimeDays: draft.intervalDays ? Number(draft.intervalDays) : null,
        lifetimeHours: draft.intervalHours ? Number(draft.intervalHours) : null,
        lifetimeKm: draft.intervalKm ? Number(draft.intervalKm) : null,
        notes: draft.notes || null,
        vehicleId: draft.vehicleId,
      },
      oil: {
        intervalDays: draft.intervalDays ? Number(draft.intervalDays) : null,
        intervalHours: draft.intervalHours ? Number(draft.intervalHours) : null,
        intervalKm: draft.intervalKm ? Number(draft.intervalKm) : null,
        lastChangeDate: draft.installedAt,
        lastHourmeter: draft.intervalHours ? 0 : null,
        lastOdometer: 0,
        notes: draft.notes || null,
        oilType: draft.oilType,
        vehicleId: draft.vehicleId,
      },
      service: {
        active: true,
        intervalDays: draft.intervalDays ? Number(draft.intervalDays) : null,
        intervalHours: draft.intervalHours ? Number(draft.intervalHours) : null,
        intervalKm: draft.intervalKm ? Number(draft.intervalKm) : null,
        notes: draft.notes || null,
        serviceType: draft.serviceType,
        vehicleId: draft.vehicleId || null,
        vehicleType: null,
      },
      tire: {
        brand: draft.brand || null,
        estimatedLifeKm: draft.estimatedLifeKm ? Number(draft.estimatedLifeKm) : null,
        installedAt: draft.installedAt || null,
        installedKm: 0,
        model: draft.model || null,
        notes: draft.notes || null,
        position: draft.position,
        serialNumber: draft.serialNumber || null,
        status: "ACTIVE",
        vehicleId: draft.vehicleId,
      },
    };
    const paths = {
      belt: "/fleet/belt-controls",
      oil: "/fleet/oil-controls",
      service: "/fleet/scheduled-services",
      tire: "/fleet/tires",
    };

    try {
      await api(paths[kind], {
        body: JSON.stringify(payloads[kind]),
        method: "POST",
      });
      setDraft(null);
      setKind(null);
      setMessage(null);
      await reloadAll();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao salvar.");
    }
  }

  if (loading) {
    return <LoadingLine label="Carregando alertas..." />;
  }

  if (error) {
    return <ResourceError message={error} />;
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Preventivos e vencimentos</p>
          <h2 className="text-2xl font-semibold">Alertas da frota</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => open("service")} variant="outline"><Wrench className="h-4 w-4" /> Serviço</Button>
          <Button onClick={() => open("oil")} variant="outline"><Droplet className="h-4 w-4" /> Óleo</Button>
          <Button onClick={() => open("belt")} variant="outline"><RotateCw className="h-4 w-4" /> Correia</Button>
          <Button onClick={() => open("tire")}><Plus className="h-4 w-4" /> Pneu</Button>
        </div>
      </div>

      {message ? <ResourceError message={message} /> : null}

      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">Serviços</TabsTrigger>
          <TabsTrigger value="oil">Óleo</TabsTrigger>
          <TabsTrigger value="belt">Correias</TabsTrigger>
          <TabsTrigger value="tires">Pneus</TabsTrigger>
        </TabsList>
        <TabsContent value="services">
          <DataTable
            columns={[
              { cell: (item) => vehicleLabel(item.vehicle), header: "Veículo", key: "vehicle" },
              { cell: (item) => item.serviceType, header: "Serviço", key: "service" },
              { cell: (item) => `${item.intervalKm ?? "-"} km / ${item.intervalHours ?? "-"} h / ${item.intervalDays ?? "-"} dias`, header: "Intervalo", key: "interval" },
              { cell: (item) => <Badge variant={healthVariant(item.health?.status)}>{healthLabel(item.health?.status)}</Badge>, header: "Status", key: "status" },
            ]}
            data={services.data}
            emptyMessage="Nenhum serviço programado."
            getRowId={(item) => item.id}
            searchText={(item) => `${item.serviceType} ${item.vehicle?.plate ?? ""}`}
          />
        </TabsContent>
        <TabsContent value="oil">
          <DataTable
            columns={[
              { cell: (item) => vehicleLabel(item.vehicle), header: "Veículo", key: "vehicle" },
              { cell: (item) => item.oilType, header: "Óleo", key: "oil" },
              { cell: (item) => `${Math.round(item.health.percent)}%`, header: "Desgaste", key: "wear" },
              { cell: (item) => <Badge variant={healthVariant(item.health.status)}>{healthLabel(item.health.status)}</Badge>, header: "Status", key: "status" },
            ]}
            data={oils.data}
            emptyMessage="Nenhum controle de óleo."
            getRowId={(item) => item.id}
            searchText={(item) => `${item.vehicle.plate} ${item.oilType}`}
          />
        </TabsContent>
        <TabsContent value="belt">
          <DataTable
            columns={[
              { cell: (item) => vehicleLabel(item.vehicle), header: "Veículo", key: "vehicle" },
              { cell: (item) => item.beltType, header: "Correia", key: "belt" },
              { cell: (item) => `${Math.round(item.health.percent)}%`, header: "Desgaste", key: "wear" },
              { cell: (item) => <Badge variant={healthVariant(item.health.status)}>{healthLabel(item.health.status)}</Badge>, header: "Status", key: "status" },
            ]}
            data={belts.data}
            emptyMessage="Nenhum controle de correia."
            getRowId={(item) => item.id}
            searchText={(item) => `${item.vehicle.plate} ${item.beltType}`}
          />
        </TabsContent>
        <TabsContent value="tires">
          <DataTable
            columns={[
              { cell: (item) => vehicleLabel(item.vehicle), header: "Veículo", key: "vehicle" },
              { cell: (item) => item.position, header: "Posição", key: "position" },
              { cell: (item) => [item.brand, item.model].filter(Boolean).join(" ") || "-", header: "Pneu", key: "tire" },
              { cell: (item) => item.status, header: "Status", key: "status" },
            ]}
            data={tires.data}
            emptyMessage="Nenhum pneu cadastrado."
            getRowId={(item) => item.id}
            searchText={(item) => `${item.vehicle.plate} ${item.position} ${item.brand ?? ""}`}
          />
        </TabsContent>
      </Tabs>

      <Dialog onOpenChange={(openDialog) => !openDialog && (setKind(null), setDraft(null))} open={Boolean(draft)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {kind === "service" ? "Serviço programado" : kind === "oil" ? "Controle de óleo" : kind === "belt" ? "Controle de correia" : "Controle de pneu"}
            </DialogTitle>
            <DialogDescription>
              O sistema calcula o alerta pelo primeiro limite atingido.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <Form onSubmit={save}>
              <FormField>
                <Label htmlFor="fleet-control-vehicle">Veículo</Label>
                <Select id="fleet-control-vehicle" onChange={(event) => setDraft({ ...draft, vehicleId: event.target.value })} required value={draft.vehicleId}>
                  {vehicles.data.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicleLabel(vehicle)}</option>)}
                </Select>
              </FormField>
              {kind === "service" ? (
                <FormField><Label htmlFor="fleet-control-service">Serviço</Label><Input id="fleet-control-service" onChange={(event) => setDraft({ ...draft, serviceType: event.target.value })} required value={draft.serviceType} /></FormField>
              ) : null}
              {kind === "oil" ? (
                <FormField><Label htmlFor="fleet-control-oil">Tipo de óleo</Label><Input id="fleet-control-oil" onChange={(event) => setDraft({ ...draft, oilType: event.target.value })} required value={draft.oilType} /></FormField>
              ) : null}
              {kind === "belt" ? (
                <FormField><Label htmlFor="fleet-control-belt">Tipo de correia</Label><Input id="fleet-control-belt" onChange={(event) => setDraft({ ...draft, beltType: event.target.value })} required value={draft.beltType} /></FormField>
              ) : null}
              {kind === "tire" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField><Label htmlFor="fleet-control-position">Posição</Label><Input id="fleet-control-position" onChange={(event) => setDraft({ ...draft, position: event.target.value })} required value={draft.position} /></FormField>
                  <FormField><Label htmlFor="fleet-control-serial">Série</Label><Input id="fleet-control-serial" onChange={(event) => setDraft({ ...draft, serialNumber: event.target.value })} value={draft.serialNumber} /></FormField>
                  <FormField><Label htmlFor="fleet-control-brand">Marca</Label><Input id="fleet-control-brand" onChange={(event) => setDraft({ ...draft, brand: event.target.value })} value={draft.brand} /></FormField>
                  <FormField><Label htmlFor="fleet-control-model">Modelo</Label><Input id="fleet-control-model" onChange={(event) => setDraft({ ...draft, model: event.target.value })} value={draft.model} /></FormField>
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-4">
                <FormField><Label htmlFor="fleet-control-date">Data base</Label><Input id="fleet-control-date" onChange={(event) => setDraft({ ...draft, installedAt: event.target.value })} type="date" value={draft.installedAt} /></FormField>
                <FormField><Label htmlFor="fleet-control-km">Km</Label><Input id="fleet-control-km" min={0} onChange={(event) => setDraft({ ...draft, intervalKm: event.target.value })} type="number" value={draft.intervalKm} /></FormField>
                <FormField><Label htmlFor="fleet-control-hours">Horas</Label><Input id="fleet-control-hours" min={0} onChange={(event) => setDraft({ ...draft, intervalHours: event.target.value })} step="0.1" type="number" value={draft.intervalHours} /></FormField>
                <FormField><Label htmlFor="fleet-control-days">Dias</Label><Input id="fleet-control-days" min={0} onChange={(event) => setDraft({ ...draft, intervalDays: event.target.value })} type="number" value={draft.intervalDays} /></FormField>
              </div>
              {kind === "tire" ? (
                <FormField><Label htmlFor="fleet-control-life">Vida útil em km</Label><Input id="fleet-control-life" min={0} onChange={(event) => setDraft({ ...draft, estimatedLifeKm: event.target.value })} type="number" value={draft.estimatedLifeKm} /></FormField>
              ) : null}
              <FormField>
                <Label htmlFor="fleet-control-notes">Observações</Label>
                <Textarea id="fleet-control-notes" onChange={(event) => setDraft({ ...draft, notes: event.target.value })} value={draft.notes} />
              </FormField>
              <Button type="submit">Salvar controle</Button>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
