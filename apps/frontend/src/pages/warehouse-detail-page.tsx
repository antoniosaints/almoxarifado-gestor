import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  BarChart3,
  Box,
  Boxes,
  ChartArea,
  Clock,
  FileDown,
  History,
  PackageMinus,
  PackagePlus,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CategoryCreateDialog,
  UnitCreateDialog,
} from "@/components/domain/catalog-quick-create-dialog";
import { DataTable } from "@/components/domain/data-table";
import { LoadingLine, ResourceError } from "@/components/domain/feedback";
import { StockBadge } from "@/components/domain/stock-badge";
import { SummaryCard } from "@/components/domain/summary-card";
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
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MaskedInput } from "@/components/ui/masked-input";
import { SearchSelect } from "@/components/ui/search-select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api, apiFile, useApiResource } from "@/lib/api";
import { readCsvFile } from "@/lib/csv";
import { useSession } from "@/lib/session";
import type {
  Invoice,
  Movement,
  Product,
  ProductCategory,
  Stock,
  Supplier,
  UnitOfMeasure,
  Warehouse,
  WarehouseCsvPreview,
} from "@/lib/types";
import { formatCurrency, formatDate, todayInputValue } from "@/lib/utils";
import { movementLabels, MovementsTable } from "./movements-page";

type MovementFormProps = {
  initialProductId?: string;
  kind: "entry" | "entryRequest" | "output" | "transfer";
  lockedProduct?: Product;
  onSaved: () => Promise<void>;
  onProductCreated?: (product: Product) => Promise<void> | void;
  productCategories?: ProductCategory[];
  products: Product[];
  units?: UnitOfMeasure[];
  warehouse: Warehouse;
  warehouses: Warehouse[];
};

function movementLabel(kind: MovementFormProps["kind"]) {
  if (kind === "entry") {
    return "Incluir Estoque";
  }

  if (kind === "entryRequest") {
    return "Solicitar";
  }

  if (kind === "output") {
    return "Saida avulsa";
  }

  return "Transferir";
}

type ProductDraft = {
  active: boolean;
  categoryId: string;
  description: string;
  name: string;
  unitId: string;
};

const warehouseTabValues = ["stock", "overview", "history"] as const;
const createProductCsvValue = "__create_product__";
const skipCsvRowValue = "__skip_row__";
const warehouseCsvRowsPerPage = 20;

function readStoredWarehouseTab(warehouseId: string) {
  if (typeof window === "undefined") {
    return "stock";
  }

  const storedTab = window.localStorage.getItem(`warehouse-tab-${warehouseId}`);

  if (storedTab && warehouseTabValues.some((tab) => tab === storedTab)) {
    return storedTab;
  }

  return "stock";
}

function emptyProductDraft(
  productCategories: ProductCategory[],
  units: UnitOfMeasure[],
): ProductDraft {
  return {
    active: true,
    categoryId: productCategories[0]?.id ?? "",
    description: "",
    name: "",
    unitId: units[0]?.id ?? "",
  };
}

