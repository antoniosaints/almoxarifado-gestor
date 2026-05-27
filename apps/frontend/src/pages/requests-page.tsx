import {
  ArrowRightLeft,
  Building2,
  Check,
  FileDown,
  FileText,
  PackagePlus,
  Plus,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
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
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/ui/search-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, apiFile, useApiResource } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/assets";
import { useSession } from "@/lib/session";
import type {
  EntryRequest,
  Invoice,
  OfficeLetter,
  Product,
  TransferRequest,
  Warehouse as WarehouseType,
} from "@/lib/types";
import { formatDate, todayInputValue } from "@/lib/utils";

function StatusBadge({ status }: { status: string }) {
  const label = {
    APPROVED: "Aprovada",
    CANCELLED: "Cancelada",
    PENDING: "Pendente",
    PENDING_RECEIPT: "Aguardando recebimento",
    RECEIVED: "Recebida",
    REJECTED: "Rejeitada",
  }[status];

  return (
    <Badge
      variant={
        status === "APPROVED" || status === "RECEIVED"
          ? "success"
          : status === "REJECTED" || status === "CANCELLED"
            ? "zero"
            : "low"
      }
    >
      {label ?? status}
    </Badge>
  );
}

type EntryRequestItemDraft = {
  id: string;
  productId: string;
  quantity: string;
};

type ApprovalItemPayload = {
  id?: string;
  productId: string;
  quantity: number;
};

function createEntryRequestItemDraft(
  productId = "",
  quantity = "1",
): EntryRequestItemDraft {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    productId,
    quantity,
  };
}

function entryRequestItems(request: EntryRequest) {
  return request.items?.length
    ? request.items
    : [
        {
          id: request.id,
          product: request.product,
          productId: request.product.id,
          quantity: request.quantity,
        },
      ];
}

function entryRequestProductSummary(request: EntryRequest) {
  const items = entryRequestItems(request);
  const firstItem = items[0];

  if (!firstItem) {
    return request.product.name;
  }

  return items.length === 1
    ? firstItem.product.name
    : `${firstItem.product.name} + ${items.length - 1} item(ns)`;
}

function entryRequestQuantitySummary(request: EntryRequest) {
  return entryRequestItems(request)
    .map(
      (item) =>
        `${item.quantity} ${item.product.unit.abbreviation} ${item.product.name}`,
    )
    .join(", ");
}

