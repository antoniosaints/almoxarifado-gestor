import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  ClipboardList,
  FileSearch,
  PackageCheck,
  PackagePlus,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useApiResource } from "@/lib/api";
import type { Insights } from "@/lib/types";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { InvoiceMovementsDialog } from "./invoices-page";
import { ProductStocksDialog } from "./products-page";

const integerFormatter = new Intl.NumberFormat("pt-BR");
const chartColors = [
  "hsl(var(--primary))",
  "hsl(var(--accent-foreground))",
  "#f59e0b",
  "#ef4444",
  "#10b981",
];

function formatInteger(value: number) {
  return integerFormatter.format(value);
}

function ChartTooltip({
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
      <p className="text-muted-foreground">{formatInteger(Number(payload[0]?.value ?? 0))}</p>
    </div>
  );
}

function scrollToAlertStocks() {
  document.getElementById("alert-stocks")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function chartContainerClass(className: string) {
  return cn("min-w-0 overflow-hidden", className);
}

export function InsightsPage() {
  const navigate = useNavigate();
  const insights = useApiResource<Insights | null>("/insights", null);

  if (insights.loading) {
    return <LoadingLine label="Calculando indicadores..." />;
  }

  if (insights.error) {
    return <ResourceError message={insights.error} />;
  }

  if (!insights.data) {
    return <ResourceError message="Nao foi possivel carregar os indicadores." />;
  }

  const { totals } = insights.data;
  const movementChartData = [
    { name: "Entradas", path: "/movements", value: totals.monthlyEntries },
    { name: "Saidas", path: "/movements", value: totals.monthlyOutputs },
    { name: "Transferencias", path: "/requests", value: totals.monthlyTransfers },
    { name: "Pendencias", path: "/requests", value: totals.pendingRequests },
  ];
  const alertChartData = [
    { name: "Baixo estoque", value: totals.lowStockItems },
    { name: "Zerados", value: totals.outOfStockItems },
  ].filter((item) => item.value > 0);
  const topProductChartData = insights.data.topProducts.map((product) => ({
    name: product.code,
    path: `/products`,
    productName: product.name,
    value: product.quantityMoved,
  }));

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Inteligencia operacional</p>
        <h2 className="text-2xl font-semibold">Insights</h2>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<Boxes className="h-4 w-4" />}
          label="Almoxarifados ativos"
          value={`${totals.activeWarehouses}/${totals.warehouses}`}
        />
        <SummaryCard
          icon={<PackageCheck className="h-4 w-4" />}
          label="Produtos ativos"
          value={`${totals.activeProducts}/${totals.products}`}
        />
        <button className="text-left" onClick={scrollToAlertStocks} type="button">
          <SummaryCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Itens em alerta"
            value={formatInteger(totals.lowStockItems + totals.outOfStockItems)}
          />
        </button>
        <button className="text-left" onClick={() => navigate("/requests")} type="button">
          <SummaryCard
            icon={<ClipboardList className="h-4 w-4" />}
            label="Pendencias"
            value={formatInteger(totals.pendingRequests)}
          />
        </button>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Movimentacao e pendencias</CardTitle>
            <CardDescription>
              Clique em uma barra para abrir o fluxo relacionado.
            </CardDescription>
          </CardHeader>
          <CardContent className={chartContainerClass("h-72 min-h-72")}>
            <ResponsiveContainer height="100%" minWidth={0} width="100%">
              <BarChart data={movementChartData} margin={{ bottom: 8, left: -16, right: 8 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
                <Bar
                  cursor="pointer"
                  dataKey="value"
                  radius={[6, 6, 0, 0]}
                  onClick={(entry: { payload?: { path?: string } }) => {
                    if (entry.payload?.path) {
                      navigate(entry.payload.path);
                    }
                  }}
                >
                  {movementChartData.map((entry, index) => (
                    <Cell fill={chartColors[index % chartColors.length]} key={entry.name} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Alertas de estoque</CardTitle>
            <CardDescription>Baixo estoque e itens zerados para reposicao.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[13rem_1fr]">
            <div className={chartContainerClass("h-52 min-h-52")}>
              <ResponsiveContainer height="100%" minWidth={0} width="100%">
                <PieChart>
                  <Tooltip content={<ChartTooltip />} />
                  <Pie
                    cursor="pointer"
                    data={alertChartData.length ? alertChartData : [{ name: "Sem alerta", value: 1 }]}
                    dataKey="value"
                    innerRadius={48}
                    nameKey="name"
                    outerRadius={78}
                    paddingAngle={4}
                    onClick={scrollToAlertStocks}
                  >
                    {(alertChartData.length ? alertChartData : [{ name: "Sem alerta" }]).map(
                      (entry, index) => (
                        <Cell
                          fill={
                            alertChartData.length
                              ? index === 0
                                ? "#f59e0b"
                                : "#ef4444"
                              : "hsl(var(--muted))"
                          }
                          key={entry.name}
                        />
                      ),
                    )}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid content-center gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Baixo estoque</p>
                <p className="text-2xl font-semibold">{formatInteger(totals.lowStockItems)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Sem estoque</p>
                <p className="text-2xl font-semibold">{formatInteger(totals.outOfStockItems)}</p>
              </div>
              <Button onClick={scrollToAlertStocks} type="button" variant="outline">
                <PackagePlus className="h-4 w-4" />
                Ver reposicao
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Saldo consolidado</CardTitle>
            <CardDescription>Quantidade total acompanhada no estoque.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-xs text-muted-foreground">Itens cadastrados</p>
                <p className="text-xl font-semibold">{formatInteger(totals.stockItems)}</p>
              </div>
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-xs text-muted-foreground">Quantidade fisica</p>
                <p className="text-xl font-semibold">
                  {formatInteger(totals.stockQuantity)}
                </p>
              </div>
              <WalletCards className="h-5 w-5 text-primary" />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-xs text-muted-foreground">Valor movimentado no mes</p>
                <p className="text-xl font-semibold">
                  {formatCurrency(totals.monthlyValue)}
                </p>
              </div>
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Top produtos do mes</CardTitle>
            <CardDescription>Clique em uma barra para acessar o catalogo.</CardDescription>
          </CardHeader>
          <CardContent className={chartContainerClass("h-72 min-h-72")}>
            <ResponsiveContainer height="100%" minWidth={0} width="100%">
              <BarChart data={topProductChartData} layout="vertical" margin={{ left: 4, right: 16 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis allowDecimals={false} fontSize={12} stroke="hsl(var(--muted-foreground))" type="number" />
                <YAxis dataKey="name" fontSize={12} stroke="hsl(var(--muted-foreground))" type="category" width={72} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) {
                      return null;
                    }

                    const item = payload[0]?.payload as
                      | { productName?: string; value?: number }
                      | undefined;

                    return (
                      <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-sm">
                        <p className="font-medium">{item?.productName}</p>
                        <p className="text-muted-foreground">
                          {formatInteger(Number(item?.value ?? 0))} movimentados
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar
                  cursor="pointer"
                  dataKey="value"
                  fill="hsl(var(--primary))"
                  radius={[0, 6, 6, 0]}
                  onClick={(entry: { payload?: { path?: string } }) => {
                    if (entry.payload?.path) {
                      navigate(entry.payload.path);
                    }
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3" id="alert-stocks">
        <div>
          <h3 className="text-lg font-semibold">Itens em alerta para reposicao</h3>
          <p className="text-sm text-muted-foreground">
            Estoques baixos ou zerados com acesso rapido ao almoxarifado.
          </p>
        </div>
        <DataTable
          columns={[
            {
              cell: (stock) => (
                <>
                  <p className="font-medium">{stock.product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {stock.product.code} | {stock.product.category?.name ?? "Sem categoria"}
                  </p>
                </>
              ),
              header: "Produto",
              key: "product",
            },
            {
              cell: (stock) => stock.warehouse?.name ?? "Almoxarifado",
              header: "Almoxarifado",
              key: "warehouse",
            },
            {
              cell: (stock) => (
                <span className={cn("font-semibold", stock.state === "ZERO" && "text-destructive")}>
                  {stock.currentQuantity} / {stock.minimumQuantity}{" "}
                  {stock.product.unit?.abbreviation ?? ""}
                </span>
              ),
              header: "Saldo / minimo",
              key: "balance",
            },
            {
              cell: (stock) => (
                <Badge variant={stock.state === "ZERO" ? "zero" : "low"}>
                  {stock.state === "ZERO" ? "Sem estoque" : "Baixo"}
                </Badge>
              ),
              header: "Estado",
              key: "state",
            },
            {
              cell: (stock) => (
                <Button asChild size="sm" variant="outline">
                  <Link to={`/warehouses/${stock.warehouseId}`}>
                    <PackagePlus className="h-4 w-4" />
                    Repor
                  </Link>
                </Button>
              ),
              cellClassName: "text-right",
              header: "Acao",
              headerClassName: "text-right",
              key: "action",
            },
          ]}
          data={insights.data.alertStocks}
          emptyMessage="Nenhum item em alerta."
          getRowId={(stock) => stock.id}
          initialPageSize={5}
          searchPlaceholder="Buscar item em alerta..."
          searchText={(stock) =>
            [
              stock.product.name,
              stock.product.code,
              stock.product.category?.name,
              stock.warehouse?.name,
              stock.currentQuantity,
              stock.minimumQuantity,
              stock.state,
            ].join(" ")
          }
        />
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Almoxarifados com risco</h3>
          <p className="text-sm text-muted-foreground">
            Priorizacao por baixo estoque e itens zerados.
          </p>
        </div>
        <DataTable
          columns={[
            {
              cell: (warehouse) => (
                <>
                  <p className="font-medium">{warehouse.name}</p>
                  <p className="text-xs text-muted-foreground">{warehouse.category}</p>
                </>
              ),
              header: "Almoxarifado",
              key: "warehouse",
            },
            {
              cell: (warehouse) => (
                <Badge variant={warehouse.lowStockItems ? "low" : "outline"}>
                  {warehouse.lowStockItems}
                </Badge>
              ),
              header: "Baixo estoque",
              key: "low",
            },
            {
              cell: (warehouse) => (
                <Badge variant={warehouse.outOfStockItems ? "zero" : "outline"}>
                  {warehouse.outOfStockItems}
                </Badge>
              ),
              header: "Zerados",
              key: "zero",
            },
            {
              cell: (warehouse) => warehouse.totalItems,
              header: "Total em risco",
              key: "total",
            },
            {
              cell: (warehouse) => (
                <Button asChild size="sm" variant="outline">
                  <Link to={`/warehouses/${warehouse.warehouseId}`}>
                    Acessar
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ),
              cellClassName: "text-right",
              header: "Acao",
              headerClassName: "text-right",
              key: "action",
            },
          ]}
          data={insights.data.warehouseRisk}
          emptyMessage="Nenhum almoxarifado em risco."
          getRowId={(warehouse) => warehouse.warehouseId}
          initialPageSize={5}
          searchPlaceholder="Buscar almoxarifado..."
          searchText={(warehouse) =>
            [
              warehouse.name,
              warehouse.category,
              warehouse.lowStockItems,
              warehouse.outOfStockItems,
            ].join(" ")
          }
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold">Produtos mais movimentados</h3>
            <p className="text-sm text-muted-foreground">Top 5 do mes corrente.</p>
          </div>
          <DataTable
            columns={[
              {
                cell: (product) => (
                  <>
                    <p className="font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.code}</p>
                  </>
                ),
                header: "Produto",
                key: "product",
              },
              {
                cell: (product) => `${product.quantityMoved} ${product.unit}`,
                header: "Quantidade",
                key: "quantity",
              },
              {
                cell: (product) => (
                  <div className="flex justify-end gap-2">
                    <ProductStocksDialog product={product.product} stocks={product.stocks} />
                  </div>
                ),
                cellClassName: "text-right",
                header: "Detalhes",
                headerClassName: "text-right",
                key: "details",
              },
            ]}
            data={insights.data.topProducts}
            emptyMessage="Nenhum produto movimentado neste mes."
            getRowId={(product) => product.productId}
            initialPageSize={5}
            searchPlaceholder="Buscar produto..."
            searchText={(product) =>
              [product.name, product.code, product.quantityMoved, product.unit].join(" ")
            }
          />
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold">Notas recentes</h3>
            <p className="text-sm text-muted-foreground">Ultimas notas fiscais registradas.</p>
          </div>
          <DataTable
            columns={[
              {
                cell: (invoice) => (
                  <>
                    <p className="font-medium">{invoice.number}</p>
                    <p className="text-xs text-muted-foreground">{invoice.companyName}</p>
                  </>
                ),
                header: "Nota",
                key: "invoice",
              },
              {
                cell: (invoice) => formatDate(invoice.issueDate),
                header: "Emissao",
                key: "date",
              },
              {
                cell: (invoice) => (
                  <Badge variant={invoice.movementCount ? "success" : "outline"}>
                    {invoice.movementCount}
                  </Badge>
                ),
                header: "Mov.",
                key: "movements",
              },
              {
                cell: (invoice) => (
                  <div className="flex justify-end gap-2">
                    <InvoiceMovementsDialog invoice={invoice} />
                    <Button asChild aria-label={`Abrir nota ${invoice.number}`} size="icon" variant="outline">
                      <Link to={`/invoices?invoiceId=${invoice.id}`}>
                        <FileSearch className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ),
                cellClassName: "text-right",
                header: "Detalhes",
                headerClassName: "text-right",
                key: "details",
              },
            ]}
            data={insights.data.recentInvoices}
            emptyMessage="Nenhuma nota fiscal recente."
            getRowId={(invoice) => invoice.id}
            initialPageSize={5}
            searchPlaceholder="Buscar nota recente..."
            searchText={(invoice) =>
              [invoice.number, invoice.companyName, formatDate(invoice.issueDate)].join(" ")
            }
          />
        </section>
      </div>
    </section>
  );
}