function NewProductInlineDialog({
  onCreated,
  productCategories,
  units,
}: {
  onCreated: (product: Product) => Promise<void> | void;
  productCategories: ProductCategory[];
  units: UnitOfMeasure[];
}) {
  const { session } = useSession();
  const canManageCatalog = session?.user.role === "ADMIN";
  const [open, setOpen] = useState(false);
  const [availableCategories, setAvailableCategories] =
    useState(productCategories);
  const [availableUnits, setAvailableUnits] = useState(units);
  const [draft, setDraft] = useState<ProductDraft>(() =>
    emptyProductDraft(productCategories, units),
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setAvailableCategories(productCategories);
  }, [productCategories]);

  useEffect(() => {
    setAvailableUnits(units);
  }, [units]);

  function openDialog() {
    setDraft(emptyProductDraft(availableCategories, availableUnits));
    setMessage(null);
    setOpen(true);
  }

  function selectCreatedCategory(category: ProductCategory) {
    setAvailableCategories((categories) => [...categories, category]);
    setDraft((current) => (current ? { ...current, categoryId: category.id } : current));
  }

  function selectCreatedUnit(unit: UnitOfMeasure) {
    setAvailableUnits((currentUnits) => [...currentUnits, unit]);
    setDraft((current) => (current ? { ...current, unitId: unit.id } : current));
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    setMessage(null);

    try {
      const product = await api<Product>("/products", {
        body: JSON.stringify(draft),
        method: "POST",
      });
      await onCreated(product);
      setOpen(false);
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao salvar produto.",
      );
    }
  }

  return (
    <>
      <button
        className="text-xs font-medium text-primary underline-offset-4 hover:underline"
        onClick={openDialog}
        type="button"
      >
        <Plus className="mr-1 inline h-3.5 w-3.5" />
        Novo produto
      </button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo produto</DialogTitle>
            <DialogDescription>
              O produto sera selecionado automaticamente para incluir estoque.
            </DialogDescription>
          </DialogHeader>
          <Form onSubmit={saveProduct}>
            {message ? <ResourceError message={message} /> : null}
            <FormField>
              <Label htmlFor="stock-product-name">Nome</Label>
              <Input
                id="stock-product-name"
                onChange={(event) =>
                  setDraft({ ...draft, name: event.target.value })
                }
                required
                value={draft.name}
              />
            </FormField>
            <FormField>
              <Label htmlFor="stock-product-description">Descrição</Label>
              <Textarea
                id="stock-product-description"
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
                value={draft.description}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField>
                <Label htmlFor="stock-product-category">Categoria</Label>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <SearchSelect
                    ariaLabel="Categoria"
                    id="stock-product-category"
                    onValueChange={(categoryId) =>
                      setDraft({ ...draft, categoryId })
                    }
                    options={availableCategories.map((category) => ({
                      label: category.name,
                      value: category.id,
                    }))}
                    placeholder="Selecione"
                    value={draft.categoryId}
                  />
                  {canManageCatalog ? (
                    <CategoryCreateDialog onCreated={selectCreatedCategory} />
                  ) : null}
                </div>
              </FormField>
              <FormField>
                <Label htmlFor="stock-product-unit">Unidade</Label>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <SearchSelect
                    ariaLabel="Unidade"
                    id="stock-product-unit"
                    onValueChange={(unitId) => setDraft({ ...draft, unitId })}
                    options={availableUnits.map((unit) => ({
                      label: `${unit.name} / ${unit.abbreviation}`,
                      value: unit.id,
                    }))}
                    placeholder="Selecione"
                    value={draft.unitId}
                  />
                  {canManageCatalog ? (
                    <UnitCreateDialog onCreated={selectCreatedUnit} />
                  ) : null}
                </div>
              </FormField>
            </div>
            <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
              <input
                checked={draft.active}
                onChange={(event) =>
                  setDraft({ ...draft, active: event.target.checked })
                }
                type="checkbox"
              />
              Produto ativo
            </label>
            <Button disabled={!draft.categoryId || !draft.unitId} type="submit">
              Salvar produto
            </Button>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InvoiceFields({
  invoiceId,
  onChange,
}: {
  invoiceId: string;
  onChange: (invoiceId: string) => void;
}) {
  const invoices = useApiResource<Invoice[]>("/invoices", []);
  const suppliers = useApiResource<Supplier[]>("/suppliers?active=true", []);
  const [draft, setDraft] = useState({
    issueDate: todayInputValue().slice(0, 10),
    number: "",
    observation: "",
    supplierId: "",
  });
  const [supplierDraft, setSupplierDraft] = useState({
    cnpj: "",
    name: "",
    tradeName: "",
  });
  const [open, setOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [supplierMessage, setSupplierMessage] = useState<string | null>(null);

  async function saveInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    setMessage(null);

    try {
      const invoice = await api<Invoice>("/invoices", {
        body: JSON.stringify(draft),
        method: "POST",
      });
      onChange(invoice.id);
      setOpen(false);
      await invoices.reload();
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao salvar nota.",
      );
    }
  }

  async function saveSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    setSupplierMessage(null);

    try {
      const supplier = await api<Supplier>("/suppliers", {
        body: JSON.stringify(supplierDraft),
        method: "POST",
      });

      setDraft((current) => ({ ...current, supplierId: supplier.id }));
      setSupplierDraft({ cnpj: "", name: "", tradeName: "" });
      setSupplierOpen(false);
      await suppliers.reload();
    } catch (caughtError) {
      setSupplierMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao salvar fornecedor.",
      );
    }
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <FormField>
          <Label htmlFor="entry-invoice">Nota fiscal</Label>
          <SearchSelect
            ariaLabel="Nota fiscal"
            id="entry-invoice"
            onValueChange={onChange}
            options={[
              { label: "Sem nota vinculada", value: "" },
              ...invoices.data.map((invoice) => ({
                label: `${invoice.number} - ${invoice.companyName}`,
                searchText: `${invoice.cnpj} ${invoice.supplier?.name ?? ""}`,
                value: invoice.id,
              })),
            ]}
            placeholder="Sem nota vinculada"
            value={invoiceId}
          />
        </FormField>
        <Button onClick={() => setOpen(true)} type="button" variant="outline">
          Nova nota
        </Button>
      </div>

      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nota fiscal da entrada</DialogTitle>
            <DialogDescription>
              A mesma nota pode ser escolhida em outras entradas.
            </DialogDescription>
          </DialogHeader>
          <Form onSubmit={saveInvoice}>
            {message ? <ResourceError message={message} /> : null}
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <FormField>
                <Label htmlFor="invoice-supplier">Fornecedor</Label>
                <SearchSelect
                  ariaLabel="Fornecedor da nota"
                  id="invoice-supplier"
                  onValueChange={(supplierId) => setDraft({ ...draft, supplierId })}
                  options={suppliers.data.map((supplier) => ({
                    label: supplier.name,
                    searchText: `${supplier.tradeName ?? ""} ${supplier.cnpj}`,
                    value: supplier.id,
                  }))}
                  placeholder="Selecione o fornecedor"
                  value={draft.supplierId}
                />
              </FormField>
              <Button onClick={() => setSupplierOpen(true)} type="button" variant="outline">
                Novo fornecedor
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField>
                <Label htmlFor="invoice-number">Número da nota</Label>
                <Input
                  id="invoice-number"
                  onChange={(event) =>
                    setDraft({ ...draft, number: event.target.value })
                  }
                  required
                  value={draft.number}
                />
              </FormField>
            </div>
            <FormField>
              <Label htmlFor="invoice-date">Data da nota</Label>
              <Input
                id="invoice-date"
                onChange={(event) =>
                  setDraft({ ...draft, issueDate: event.target.value })
                }
                required
                type="date"
                value={draft.issueDate}
              />
            </FormField>
            <FormField>
              <Label htmlFor="invoice-observation">Observação adicional</Label>
              <Textarea
                id="invoice-observation"
                onChange={(event) =>
                  setDraft({ ...draft, observation: event.target.value })
                }
                value={draft.observation}
              />
            </FormField>
            <Button disabled={!draft.supplierId} type="submit">
              Salvar nota fiscal
            </Button>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setSupplierOpen} open={supplierOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo fornecedor</DialogTitle>
            <DialogDescription>
              Cadastre rapidamente a empresa para vincular a nota fiscal.
            </DialogDescription>
          </DialogHeader>
          <Form onSubmit={saveSupplier}>
            {supplierMessage ? <ResourceError message={supplierMessage} /> : null}
            <FormField>
              <Label htmlFor="quick-supplier-name">Razao social</Label>
              <Input
                id="quick-supplier-name"
                onChange={(event) =>
                  setSupplierDraft({ ...supplierDraft, name: event.target.value })
                }
                required
                value={supplierDraft.name}
              />
            </FormField>
            <FormField>
              <Label htmlFor="quick-supplier-trade-name">Nome fantasia</Label>
              <Input
                id="quick-supplier-trade-name"
                onChange={(event) =>
                  setSupplierDraft({
                    ...supplierDraft,
                    tradeName: event.target.value,
                  })
                }
                value={supplierDraft.tradeName}
              />
            </FormField>
            <FormField>
              <Label htmlFor="quick-supplier-cnpj">CNPJ</Label>
              <MaskedInput
                id="quick-supplier-cnpj"
                mask="cnpj"
                onChange={(event) =>
                  setSupplierDraft({ ...supplierDraft, cnpj: event.target.value })
                }
                required
                value={supplierDraft.cnpj}
              />
            </FormField>
            <Button type="submit">Salvar fornecedor</Button>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MovementForm({
  initialProductId = "",
  kind,
  lockedProduct,
  onSaved,
  onProductCreated,
  productCategories = [],
  products,
  units = [],
  warehouse,
  warehouses,
}: MovementFormProps) {
  const [productId, setProductId] = useState(
    lockedProduct?.id ?? initialProductId,
  );
  const [quantity, setQuantity] = useState("1");
  const [observation, setObservation] = useState("");
  const [destinationNote, setDestinationNote] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [minimumQuantity, setMinimumQuantity] = useState("0");
  const [movementDate, setMovementDate] = useState(todayInputValue());
  const [message, setMessage] = useState<string | null>(null);
  const selectedStock = warehouse.stocks.find(
    (stock) => stock.productId === productId,
  );
  const createsNewStock =
    kind === "entry" && Boolean(productId) && !selectedStock && !lockedProduct;
  const productOptions = lockedProduct ? [lockedProduct] : products;

  const endpoint = {
    entry: "/movements/entry",
    entryRequest: "/entry-requests",
    output: "/movements/output",
    transfer: "/movements/transfer",
  }[kind];

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const payload =
      kind === "transfer"
        ? {
            destinationWarehouseId,
            movementDate,
            observation,
            productId,
            quantity,
            sourceWarehouseId: warehouse.id,
          }
        : {
            destinationNote,
            invoiceId: kind === "entry" ? invoiceId || null : undefined,
            minimumQuantity: createsNewStock ? minimumQuantity : undefined,
            movementDate,
            observation,
            productId,
            quantity,
            unitPrice: kind === "entry" ? unitPrice : undefined,
            warehouseId: warehouse.id,
          };

    try {
      await api(endpoint, {
        body: JSON.stringify(payload),
        method: "POST",
      });
      setQuantity("1");
      setObservation("");
      setDestinationNote("");
      setDestinationWarehouseId("");
      setUnitPrice("");
      setMinimumQuantity("0");
      setMessage(
        kind === "entryRequest"
          ? "Solicitacao enviada."
          : kind === "transfer"
            ? "Transferência enviada para recebimento."
            : "Movimentação registrada.",
      );
      await onSaved();
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao registrar.",
      );
    }
  }

  return (
    <Form onSubmit={save}>
      {message ? (
        <Alert
          className={
            message === "Movimentação registrada." ||
            message === "Solicitacao enviada." ||
            message === "Transferência enviada para recebimento."
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : "border-rose-200 bg-rose-50 text-rose-950"
          }
        >
          <AlertTitle>
            {message === "Movimentação registrada." ||
            message === "Solicitacao enviada." ||
            message === "Transferência enviada para recebimento."
              ? "Pronto"
              : "Atencao"}
          </AlertTitle>
          <AlertDescription className="text-current">
            {message}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <FormField>
          <div className="mt-2 flex items-center justify-between gap-2">
            <Label className="mb-0" htmlFor={`${kind}-product`}>
              Produto
            </Label>
            {kind === "entry" && !lockedProduct && onProductCreated ? (
              <NewProductInlineDialog
                onCreated={async (product) => {
                  await onProductCreated(product);
                  setProductId(product.id);
                  setMinimumQuantity("0");
                }}
                productCategories={productCategories}
                units={units}
              />
            ) : null}
          </div>
          <SearchSelect
            ariaLabel="Produto"
            disabled={Boolean(lockedProduct)}
            emptyMessage="Nenhum produto disponivel."
            id={`${kind}-product`}
            onValueChange={setProductId}
            options={productOptions
              .filter((product) => lockedProduct || product.active)
              .map((product) => ({
                label: `${product.code} - ${product.name}`,
                searchText: `${product.category.name} ${product.unit.abbreviation}`,
                value: product.id,
              }))}
            placeholder="Selecione"
            value={productId}
          />
        </FormField>
        <FormField>
          <Label htmlFor={`${kind}-quantity`}>
            {createsNewStock ? "Quantidade inicial" : "Quantidade"}
          </Label>
          <Input
            id={`${kind}-quantity`}
            min="1"
            onChange={(event) => setQuantity(event.target.value)}
            required
            type="number"
            value={quantity}
          />
        </FormField>
      </div>

      {kind === "output" ? (
        <FormField>
          <Label htmlFor="output-destination">Destino ou justificativa</Label>
          <Input
            id="output-destination"
            onChange={(event) => setDestinationNote(event.target.value)}
            placeholder="Ex.: manutencao da escola municipal"
            value={destinationNote}
          />
        </FormField>
      ) : null}

      {kind === "transfer" ? (
        <FormField>
          <Label htmlFor="transfer-destination">Almoxarifado destino</Label>
          <SearchSelect
            ariaLabel="Almoxarifado destino"
            id="transfer-destination"
            onValueChange={setDestinationWarehouseId}
            options={warehouses
              .filter((item) => item.id !== warehouse.id && item.active)
              .map((item) => ({
                label: item.name,
                searchText: item.category.name,
                value: item.id,
              }))}
            placeholder="Selecione"
            value={destinationWarehouseId}
          />
        </FormField>
      ) : null}

      {kind === "entry" ? (
        <InvoiceFields invoiceId={invoiceId} onChange={setInvoiceId} />
      ) : null}

      <div className={`grid gap-4 ${createsNewStock ? "lg:grid-cols-2" : ""}`}>
        {createsNewStock ? (
          <FormField>
            <Label htmlFor="entry-minimum-stock">Estoque mínimo inicial</Label>
            <Input
              id="entry-minimum-stock"
              min="0"
              onChange={(event) => setMinimumQuantity(event.target.value)}
              required
              type="number"
              value={minimumQuantity}
            />
          </FormField>
        ) : null}

        {kind === "entry" ? (
          <FormField>
            <Label htmlFor="entry-unit-price">Valor unitário</Label>
            <Input
              id="entry-unit-price"
              min="0"
              onChange={(event) => setUnitPrice(event.target.value)}
              placeholder="0.00"
              required
              step="0.01"
              type="number"
              value={unitPrice}
            />
          </FormField>
        ) : null}
      </div>

      <div className="grid gap-4">
        <FormField>
          <Label htmlFor={`${kind}-date`}>Data da movimentação</Label>
          <Input
            id={`${kind}-date`}
            onChange={(event) => setMovementDate(event.target.value)}
            required
            type="datetime-local"
            value={movementDate}
          />
        </FormField>
        <FormField>
          <Label htmlFor={`${kind}-observation`}>Observação</Label>
          <Textarea
            id={`${kind}-observation`}
            onChange={(event) => setObservation(event.target.value)}
            value={observation}
          />
        </FormField>
      </div>

      <Button type="submit">
        {kind === "entry" || kind === "entryRequest" ? (
          <PackagePlus className="h-4 w-4" />
        ) : kind === "output" ? (
          <PackageMinus className="h-4 w-4" />
        ) : (
          <ArrowRightLeft className="h-4 w-4" />
        )}
        {kind === "entryRequest" ? "Enviar solicitação" : "Registrar"}
      </Button>
    </Form>
  );
}

function MovementDialog({
  compact,
  disabled,
  label,
  ...props
}: MovementFormProps & {
  compact?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const dialogLabel = label ?? movementLabel(props.kind);
  const icon =
    props.kind === "entry" || props.kind === "entryRequest" ? (
      <PackagePlus className="h-4 w-4" />
    ) : props.kind === "output" ? (
      <PackageMinus className="h-4 w-4" />
    ) : (
      <ArrowRightLeft className="h-4 w-4" />
    );

  return (
    <>
      <Button
        aria-label={compact ? dialogLabel : undefined}
        disabled={disabled}
        onClick={() => setOpen(true)}
        size={compact ? "icon" : "default"}
        variant={compact ? "outline" : "default"}
      >
        {icon}
        {compact ? null : dialogLabel}
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dialogLabel}</DialogTitle>
            <DialogDescription>{props.warehouse.name}</DialogDescription>
          </DialogHeader>
          <MovementForm {...props} />
        </DialogContent>
      </Dialog>
    </>
  );
}

type BulkStockAction = "delete" | "zero";

function isLowStock(stock: Stock) {
  return stock.currentQuantity <= stock.minimumQuantity;
}

function stockCurrency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);

  return Number.isFinite(amount) ? formatCurrency(amount) : formatCurrency(0);
}

