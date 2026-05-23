import { FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "@/components/domain/data-table";
import { LoadingLine, ResourceError } from "@/components/domain/feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/ui/search-select";
import { useApiResource } from "@/lib/api";
import type { Movement, MovementType, Product, Warehouse } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export const movementLabels: Record<MovementType, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saida",
  TRANSFERENCIA_ENTRADA: "Transferencia recebida",
  TRANSFERENCIA_SAIDA: "Transferencia enviada",
};

export function MovementsTable({
  movements,
  showInvoiceAction = false,
}: {
  movements: Movement[];
  showInvoiceAction?: boolean;
}) {
  return (
    <DataTable
      columns={[
        {
          cell: (movement) => formatDate(movement.movementDate),
          header: "Data",
          key: "date",
        },
        {
          cell: (movement) => (
            <Badge variant={movement.type.includes("ENTRADA") ? "success" : "outline"}>
              {movementLabels[movement.type]}
            </Badge>
          ),
          header: "Tipo",
          key: "type",
        },
        {
          cell: (movement) => (
            <>
              <p className="font-medium">{movement.product.name}</p>
              <p className="text-xs text-muted-foreground">{movement.product.code}</p>
            </>
          ),
          header: "Produto",
          key: "product",
        },
        {
          cell: (movement) => movement.warehouse.name,
          header: "Almoxarifado",
          key: "warehouse",
        },
        {
          cell: (movement) =>
            `${movement.sourceWarehouse?.name ?? "-"} / ${
              movement.destinationWarehouse?.name ?? movement.destinationNote ?? "-"
            }`,
          header: "Origem / destino",
          key: "source-destination",
        },
        {
          cell: (movement) =>
            `${movement.quantity} ${movement.product.unit.abbreviation}`,
          header: "Quantidade",
          key: "quantity",
        },
        {
          cell: (movement) => {
            const unitPrice =
              movement.unitPrice === null || movement.unitPrice === undefined
                ? null
                : Number(movement.unitPrice);

            return unitPrice === null || Number.isNaN(unitPrice)
              ? "-"
              : formatCurrency(unitPrice);
          },
          header: "Valor unitario",
          key: "unit-price",
        },
        {
          cell: (movement) => {
            const unitPrice =
              movement.unitPrice === null || movement.unitPrice === undefined
                ? null
                : Number(movement.unitPrice);

            return unitPrice === null || Number.isNaN(unitPrice)
              ? "-"
              : formatCurrency(unitPrice * movement.quantity);
          },
          header: "Valor total",
          key: "total",
        },
        ...(showInvoiceAction
          ? [
              {
                cell: (movement: Movement) =>
                  movement.invoiceId ? (
                    <Button asChild size="sm" variant="outline">
                      <Link
                        aria-label={`Abrir nota ${
                          movement.invoice?.number ?? "fiscal"
                        }`}
                        to={`/invoices?invoiceId=${movement.invoiceId}`}
                      >
                        <FileText className="h-4 w-4" />
                        NF
                      </Link>
                    </Button>
                  ) : (
                    "-"
                  ),
                cellClassName: "text-right",
                header: "NF",
                headerClassName: "text-right",
                key: "invoice-action",
              },
            ]
          : []),
      ]}
      data={movements}
      emptyMessage="Nenhuma movimentacao encontrada."
      getRowId={(movement) => movement.id}
      searchPlaceholder="Buscar movimentacao..."
      searchText={(movement) =>
        [
          formatDate(movement.movementDate),
          movementLabels[movement.type],
          movement.product.name,
          movement.product.code,
          movement.product.unit.abbreviation,
          movement.warehouse.name,
          movement.sourceWarehouse?.name,
          movement.destinationWarehouse?.name,
          movement.destinationNote,
          movement.observation,
          movement.quantity,
        ].join(" ")
      }
    />
  );
}

export function MovementsPage() {
  const warehouses = useApiResource<Warehouse[]>("/warehouses", []);
  const products = useApiResource<Product[]>("/products", []);
  const [warehouseId, setWarehouseId] = useState("");
  const [productId, setProductId] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (warehouseId) params.set("warehouseId", warehouseId);
    if (productId) params.set("productId", productId);
    if (type) params.set("type", type);
    if (from) params.set("from", from);
    if (to) params.set("to", `${to}T23:59:59.999`);
    const query = params.toString();
    return query ? `/movements?${query}` : "/movements";
  }, [from, productId, to, type, warehouseId]);

  const movements = useApiResource<Movement[]>(path, []);

  if (warehouses.loading || products.loading || movements.loading) {
    return <LoadingLine />;
  }

  if (warehouses.error || products.error || movements.error) {
    return (
      <ResourceError
        message={warehouses.error ?? products.error ?? movements.error ?? ""}
      />
    );
  }

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">Auditoria</p>
        <h2 className="text-2xl font-semibold">Movimentacoes</h2>
      </div>
      <div className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-2 xl:grid-cols-5">
        <FormField>
          <Label htmlFor="movement-warehouse">Almoxarifado</Label>
          <SearchSelect
            ariaLabel="Filtrar almoxarifado"
            id="movement-warehouse"
            onValueChange={setWarehouseId}
            options={[
              { label: "Todos", value: "" },
              ...warehouses.data.map((warehouse) => ({
                label: warehouse.name,
                searchText: warehouse.category.name,
                value: warehouse.id,
              })),
            ]}
            placeholder="Todos"
            value={warehouseId}
          />
        </FormField>
        <FormField>
          <Label htmlFor="movement-product">Produto</Label>
          <SearchSelect
            ariaLabel="Filtrar produto"
            id="movement-product"
            onValueChange={setProductId}
            options={[
              { label: "Todos", value: "" },
              ...products.data.map((product) => ({
                label: `${product.code} - ${product.name}`,
                searchText: product.category.name,
                value: product.id,
              })),
            ]}
            placeholder="Todos"
            value={productId}
          />
        </FormField>
        <FormField>
          <Label htmlFor="movement-type">Tipo</Label>
          <SearchSelect
            ariaLabel="Filtrar tipo"
            id="movement-type"
            onValueChange={setType}
            options={[
              { label: "Todos", value: "" },
              ...Object.entries(movementLabels).map(([value, label]) => ({
                label,
                value,
              })),
            ]}
            placeholder="Todos"
            value={type}
          />
        </FormField>
        <FormField>
          <Label htmlFor="movement-from">De</Label>
          <Input id="movement-from" onChange={(event) => setFrom(event.target.value)} type="date" value={from} />
        </FormField>
        <FormField>
          <Label htmlFor="movement-to">Ate</Label>
          <Input id="movement-to" onChange={(event) => setTo(event.target.value)} type="date" value={to} />
        </FormField>
      </div>
      <MovementsTable movements={movements.data} />
    </section>
  );
}
