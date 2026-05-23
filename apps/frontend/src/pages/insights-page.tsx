import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  PackageCheck,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { DataTable } from "@/components/domain/data-table";
import { LoadingLine, ResourceError } from "@/components/domain/feedback";
import { SummaryCard } from "@/components/domain/summary-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/lib/api";
import type { Insights } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

const integerFormatter = new Intl.NumberFormat("pt-BR");

function formatInteger(value: number) {
  return integerFormatter.format(value);
}

export function InsightsPage() {
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
        <SummaryCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Itens em alerta"
          value={formatInteger(totals.lowStockItems + totals.outOfStockItems)}
        />
        <SummaryCard
          icon={<ClipboardList className="h-4 w-4" />}
          label="Pendencias"
          value={formatInteger(totals.pendingRequests)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Movimentacao do mes</CardTitle>
            <CardDescription>Entradas, saidas, transferencias e valor movimentado.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="mt-1 text-xl font-semibold">
                {formatInteger(totals.monthlyMovements)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Entradas</p>
              <p className="mt-1 text-xl font-semibold text-emerald-700">
                {formatInteger(totals.monthlyEntries)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Saidas</p>
              <p className="mt-1 text-xl font-semibold text-rose-700">
                {formatInteger(totals.monthlyOutputs)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Valor</p>
              <p className="mt-1 text-xl font-semibold">
                {formatCurrency(totals.monthlyValue)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saldo consolidado</CardTitle>
            <CardDescription>Quantidade total acompanhada no estoque.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>
      </div>

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
