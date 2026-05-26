import { ArrowRightLeft, ClipboardList, Fuel, Gauge, Wrench } from "lucide-react";
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
import {
  maintenanceStatusLabels,
  maintenanceTypeLabels,
  todayDateInput,
} from "@/lib/fleet";
import type {
  FleetAllocation,
  FleetDriver,
  FleetFueling,
  FleetMaintenance,
  FleetMaintenanceStatus,
  FleetMaintenanceType,
  FleetReading,
  FleetStructure,
  FleetTransfer,
  FleetVehicle,
} from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

type OperationKind = "reading" | "fueling" | "maintenance" | "transfer" | "allocation";

type OperationDraft = {
  amount: string;
  completedAt: string;
  destinationStructureId: string;
  driverId: string;
  fiscalDocument: string;
  fuelType: string;
  fuelingDate: string;
  hourmeter: string;
  laborCost: string;
  notes: string;
  odometer: string;
  openedAt: string;
  partsCost: string;
  partsUsed: string;
  performedServices: string;
  problemDescription: string;
  quantity: string;
  reason: string;
  readingDate: string;
  startDate: string;
  status: FleetMaintenanceStatus;
  structureId: string;
  supplier: string;
  transferDate: string;
  type: FleetMaintenanceType;
  unitPrice: string;
  vehicleCondition: string;
  vehicleId: string;
};

function emptyDraft(vehicles: FleetVehicle[], structures: FleetStructure[], drivers: FleetDriver[]): OperationDraft {
  return {
    amount: "",
    completedAt: "",
    destinationStructureId: structures[0]?.id ?? "",
    driverId: drivers[0]?.id ?? "",
    fiscalDocument: "",
    fuelType: vehicles[0]?.fuelType ?? "Diesel",
    fuelingDate: todayDateInput(),
    hourmeter: "",
    laborCost: "0",
    notes: "",
    odometer: vehicles[0] ? String(vehicles[0].currentOdometer) : "0",
    openedAt: todayDateInput(),
    partsCost: "0",
    partsUsed: "",
    performedServices: "",
    problemDescription: "",
    quantity: "0",
    reason: "",
    readingDate: todayDateInput(),
    startDate: todayDateInput(),
    status: "OPEN",
    structureId: structures[0]?.id ?? "",
    supplier: "",
    transferDate: todayDateInput(),
    type: "PREVENTIVE",
    unitPrice: "0",
    vehicleCondition: "",
    vehicleId: vehicles[0]?.id ?? "",
  };
}

function vehicleLabel(vehicle?: FleetVehicle) {
  return vehicle ? `${vehicle.plate} - ${vehicle.brand} ${vehicle.model}` : "-";
}

