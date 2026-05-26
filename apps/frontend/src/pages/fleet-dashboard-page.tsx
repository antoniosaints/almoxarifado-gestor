import {
  AlertTriangle,
  Car,
  Gauge,
  IdCard,
  Wrench,
  Fuel,
} from "lucide-react";
import { DataTable } from "@/components/domain/data-table";
import { LoadingLine, ResourceError } from "@/components/domain/feedback";
import { SummaryCard } from "@/components/domain/summary-card";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useApiResource } from "@/lib/api";
import {
  healthLabel,
  healthVariant,
  vehicleStatusLabels,
  vehicleStatusVariant,
} from "@/lib/fleet";
import type { FleetDashboard, FleetVehicle } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function FleetDashboardPage() {
  const dashboard = useApiResource<FleetDashboard | null>("/fleet/dashboard", null);

  if (dashboard.loading) {
    return <LoadingLine label="Carregando indicadores da frota..." />;
  }

  if (dashboard.error) {
    return <ResourceError message={dashboard.error} />;
  }

  if (!dashboard.data) {
    return <ResourceError message="Não foi possível carregar a frota." />;
  }

  const { alerts, costs, metrics, totals } = dashboard.data;
  const combinedAlerts = [
    ...alerts.cnhExpired.map((driver) => ({
      id: `driver-expired-${driver.id}`,
      title: driver.name,
      type: "CNH vencida",
      status: "OVERDUE" as const,
      target: driver.licenseExpiresAt ?? "-",
    })),
    ...alerts.cnhExpiring.map((driver) => ({
      id: `driver-expiring-${driver.id}`,
      title: driver.name,
      type: "CNH próxima",
      status: "ATTENTION" as const,
      target: driver.licenseExpiresAt ?? "-",
    })),
    ...alerts.oil.map((control) => ({
      id: `oil-${control.id}`,
      title: control.vehicle.plate,
      type: `Óleo - ${control.oilType}`,
      status: control.health.status,
      target: `${formatNumber(control.health.percent)}%`,
    })),
    ...alerts.belt.map((control) => ({
      id: `belt-${control.id}`,
      title: control.vehicle.plate,
      type: `Correia - ${control.beltType}`,
      status: control.health.status,
      target: `${formatNumber(control.health.percent)}%`,
    })),
    ...alerts.services.map((service) => ({
      id: `service-${service.id}`,
      title: service.vehicle?.plate ?? service.vehicleType ?? "Serviço",
      type: service.serviceType,
      status: service.health?.status ?? "ATTENTION",
      target: `${formatNumber(service.health?.percent ?? 0)}%`,
    })),
  ];

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Painel operacional</p>
        <h2 className="text-2xl font-semibold">Controle de frota</h2>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<Car className="h-4 w-4" />}
          label="Veículos ativos"
          value={`${totals.activeVehicles}/${totals.totalVehicles}`}
        />
        <SummaryCard
          icon={<Wrench className="h-4 w-4" />}
          label="Em manutenção"
          value={totals.maintenanceVehicles}
        />
        <SummaryCard
          icon={<IdCard className="h-4 w-4" />}
          label="CNHs em alerta"
          value={totals.cnhExpired + totals.cnhExpiring}
        />
        <SummaryCard
          icon={<Fuel className="h-4 w-4" />}
          label="Combustível no mês"
          value={formatCurrency(costs.monthlyFuelCost)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Consumo e custos</CardTitle>
            <CardDescription>Indicadores calculados pelos abastecimentos.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Consumo médio</p>
              <p className="text-xl font-semibold">
                {formatNumber(metrics.averageKmPerLiter)} km/l
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Litros por hora</p>
              <p className="text-xl font-semibold">
                {formatNumber(metrics.averageLitersPerHour)} l/h
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Custo por km</p>
              <p className="text-xl font-semibold">
                {formatCurrency(metrics.averageCostPerKm)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Manutenção no mês</p>
              <p className="text-xl font-semibold">
                {formatCurrency(costs.monthlyMaintenanceCost)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Veículos com maior custo</CardTitle>
            <CardDescription>Combustível e manutenção consolidados.</CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={[
                {
                  cell: (item) => (
                    <>
                      <p className="font-medium">{item.vehicle.plate}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.vehicle.brand} {item.vehicle.model}
                      </p>
                    </>
                  ),
                  header: "Veículo",
                  key: "vehicle",
                },
                {
                  cell: (item) => formatCurrency(item.fuelCost),
                  header: "Combustível",
                  key: "fuel",
                },
                {
                  cell: (item) => formatCurrency(item.totalCost),
                  header: "Total",
                  key: "total",
                },
              ]}
              data={costs.byVehicle.slice(0, 5)}
              emptyMessage="Nenhum custo registrado."
              getRowId={(item) => item.vehicle.id}
              initialPageSize={5}
              searchText={(item) => `${item.vehicle.plate} ${item.vehicle.model}`}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Alertas e vencimentos</h3>
              <p className="text-sm text-muted-foreground">
                CNH, óleo, correias e serviços preventivos.
              </p>
            </div>
          </div>
          <DataTable
            columns={[
              { cell: (item) => item.title, header: "Origem", key: "title" },
              { cell: (item) => item.type, header: "Alerta", key: "type" },
              {
                cell: (item) => (
                  <Badge variant={healthVariant(item.status)}>
                    {healthLabel(item.status)}
                  </Badge>
                ),
                header: "Status",
                key: "status",
              },
              { cell: (item) => item.target, header: "Referência", key: "target" },
            ]}
            data={combinedAlerts}
            emptyMessage="Nenhum alerta ativo."
            getRowId={(item) => item.id}
            initialPageSize={5}
            searchText={(item) => `${item.title} ${item.type} ${item.target}`}
          />
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Situação operacional</h3>
              <p className="text-sm text-muted-foreground">
                Veículos sem motorista e veículos em manutenção.
              </p>
            </div>
          </div>
          <DataTable
            columns={[
              {
                cell: (vehicle: FleetVehicle) => (
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
                cell: (vehicle) => vehicle.currentStructure?.name ?? "-",
                header: "Estrutura",
                key: "structure",
              },
            ]}
            data={[
              ...alerts.vehiclesInMaintenance,
              ...alerts.vehiclesNoDriver.filter(
                (vehicle) =>
                  !alerts.vehiclesInMaintenance.some((item) => item.id === vehicle.id),
              ),
            ]}
            emptyMessage="Nenhum veículo em alerta operacional."
            getRowId={(vehicle) => vehicle.id}
            initialPageSize={5}
            searchText={(vehicle) =>
              `${vehicle.plate} ${vehicle.model} ${vehicle.currentStructure?.name ?? ""}`
            }
          />
        </section>
      </div>
    </section>
  );
}
