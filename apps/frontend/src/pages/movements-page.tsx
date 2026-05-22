import { useMemo, useState } from "react";
import { LoadingLine, ResourceError } from "@/components/domain/feedback";
import { Badge } from "@/components/ui/badge";
import { FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/ui/search-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApiResource } from "@/lib/api";
import type { Movement, MovementType, Product, Warehouse } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export const movementLabels: Record<MovementType, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saida",
  TRANSFERENCIA_ENTRADA: "Transferencia recebida",
  TRANSFERENCIA_SAIDA: "Transferencia enviada",
};

export function MovementsTable({ movements }: { movements: Movement[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Produto</TableHead>
          <TableHead>Almoxarifado</TableHead>
          <TableHead>Origem / destino</TableHead>
          <TableHead>Quantidade</TableHead>
          <TableHead>Valor unitario</TableHead>
          <TableHead>Valor total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {movements.map((movement) => {
          const unitPrice =
            movement.unitPrice === null || movement.unitPrice === undefined
              ? null
              : Number(movement.unitPrice);

          return (
            <TableRow key={movement.id}>
              <TableCell>{formatDate(movement.movementDate)}</TableCell>
              <TableCell>
                <Badge variant={movement.type.includes("ENTRADA") ? "success" : "outline"}>
                  {movementLabels[movement.type]}
                </Badge>
              </TableCell>
              <TableCell>
                <p className="font-medium">{movement.product.name}</p>
                <p className="text-xs text-muted-foreground">{movement.product.code}</p>
              </TableCell>
              <TableCell>{movement.warehouse.name}</TableCell>
              <TableCell>
                {movement.sourceWarehouse?.name ?? "-"} /{" "}
                {movement.destinationWarehouse?.name ?? movement.destinationNote ?? "-"}
              </TableCell>
              <TableCell>
                {movement.quantity} {movement.product.unit.abbreviation}
              </TableCell>
              <TableCell>
                {unitPrice === null || Number.isNaN(unitPrice)
                  ? "-"
                  : formatCurrency(unitPrice)}
              </TableCell>
              <TableCell>
                {unitPrice === null || Number.isNaN(unitPrice)
                  ? "-"
                  : formatCurrency(unitPrice * movement.quantity)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
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
