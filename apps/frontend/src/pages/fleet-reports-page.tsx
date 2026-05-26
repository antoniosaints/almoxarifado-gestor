import { BarChart3, FileText } from "lucide-react";
import { DataTable } from "@/components/domain/data-table";
import { LoadingLine, ResourceError } from "@/components/domain/feedback";
import { SummaryCard } from "@/components/domain/summary-card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiResource } from "@/lib/api";
import { driverCnhLabel, vehicleStatusLabels, vehicleStatusVariant } from "@/lib/fleet";
import type { FleetReports } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export function FleetReportsPage() {
  const reports = useApiResource<FleetReports | null>("/fleet/reports", null);

  if (reports.loading) {
    return <LoadingLine label="Carregando relatórios da frota..." />;
  }

  if (reports.error) {
    return <ResourceError message={reports.error} />;
  }

  if (!reports.data) {
    return <ResourceError message="Não foi possível carregar os relatórios." />;
  }

  const totalCost = reports.data.costsByVehicle.reduce(
    (sum, item) => sum + item.totalCost,
    0,
  );

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">Visões consolidadas</p>
        <h2 className="text-2xl font-semibold">Relatórios da frota</h2>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard icon={<FileText className="h-4 w-4" />} label="Veículos" value={reports.data.vehicles.length} />
        <SummaryCard icon={<BarChart3 className="h-4 w-4" />} label="Custo total" value={formatCurrency(totalCost)} />
        <SummaryCard icon={<FileText className="h-4 w-4" />} label="CNHs em alerta" value={reports.data.cnhAlerts.expired.length + reports.data.cnhAlerts.expiring.length} />
      </div>

      <Tabs defaultValue="fleet">
        <TabsList>
          <TabsTrigger value="fleet">Frota atual</TabsTrigger>
          <TabsTrigger value="costs">Custos</TabsTrigger>
          <TabsTrigger value="fuel">Combustível</TabsTrigger>
          <TabsTrigger value="maintenance">Manutenções</TabsTrigger>
          <TabsTrigger value="cnh">CNH</TabsTrigger>
          <TabsTrigger value="transfers">Transferências</TabsTrigger>
        </TabsList>
        <TabsContent value="fleet">
          <DataTable
            columns={[
              { cell: (vehicle) => vehicle.plate, header: "Placa", key: "plate" },
              { cell: (vehicle) => `${vehicle.brand} ${vehicle.model}`, header: "Veículo", key: "vehicle" },
              { cell: (vehicle) => vehicle.currentStructure?.name ?? "-", header: "Estrutura", key: "structure" },
              { cell: (vehicle) => <Badge variant={vehicleStatusVariant(vehicle.status)}>{vehicleStatusLabels[vehicle.status]}</Badge>, header: "Status", key: "status" },
            ]}
            data={reports.data.vehicles}
            emptyMessage="Nenhum veículo."
            getRowId={(vehicle) => vehicle.id}
            searchText={(vehicle) => `${vehicle.plate} ${vehicle.model} ${vehicle.currentStructure?.name ?? ""}`}
          />
        </TabsContent>
        <TabsContent value="costs">
          <DataTable
            columns={[
              { cell: (item) => item.vehicle.plate, header: "Veículo", key: "vehicle" },
              { cell: (item) => formatCurrency(item.fuelCost), header: "Combustível", key: "fuel" },
              { cell: (item) => formatCurrency(item.maintenanceCost), header: "Manutenção", key: "maintenance" },
              { cell: (item) => formatCurrency(item.totalCost), header: "Total", key: "total" },
            ]}
            data={reports.data.costsByVehicle}
            emptyMessage="Nenhum custo."
            getRowId={(item) => item.vehicle.id}
            searchText={(item) => `${item.vehicle.plate} ${item.vehicle.model}`}
          />
        </TabsContent>
        <TabsContent value="fuel">
          <DataTable
            columns={[
              { cell: (item) => item.vehicle.plate, header: "Veículo", key: "vehicle" },
              { cell: (item) => formatDate(item.fuelingDate), header: "Data", key: "date" },
              { cell: (item) => `${item.quantity} l`, header: "Litros", key: "liters" },
              { cell: (item) => formatCurrency(Number(item.totalPrice)), header: "Total", key: "total" },
              { cell: (item) => item.driver?.name ?? "-", header: "Motorista", key: "driver" },
            ]}
            data={reports.data.fuelings}
            emptyMessage="Nenhum abastecimento."
            getRowId={(item) => item.id}
            searchText={(item) => `${item.vehicle.plate} ${item.driver?.name ?? ""} ${item.supplier ?? ""}`}
          />
        </TabsContent>
        <TabsContent value="maintenance">
          <DataTable
            columns={[
              { cell: (item) => item.vehicle.plate, header: "Veículo", key: "vehicle" },
              { cell: (item) => formatDate(item.openedAt), header: "Abertura", key: "opened" },
              { cell: (item) => item.problemDescription, header: "Descrição", key: "description" },
              { cell: (item) => formatCurrency(Number(item.totalCost)), header: "Custo", key: "cost" },
            ]}
            data={reports.data.maintenances}
            emptyMessage="Nenhuma manutenção."
            getRowId={(item) => item.id}
            searchText={(item) => `${item.vehicle.plate} ${item.problemDescription}`}
          />
        </TabsContent>
        <TabsContent value="cnh">
          <DataTable
            columns={[
              { cell: (driver) => driver.name, header: "Motorista", key: "driver" },
              { cell: (driver) => driver.licenseNumber ?? "-", header: "CNH", key: "license" },
              { cell: (driver) => formatDate(driver.licenseExpiresAt), header: "Vencimento", key: "expires" },
              { cell: (driver) => driverCnhLabel(driver), header: "Status", key: "status" },
            ]}
            data={[...reports.data.cnhAlerts.expired, ...reports.data.cnhAlerts.expiring]}
            emptyMessage="Nenhuma CNH em alerta."
            getRowId={(driver) => driver.id}
            searchText={(driver) => `${driver.name} ${driver.licenseNumber ?? ""} ${driverCnhLabel(driver)}`}
          />
        </TabsContent>
        <TabsContent value="transfers">
          <DataTable
            columns={[
              { cell: (item) => item.vehicle.plate, header: "Veículo", key: "vehicle" },
              { cell: (item) => formatDate(item.transferDate), header: "Data", key: "date" },
              { cell: (item) => item.originStructure?.name ?? "-", header: "Origem", key: "origin" },
              { cell: (item) => item.destinationStructure.name, header: "Destino", key: "destination" },
            ]}
            data={reports.data.transfers}
            emptyMessage="Nenhuma transferência."
            getRowId={(item) => item.id}
            searchText={(item) => `${item.vehicle.plate} ${item.originStructure?.name ?? ""} ${item.destinationStructure.name}`}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