function OfficeLetterDialog({ request }: { request: EntryRequest }) {
  const [open, setOpen] = useState(false);
  const [letter, setLetter] = useState<OfficeLetter | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logoUrl = resolveAssetUrl(letter?.header.logoUrl);

  async function openDialog() {
    setOpen(true);

    if (letter || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setLetter(
        await api<OfficeLetter>(`/entry-requests/${request.id}/office-letter`),
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao carregar oficio.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function exportPdf() {
    setExportingPdf(true);
    setError(null);

    try {
      const blob = await apiFile(
        `/entry-requests/${request.id}/office-letter/pdf`,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const suffix =
        letter?.numberFormatted.replace(/[^\d]+/g, "-").replace(/^-|-$/g, "") ??
        request.id;

      link.href = url;
      link.download = `oficio-${suffix}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao exportar o PDF.",
      );
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <>
      <Button onClick={() => void openDialog()} size="sm" variant="outline">
        <FileText className="h-4 w-4" />
        Ver oficio
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Oficio da solicitacao</DialogTitle>
            <DialogDescription>
              {request.warehouse.name} - {entryRequestProductSummary(request)}
            </DialogDescription>
          </DialogHeader>

          {loading ? <LoadingLine /> : null}
          {error ? <ResourceError message={error} /> : null}
          {letter ? (
            <article className="space-y-6 rounded-md border bg-background p-5 text-sm">
              <header className="flex items-center gap-3 border-b pb-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted">
                  {logoUrl ? (
                    <img
                      alt=""
                      className="h-full w-full object-contain"
                      src={logoUrl}
                    />
                  ) : (
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold">{letter.header.title}</p>
                  <p className="text-muted-foreground">{letter.header.subtitle}</p>
                </div>
              </header>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">OFICIO Nº {letter.numberFormatted}</p>
                <p className="text-muted-foreground">{letter.subject}</p>
              </div>
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: letter.contentHtml }}
              />
            </article>
          ) : null}
          {letter ? (
            <div className="flex justify-end border-t pt-4">
              <Button onClick={() => void exportPdf()} disabled={exportingPdf}>
                <FileDown className="h-4 w-4" />
                {exportingPdf ? "Exportando..." : "Exportar PDF"}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ApprovalDialog({
  invoices,
  onApprove,
  request,
  warehouses,
}: {
  invoices: Invoice[];
  onApprove: (
    requestId: string,
    invoiceId: string | undefined,
    items: ApprovalItemPayload[],
  ) => Promise<void>;
  request: EntryRequest;
  warehouses: WarehouseType[];
}) {
  const [invoiceId, setInvoiceId] = useState("");
  const [open, setOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const items = entryRequestItems(request);
  const approvalItems = items.map((item) => {
    const quantity = Number.parseInt(quantities[item.id] ?? String(item.quantity), 10);

    return {
      id: item.id,
      productId: item.productId,
      quantity,
    };
  });
  const canApprove = approvalItems.every(
    (item) => Number.isInteger(item.quantity) && item.quantity > 0,
  );
  const sourceWarehouse = warehouses.find((warehouse) => warehouse.isGeneral);
  const destinationWarehouse = warehouses.find(
    (warehouse) => warehouse.id === request.warehouse.id,
  );

  useEffect(() => {
    if (open) {
      setQuantities(
        Object.fromEntries(
          entryRequestItems(request).map((item) => [item.id, String(item.quantity)]),
        ),
      );
    }
  }, [open, request]);

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        <Check className="h-4 w-4" />
        Aprovar
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar entrada</DialogTitle>
            <DialogDescription>
              {entryRequestProductSummary(request)} para {request.warehouse.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              {items.map((item, index) => {
                const quantity = quantities[item.id] ?? String(item.quantity);
                const approvedQuantity = Number.parseInt(quantity, 10);
                const summaryQuantity =
                  Number.isInteger(approvedQuantity) && approvedQuantity > 0
                    ? approvedQuantity
                    : item.quantity;
                const sourceStock = sourceWarehouse?.stocks.find(
                  (stock) => stock.productId === item.productId,
                );
                const destinationStock = destinationWarehouse?.stocks.find(
                  (stock) => stock.productId === item.productId,
                );
                const sourceBefore = sourceStock?.currentQuantity ?? 0;
                const destinationBefore = destinationStock?.currentQuantity ?? 0;
                const sourceAfter = sourceBefore - summaryQuantity;
                const destinationAfter = destinationBefore + summaryQuantity;

                return (
                  <div
                    className="grid gap-4 rounded-md border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_10rem]"
                    key={item.id}
                  >
                    <div className="min-w-0 space-y-2">
                      <div>
                        <p className="truncate text-sm font-medium">
                          {item.product.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Solicitado: {item.quantity}{" "}
                          {item.product.unit.abbreviation}
                        </p>
                      </div>
                      <div className="rounded-md border bg-background p-3 text-sm">
                        <p>
                          Estoque geral: {sourceBefore}{" "}
                          {item.product.unit.abbreviation}
                        </p>
                        <p>
                          Após aprovar: {sourceAfter}{" "}
                          {item.product.unit.abbreviation}
                        </p>
                        <p>
                          Destino atual: {destinationBefore}{" "}
                          {item.product.unit.abbreviation}
                        </p>
                        <p>
                          Destino após entrada: {destinationAfter}{" "}
                          {item.product.unit.abbreviation}
                        </p>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`quantity-${request.id}-${item.id}`}>
                        {items.length === 1
                          ? "Quantidade aprovada"
                          : `Quantidade aprovada ${index + 1}`}
                      </Label>
                      <Input
                        id={`quantity-${request.id}-${item.id}`}
                        min="1"
                        onChange={(event) =>
                          setQuantities((current) => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                        type="number"
                        value={quantity}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div>
              <Label htmlFor={`invoice-${request.id}`}>Nota fiscal opcional</Label>
              <SearchSelect
                ariaLabel="Nota fiscal opcional"
                id={`invoice-${request.id}`}
                onValueChange={setInvoiceId}
                options={[
                  { label: "Sem nota vinculada", value: "" },
                  ...invoices.map((invoice) => ({
                    label: `${invoice.number} - ${invoice.companyName}`,
                    searchText: invoice.cnpj,
                    value: invoice.id,
                  })),
                ]}
                placeholder="Sem nota vinculada"
                value={invoiceId}
              />
            </div>
            <Button
              disabled={!canApprove}
              onClick={() => {
                void onApprove(
                  request.id,
                  invoiceId || undefined,
                  approvalItems,
                ).then(() => setOpen(false));
              }}
            >
              Confirmar aprovação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReceiveDialog({
  onReceive,
  request,
}: {
  onReceive: (requestId: string) => Promise<void>;
  request: TransferRequest;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        <PackagePlus className="h-4 w-4" />
        Confirmar recebimento
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar recebimento</DialogTitle>
            <DialogDescription>
              {request.quantity} {request.product.unit.abbreviation} de{" "}
              {request.product.name}
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={() => {
              void onReceive(request.id).then(() => setOpen(false));
            }}
          >
            Confirmar recebimento
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DirectEntryRequestDialog({
  onCreated,
  warehouses,
}: {
  onCreated: () => Promise<void>;
  warehouses: WarehouseType[];
}) {
  const [open, setOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<EntryRequestItemDraft[]>([
    createEntryRequestItemDraft(),
  ]);
  const [movementDate, setMovementDate] = useState(todayInputValue());
  const [observation, setObservation] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const availableWarehouses = warehouses.filter((warehouse) => !warehouse.isGeneral);
  const validItems = items
    .map((item) => ({
      productId: item.productId,
      quantity: Number.parseInt(item.quantity, 10),
    }))
    .filter(
      (item) =>
        item.productId &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0,
    );

  useEffect(() => {
    if (!open) {
      return;
    }

    const firstWarehouse = availableWarehouses[0]?.id ?? "";

    setWarehouseId((current) => current || firstWarehouse);
  }, [availableWarehouses, open]);

  useEffect(() => {
    if (!open || !warehouseId) {
      setProducts([]);
      setItems([createEntryRequestItemDraft()]);
      return;
    }

    let ignore = false;

    async function loadProducts() {
      setLoadingProducts(true);
      setMessage(null);

      try {
        const params = new URLSearchParams({ warehouseId });
        const nextProducts = await api<Product[]>(
          `/entry-requests/available-products?${params.toString()}`,
        );

        if (!ignore) {
          setProducts(nextProducts);
          setItems((current) =>
            current.map((item, index) => ({
              ...item,
              productId: nextProducts.some(
                (product) => product.id === item.productId,
              )
                ? item.productId
                : index === 0
                  ? nextProducts[0]?.id ?? ""
                  : "",
            })),
          );
        }
      } catch (caughtError) {
        if (!ignore) {
          setMessage(
            caughtError instanceof Error
              ? caughtError.message
              : "Falha ao carregar produtos.",
          );
        }
      } finally {
        if (!ignore) {
          setLoadingProducts(false);
        }
      }
    }

    void loadProducts();

    return () => {
      ignore = true;
    };
  }, [open, warehouseId]);

  function openDialog() {
    setMessage(null);
    setItems([createEntryRequestItemDraft(products[0]?.id ?? "")]);
    setMovementDate(todayInputValue());
    setObservation("");
    setOpen(true);
  }

  function updateItem(
    itemId: string,
    field: "productId" | "quantity",
    value: string,
  ) {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
  }

  function addItem() {
    setItems((current) => [
      ...current,
      createEntryRequestItemDraft(products[0]?.id ?? ""),
    ]);
  }

  function removeItem(itemId: string) {
    setItems((current) =>
      current.length > 1
        ? current.filter((item) => item.id !== itemId)
        : current,
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validItems.length) {
      setMessage("Informe ao menos um produto com quantidade maior que zero.");
      return;
    }

    const primaryItem = validItems[0];

    setSaving(true);
    setMessage(null);

    try {
      await api("/entry-requests", {
        body: JSON.stringify({
          items: validItems,
          movementDate,
          observation,
          productId: primaryItem.productId,
          quantity: primaryItem.quantity,
          warehouseId,
        }),
        method: "POST",
      });
      await onCreated();
      setOpen(false);
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao enviar solicitação.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button disabled={!availableWarehouses.length} onClick={openDialog} type="button">
        <PackagePlus className="h-4 w-4" />
        Solicitar
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Solicitar entrada</DialogTitle>
            <DialogDescription>
              Informe o almoxarifado de destino antes de escolher o produto.
            </DialogDescription>
          </DialogHeader>
          <Form onSubmit={submit}>
            {message ? <ResourceError message={message} /> : null}
            <FormField>
              <Label htmlFor="request-warehouse">Almoxarifado destino</Label>
              <SearchSelect
                ariaLabel="Almoxarifado destino"
                id="request-warehouse"
                onValueChange={(nextWarehouseId) => {
                  setWarehouseId(nextWarehouseId);
                  setItems([createEntryRequestItemDraft()]);
                }}
                options={availableWarehouses.map((warehouse) => ({
                  label: warehouse.name,
                  searchText: warehouse.category.name,
                  value: warehouse.id,
                }))}
                placeholder="Selecione"
                value={warehouseId}
              />
            </FormField>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  className="grid gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto]"
                  key={item.id}
                >
                  <FormField>
                    <Label htmlFor={`request-product-${item.id}`}>
                      {items.length === 1 ? "Produto" : `Produto ${index + 1}`}
                    </Label>
                    <SearchSelect
                      ariaLabel={
                        items.length === 1 ? "Produto" : `Produto ${index + 1}`
                      }
                      disabled={!warehouseId || loadingProducts}
                      emptyMessage={
                        loadingProducts
                          ? "Carregando produtos..."
                          : "Nenhum produto disponível."
                      }
                      id={`request-product-${item.id}`}
                      onValueChange={(value) =>
                        updateItem(item.id, "productId", value)
                      }
                      options={products.map((product) => ({
                        label: `${product.code} - ${product.name}`,
                        searchText: `${product.category.name} ${product.unit.abbreviation}`,
                        value: product.id,
                      }))}
                      placeholder={loadingProducts ? "Carregando..." : "Selecione"}
                      value={item.productId}
                    />
                  </FormField>
                  <FormField>
                    <Label htmlFor={`request-quantity-${item.id}`}>
                      Quantidade
                    </Label>
                    <Input
                      id={`request-quantity-${item.id}`}
                      min="1"
                      onChange={(event) =>
                        updateItem(item.id, "quantity", event.target.value)
                      }
                      required
                      type="number"
                      value={item.quantity}
                    />
                  </FormField>
                  <div className="flex items-end">
                    <Button
                      aria-label={`Remover item ${index + 1}`}
                      disabled={items.length === 1}
                      onClick={() => removeItem(item.id)}
                      size="icon"
                      type="button"
                      variant="outline"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                disabled={!warehouseId || loadingProducts}
                onClick={addItem}
                type="button"
                variant="outline"
              >
                <Plus className="h-4 w-4" />
                Adicionar item
              </Button>
            </div>
            <FormField>
              <Label htmlFor="request-date">Data da movimentação</Label>
              <Input
                id="request-date"
                onChange={(event) => setMovementDate(event.target.value)}
                required
                type="datetime-local"
                value={movementDate}
              />
            </FormField>
            <FormField>
              <Label htmlFor="request-observation">Observação</Label>
              <Textarea
                id="request-observation"
                onChange={(event) => setObservation(event.target.value)}
                value={observation}
              />
            </FormField>
            <Button
              disabled={
                !warehouseId || !validItems.length || saving || loadingProducts
              }
              type="submit"
            >
              <PackagePlus className="h-4 w-4" />
              {saving ? "Enviando..." : "Enviar solicitação"}
            </Button>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DirectTransferDialog({
  onCreated,
  warehouses,
}: {
  onCreated: () => Promise<void>;
  warehouses: WarehouseType[];
}) {
  const [open, setOpen] = useState(false);
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [movementDate, setMovementDate] = useState(todayInputValue());
  const [observation, setObservation] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const sourceWarehouse = warehouses.find((warehouse) => warehouse.isGeneral);
  const destinationWarehouses = warehouses.filter((warehouse) => !warehouse.isGeneral);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDestinationWarehouseId(
      (current) => current || destinationWarehouses[0]?.id || "",
    );
  }, [destinationWarehouses, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let ignore = false;

    async function loadProducts() {
      setLoadingProducts(true);
      setMessage(null);

      try {
        const nextProducts = await api<Product[]>("/entry-requests/available-products");

        if (!ignore) {
          setProducts(nextProducts);
          setProductId((current) =>
            nextProducts.some((product) => product.id === current)
              ? current
              : nextProducts[0]?.id ?? "",
          );
        }
      } catch (caughtError) {
        if (!ignore) {
          setMessage(
            caughtError instanceof Error
              ? caughtError.message
              : "Falha ao carregar produtos.",
          );
        }
      } finally {
        if (!ignore) {
          setLoadingProducts(false);
        }
      }
    }

    void loadProducts();

    return () => {
      ignore = true;
    };
  }, [open]);

  function openDialog() {
    setMessage(null);
    setQuantity("1");
    setMovementDate(todayInputValue());
    setObservation("");
    setOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sourceWarehouse) {
      setMessage("Cadastre um almoxarifado geral ativo para transferir.");
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await api("/movements/transfer", {
        body: JSON.stringify({
          destinationWarehouseId,
          movementDate,
          observation,
          productId,
          quantity,
          sourceWarehouseId: sourceWarehouse.id,
        }),
        method: "POST",
      });
      await onCreated();
      setOpen(false);
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao solicitar transferência.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        disabled={!sourceWarehouse || !destinationWarehouses.length}
        onClick={openDialog}
        type="button"
        variant="outline"
      >
        <ArrowRightLeft className="h-4 w-4" />
        Transferir
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Transferir produto</DialogTitle>
            <DialogDescription>
              Solicite uma transferência do almoxarifado geral para o destino.
            </DialogDescription>
          </DialogHeader>
          <Form onSubmit={submit}>
            {message ? <ResourceError message={message} /> : null}
            <FormField>
              <Label htmlFor="transfer-destination">Almoxarifado destino</Label>
              <SearchSelect
                ariaLabel="Almoxarifado destino"
                id="transfer-destination"
                onValueChange={setDestinationWarehouseId}
                options={destinationWarehouses.map((warehouse) => ({
                  label: warehouse.name,
                  searchText: warehouse.category.name,
                  value: warehouse.id,
                }))}
                placeholder="Selecione"
                value={destinationWarehouseId}
              />
            </FormField>
            <FormField>
              <Label htmlFor="transfer-product">Produto</Label>
              <SearchSelect
                ariaLabel="Produto"
                disabled={loadingProducts}
                emptyMessage={
                  loadingProducts
                    ? "Carregando produtos..."
                    : "Nenhum produto disponível no almoxarifado geral."
                }
                id="transfer-product"
                onValueChange={setProductId}
                options={products.map((product) => ({
                  label: `${product.code} - ${product.name}`,
                  searchText: `${product.category.name} ${product.unit.abbreviation}`,
                  value: product.id,
                }))}
                placeholder={loadingProducts ? "Carregando..." : "Selecione"}
                value={productId}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField>
                <Label htmlFor="transfer-quantity">Quantidade</Label>
                <Input
                  id="transfer-quantity"
                  min="1"
                  onChange={(event) => setQuantity(event.target.value)}
                  required
                  type="number"
                  value={quantity}
                />
              </FormField>
              <FormField>
                <Label htmlFor="transfer-date">Data da movimentação</Label>
                <Input
                  id="transfer-date"
                  onChange={(event) => setMovementDate(event.target.value)}
                  required
                  type="datetime-local"
                  value={movementDate}
                />
              </FormField>
            </div>
            <FormField>
              <Label htmlFor="transfer-observation">Observação</Label>
              <Textarea
                id="transfer-observation"
                onChange={(event) => setObservation(event.target.value)}
                value={observation}
              />
            </FormField>
            <Button
              disabled={
                !destinationWarehouseId || !productId || saving || loadingProducts
              }
              type="submit"
            >
              <ArrowRightLeft className="h-4 w-4" />
              {saving ? "Enviando..." : "Solicitar transferência"}
            </Button>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RequestsPage() {
  const { session } = useSession();
  const entries = useApiResource<EntryRequest[]>("/entry-requests", []);
  const transfers = useApiResource<TransferRequest[]>("/transfer-requests", []);
  const invoices = useApiResource<Invoice[]>("/invoices", []);
  const warehouses = useApiResource<WarehouseType[]>("/warehouses", []);
  const [activeTab, setActiveTab] = useState("entries");
  const [message, setMessage] = useState<{
    error: boolean;
    text: string;
  } | null>(null);
  const admin = session?.user.role === "ADMIN";

  async function approve(
    requestId: string,
    invoiceId: string | undefined,
    items: ApprovalItemPayload[],
  ) {
    try {
      const primaryItem = items[0];

      await api(`/entry-requests/${requestId}/approve`, {
        body: JSON.stringify({
          invoiceId,
          items,
          quantity: primaryItem?.quantity,
        }),
        method: "POST",
      });
      setMessage({ error: false, text: "Solicitação aprovada." });
      await entries.reload();
    } catch (caughtError) {
      setMessage({
        error: true,
        text: caughtError instanceof Error ? caughtError.message : "Falha ao aprovar.",
      });
    }
  }

  async function reject(requestId: string) {
    try {
      await api(`/entry-requests/${requestId}/reject`, { method: "POST" });
      setMessage({ error: false, text: "Solicitação rejeitada." });
      await entries.reload();
    } catch (caughtError) {
      setMessage({
        error: true,
        text: caughtError instanceof Error ? caughtError.message : "Falha ao rejeitar.",
      });
    }
  }

  async function receive(requestId: string) {
    try {
      await api(`/transfer-requests/${requestId}/receive`, { method: "POST" });
      setMessage({ error: false, text: "Recebimento confirmado." });
      await transfers.reload();
    } catch (caughtError) {
      setMessage({
        error: true,
        text:
          caughtError instanceof Error
            ? caughtError.message
            : "Falha ao receber transferência.",
      });
    }
  }

  async function requestCreated() {
    setMessage({ error: false, text: "Solicitação enviada." });
    await entries.reload();
  }

  async function transferCreated() {
    setMessage({ error: false, text: "Transferência solicitada." });
    await transfers.reload();
  }

  if (
    entries.loading ||
    transfers.loading ||
    warehouses.loading ||
    (admin && invoices.loading)
  ) {
    return <LoadingLine />;
  }

  if (entries.error || transfers.error || warehouses.error || (admin && invoices.error)) {
    return (
      <ResourceError
        message={
          entries.error ??
          transfers.error ??
          warehouses.error ??
          invoices.error ??
          ""
        }
      />
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Pendências internas</p>
          <h2 className="text-2xl font-semibold">Solicitações</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <DirectEntryRequestDialog
            onCreated={requestCreated}
            warehouses={warehouses.data}
          />
          {admin ? (
            <DirectTransferDialog
              onCreated={transferCreated}
              warehouses={warehouses.data}
            />
          ) : null}
        </div>
      </div>

      {message ? (
        <Alert
          className={
            message.error
              ? "border-rose-200 bg-rose-50 text-rose-950"
              : "border-emerald-200 bg-emerald-50 text-emerald-950"
          }
        >
          <AlertTitle>
            {message.error ? "Não foi possível concluir" : "Atualização"}
          </AlertTitle>
          <AlertDescription className="text-current">{message.text}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs onValueChange={setActiveTab} value={activeTab}>
        <TabsList>
          <TabsTrigger onClick={() => setActiveTab("entries")} value="entries">
            Entradas solicitadas
          </TabsTrigger>
          <TabsTrigger onClick={() => setActiveTab("transfers")} value="transfers">
            Recebimentos
          </TabsTrigger>
        </TabsList>
        <TabsContent value="entries">
          <DataTable
            columns={[
              {
                cell: (request) => (
                  <>
                    <p className="font-medium">
                      {entryRequestProductSummary(request)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(request.movementDate)}
                    </p>
                  </>
                ),
                header: "Produto",
                key: "product",
              },
              {
                cell: (request) => request.warehouse.name,
                header: "Almoxarifado",
                key: "warehouse",
              },
              {
                cell: (request) => (
                  <p className="max-w-xs truncate" title={entryRequestQuantitySummary(request)}>
                    {entryRequestQuantitySummary(request)}
                  </p>
                ),
                header: "Quantidade",
                key: "quantity",
              },
              {
                cell: (request) => request.requestedBy.name,
                header: "Solicitante",
                key: "requester",
              },
              {
                cell: (request) => <StatusBadge status={request.status} />,
                header: "Status",
                key: "status",
              },
              {
                cell: (request) => (
                  <div className="flex justify-end gap-2">
                    {request.warehouse.isGeneral !== true ? (
                      <OfficeLetterDialog request={request} />
                    ) : null}
                    <Button asChild size="sm" variant="outline">
                      <Link
                        aria-label={`Abrir almoxarifado ${request.warehouse.name}`}
                        to={`/warehouses/${request.warehouse.id}`}
                      >
                        <Warehouse className="h-4 w-4" />
                        Almoxarifado
                      </Link>
                    </Button>
                    {admin && request.status === "PENDING" ? (
                      <>
                        <ApprovalDialog
                          invoices={invoices.data}
                          onApprove={approve}
                          request={request}
                          warehouses={warehouses.data}
                        />
                        <Button
                          onClick={() => void reject(request.id)}
                          size="sm"
                          variant="outline"
                        >
                          <X className="h-4 w-4" />
                          Rejeitar
                        </Button>
                      </>
                    ) : null}
                  </div>
                ),
                cellClassName: "text-right",
                header: "Ações",
                headerClassName: "text-right",
                key: "actions",
              },
            ]}
            data={entries.data}
            emptyMessage="Nenhuma solicitação de entrada encontrada."
            getRowId={(request) => request.id}
            searchPlaceholder="Buscar entrada solicitada..."
            searchText={(request) =>
              [
                ...entryRequestItems(request).flatMap((item) => [
                  item.product.name,
                  item.product.code,
                  item.product.unit.abbreviation,
                  String(item.quantity),
                ]),
                request.warehouse.name,
                request.requestedBy.name,
                request.status,
                formatDate(request.movementDate),
              ].join(" ")
            }
          />
        </TabsContent>
        <TabsContent value="transfers">
          <DataTable
            columns={[
              {
                cell: (request) => (
                  <>
                    <p className="font-medium">{request.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(request.createdAt)}
                    </p>
                  </>
                ),
                header: "Produto",
                key: "product",
              },
              {
                cell: (request) => request.sourceWarehouse.name,
                header: "Origem",
                key: "source",
              },
              {
                cell: (request) => request.destinationWarehouse.name,
                header: "Destino",
                key: "destination",
              },
              {
                cell: (request) =>
                  `${request.quantity} ${request.product.unit.abbreviation}`,
                header: "Quantidade",
                key: "quantity",
              },
              {
                cell: (request) => <StatusBadge status={request.status} />,
                header: "Status",
                key: "status",
              },
              {
                cell: (request) => (
                  <div className="flex justify-end gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link
                        aria-label={`Abrir destino ${request.destinationWarehouse.name}`}
                        to={`/warehouses/${request.destinationWarehouse.id}`}
                      >
                        <Warehouse className="h-4 w-4" />
                        Destino
                      </Link>
                    </Button>
                    {request.status === "PENDING_RECEIPT" ? (
                      <ReceiveDialog onReceive={receive} request={request} />
                    ) : null}
                  </div>
                ),
                cellClassName: "text-right",
                header: "Ações",
                headerClassName: "text-right",
                key: "actions",
              },
            ]}
            data={transfers.data}
            emptyMessage="Nenhum recebimento encontrado."
            getRowId={(request) => request.id}
            searchPlaceholder="Buscar recebimento..."
            searchText={(request) =>
              [
                request.product.name,
                request.product.code,
                request.product.unit.abbreviation,
                request.sourceWarehouse.name,
                request.destinationWarehouse.name,
                request.status,
                request.createdBy.name,
                request.receivedBy?.name,
                formatDate(request.createdAt),
              ].join(" ")
            }
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
