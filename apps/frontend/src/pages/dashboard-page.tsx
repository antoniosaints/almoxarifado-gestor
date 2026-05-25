import { AlertTriangle, ArrowRight, Boxes, PackageCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { LoadingLine, ResourceError } from "@/components/domain/feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useApiResource } from "@/lib/api";
import type { Warehouse } from "@/lib/types";
import { formatDate } from "@/lib/utils";

function WarehouseFacts({ warehouse }: { warehouse: Warehouse }) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-3">
      <div>
        <dt className="text-muted-foreground">Produtos em estoque</dt>
        <dd className="text-lg font-semibold">{warehouse.summary.stockedProducts}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Produtos em baixo estoque</dt>
        <dd className="text-lg font-semibold">{warehouse.summary.lowStockItems}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Ultima movimentacao</dt>
        <dd className="font-medium">{formatDate(warehouse.summary.lastMovementAt)}</dd>
      </div>
    </dl>
  );
}

export function DashboardContent({ warehouses }: { warehouses: Warehouse[] }) {
  const generalWarehouse = warehouses.find((warehouse) => warehouse.isGeneral);
  const regularWarehouses = warehouses.filter((warehouse) => !warehouse.isGeneral);
  const groups = regularWarehouses.reduce((map, warehouse) => {
    const category = warehouse.category?.name ?? "Sem categoria";
    const categoryWarehouses = map.get(category) ?? [];
    categoryWarehouses.push(warehouse);
    map.set(category, categoryWarehouses);
    return map;
  }, new Map<string, Warehouse[]>());

  return (
    <div className="space-y-6">
      {generalWarehouse ? (
        <article aria-label={generalWarehouse.name}>
          <Card className="overflow-hidden border-primary/30 bg-card">
            <CardHeader className="gap-4 p-6 md:flex md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Geral</Badge>
                  <Badge variant="outline">{generalWarehouse.category.name}</Badge>
                </div>
                <div>
                  <CardTitle className="text-2xl">{generalWarehouse.name}</CardTitle>
                  <CardDescription className="mt-1 max-w-2xl">
                    Base principal para reposição e transferência aos demais almoxarifados.
                  </CardDescription>
                </div>
              </div>
              <Button asChild>
                <Link to={`/warehouses/${generalWarehouse.id}`}>
                  <Boxes className="h-4 w-4" />
                  Acessar almoxarifado
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="grid gap-5 px-6 pb-6 md:grid-cols-[1fr_auto] md:items-end">
              <WarehouseFacts warehouse={generalWarehouse} />
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
                  <PackageCheck className="mb-2 h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                  <p className="text-xs text-emerald-900 dark:text-emerald-200">Sem estoque</p>
                  <p className="text-xl font-semibold">
                    {generalWarehouse.summary.outOfStockItems}
                  </p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                  <AlertTriangle className="mb-2 h-4 w-4 text-amber-700 dark:text-amber-300" />
                  <p className="text-xs text-amber-900 dark:text-amber-200">Alertas</p>
                  <p className="text-xl font-semibold">
                    {generalWarehouse.summary.lowStockItems}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </article>
      ) : null}

      {[...groups.entries()].map(([category, groupedWarehouses]) => (
        <section className="space-y-3" key={category}>
          <div>
            <h2 className="text-lg font-semibold">{category}</h2>
            <p className="text-sm text-muted-foreground">
              Almoxarifados desta área para operação diaria.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {groupedWarehouses.map((warehouse) => (
              <article aria-label={warehouse.name} key={warehouse.id}>
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant="outline">{warehouse.category.name}</Badge>
                      <Badge variant={warehouse.active ? "success" : "zero"}>
                        {warehouse.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <CardTitle>{warehouse.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <WarehouseFacts warehouse={warehouse} />
                    <Button asChild className="w-full" variant="outline">
                      <Link to={`/warehouses/${warehouse.id}`}>
                        Acessar almoxarifado
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const warehouses = useApiResource<Warehouse[]>("/warehouses", []);

  if (warehouses.loading) {
    return <LoadingLine label="Carregando almoxarifados..." />;
  }

  if (warehouses.error) {
    return <ResourceError message={warehouses.error} />;
  }

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">Painel inicial</p>
        <h2 className="text-2xl font-semibold">Almoxarifados da prefeitura</h2>
      </div>
      <DashboardContent warehouses={warehouses.data} />
    </section>
  );
}
