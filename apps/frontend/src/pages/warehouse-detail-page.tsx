import {
  ArrowLeft,
  ArrowRightLeft,
  Boxes,
  PackageMinus,
  PackagePlus,
  Pencil,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
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
import { SearchSelect } from "@/components/ui/search-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, useApiResource } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Invoice, Movement, Product, Stock, Warehouse } from "@/lib/types";
import { formatDate, todayInputValue } from "@/lib/utils";
import { MovementsTable } from "./movements-page";

type MovementFormProps = {
  kind: "entry" | "entryRequest" | "output" | "transfer";
  onSaved: () => Promise<void>;
  products: Product[];
  warehouse: Warehouse;
  warehouses: Warehouse[];
};

function movementLabel(kind: MovementFormProps["kind"]) {
  if (kind === "entry") {
    return "Entrada de estoque";
  }

  if (kind === "entryRequest") {
    return "Solicitar entrada";
  }

  if (kind === "output") {
    return "Saida avulsa";
  }

  return "Transferir para outro almoxarifado";
}

function InvoiceFields({
  invoiceId,
  onChange,
}: {
  invoiceId: string;
  onChange: (invoiceId: string) => void;
}) {
  const invoices = useApiResource<Invoice[]>("/invoices", []);
  const [draft, setDraft] = useState({
    cnpj: "",
    companyName: "",
    issueDate: todayInputValue().slice(0, 10),
    number: "",
    observation: "",
  });
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function saveInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
        caughtError instanceof Error ? caughtError.message : "Falha ao salvar nota.",
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
                searchText: invoice.cnpj,
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
            <FormField>
              <Label htmlFor="invoice-company">Empresa</Label>
              <Input
                id="invoice-company"
                onChange={(event) =>
                  setDraft({ ...draft, companyName: event.target.value })
                }
                required
                value={draft.companyName}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField>
                <Label htmlFor="invoice-cnpj">CNPJ</Label>
                <Input
                  id="invoice-cnpj"
                  onChange={(event) => setDraft({ ...draft, cnpj: event.target.value })}
                  required
                  value={draft.cnpj}
                />
              </FormField>
              <FormField>
                <Label htmlFor="invoice-number">Numero da nota</Label>
                <Input
                  id="invoice-number"
                  onChange={(event) => setDraft({ ...draft, number: event.target.value })}
                  required
                  value={draft.number}
                />
              </FormField>
            </div>
            <FormField>
              <Label htmlFor="invoice-date">Data da nota</Label>
              <Input
                id="invoice-date"
                onChange={(event) => setDraft({ ...draft, issueDate: event.target.value })}
                required
                type="date"
                value={draft.issueDate}
              />
            </FormField>
            <FormField>
              <Label htmlFor="invoice-observation">Observacao adicional</Label>
              <Textarea
                id="invoice-observation"
                onChange={(event) =>
                  setDraft({ ...draft, observation: event.target.value })
                }
                value={draft.observation}
              />
            </FormField>
            <Button type="submit">Salvar nota fiscal</Button>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function MovementForm({
  kind,
  onSaved,
  products,
  warehouse,
  warehouses,
}: MovementFormProps) {
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [observation, setObservation] = useState("");
  const [destinationNote, setDestinationNote] = useState("");
  const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [movementDate, setMovementDate] = useState(todayInputValue());
  const [message, setMessage] = useState<string | null>(null);

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
            movementDate,
            observation,
            productId,
            quantity,
            unitPrice:
              kind === "entry" && warehouse.isGeneral && unitPrice
                ? unitPrice
                : undefined,
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
      setMessage(
        kind === "entryRequest"
          ? "Solicitacao enviada."
          : kind === "transfer"
            ? "Transferencia enviada para recebimento."
            : "Movimentacao registrada.",
      );
      await onSaved();
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error ? caughtError.message : "Falha ao registrar.",
      );
    }
  }

  return (
    <Form onSubmit={save}>
          {message ? (
            <Alert
              className={
                message === "Movimentacao registrada." ||
                message === "Solicitacao enviada." ||
                message === "Transferencia enviada para recebimento."
                  ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                  : "border-rose-200 bg-rose-50 text-rose-950"
              }
            >
              <AlertTitle>
                {message === "Movimentacao registrada." ||
                message === "Solicitacao enviada." ||
                message === "Transferencia enviada para recebimento."
                  ? "Pronto"
                  : "Atencao"}
              </AlertTitle>
              <AlertDescription className="text-current">{message}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            <FormField>
              <Label htmlFor={`${kind}-product`}>Produto</Label>
              <SearchSelect
                ariaLabel="Produto"
                id={`${kind}-product`}
                onValueChange={setProductId}
                options={products
                  .filter((product) => product.active)
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
              <Label htmlFor={`${kind}-quantity`}>Quantidade</Label>
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

          {kind === "entry" && warehouse.isGeneral ? (
            <FormField>
              <Label htmlFor="entry-unit-price">Valor unitario</Label>
              <Input
                id="entry-unit-price"
                min="0"
                onChange={(event) => setUnitPrice(event.target.value)}
                placeholder="0.00"
                step="0.01"
                type="number"
                value={unitPrice}
              />
            </FormField>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <FormField>
              <Label htmlFor={`${kind}-date`}>Data da movimentacao</Label>
              <Input
                id={`${kind}-date`}
                onChange={(event) => setMovementDate(event.target.value)}
                required
                type="datetime-local"
                value={movementDate}
              />
            </FormField>
            <FormField>
              <Label htmlFor={`${kind}-observation`}>Observacao</Label>
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
            {kind === "entryRequest" ? "Enviar solicitacao" : "Registrar"}
          </Button>
    </Form>
  );
}

function MovementDialog(props: MovementFormProps) {
  const [open, setOpen] = useState(false);
  const label = movementLabel(props.kind);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        {props.kind === "entry" || props.kind === "entryRequest" ? (
          <PackagePlus className="h-4 w-4" />
        ) : props.kind === "output" ? (
          <PackageMinus className="h-4 w-4" />
        ) : (
          <ArrowRightLeft className="h-4 w-4" />
        )}
        {label}
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>{props.warehouse.name}</DialogDescription>
          </DialogHeader>
          <MovementForm {...props} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function StockTable({
  onMinimumChange,
  onStockDeleted,
  stocks,
}: {
  onMinimumChange: (stockId: string, minimumQuantity: number) => Promise<void>;
  onStockDeleted: (stockId: string) => Promise<void>;
  stocks: Stock[];
}) {
  const { session } = useSession();
  const [editingStock, setEditingStock] = useState<Stock | null>(null);
  const [minimum, setMinimum] = useState("");
  const admin = session?.user.role === "ADMIN";

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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Produto</TableHead>
            <TableHead>Quantidade atual</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Estoque minimo</TableHead>
            <TableHead>Ultima movimentacao</TableHead>
            {admin ? <TableHead className="text-right">Acoes</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {stocks.map((stock) => (
            <TableRow key={stock.id}>
              <TableCell>
                <p className="font-medium">{stock.product.name}</p>
                <p className="text-xs text-muted-foreground">{stock.product.code}</p>
              </TableCell>
              <TableCell>
                {stock.currentQuantity} {stock.product.unit.abbreviation}
              </TableCell>
              <TableCell>
                <StockBadge stock={stock} />
              </TableCell>
              <TableCell>{stock.minimumQuantity}</TableCell>
              <TableCell>{formatDate(stock.lastMovementAt)}</TableCell>
              {admin ? (
                <TableCell>
                  <div className="flex justify-end gap-2">
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
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        onOpenChange={(open) => !open && setEditingStock(null)}
        open={Boolean(editingStock)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar estoque minimo</DialogTitle>
            <DialogDescription>{editingStock?.product.name}</DialogDescription>
          </DialogHeader>
          {editingStock ? (
            <Form onSubmit={saveMinimum}>
              <FormField>
                <Label htmlFor="minimum-stock">Estoque minimo</Label>
                <Input
                  id="minimum-stock"
                  min="0"
                  onChange={(event) => setMinimum(event.target.value)}
                  required
                  type="number"
                  value={minimum}
                />
              </FormField>
              <Button type="submit">Salvar estoque minimo</Button>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function WarehouseTabs({
  movements,
  onMinimumChange,
  onMovementSaved,
  onStockDeleted,
  entryRequestProducts,
  products,
  warehouse,
  warehouses,
}: {
  movements: Movement[];
  onMinimumChange: (stockId: string, minimumQuantity: number) => Promise<void>;
  onMovementSaved: () => Promise<void>;
  onStockDeleted: (stockId: string) => Promise<void>;
  entryRequestProducts?: Product[];
  products: Product[];
  warehouse: Warehouse;
  warehouses: Warehouse[];
}) {
  const { session } = useSession();
  const operator = session?.user.role === "OPERATOR";
  const lowStock = warehouse.stocks.filter(
    (stock) => stock.currentQuantity > 0 && stock.currentQuantity <= stock.minimumQuantity,
  );

  return (
    <Tabs defaultValue="overview">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <TabsList>
          <TabsTrigger value="overview">Visao geral</TabsTrigger>
          <TabsTrigger value="stock">Estoque</TabsTrigger>
          <TabsTrigger value="history">Historico</TabsTrigger>
        </TabsList>
        <div className="flex flex-wrap gap-2">
          <MovementDialog
            kind={operator ? "entryRequest" : "entry"}
            onSaved={onMovementSaved}
            products={operator ? entryRequestProducts ?? products : products}
            warehouse={warehouse}
            warehouses={warehouses}
          />
          <MovementDialog
            kind="output"
            onSaved={onMovementSaved}
            products={products}
            warehouse={warehouse}
            warehouses={warehouses}
          />
          {warehouse.isGeneral && !operator ? (
            <MovementDialog
              kind="transfer"
              onSaved={onMovementSaved}
              products={products}
              warehouse={warehouse}
              warehouses={warehouses}
            />
          ) : null}
        </div>
      </div>
      <TabsContent value="overview">
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
                Nenhum item deste almoxarifado esta abaixo do minimo.
              </AlertDescription>
            </Alert>
          )}
          <StockTable
            onMinimumChange={onMinimumChange}
            onStockDeleted={onStockDeleted}
            stocks={warehouse.stocks}
          />
        </div>
      </TabsContent>
      <TabsContent value="stock">
        <StockTable
          onMinimumChange={onMinimumChange}
          onStockDeleted={onStockDeleted}
          stocks={warehouse.stocks}
        />
      </TabsContent>
      <TabsContent value="history">
        <MovementsTable movements={movements} />
      </TabsContent>
    </Tabs>
  );
}

export function WarehouseDetailPage() {
  const { warehouseId = "missing" } = useParams();
  const warehouse = useApiResource<Warehouse | null>(`/warehouses/${warehouseId}`, null);
  const warehouses = useApiResource<Warehouse[]>("/warehouses", []);
  const products = useApiResource<Product[]>("/products", []);
  const entryRequestProducts = useApiResource<Product[]>(
    "/entry-requests/available-products",
    [],
  );
  const movements = useApiResource<Movement[]>(
    `/movements?warehouseId=${warehouseId}`,
    [],
  );
  const [message, setMessage] = useState<string | null>(null);

  async function reloadOperations() {
    await Promise.all([warehouse.reload(), warehouses.reload(), movements.reload()]);
  }

  async function updateMinimum(stockId: string, minimumQuantity: number) {
    try {
      await api(`/stocks/${stockId}/minimum`, {
        body: JSON.stringify({ minimumQuantity }),
        method: "PUT",
      });
      setMessage("Estoque minimo atualizado.");
      await warehouse.reload();
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error ? caughtError.message : "Falha ao atualizar minimo.",
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
        caughtError instanceof Error ? caughtError.message : "Falha ao remover estoque.",
      );
    }
  }

  if (
    warehouse.loading ||
    warehouses.loading ||
    products.loading ||
    entryRequestProducts.loading ||
    movements.loading
  ) {
    return <LoadingLine />;
  }

  if (
    warehouse.error ||
    warehouses.error ||
    products.error ||
    entryRequestProducts.error ||
    movements.error
  ) {
    return (
      <ResourceError
        message={
          warehouse.error ??
          warehouses.error ??
          products.error ??
          entryRequestProducts.error ??
          movements.error ??
          ""
        }
      />
    );
  }

  if (!warehouse.data) {
    return <ResourceError message="Almoxarifado nao encontrado." />;
  }

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyMovements = movements.data.filter((movement) => {
    const date = new Date(movement.movementDate);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });
  const monthEntries = monthlyMovements.filter((movement) =>
    movement.type.includes("ENTRADA"),
  ).length;
  const monthOutputs = monthlyMovements.filter((movement) =>
    movement.type.includes("SAIDA"),
  ).length;

  return (
    <section className="space-y-5">
      <div className="space-y-3">
        <Button asChild size="sm" variant="ghost">
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
              {warehouse.data.description || "Operacao de estoque do almoxarifado."}
            </p>
          </div>
        </div>
      </div>

      {message ? (
        <Alert className="border-sky-200 bg-sky-50 text-sky-950">
          <AlertTitle>Atualizacao</AlertTitle>
          <AlertDescription className="text-sky-900">{message}</AlertDescription>
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
        onStockDeleted={deleteStock}
        entryRequestProducts={entryRequestProducts.data}
        products={products.data}
        warehouse={warehouse.data}
        warehouses={warehouses.data}
      />
    </section>
  );
}