export function FleetOperationsPage() {
  const vehicles = useApiResource<FleetVehicle[]>("/fleet/vehicles", []);
  const drivers = useApiResource<FleetDriver[]>("/fleet/drivers", []);
  const structures = useApiResource<FleetStructure[]>("/fleet/structures", []);
  const readings = useApiResource<FleetReading[]>("/fleet/readings", []);
  const fuelings = useApiResource<FleetFueling[]>("/fleet/fuelings", []);
  const maintenances = useApiResource<FleetMaintenance[]>("/fleet/maintenances", []);
  const transfers = useApiResource<FleetTransfer[]>("/fleet/transfers", []);
  const allocations = useApiResource<FleetAllocation[]>("/fleet/allocations", []);
  const [kind, setKind] = useState<OperationKind | null>(null);
  const [draft, setDraft] = useState<OperationDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loading =
    vehicles.loading ||
    drivers.loading ||
    structures.loading ||
    readings.loading ||
    fuelings.loading ||
    maintenances.loading ||
    transfers.loading ||
    allocations.loading;
  const error =
    vehicles.error ||
    drivers.error ||
    structures.error ||
    readings.error ||
    fuelings.error ||
    maintenances.error ||
    transfers.error ||
    allocations.error;

  function open(kindName: OperationKind) {
    setKind(kindName);
    setDraft(emptyDraft(vehicles.data, structures.data, drivers.data));
  }

  async function reloadAll() {
    await Promise.all([
      vehicles.reload(),
      readings.reload(),
      fuelings.reload(),
      maintenances.reload(),
      transfers.reload(),
      allocations.reload(),
    ]);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft || !kind) {
      return;
    }

    const paths = {
      allocation: "/fleet/allocations",
      fueling: "/fleet/fuelings",
      maintenance: "/fleet/maintenances",
      reading: "/fleet/readings",
      transfer: "/fleet/transfers",
    };
    const payloads = {
      allocation: {
        destinationStructureId: draft.destinationStructureId,
        driverId: draft.driverId || null,
        notes: draft.notes || null,
        reason: draft.reason || null,
        startDate: draft.startDate,
        vehicleId: draft.vehicleId,
      },
      fueling: {
        driverId: draft.driverId || null,
        fiscalDocument: draft.fiscalDocument || null,
        fuelType: draft.fuelType,
        fuelingDate: draft.fuelingDate,
        hourmeter: draft.hourmeter ? Number(draft.hourmeter) : null,
        notes: draft.notes || null,
        odometer: draft.odometer ? Number(draft.odometer) : null,
        quantity: Number(draft.quantity),
        supplier: draft.supplier || null,
        totalPrice: draft.amount ? Number(draft.amount) : null,
        unitPrice: Number(draft.unitPrice),
        vehicleId: draft.vehicleId,
      },
      maintenance: {
        completedAt: draft.completedAt || null,
        hourmeter: draft.hourmeter ? Number(draft.hourmeter) : null,
        laborCost: Number(draft.laborCost || 0),
        notes: draft.notes || null,
        odometer: draft.odometer ? Number(draft.odometer) : null,
        openedAt: draft.openedAt,
        partsCost: Number(draft.partsCost || 0),
        partsUsed: draft.partsUsed || null,
        performedServices: draft.performedServices || null,
        problemDescription: draft.problemDescription,
        status: draft.status,
        supplier: draft.supplier || null,
        totalCost: draft.amount ? Number(draft.amount) : null,
        type: draft.type,
        vehicleId: draft.vehicleId,
      },
      reading: {
        driverId: draft.driverId || null,
        hourmeter: draft.hourmeter ? Number(draft.hourmeter) : null,
        notes: draft.notes || null,
        odometer: draft.odometer ? Number(draft.odometer) : null,
        readingDate: draft.readingDate,
        structureId: draft.structureId || null,
        vehicleId: draft.vehicleId,
      },
      transfer: {
        destinationStructureId: draft.destinationStructureId,
        driverId: draft.driverId || null,
        hourmeter: draft.hourmeter ? Number(draft.hourmeter) : null,
        notes: draft.notes || null,
        odometer: draft.odometer ? Number(draft.odometer) : null,
        transferDate: draft.transferDate,
        vehicleCondition: draft.vehicleCondition || null,
        vehicleId: draft.vehicleId,
      },
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
    return <LoadingLine label="Carregando operações da frota..." />;
  }

  if (error) {
    return <ResourceError message={error} />;
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Uso, consumo e movimentações</p>
          <h2 className="text-2xl font-semibold">Operações da frota</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => open("reading")} variant="outline">
            <Gauge className="h-4 w-4" />
            Leitura
          </Button>
          <Button onClick={() => open("fueling")} variant="outline">
            <Fuel className="h-4 w-4" />
            Abastecimento
          </Button>
          <Button onClick={() => open("maintenance")} variant="outline">
            <Wrench className="h-4 w-4" />
            Manutenção
          </Button>
          <Button onClick={() => open("transfer")}>
            <ArrowRightLeft className="h-4 w-4" />
            Transferir
          </Button>
          <Button onClick={() => open("allocation")} variant="outline">
            <ClipboardList className="h-4 w-4" />
            Alocar
          </Button>
        </div>
      </div>

      {message ? <ResourceError message={message} /> : null}

      <Tabs defaultValue="readings">
        <TabsList>
          <TabsTrigger value="readings">Leituras</TabsTrigger>
          <TabsTrigger value="fuelings">Abastecimentos</TabsTrigger>
          <TabsTrigger value="maintenances">Manutenções</TabsTrigger>
          <TabsTrigger value="transfers">Transferências</TabsTrigger>
          <TabsTrigger value="allocations">Alocações</TabsTrigger>
        </TabsList>
        <TabsContent value="readings">
          <DataTable
            columns={[
              { cell: (item) => vehicleLabel(item.vehicle), header: "Veículo", key: "vehicle" },
              { cell: (item) => formatDate(item.readingDate), header: "Data", key: "date" },
              { cell: (item) => item.odometer ?? "-", header: "Odômetro", key: "odometer" },
              { cell: (item) => item.hourmeter ?? "-", header: "Horímetro", key: "hourmeter" },
              { cell: (item) => item.driver?.name ?? "-", header: "Motorista", key: "driver" },
            ]}
            data={readings.data}
            emptyMessage="Nenhuma leitura registrada."
            getRowId={(item) => item.id}
            searchText={(item) => `${item.vehicle.plate} ${item.driver?.name ?? ""}`}
          />
        </TabsContent>
        <TabsContent value="fuelings">
          <DataTable
            columns={[
              { cell: (item) => vehicleLabel(item.vehicle), header: "Veículo", key: "vehicle" },
              { cell: (item) => formatDate(item.fuelingDate), header: "Data", key: "date" },
              { cell: (item) => `${item.quantity} l`, header: "Quantidade", key: "quantity" },
              { cell: (item) => formatCurrency(Number(item.totalPrice)), header: "Total", key: "total" },
              { cell: (item) => item.supplier ?? "-", header: "Fornecedor", key: "supplier" },
            ]}
            data={fuelings.data}
            emptyMessage="Nenhum abastecimento registrado."
            getRowId={(item) => item.id}
            searchText={(item) => `${item.vehicle.plate} ${item.supplier ?? ""} ${item.fuelType}`}
          />
        </TabsContent>
        <TabsContent value="maintenances">
          <DataTable
            columns={[
              { cell: (item) => vehicleLabel(item.vehicle), header: "Veículo", key: "vehicle" },
              { cell: (item) => maintenanceTypeLabels[item.type], header: "Tipo", key: "type" },
              { cell: (item) => item.problemDescription, header: "Descrição", key: "problem" },
              {
                cell: (item) => (
                  <Badge variant={item.status === "COMPLETED" ? "success" : item.status === "CANCELLED" ? "zero" : "low"}>
                    {maintenanceStatusLabels[item.status]}
                  </Badge>
                ),
                header: "Status",
                key: "status",
              },
              { cell: (item) => formatCurrency(Number(item.totalCost)), header: "Custo", key: "cost" },
            ]}
            data={maintenances.data}
            emptyMessage="Nenhuma manutenção registrada."
            getRowId={(item) => item.id}
            searchText={(item) => `${item.vehicle.plate} ${item.problemDescription} ${maintenanceStatusLabels[item.status]}`}
          />
        </TabsContent>
        <TabsContent value="transfers">
          <DataTable
            columns={[
              { cell: (item) => vehicleLabel(item.vehicle), header: "Veículo", key: "vehicle" },
              { cell: (item) => formatDate(item.transferDate), header: "Data", key: "date" },
              { cell: (item) => item.originStructure?.name ?? "-", header: "Origem", key: "origin" },
              { cell: (item) => item.destinationStructure.name, header: "Destino", key: "dest" },
              { cell: (item) => item.vehicleCondition ?? "-", header: "Condição", key: "condition" },
            ]}
            data={transfers.data}
            emptyMessage="Nenhuma transferência registrada."
            getRowId={(item) => item.id}
            searchText={(item) => `${item.vehicle.plate} ${item.originStructure?.name ?? ""} ${item.destinationStructure.name}`}
          />
        </TabsContent>
        <TabsContent value="allocations">
          <DataTable
            columns={[
              { cell: (item) => vehicleLabel(item.vehicle), header: "Veículo", key: "vehicle" },
              { cell: (item) => formatDate(item.startDate), header: "Início", key: "start" },
              { cell: (item) => item.destinationStructure.name, header: "Estrutura", key: "structure" },
              { cell: (item) => item.endDate ? formatDate(item.endDate) : "Ativa", header: "Fim", key: "end" },
              { cell: (item) => item.reason ?? "-", header: "Motivo", key: "reason" },
            ]}
            data={allocations.data}
            emptyMessage="Nenhuma alocação registrada."
            getRowId={(item) => item.id}
            searchText={(item) => `${item.vehicle.plate} ${item.destinationStructure.name} ${item.reason ?? ""}`}
          />
        </TabsContent>
      </Tabs>

      <Dialog onOpenChange={(open) => !open && (setDraft(null), setKind(null))} open={Boolean(draft)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {kind === "reading"
                ? "Registrar leitura"
                : kind === "fueling"
                  ? "Registrar abastecimento"
                  : kind === "maintenance"
                    ? "Registrar manutenção"
                    : kind === "transfer"
                      ? "Transferir veículo"
                      : "Alocar veículo"}
            </DialogTitle>
            <DialogDescription>
              O registro atualiza histórico, indicadores e alertas relacionados.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <Form onSubmit={save}>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField>
                  <Label htmlFor="fleet-op-vehicle">Veículo</Label>
                  <Select
                    id="fleet-op-vehicle"
                    onChange={(event) => {
                      const vehicle = vehicles.data.find((item) => item.id === event.target.value);
                      setDraft({
                        ...draft,
                        fuelType: vehicle?.fuelType ?? draft.fuelType,
                        odometer: vehicle ? String(vehicle.currentOdometer) : draft.odometer,
                        vehicleId: event.target.value,
                      });
                    }}
                    required
                    value={draft.vehicleId}
                  >
                    {vehicles.data.map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>{vehicleLabel(vehicle)}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField>
                  <Label htmlFor="fleet-op-driver">Motorista</Label>
                  <Select
                    id="fleet-op-driver"
                    onChange={(event) => setDraft({ ...draft, driverId: event.target.value })}
                    value={draft.driverId}
                  >
                    <option value="">Sem motorista</option>
                    {drivers.data.map((driver) => (
                      <option key={driver.id} value={driver.id}>{driver.name}</option>
                    ))}
                  </Select>
                </FormField>
              </div>

              {kind === "reading" ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField>
                      <Label htmlFor="fleet-op-reading-date">Data</Label>
                      <Input id="fleet-op-reading-date" onChange={(event) => setDraft({ ...draft, readingDate: event.target.value })} required type="date" value={draft.readingDate} />
                    </FormField>
                    <FormField>
                      <Label htmlFor="fleet-op-odometer">Odômetro</Label>
                      <Input id="fleet-op-odometer" min={0} onChange={(event) => setDraft({ ...draft, odometer: event.target.value })} type="number" value={draft.odometer} />
                    </FormField>
                    <FormField>
                      <Label htmlFor="fleet-op-hourmeter">Horímetro</Label>
                      <Input id="fleet-op-hourmeter" min={0} onChange={(event) => setDraft({ ...draft, hourmeter: event.target.value })} step="0.1" type="number" value={draft.hourmeter} />
                    </FormField>
                  </div>
                  <FormField>
                    <Label htmlFor="fleet-op-structure">Estrutura</Label>
                    <Select id="fleet-op-structure" onChange={(event) => setDraft({ ...draft, structureId: event.target.value })} value={draft.structureId}>
                      <option value="">Sem estrutura</option>
                      {structures.data.map((structure) => <option key={structure.id} value={structure.id}>{structure.name}</option>)}
                    </Select>
                  </FormField>
                </>
              ) : null}

              {kind === "fueling" ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField><Label htmlFor="fleet-op-fuel-date">Data</Label><Input id="fleet-op-fuel-date" onChange={(event) => setDraft({ ...draft, fuelingDate: event.target.value })} required type="date" value={draft.fuelingDate} /></FormField>
                    <FormField><Label htmlFor="fleet-op-fuel-type">Combustível</Label><Input id="fleet-op-fuel-type" onChange={(event) => setDraft({ ...draft, fuelType: event.target.value })} required value={draft.fuelType} /></FormField>
                    <FormField><Label htmlFor="fleet-op-supplier">Fornecedor</Label><Input id="fleet-op-supplier" onChange={(event) => setDraft({ ...draft, supplier: event.target.value })} value={draft.supplier} /></FormField>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-4">
                    <FormField><Label htmlFor="fleet-op-quantity">Litros</Label><Input id="fleet-op-quantity" min={0} onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} required step="0.01" type="number" value={draft.quantity} /></FormField>
                    <FormField><Label htmlFor="fleet-op-unit">Valor/l</Label><Input id="fleet-op-unit" min={0} onChange={(event) => setDraft({ ...draft, unitPrice: event.target.value })} required step="0.01" type="number" value={draft.unitPrice} /></FormField>
                    <FormField><Label htmlFor="fleet-op-fuel-odometer">Odômetro</Label><Input id="fleet-op-fuel-odometer" min={0} onChange={(event) => setDraft({ ...draft, odometer: event.target.value })} type="number" value={draft.odometer} /></FormField>
                    <FormField><Label htmlFor="fleet-op-fuel-hourmeter">Horímetro</Label><Input id="fleet-op-fuel-hourmeter" min={0} onChange={(event) => setDraft({ ...draft, hourmeter: event.target.value })} step="0.1" type="number" value={draft.hourmeter} /></FormField>
                  </div>
                  <FormField><Label htmlFor="fleet-op-doc">Documento</Label><Input id="fleet-op-doc" onChange={(event) => setDraft({ ...draft, fiscalDocument: event.target.value })} value={draft.fiscalDocument} /></FormField>
                </>
              ) : null}

              {kind === "maintenance" ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField><Label htmlFor="fleet-op-maint-type">Tipo</Label><Select id="fleet-op-maint-type" onChange={(event) => setDraft({ ...draft, type: event.target.value as FleetMaintenanceType })} value={draft.type}>{Object.entries(maintenanceTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></FormField>
                    <FormField><Label htmlFor="fleet-op-maint-status">Status</Label><Select id="fleet-op-maint-status" onChange={(event) => setDraft({ ...draft, status: event.target.value as FleetMaintenanceStatus })} value={draft.status}>{Object.entries(maintenanceStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></FormField>
                    <FormField><Label htmlFor="fleet-op-opened">Abertura</Label><Input id="fleet-op-opened" onChange={(event) => setDraft({ ...draft, openedAt: event.target.value })} required type="date" value={draft.openedAt} /></FormField>
                  </div>
                  <FormField><Label htmlFor="fleet-op-problem">Descrição</Label><Textarea id="fleet-op-problem" onChange={(event) => setDraft({ ...draft, problemDescription: event.target.value })} required value={draft.problemDescription} /></FormField>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField><Label htmlFor="fleet-op-labor">Mão de obra</Label><Input id="fleet-op-labor" min={0} onChange={(event) => setDraft({ ...draft, laborCost: event.target.value })} step="0.01" type="number" value={draft.laborCost} /></FormField>
                    <FormField><Label htmlFor="fleet-op-parts-cost">Peças</Label><Input id="fleet-op-parts-cost" min={0} onChange={(event) => setDraft({ ...draft, partsCost: event.target.value })} step="0.01" type="number" value={draft.partsCost} /></FormField>
                    <FormField><Label htmlFor="fleet-op-supplier-maint">Fornecedor</Label><Input id="fleet-op-supplier-maint" onChange={(event) => setDraft({ ...draft, supplier: event.target.value })} value={draft.supplier} /></FormField>
                  </div>
                  <FormField><Label htmlFor="fleet-op-services">Serviços executados</Label><Textarea id="fleet-op-services" onChange={(event) => setDraft({ ...draft, performedServices: event.target.value })} value={draft.performedServices} /></FormField>
                  <FormField><Label htmlFor="fleet-op-parts">Peças utilizadas</Label><Textarea id="fleet-op-parts" onChange={(event) => setDraft({ ...draft, partsUsed: event.target.value })} value={draft.partsUsed} /></FormField>
                </>
              ) : null}

              {kind === "transfer" || kind === "allocation" ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField>
                      <Label htmlFor="fleet-op-destination">Estrutura destino</Label>
                      <Select id="fleet-op-destination" onChange={(event) => setDraft({ ...draft, destinationStructureId: event.target.value })} required value={draft.destinationStructureId}>
                        {structures.data.map((structure) => <option key={structure.id} value={structure.id}>{structure.name}</option>)}
                      </Select>
                    </FormField>
                    <FormField>
                      <Label htmlFor="fleet-op-date">{kind === "transfer" ? "Transferência" : "Início"}</Label>
                      <Input id="fleet-op-date" onChange={(event) => setDraft(kind === "transfer" ? { ...draft, transferDate: event.target.value } : { ...draft, startDate: event.target.value })} required type="date" value={kind === "transfer" ? draft.transferDate : draft.startDate} />
                    </FormField>
                  </div>
                  {kind === "transfer" ? (
                    <div className="grid gap-4 sm:grid-cols-3">
                      <FormField><Label htmlFor="fleet-op-transfer-odometer">Odômetro</Label><Input id="fleet-op-transfer-odometer" min={0} onChange={(event) => setDraft({ ...draft, odometer: event.target.value })} type="number" value={draft.odometer} /></FormField>
                      <FormField><Label htmlFor="fleet-op-transfer-hourmeter">Horímetro</Label><Input id="fleet-op-transfer-hourmeter" min={0} onChange={(event) => setDraft({ ...draft, hourmeter: event.target.value })} step="0.1" type="number" value={draft.hourmeter} /></FormField>
                      <FormField><Label htmlFor="fleet-op-condition">Condição</Label><Input id="fleet-op-condition" onChange={(event) => setDraft({ ...draft, vehicleCondition: event.target.value })} value={draft.vehicleCondition} /></FormField>
                    </div>
                  ) : (
                    <FormField><Label htmlFor="fleet-op-reason">Motivo</Label><Input id="fleet-op-reason" onChange={(event) => setDraft({ ...draft, reason: event.target.value })} value={draft.reason} /></FormField>
                  )}
                </>
              ) : null}

              <FormField>
                <Label htmlFor="fleet-op-notes">Observações</Label>
                <Textarea id="fleet-op-notes" onChange={(event) => setDraft({ ...draft, notes: event.target.value })} value={draft.notes} />
              </FormField>
              <Button type="submit">Salvar registro</Button>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
