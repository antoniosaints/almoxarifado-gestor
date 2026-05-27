import { Eye, FileDown, FileText, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "@/components/domain/data-table";
import { LoadingLine, ResourceError } from "@/components/domain/feedback";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/ui/search-select";
import { api, apiFile, useApiResource } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Movement, MovementType, Product, Warehouse } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

export const movementLabels: Record<MovementType, string> = {
  ENTRADA: "Entrada",
  SAIDA: "Saída",
  TRANSFERENCIA_ENTRADA: "Transferência recebida",
  TRANSFERENCIA_SAIDA: "Transferência enviada",
};

function movementUnitPrice(movement: Movement) {
  const unitPrice =
    movement.unitPrice === null || movement.unitPrice === undefined
      ? null
      : Number(movement.unitPrice);

  return unitPrice === null || Number.isNaN(unitPrice) ? null : unitPrice;
}

function movementTotalValue(movement: Movement) {
  const unitPrice = movementUnitPrice(movement);

  return unitPrice === null ? null : unitPrice * movement.quantity;
}

function movementAuditFileName(movement: Movement) {
  return `movimentacao-${movement.id}.pdf`;
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{value || "-"}</p>
    </div>
  );
}

function MovementDetailsDialog({
  movement,
  onOpenChange,
}: {
  movement: Movement | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function exportPdf() {
    if (!movement) {
      return;
    }

    setExporting(true);
    setMessage(null);

    try {
      const blob = await apiFile(`/reports/movements/${movement.id}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = movementAuditFileName(movement);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao exportar auditoria.",
      );
    } finally {
      setExporting(false);
    }
  }

  const unitPrice = movement ? movementUnitPrice(movement) : null;
  const totalValue = movement ? movementTotalValue(movement) : null;

  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(movement)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Auditoria da movimentação</DialogTitle>
          <DialogDescription>
            Detalhes completos da operação registrada no estoque.
          </DialogDescription>
        </DialogHeader>
        {movement ? (
          <div className="space-y-4">
            {message ? <ResourceError message={message} /> : null}
            <div className="flex justify-end">
              <Button disabled={exporting} onClick={exportPdf} type="button">
                <FileDown className="h-4 w-4" />
                {exporting ? "Exportando..." : "Exportar PDF"}
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem label="Tipo" value={movementLabels[movement.type]} />
              <DetailItem label="Data e hora" value={formatDate(movement.movementDate)} />
              <DetailItem
                label="Operado por"
                value={movement.responsibleUser?.name ?? "-"}
              />
              <DetailItem label="Produto" value={`${movement.product.code} - ${movement.product.name}`} />
              <DetailItem label="Almoxarifado" value={movement.warehouse.name} />
              <DetailItem label="Origem" value={movement.sourceWarehouse?.name ?? "-"} />
              <DetailItem
                label="Destino"
                value={
                  movement.destinationWarehouse?.name ??
                  movement.destinationNote ??
                  "-"
                }
              />
              <DetailItem
                label="Quantidade"
                value={`${movement.quantity} ${movement.product.unit.abbreviation}`}
              />
              <DetailItem
                label="Valor unitário"
                value={unitPrice === null ? "-" : formatCurrency(unitPrice)}
              />
              <DetailItem
                label="Valor total"
                value={totalValue === null ? "-" : formatCurrency(totalValue)}
              />
              <DetailItem
                label="Nota"
                value={
                  movement.invoice
                    ? `${movement.invoice.number} - ${
                        movement.invoice.supplier?.name ??
                        movement.invoice.companyName
                      }`
                    : "-"
                }
              />
              <DetailItem label="Observação" value={movement.observation ?? "-"} />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function MovementsTable({
  deletingMovementId = null,
  movements,
  onDeleteMovement,
  showInvoiceAction = false,
}: {
  deletingMovementId?: string | null;
  movements: Movement[];
  onDeleteMovement?: (movement: Movement) => void;
  showInvoiceAction?: boolean;
}) {
  const [movementToView, setMovementToView] = useState<Movement | null>(null);

  return (
    <>
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
          cell: (movement) => movement.responsibleUser?.name ?? "-",
          header: "Operado por",
          key: "responsible",
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
            const unitPrice = movementUnitPrice(movement);

            return unitPrice === null ? "-" : formatCurrency(unitPrice);
          },
          header: "Valor unitário",
          key: "unit-price",
        },
        {
          cell: (movement) => {
            const totalValue = movementTotalValue(movement);

            return totalValue === null ? "-" : formatCurrency(totalValue);
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
        {
          cell: (movement: Movement) => (
            <Button
              aria-label={`Visualizar movimentação de ${movement.product.name}`}
              onClick={() => setMovementToView(movement)}
              size="icon"
              type="button"
              variant="outline"
            >
              <Eye className="h-4 w-4" />
            </Button>
          ),
          cellClassName: "text-right",
          header: "Auditoria",
          headerClassName: "text-right",
          key: "view-action",
        },
        ...(onDeleteMovement
          ? [
              {
                cell: (movement: Movement) => (
                  <Button
                    aria-label={`Excluir movimentação de ${movement.product.name}`}
                    disabled={deletingMovementId === movement.id}
                    onClick={() => onDeleteMovement(movement)}
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                ),
                cellClassName: "text-right",
                header: "Ações",
                headerClassName: "text-right",
                key: "delete-action",
              },
            ]
          : []),
      ]}
      data={movements}
      emptyMessage="Nenhuma movimentação encontrada."
      getRowId={(movement) => movement.id}
      searchPlaceholder="Buscar movimentação..."
      searchText={(movement) =>
        [
          formatDate(movement.movementDate),
          movementLabels[movement.type],
          movement.product.name,
          movement.product.code,
          movement.product.unit.abbreviation,
          movement.responsibleUser?.name,
          movement.warehouse.name,
          movement.sourceWarehouse?.name,
          movement.destinationWarehouse?.name,
          movement.destinationNote,
          movement.observation,
          movement.quantity,
        ].join(" ")
      }
    />
      <MovementDetailsDialog
        movement={movementToView}
        onOpenChange={(open) => {
          if (!open) {
            setMovementToView(null);
          }
        }}
      />
    </>
  );
}

export function MovementsPage() {
  const { session } = useSession();
  const warehouses = useApiResource<Warehouse[]>("/warehouses", []);
  const products = useApiResource<Product[]>("/products", []);
  const [warehouseId, setWarehouseId] = useState("");
  const [productId, setProductId] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [movementToDelete, setMovementToDelete] = useState<Movement | null>(null);
  const [deletingMovementId, setDeletingMovementId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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
  const canDeleteMovements = session?.user.role === "ADMIN";

  async function deleteMovement() {
    if (!movementToDelete) {
      return;
    }

    setDeletingMovementId(movementToDelete.id);
    setActionError(null);
    setActionMessage(null);

    try {
      await api(`/movements/${movementToDelete.id}`, { method: "DELETE" });
      movements.setData((current) =>
        current.filter((movement) => movement.id !== movementToDelete.id),
      );
      setActionMessage("Movimentação excluída.");
      setMovementToDelete(null);
    } catch (caughtError) {
      setActionError(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao excluir movimentação.",
      );
    } finally {
      setDeletingMovementId(null);
    }
  }

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
        <h2 className="text-2xl font-semibold">Movimentações</h2>
      </div>
      {actionMessage ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950">
          <AlertTitle>Pronto</AlertTitle>
          <AlertDescription className="text-emerald-900">
            {actionMessage}
          </AlertDescription>
        </Alert>
      ) : null}
      {actionError ? <ResourceError message={actionError} /> : null}
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
          <Label htmlFor="movement-to">Até</Label>
          <Input id="movement-to" onChange={(event) => setTo(event.target.value)} type="date" value={to} />
        </FormField>
      </div>
      <MovementsTable
        deletingMovementId={deletingMovementId}
        movements={movements.data}
        onDeleteMovement={canDeleteMovements ? setMovementToDelete : undefined}
      />

      <Dialog
        onOpenChange={(open) => {
          if (!open && !deletingMovementId) {
            setMovementToDelete(null);
          }
        }}
        open={Boolean(movementToDelete)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir movimentação</DialogTitle>
            <DialogDescription>
              Esta movimentação sera removida do histórico do estoque.
            </DialogDescription>
          </DialogHeader>
          {movementToDelete ? (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{movementToDelete.product.name}</p>
              <p className="text-muted-foreground">
                {movementLabels[movementToDelete.type]} em{" "}
                {movementToDelete.warehouse.name} no dia{" "}
                {formatDate(movementToDelete.movementDate)}
              </p>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              disabled={Boolean(deletingMovementId)}
              onClick={() => setMovementToDelete(null)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              disabled={Boolean(deletingMovementId)}
              onClick={deleteMovement}
              type="button"
              variant="destructive"
            >
              {deletingMovementId ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