function movementsForStock(movements: Movement[], stock: Stock) {
  return movements.filter(
    (movement) =>
      movement.productId === stock.productId &&
      movement.warehouseId === stock.warehouseId,
  );
}

function latestMovementForStock(movements: Movement[], stock: Stock) {
  return movementsForStock(movements, stock)[0] ?? null;
}

function movementSummary(movement: Movement | null) {
  if (!movement) {
    return "Sem movimentação";
  }

  return `${movementLabels[movement.type]} - ${formatDate(movement.movementDate)}`;
}

function StockMovementsDialog({
  movements,
  stock,
}: {
  movements: Movement[];
  stock: Stock;
}) {
  const [open, setOpen] = useState(false);
  const [invoiceOnly, setInvoiceOnly] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const stockMovements = movementsForStock(movements, stock);
  const visibleMovements = invoiceOnly
    ? stockMovements.filter(
        (movement) => movement.invoiceId || movement.invoice,
      )
    : stockMovements;

  async function exportMovementsPdf() {
    setExporting(true);
    setMessage(null);

    const params = new URLSearchParams({
      productId: stock.productId,
      warehouseIds: stock.warehouseId,
    });

    if (invoiceOnly) {
      params.set("invoiceOnly", "1");
    }

    try {
      const blob = await apiFile(`/reports/movements?${params.toString()}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `movimentacoes-${stock.product.code}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao exportar movimentações.",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Button
        aria-label={`Ver movimentações de ${stock.product.name}`}
        onClick={() => setOpen(true)}
        size="icon"
        variant="outline"
      >
        <History className="h-4 w-4" />
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Movimentações de {stock.product.name}</DialogTitle>
            <DialogDescription>
              Entradas e saídas registradas neste almoxarifado.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
            <span className="text-sm text-muted-foreground">
              Somente com nota fiscal
            </span>
            <Switch checked={invoiceOnly} onCheckedChange={setInvoiceOnly} />
          </div>
          {message ? <ResourceError message={message} /> : null}
          <MovementsTable movements={visibleMovements} showInvoiceAction />
          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {visibleMovements.length} movimentação(ões) no filtro atual.
            </p>
            <Button
              disabled={exporting}
              onClick={() => void exportMovementsPdf()}
              type="button"
            >
              <FileDown className="h-4 w-4" />
              {exporting ? "Gerando..." : "Exportar PDF"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function uniqueProductsForMovements(movements: Movement[], stocks: Stock[]) {
  const products = new Map<string, Product>();

  stocks.forEach((stock) => products.set(stock.productId, stock.product));
  movements.forEach((movement) => {
    if (products.has(movement.productId)) {
      return;
    }

    products.set(movement.productId, {
      ...movement.product,
      active: true,
      category: {
        id: "",
        name: "",
      },
      categoryId: "",
      minimumQuantity: 0,
      unitId: movement.product.unit.id,
    });
  });

  return Array.from(products.values()).sort((left, right) =>
    left.code.localeCompare(right.code),
  );
}

function WarehouseMovementsExportDialog({
  movements,
  stocks,
  warehouse,
}: {
  movements: Movement[];
  stocks: Stock[];
  warehouse: Warehouse;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [productId, setProductId] = useState("");
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const products = uniqueProductsForMovements(movements, stocks);
  const invoiceOptions = Array.from(
    movements.reduce<Map<string, NonNullable<Movement["invoice"]>>>(
      (options, movement) => {
        if (movement.invoiceId && movement.invoice) {
          options.set(movement.invoiceId, movement.invoice);
        }

        return options;
      },
      new Map(),
    ),
  )
    .map(([id, invoice]) => ({
      id,
      invoice,
    }))
    .sort((left, right) => left.invoice.number.localeCompare(right.invoice.number));

  async function exportMovements(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setExporting(true);
    setMessage(null);

    const params = new URLSearchParams({
      warehouseIds: warehouse.id,
    });

    if (from) {
      params.set("from", from);
    }

    if (to) {
      params.set("to", to);
    }

    if (invoiceId) {
      params.set("invoiceId", invoiceId);
    }

    if (productId) {
      params.set("productId", productId);
    }

    try {
      const blob = await apiFile(`/reports/movements?${params.toString()}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `movimentacoes-${warehouse.name
        .replace(/[^a-z0-9_-]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toLocaleLowerCase("pt-BR")}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao exportar movimentações.",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button" variant="outline">
        <FileDown className="h-4 w-4" />
        Exportar movimentações
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar movimentações</DialogTitle>
            <DialogDescription>
              Exporte todo o histórico ou filtre por período, nota e produto.
            </DialogDescription>
          </DialogHeader>
          <Form onSubmit={exportMovements}>
            {message ? <ResourceError message={message} /> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField>
                <Label htmlFor="warehouse-movement-export-from">Período de</Label>
                <Input
                  id="warehouse-movement-export-from"
                  onChange={(event) => setFrom(event.target.value)}
                  type="date"
                  value={from}
                />
              </FormField>
              <FormField>
                <Label htmlFor="warehouse-movement-export-to">Período até</Label>
                <Input
                  id="warehouse-movement-export-to"
                  onChange={(event) => setTo(event.target.value)}
                  type="date"
                  value={to}
                />
              </FormField>
            </div>
            <FormField>
              <Label htmlFor="warehouse-movement-export-invoice">Nota fiscal</Label>
              <SearchSelect
                ariaLabel="Filtrar nota fiscal"
                id="warehouse-movement-export-invoice"
                onValueChange={setInvoiceId}
                options={[
                  { label: "Todas as notas", value: "" },
                  ...invoiceOptions.map(({ id, invoice }) => ({
                    label: `${invoice.number} - ${invoice.companyName}`,
                    searchText: invoice.cnpj,
                    value: id,
                  })),
                ]}
                placeholder="Todas as notas"
                searchPlaceholder="Buscar por nota, empresa ou CNPJ..."
                value={invoiceId}
              />
            </FormField>
            <FormField>
              <Label htmlFor="warehouse-movement-export-product">Produto</Label>
              <SearchSelect
                ariaLabel="Filtrar produto"
                id="warehouse-movement-export-product"
                onValueChange={setProductId}
                options={[
                  { label: "Todos os produtos", value: "" },
                  ...products.map((product) => ({
                    label: `${product.code} - ${product.name}`,
                    searchText: product.unit.abbreviation,
                    value: product.id,
                  })),
                ]}
                placeholder="Todos os produtos"
                value={productId}
              />
            </FormField>
            <Button disabled={exporting} type="submit">
              <FileDown className="h-4 w-4" />
              {exporting ? "Gerando..." : "Exportar PDF"}
            </Button>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BulkStockActionDialog({
  action,
  onChanged,
  stocks,
}: {
  action: BulkStockAction;
  onChanged: () => Promise<void>;
  stocks: Stock[];
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const zeroAction = action === "zero";
  const title = zeroAction ? "Zerar estoques" : "Apagar estoques";
  const allSelected = stocks.length > 0 && selectedIds.length === stocks.length;

  function toggleStock(stockId: string) {
    setSelectedIds((current) =>
      current.includes(stockId)
        ? current.filter((id) => id !== stockId)
        : [...current, stockId],
    );
  }

  function toggleAllStocks() {
    setSelectedIds(allSelected ? [] : stocks.map((stock) => stock.id));
  }

  function closeDialog(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      setPassword("");
      setSelectedIds([]);
      setMessage(null);
      setSaving(false);
    }
  }

  async function confirmAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSaving(true);

    try {
      await api(zeroAction ? "/stocks/bulk-zero" : "/stocks/bulk-delete", {
        body: JSON.stringify({ password, stockIds: selectedIds }),
        method: "POST",
      });
      await onChanged();
      closeDialog(false);
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao concluir ação.",
      );
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        type="button"
        variant={zeroAction ? "outline" : "destructive"}
      >
        {zeroAction ? (
          <TriangleAlert className="h-4 w-4" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
        {title}
      </Button>
      <Dialog onOpenChange={closeDialog} open={open}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Selecione os estoques e confirme com a senha do usuário admin.
            </DialogDescription>
          </DialogHeader>
          <Form onSubmit={confirmAction}>
            {message ? <ResourceError message={message} /> : null}
            <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedIds.length} de {stocks.length} estoque(s) selecionado(s).
              </p>
              <Button
                disabled={!stocks.length}
                onClick={toggleAllStocks}
                size="sm"
                type="button"
                variant="outline"
              >
                {allSelected ? "Limpar seleção" : "Selecionar todos"}
              </Button>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border p-2">
              {stocks.map((stock) => (
                <label
                  className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
                  key={stock.id}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <input
                      checked={selectedIds.includes(stock.id)}
                      onChange={() => toggleStock(stock.id)}
                      type="checkbox"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {stock.product.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {stock.currentQuantity}{" "}
                        {stock.product.unit.abbreviation} | mínimo{" "}
                        {stock.minimumQuantity}
                      </span>
                    </span>
                  </span>
                  <StockBadge stock={stock} />
                </label>
              ))}
              {!stocks.length ? (
                <p className="p-3 text-sm text-muted-foreground">
                  Nenhum estoque disponivel.
                </p>
              ) : null}
            </div>
            <FormField>
              <Label htmlFor={`${action}-stock-password`}>Senha do admin</Label>
              <Input
                id={`${action}-stock-password`}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </FormField>
            <Button disabled={!selectedIds.length || saving} type="submit">
              {saving ? "Confirmando..." : title}
            </Button>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StockTable({
  movements,
  onMinimumChange,
  onMovementSaved,
  onStockDeleted,
  stocks,
  warehouse,
  warehouses,
}: {
  movements: Movement[];
  onMinimumChange: (stockId: string, minimumQuantity: number) => Promise<void>;
  onMovementSaved: () => Promise<void>;
  onStockDeleted: (stockId: string) => Promise<void>;
  stocks: Stock[];
  warehouse: Warehouse;
  warehouses: Warehouse[];
}) {
  const { session } = useSession();
  const [editingStock, setEditingStock] = useState<Stock | null>(null);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [minimum, setMinimum] = useState("");
  const admin = session?.user.role === "ADMIN";
  const filteredStocks = showLowStockOnly
    ? stocks.filter((stock) => isLowStock(stock))
    : stocks;

  function editStock(stock: Stock) {
    setEditingStock(stock);
    setMinimum(String(stock.minimumQuantity));
  }

  async function saveMinimum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingStock) {
      return;
    }

    await onMinimumChange(editingStock.id, Number(minimum));
    setEditingStock(null);
  }

  return (
    <>
      <DataTable
        columns={[
          {
            cell: (stock) => (
              <>
                <p className="font-medium flex items-center gap-1">
                  {stock.product.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stock.product.code}
                </p>
              </>
            ),
            header: "Produto",
            key: "product",
          },
          {
            cell: (stock) => (
              <>
                <div className="flex items-center gap-1">
                  <p>
                    {stock.currentQuantity}
                    {stock.product.unit.abbreviation}
                  </p>
                  {stock.currentQuantity <= stock.minimumQuantity && (
                    <p
                      className="text-xs text-red-500"
                      title={`O estoque está baixo, mínimo ${stock.minimumQuantity}${stock.product.unit.abbreviation}`}
                    >
                      <TriangleAlert className="h-4 w-4" />
                    </p>
                  )}
                </div>
              </>
            ),
            header: "Quantidade",
            key: "quantity",
          },
          {
            cell: (stock) => stock.product.category.name,
            header: "Categoria",
            key: "category",
          },
          {
            cell: (stock) => stockCurrency(stock.totalValue),
            header: "Valor total",
            key: "total-value",
          },
          {
            cell: (stock) => (
              <div className="flex justify-center">
                <StockMovementsDialog movements={movements} stock={stock} />
              </div>
            ),
            header: "Mov.",
            headerClassName: "text-center",
            key: "movements",
          },
          {
            cell: (stock) =>
              movementSummary(latestMovementForStock(movements, stock)),
            header: "Última movimentação",
            key: "last-movement",
          },
          ...(admin
            ? [
                {
                  cell: (stock: Stock) => (
                    <div className="flex justify-end gap-2">
                      <MovementDialog
                        compact
                        initialProductId={stock.productId}
                        kind="entry"
                        label="Entrada no estoque"
                        lockedProduct={stock.product}
                        onSaved={onMovementSaved}
                        products={[stock.product]}
                        warehouse={warehouse}
                        warehouses={warehouses}
                      />
                      <MovementDialog
                        compact
                        disabled={stock.currentQuantity <= 0}
                        initialProductId={stock.productId}
                        kind="output"
                        label="Saida avulsa"
                        lockedProduct={stock.product}
                        onSaved={onMovementSaved}
                        products={[stock.product]}
                        warehouse={warehouse}
                        warehouses={warehouses}
                      />
                      <Button
                        aria-label={`Editar estoque de ${stock.product.name}`}
                        onClick={() => editStock(stock)}
                        size="icon"
                        variant="outline"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!stock.lastMovementAt ? (
                        <Button
                          aria-label={`Remover estoque de ${stock.product.name}`}
                          onClick={() => void onStockDeleted(stock.id)}
                          size="icon"
                          variant="outline"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  ),
                  cellClassName: "text-right",
                  header: "Ações",
                  headerClassName: "text-right",
                  key: "actions",
                },
              ]
            : [
                {
                  cell: (stock: Stock) => (
                    <div className="flex justify-end gap-2">
                      <MovementDialog
                        compact
                        initialProductId={stock.productId}
                        kind="entry"
                        label="Entrada no estoque"
                        lockedProduct={stock.product}
                        onSaved={onMovementSaved}
                        products={[stock.product]}
                        warehouse={warehouse}
                        warehouses={warehouses}
                      />
                      <MovementDialog
                        compact
                        disabled={stock.currentQuantity <= 0}
                        initialProductId={stock.productId}
                        kind="output"
                        label="Saida avulsa"
                        lockedProduct={stock.product}
                        onSaved={onMovementSaved}
                        products={[stock.product]}
                        warehouse={warehouse}
                        warehouses={warehouses}
                      />
                    </div>
                  ),
                  cellClassName: "text-right",
                  header: "Ações",
                  headerClassName: "text-right",
                  key: "actions",
                },
              ]),
        ]}
        data={filteredStocks}
        emptyMessage="Nenhum estoque cadastrado."
        getRowId={(stock) => stock.id}
        searchPlaceholder="Buscar produto no estoque..."
        searchText={(stock) =>
          [
            stock.product.name,
            stock.product.code,
            stock.product.category.name,
            stock.product.unit.abbreviation,
            stock.currentQuantity,
            stock.minimumQuantity,
            stockCurrency(stock.totalValue),
            movementSummary(latestMovementForStock(movements, stock)),
          ].join(" ")
        }
        toolbar={
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch
                checked={showLowStockOnly}
                onCheckedChange={setShowLowStockOnly}
              />
              Estoques baixos
            </label>
            {admin ? (
              <>
                <BulkStockActionDialog
                  action="zero"
                  onChanged={onMovementSaved}
                  stocks={stocks}
                />
                <BulkStockActionDialog
                  action="delete"
                  onChanged={onMovementSaved}
                  stocks={stocks}
                />
              </>
            ) : null}
          </div>
        }
      />

      <Dialog
        onOpenChange={(open) => !open && setEditingStock(null)}
        open={Boolean(editingStock)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar estoque mínimo</DialogTitle>
            <DialogDescription>{editingStock?.product.name}</DialogDescription>
          </DialogHeader>
          {editingStock ? (
            <Form onSubmit={saveMinimum}>
              <FormField>
                <Label htmlFor="minimum-stock">Estoque mínimo</Label>
                <Input
                  id="minimum-stock"
                  min="0"
                  onChange={(event) => setMinimum(event.target.value)}
                  required
                  type="number"
                  value={minimum}
                />
              </FormField>
              <Button type="submit">Salvar estoque mínimo</Button>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function WarehouseOverview({
  movements,
  stocks,
}: {
  movements: Movement[];
  stocks: Stock[];
}) {
  const lowStock = stocks.filter(
    (stock) => stock.currentQuantity > 0 && isLowStock(stock),
  );
  const outOfStock = stocks.filter((stock) => stock.currentQuantity === 0);
  const totalQuantity = stocks.reduce(
    (total, stock) => total + stock.currentQuantity,
    0,
  );
  const totalValue = stocks.reduce(
    (total, stock) => total + Number(stock.totalValue ?? 0),
    0,
  );
  const categoryStats = Object.values(
    stocks.reduce<
      Record<
        string,
        {
          itemCount: number;
          name: string;
          quantity: number;
          totalValue: number;
        }
      >
    >((groups, stock) => {
      const name = stock.product.category.name;
      const group =
        groups[name] ??
        (groups[name] = {
          itemCount: 0,
          name,
          quantity: 0,
          totalValue: 0,
        });

      group.itemCount += 1;
      group.quantity += stock.currentQuantity;
      group.totalValue += Number(stock.totalValue ?? 0);

      return groups;
    }, {}),
  ).sort((left, right) => right.totalValue - left.totalValue);
  const maxCategoryValue = Math.max(
    1,
    ...categoryStats.map((category) => category.totalValue),
  );
  const recentMovements = [...movements]
    .sort(
      (left, right) =>
        new Date(right.movementDate).getTime() -
        new Date(left.movementDate).getTime(),
    )
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {lowStock.length ? (
        <Alert>
          <AlertTitle>Produtos em baixo estoque</AlertTitle>
          <AlertDescription>
            {lowStock.map((stock) => stock.product.name).join(", ")}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950">
          <AlertTitle>Estoque acompanhado</AlertTitle>
          <AlertDescription className="text-emerald-900">
            Nenhum item deste almoxarifado esta abaixo do mínimo.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<Boxes className="h-4 w-4" />}
          label="Itens monitorados"
          value={stocks.length}
        />
        <SummaryCard
          icon={<PackagePlus className="h-4 w-4" />}
          label="Quantidade total"
          value={totalQuantity}
        />
        <SummaryCard
          icon={<TriangleAlert className="h-4 w-4" />}
          label="Baixo estoque"
          value={lowStock.length}
        />
        <SummaryCard
          icon={<BarChart3 className="h-4 w-4" />}
          label="Valor total em estoque"
          value={stockCurrency(totalValue)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
        <section className="rounded-lg border bg-card p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold">Distribuição por categoria</h3>
              <p className="text-sm text-muted-foreground">
                Participação por valor total em estoque.
              </p>
            </div>
            <Badge variant="outline">{categoryStats.length} categorias</Badge>
          </div>

          {categoryStats.length ? (
            <div className="space-y-4">
              {categoryStats.map((category) => (
                <div className="space-y-2" key={category.name}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{category.name}</span>
                    <span className="text-muted-foreground">
                      {category.itemCount} item(ns) - {category.quantity} un.
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.max(
                          6,
                          (category.totalValue / maxCategoryValue) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stockCurrency(category.totalValue)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Nenhum estoque cadastrado para analisar.
            </p>
          )}
        </section>

        <section className="rounded-lg border bg-card p-4">
          <div className="mb-4">
            <h3 className="font-semibold">Ultimas movimentações</h3>
            <p className="text-sm text-muted-foreground">
              Atividade recente deste almoxarifado.
            </p>
          </div>

          {recentMovements.length ? (
            <div className="space-y-3">
              {recentMovements.map((movement) => (
                <div
                  className="rounded-md border bg-background p-3"
                  key={movement.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge
                      variant={
                        movement.type.includes("ENTRADA")
                          ? "success"
                          : "outline"
                      }
                    >
                      {movementLabels[movement.type]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(movement.movementDate)}
                    </span>
                  </div>
                  <p className="mt-2 font-medium">{movement.product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {movement.quantity} {movement.product.unit.abbreviation}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Nenhuma movimentação registrada no período.
            </p>
          )}
        </section>
      </div>

      {outOfStock.length ? (
        <p className="text-sm text-muted-foreground">
          {outOfStock.length} produto(s) sem saldo precisam de acompanhamento.
        </p>
      ) : null}
    </div>
  );
}

function WarehouseCsvImportDialog({
  onImported,
  productCategories,
  products,
  warehouse,
}: {
  onImported: () => Promise<void>;
  productCategories: ProductCategory[];
  products: Product[];
  warehouse: Warehouse;
}) {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [categoryId, setCategoryId] = useState(productCategories[0]?.id ?? "");
  const [minimumQuantity, setMinimumQuantity] = useState("0");
  const [preview, setPreview] = useState<WarehouseCsvPreview | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [rowActions, setRowActions] = useState<Record<number, string>>({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const productOptions = [
    {
      label: "Não importar esta linha",
      searchText: "ignorar pular",
      value: skipCsvRowValue,
    },
    {
      label: "Criar produto",
      searchText: "novo cadastrar",
      value: createProductCsvValue,
    },
    ...products.map((product) => ({
      label: `${product.code} - ${product.name}`,
      searchText: `${product.category.name} ${product.unit.abbreviation}`,
      value: product.id,
    })),
  ];
  const needsCategory = (preview?.rows ?? []).some(
    (row) => (rowActions[row.index] ?? createProductCsvValue) === createProductCsvValue,
  );
  const canSubmit =
    Boolean(preview) &&
    (!needsCategory || Boolean(categoryId)) &&
    (preview?.rows ?? []).every(
      (row) => row.canImport || rowActions[row.index] === skipCsvRowValue,
    );
  const previewRows = preview?.rows ?? [];
  const totalPreviewPages = Math.max(
    1,
    Math.ceil(previewRows.length / warehouseCsvRowsPerPage),
  );
  const currentPreviewPage = Math.min(previewPage, totalPreviewPages);
  const pagedPreviewRows = previewRows.slice(
    (currentPreviewPage - 1) * warehouseCsvRowsPerPage,
    currentPreviewPage * warehouseCsvRowsPerPage,
  );
  const skippedPreviewRows = previewRows.filter(
    (row) => row.alreadyImported || !row.canImport,
  ).length;

  function openDialog() {
    setCsv("");
    setFileName("");
    setCategoryId(productCategories[0]?.id ?? "");
    setMinimumQuantity("0");
    setPreview(null);
    setPreviewPage(1);
    setRowActions({});
    setMessage(null);
    setOpen(true);
  }

  function downloadTemplate() {
    const content = [
      "nome_produto;unidade;quantidade;valor_unitario;observacao;numero_nota;cnpj_empresa;nome_empresa;data_nota",
      "Papel A4;PCT;10;25,50;Compra mensal;NF-001;12345678000190;Fornecedor Municipal;25/05/2026",
    ].join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "modelo-importacao-estoque.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function selectCsv(file?: File) {
    setMessage(null);

    if (!file) {
      setCsv("");
      setFileName("");
      setPreview(null);
      setPreviewPage(1);
      setRowActions({});
      return;
    }

    if (!file.name.toLocaleLowerCase("pt-BR").endsWith(".csv")) {
      setMessage("Selecione um arquivo CSV.");
      return;
    }

    const selectedCsv = await readCsvFile(file);

    setCsv(selectedCsv);
    setFileName(file.name);
    setPreview(null);
    setPreviewPage(1);
    setRowActions({});
    setPreviewLoading(true);

    try {
      const nextPreview = await api<WarehouseCsvPreview>(
        `/warehouses/${warehouse.id}/import-csv/preview`,
        {
          body: JSON.stringify({ csv: selectedCsv }),
          method: "POST",
        },
      );

      setPreview(nextPreview);
      setPreviewPage(1);
      setRowActions(
        Object.fromEntries(
          nextPreview.rows.map((row) => [
            row.index,
            row.alreadyImported
              ? skipCsvRowValue
              : row.canImport
                ? row.suggestedProduct?.id ?? createProductCsvValue
                : skipCsvRowValue,
          ]),
        ),
      );
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error ? caughtError.message : "Falha ao ler CSV.",
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await api(`/warehouses/${warehouse.id}/import-csv`, {
        body: JSON.stringify({
          categoryId: categoryId || undefined,
          csv,
          minimumQuantity,
          rows: (preview?.rows ?? []).map((row) => {
            const action = rowActions[row.index] ?? createProductCsvValue;

            if (action === skipCsvRowValue) {
              return {
                action: "SKIP",
                rowIndex: row.index,
              };
            }

            return {
              action: "IMPORT",
              createProduct: action === createProductCsvValue,
              productId: action !== createProductCsvValue ? action : null,
              rowIndex: row.index,
            };
          }),
        }),
        method: "POST",
      });
      await onImported();
      setOpen(false);
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error ? caughtError.message : "Falha ao importar CSV.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button onClick={openDialog} type="button" variant="outline">
        <Upload className="h-4 w-4" />
        Importar CSV
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Importar CSV da compra</DialogTitle>
            <DialogDescription>
              Confira cada linha antes de atualizar o estoque de {warehouse.name}.
            </DialogDescription>
          </DialogHeader>
          <Form onSubmit={submit}>
            {message ? (
              <Alert className="border-rose-200 bg-rose-50 text-rose-950">
                <AlertTitle>Não foi possível importar o CSV</AlertTitle>
                <AlertDescription className="text-rose-900">
                  {message}
                </AlertDescription>
              </Alert>
            ) : null}
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
              <FormField>
                <Label htmlFor="stock-csv-file">Arquivo CSV</Label>
                <Input
                  accept=".csv,text/csv"
                  id="stock-csv-file"
                  onChange={(event) => void selectCsv(event.target.files?.[0])}
                  type="file"
                />
                {fileName ? (
                  <p className="text-xs text-muted-foreground">{fileName}</p>
                ) : null}
              </FormField>
              <div className="flex items-end">
                <Button
                  className="w-full"
                  onClick={downloadTemplate}
                  type="button"
                  variant="outline"
                >
                  <FileDown className="h-4 w-4" />
                  Baixar modelo
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField>
                <Label htmlFor="stock-csv-category">Categoria para novos produtos</Label>
                <SearchSelect
                  ariaLabel="Categoria para novos produtos"
                  id="stock-csv-category"
                  onValueChange={setCategoryId}
                  options={productCategories.map((category) => ({
                    label: category.name,
                    value: category.id,
                  }))}
                  placeholder="Selecione"
                  value={categoryId}
                />
              </FormField>
              <FormField>
                <Label htmlFor="stock-csv-minimum">Estoque mínimo inicial</Label>
                <Input
                  id="stock-csv-minimum"
                  min="0"
                  onChange={(event) => setMinimumQuantity(event.target.value)}
                  required
                  type="number"
                  value={minimumQuantity}
                />
              </FormField>
            </div>

            {previewLoading ? <LoadingLine /> : null}

            {preview ? (
              <div className="overflow-hidden rounded-lg border bg-card">
                <div className="flex flex-col gap-2 border-b p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {previewRows.length}
                    </span>{" "}
                    linha(s) lida(s).{" "}
                    <span className="font-medium text-foreground">
                      {previewRows.length - skippedPreviewRows}
                    </span>{" "}
                    para importar e{" "}
                    <span className="font-medium text-foreground">
                      {skippedPreviewRows}
                    </span>{" "}
                    ignorada(s).
                  </div>
                  {totalPreviewPages > 1 ? (
                    <div className="flex items-center gap-2">
                      <Button
                        disabled={currentPreviewPage === 1}
                        onClick={() =>
                          setPreviewPage((current) => Math.max(1, current - 1))
                        }
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Anterior
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Página {currentPreviewPage} de {totalPreviewPages}
                      </span>
                      <Button
                        disabled={currentPreviewPage === totalPreviewPages}
                        onClick={() =>
                          setPreviewPage((current) =>
                            Math.min(totalPreviewPages, current + 1),
                          )
                        }
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Próxima
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Linha</TableHead>
                      <TableHead>Nota / fornecedor</TableHead>
                      <TableHead>Produto no CSV</TableHead>
                      <TableHead className="text-right">Qtd.</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="min-w-72">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedPreviewRows.map((row) => (
                      <TableRow key={row.index}>
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">
                              {row.invoiceNumber || "Sem nota"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {[row.companyName, row.cnpj]
                                .filter(Boolean)
                                .join(" - ") || "-"}
                            </p>
                            {row.errors.map((error) => (
                              <Badge key={error} variant="zero">
                                {error}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="font-medium">{row.productName}</p>
                            <p className="text-xs text-muted-foreground">
                              {row.unit}
                            </p>
                            {row.alreadyImported ? (
                              <Badge variant="outline">Já importada</Badge>
                            ) : row.suggestedProduct ? (
                              <Badge variant="success">Sugerido</Badge>
                            ) : (
                              <Badge variant="outline">Novo</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {row.quantity} {row.unit}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="space-y-1">
                            <p>{formatCurrency(row.totalValue)}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(row.unitPrice)}
                            </p>
                            {row.warnings.map((warning) => (
                              <p className="text-xs text-amber-600" key={warning}>
                                {warning}
                              </p>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <SearchSelect
                            ariaLabel={`Acao da linha ${row.rowNumber}`}
                            id={`stock-csv-row-${row.index}`}
                            onValueChange={(value) =>
                              setRowActions((current) => ({
                                ...current,
                                [row.index]: value,
                              }))
                            }
                            options={productOptions}
                            placeholder="Selecione"
                            value={rowActions[row.index] ?? createProductCsvValue}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            <Button disabled={!canSubmit || saving || previewLoading} type="submit">
              <Upload className="h-4 w-4" />
              {saving ? "Importando..." : "Confirmar importacao"}
            </Button>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function WarehouseTabs({
  movements,
  onMinimumChange,
  onMovementSaved,
  onProductCreated,
  onStockDeleted,
  productCategories,
  products,
  units,
  warehouse,
  warehouses,
}: {
  movements: Movement[];
  onMinimumChange: (stockId: string, minimumQuantity: number) => Promise<void>;
  onMovementSaved: () => Promise<void>;
  onProductCreated?: (product: Product) => Promise<void> | void;
  onStockDeleted: (stockId: string) => Promise<void>;
  productCategories?: ProductCategory[];
  products: Product[];
  units?: UnitOfMeasure[];
  warehouse: Warehouse;
  warehouses: Warehouse[];
}) {
  const { session } = useSession();
  const operator = session?.user.role === "OPERATOR";
  const [activeTab, setActiveTab] = useState(() =>
    readStoredWarehouseTab(warehouse.id),
  );
  const stockedProducts = warehouse.stocks
    .map((stock) => stock.product)
    .sort((left, right) => left.code.localeCompare(right.code));
  const transferableProducts = warehouse.stocks
    .filter((stock) => stock.currentQuantity > 0)
    .map((stock) => stock.product)
    .sort((left, right) => left.code.localeCompare(right.code));

  useEffect(() => {
    setActiveTab(readStoredWarehouseTab(warehouse.id));
  }, [warehouse.id]);

  function selectTab(nextTab: string) {
    if (!warehouseTabValues.some((tab) => tab === nextTab)) {
      return;
    }

    setActiveTab(nextTab);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(`warehouse-tab-${warehouse.id}`, nextTab);
    }
  }

  return (
    <Tabs onValueChange={selectTab} value={activeTab}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <TabsList>
          <TabsTrigger onClick={() => selectTab("stock")} value="stock">
            <Box size={15} className="mr-1" />
            Estoque
          </TabsTrigger>
          <TabsTrigger onClick={() => selectTab("overview")} value="overview">
            <ChartArea size={15} className="mr-1" />
            Visão geral
          </TabsTrigger>
          <TabsTrigger onClick={() => selectTab("history")} value="history">
            <Clock size={15} className="mr-1" />
            Histórico
          </TabsTrigger>
        </TabsList>
        <div className="flex flex-wrap gap-2">
          {activeTab === "stock" ? (
            <>
              <WarehouseCsvImportDialog
                onImported={onMovementSaved}
                productCategories={productCategories ?? []}
                products={products}
                warehouse={warehouse}
              />
              <MovementDialog
                kind="entry"
                onSaved={onMovementSaved}
                onProductCreated={onProductCreated}
                productCategories={productCategories}
                products={products}
                units={units}
                warehouse={warehouse}
                warehouses={warehouses}
              />
            </>
          ) : null}
          {(operator || session?.user.role === "ADMIN") &&
          activeTab === "stock" &&
          !warehouse.isGeneral ? (
            <MovementDialog
              kind="entryRequest"
              onSaved={onMovementSaved}
              products={stockedProducts}
              warehouse={warehouse}
              warehouses={warehouses}
            />
          ) : null}
          {warehouse.isGeneral && activeTab === "stock" && !operator ? (
            <MovementDialog
              kind="transfer"
              onSaved={onMovementSaved}
              products={transferableProducts}
              warehouse={warehouse}
              warehouses={warehouses}
            />
          ) : null}
          {activeTab === "history" ? (
            <WarehouseMovementsExportDialog
              movements={movements}
              stocks={warehouse.stocks}
              warehouse={warehouse}
            />
          ) : null}
        </div>
      </div>
      <TabsContent value="stock">
        <StockTable
          movements={movements}
          onMinimumChange={onMinimumChange}
          onMovementSaved={onMovementSaved}
          onStockDeleted={onStockDeleted}
          stocks={warehouse.stocks}
          warehouse={warehouse}
          warehouses={warehouses}
        />
      </TabsContent>
      <TabsContent value="overview">
        <WarehouseOverview movements={movements} stocks={warehouse.stocks} />
      </TabsContent>
      <TabsContent value="history">
        <MovementsTable movements={movements} />
      </TabsContent>
    </Tabs>
  );
}

export function WarehouseDetailPage() {
  const { warehouseId = "missing" } = useParams();
  const warehouse = useApiResource<Warehouse | null>(
    `/warehouses/${warehouseId}`,
    null,
  );
  const warehouses = useApiResource<Warehouse[]>("/warehouses", []);
  const products = useApiResource<Product[]>("/products", []);
  const productCategories = useApiResource<ProductCategory[]>(
    "/product-categories",
    [],
  );
  const units = useApiResource<UnitOfMeasure[]>("/units", []);
  const movements = useApiResource<Movement[]>(
    `/movements?warehouseId=${warehouseId}`,
    [],
  );
  const [message, setMessage] = useState<string | null>(null);

  async function reloadOperations() {
    await Promise.all([
      warehouse.reload(),
      warehouses.reload(),
      movements.reload(),
    ]);
  }

  function addProductToOptions(product: Product) {
    products.setData((currentProducts) =>
      [
        ...currentProducts.filter((item) => item.id !== product.id),
        product,
      ].sort((a, b) => a.code.localeCompare(b.code)),
    );
  }

  async function updateMinimum(stockId: string, minimumQuantity: number) {
    try {
      await api(`/stocks/${stockId}/minimum`, {
        body: JSON.stringify({ minimumQuantity }),
        method: "PUT",
      });
      setMessage("Estoque mínimo atualizado.");
      await warehouse.reload();
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao atualizar mínimo.",
      );
    }
  }

  async function deleteStock(stockId: string) {
    try {
      await api(`/stocks/${stockId}`, {
        method: "DELETE",
      });
      setMessage("Estoque removido.");
      await warehouse.reload();
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao remover estoque.",
      );
    }
  }

  if (
    warehouse.loading ||
    warehouses.loading ||
    products.loading ||
    productCategories.loading ||
    units.loading ||
    movements.loading
  ) {
    return <LoadingLine />;
  }

  if (
    warehouse.error ||
    warehouses.error ||
    products.error ||
    productCategories.error ||
    units.error ||
    movements.error
  ) {
    return (
      <ResourceError
        message={
          warehouse.error ??
          warehouses.error ??
          products.error ??
          productCategories.error ??
          units.error ??
          movements.error ??
          ""
        }
      />
    );
  }

  if (!warehouse.data) {
    return <ResourceError message="Almoxarifado não encontrado." />;
  }

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyMovements = movements.data.filter((movement) => {
    const date = new Date(movement.movementDate);
    return (
      date.getMonth() === currentMonth && date.getFullYear() === currentYear
    );
  });
  const monthEntries = monthlyMovements.filter((movement) =>
    movement.type.includes("ENTRADA"),
  ).length;
  const monthOutputs = monthlyMovements.filter((movement) =>
    movement.type.includes("SAIDA"),
  ).length;

  return (
    <section className="space-y-5">
      <div className="space-y-0 flex flex-row-reverse items-center justify-between">
        <Button asChild variant="outline">
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao dashboard
          </Link>
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge variant="outline">{warehouse.data.category.name}</Badge>
              {warehouse.data.isGeneral ? <Badge>Geral</Badge> : null}
            </div>
            <h2 className="text-2xl font-semibold">{warehouse.data.name}</h2>
            <p className="text-sm text-muted-foreground">
              {warehouse.data.description ||
                "Operação de estoque do almoxarifado."}
            </p>
          </div>
        </div>
      </div>

      {message ? (
        <Alert className="border-sky-200 bg-sky-50 text-sky-950">
          <AlertTitle>Atualização</AlertTitle>
          <AlertDescription className="text-sky-900">
            {message}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          icon={<Boxes className="h-4 w-4" />}
          label="Total de produtos"
          value={warehouse.data.summary.stockedProducts}
        />
        <SummaryCard
          icon={<TriangleAlert className="h-4 w-4" />}
          label="Baixo estoque"
          value={warehouse.data.summary.lowStockItems}
        />
        <SummaryCard
          icon={<PackageMinus className="h-4 w-4" />}
          label="Sem estoque"
          value={warehouse.data.summary.outOfStockItems}
        />
        <SummaryCard
          icon={<PackagePlus className="h-4 w-4" />}
          label="Entradas no mes"
          value={monthEntries}
        />
        <SummaryCard
          icon={<PackageMinus className="h-4 w-4" />}
          label="Saidas no mes"
          value={monthOutputs}
        />
      </div>

      <WarehouseTabs
        movements={movements.data}
        onMinimumChange={updateMinimum}
        onMovementSaved={reloadOperations}
        onProductCreated={addProductToOptions}
        onStockDeleted={deleteStock}
        productCategories={productCategories.data}
        products={products.data}
        units={units.data}
        warehouse={warehouse.data}
        warehouses={warehouses.data}
      />
    </section>
  );
}
