import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CreditCard,
  KeyRound,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import type { ManagerBilling, ManagerDashboard, ManagerLicense } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

const chartColors = [
  "hsl(var(--primary))",
  "#0ea5e9",
  "#f59e0b",
  "#10b981",
  "#ef4444",
];

function money(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

function licenseStatusLabel(status: ManagerLicense["status"]) {
  const labels = {
    ACTIVE: "Ativa",
    CANCELLED: "Cancelada",
    EXPIRED: "Expirada",
    PENDING: "Pendente",
  };

  return labels[status];
}

function licenseStatusVariant(status: ManagerLicense["status"]) {
  if (status === "ACTIVE") {
    return "success" as const;
  }

  if (status === "CANCELLED" || status === "EXPIRED") {
    return "zero" as const;
  }

  return "low" as const;
}

function billingStatusVariant(status: ManagerBilling["status"]) {
  if (status === "PAID") {
    return "success" as const;
  }

  if (status === "OVERDUE" || status === "CANCELLED") {
    return "zero" as const;
  }

  return "low" as const;
}

function billingStatusLabel(status: ManagerBilling["status"]) {
  const labels = {
    CANCELLED: "Cancelado",
    OPEN: "Aberto",
    OVERDUE: "Vencido",
    PAID: "Pago",
  };

  return labels[status];
}

function MoneyTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ value?: number }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-sm">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">
        {formatCurrency(Number(payload[0]?.value ?? 0))}
      </p>
    </div>
  );
}

function chartData(data: Array<{ name: string; value: number }>) {
  return data.length ? data : [{ name: "Sem receita", value: 1 }];
}

export function ManagerDashboardPage() {
  const dashboard = useApiResource<ManagerDashboard | null>(
    "/manager/dashboard",
    null,
  );

  if (dashboard.loading) {
    return <LoadingLine label="Carregando gestão..." />;
  }

  if (dashboard.error) {
    return <ResourceError message={dashboard.error} />;
  }

  if (!dashboard.data) {
    return <ResourceError message="Não foi possível carregar a gestão." />;
  }

  const { totals } = dashboard.data;
  const revenueBySystem = chartData(dashboard.data.revenueBySystem);
  const revenueByLicenseType = chartData(dashboard.data.revenueByLicenseType);

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Painel de gestão</p>
        <h2 className="text-2xl font-semibold">Assinaturas e licenças</h2>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<Building2 className="h-4 w-4" />}
          label="Assinantes ativos"
          value={`${totals.activeSubscribers}/${totals.totalSubscribers}`}
        />
        <SummaryCard
          icon={<KeyRound className="h-4 w-4" />}
          label="Licenças ativas"
          value={totals.activeLicenses}
        />
        <SummaryCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Receita do mês"
          value={formatCurrency(totals.currentMonthRevenue)}
        />
        <SummaryCard
          icon={<CreditCard className="h-4 w-4" />}
          label="MRR previsto"
          value={formatCurrency(totals.monthlyRecurring)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Receita por sistema</CardTitle>
            <CardDescription>Somente faturamentos pagos entram no gráfico.</CardDescription>
          </CardHeader>
          <CardContent className="h-72 min-h-72 min-w-0 overflow-hidden">
            <ResponsiveContainer height="100%" minWidth={0} width="100%">
              <BarChart data={revenueBySystem} margin={{ bottom: 8, left: 0, right: 8 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <YAxis
                  fontSize={12}
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(value) => formatCurrency(Number(value))}
                  width={90}
                />
                <Tooltip content={<MoneyTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {revenueBySystem.map((entry, index) => (
                    <Cell fill={chartColors[index % chartColors.length]} key={entry.name} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Receita por licença</CardTitle>
            <CardDescription>Distribuição por tipo de licença faturada.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[14rem_1fr]">
            <div className="h-56 min-h-56 min-w-0 overflow-hidden">
              <ResponsiveContainer height="100%" minWidth={0} width="100%">
                <PieChart>
                  <Tooltip content={<MoneyTooltip />} />
                  <Pie
                    data={revenueByLicenseType}
                    dataKey="value"
                    innerRadius={48}
                    nameKey="name"
                    outerRadius={78}
                    paddingAngle={4}
                  >
                    {revenueByLicenseType.map((entry, index) => (
                      <Cell
                        fill={
                          dashboard.data?.revenueByLicenseType.length
                            ? chartColors[index % chartColors.length]
                            : "hsl(var(--muted))"
                        }
                        key={entry.name}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid content-center gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Receita total</p>
                <p className="text-xl font-semibold">
                  {formatCurrency(totals.totalRevenue)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Cobranças abertas</p>
                <p className="text-xl font-semibold">{totals.openBillings}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Cobranças vencidas</p>
                <p className="text-xl font-semibold">{totals.overdueBillings}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Licenças vencendo</h3>
              <p className="text-sm text-muted-foreground">Próximos 30 dias.</p>
            </div>
          </div>
          <DataTable
            columns={[
              {
                cell: (license) => (
                  <>
                    <p className="font-medium">{license.subscriber?.name ?? "-"}</p>
                    <p className="text-xs text-muted-foreground">{license.systemKey}</p>
                  </>
                ),
                header: "Assinante",
                key: "subscriber",
              },
              {
                cell: (license) => formatDate(license.expiresAt),
                header: "Vencimento",
                key: "expiresAt",
              },
              {
                cell: (license) => (
                  <Badge variant={licenseStatusVariant(license.status)}>
                    {licenseStatusLabel(license.status)}
                  </Badge>
                ),
                header: "Status",
                key: "status",
              },
            ]}
            data={dashboard.data.upcomingExpirations}
            emptyMessage="Nenhuma licença vencendo nos próximos 30 dias."
            getRowId={(license) => license.id}
            initialPageSize={5}
            searchText={(license) =>
              `${license.subscriber?.name ?? ""} ${license.systemKey} ${license.licenseKey}`
            }
          />
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Faturamentos vencidos</h3>
              <p className="text-sm text-muted-foreground">Cobranças abertas fora do prazo.</p>
            </div>
          </div>
          <DataTable
            columns={[
              {
                cell: (billing) => (
                  <>
                    <p className="font-medium">{billing.subscriber?.name ?? "-"}</p>
                    <p className="text-xs text-muted-foreground">{billing.reference}</p>
                  </>
                ),
                header: "Assinante",
                key: "subscriber",
              },
              {
                cell: (billing) => formatCurrency(money(billing.amount)),
                header: "Valor",
                key: "amount",
              },
              {
                cell: (billing) => (
                  <Badge variant={billingStatusVariant(billing.status)}>
                    {billingStatusLabel(billing.status)}
                  </Badge>
                ),
                header: "Status",
                key: "status",
              },
            ]}
            data={dashboard.data.overdueBillings}
            emptyMessage="Nenhuma cobrança vencida."
            getRowId={(billing) => billing.id}
            initialPageSize={5}
            searchText={(billing) =>
              `${billing.subscriber?.name ?? ""} ${billing.reference} ${billing.systemKey}`
            }
          />
        </section>
      </div>
    </section>
  );
}
