import { Building2, FileDown, FileSearch, Trash2, Upload } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { DataTable } from "@/components/domain/data-table";
import { LoadingLine, ResourceError } from "@/components/domain/feedback";
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
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, apiFile, useApiResource } from "@/lib/api";
import { getStoredSession } from "@/lib/session";
import type { Invoice, Product, ProductCategory, Supplier, Warehouse } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { onlyDigits } from "@/lib/masks";
import { MovementsTable } from "./movements-page";

const automaticProductMappingValue = "__automatic__";

type InvoiceXmlPreview = {
  invoice: {
    cnpj: string;
    companyAddress?: string | null;
    companyCity?: string | null;
    companyName: string;
    companyPhone?: string | null;
    companyState?: string | null;
    companyTradeName?: string | null;
    companyZipCode?: string | null;
    invoiceKey?: string | null;
    issueDate: string;
    municipalRegistration?: string | null;
    number: string;
    series?: string | null;
    stateRegistration?: string | null;
    totalValue: number;
  };
  items: Array<{
    code: string;
    index: number;
    name: string;
    quantity: number;
    suggestedProduct?: Pick<Product, "code" | "id" | "name" | "unit"> | null;
    totalValue: number;
    unit: string;
    unitPrice: number;
  }>;
};

function invoiceTotal(invoice: Invoice) {
  const invoiceValue = Number(invoice.totalValue ?? 0);

  if (Number.isFinite(invoiceValue) && invoiceValue > 0) {
    return invoiceValue;
  }

  return (invoice.movements ?? []).reduce((total, movement) => {
    const unitPrice =
      movement.unitPrice === null || movement.unitPrice === undefined
        ? 0
        : Number(movement.unitPrice);

    return Number.isFinite(unitPrice) ? total + unitPrice * movement.quantity : total;
  }, 0);
}

function invoiceReportQuery(filters: {
  cnpj?: string;
  companyName?: string;
  from?: string;
  invoiceId?: string;
  number?: string;
  supplierId?: string;
  to?: string;
}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, key === "cnpj" ? onlyDigits(value) : value);
    }
  });

  const query = params.toString();
  return `/reports/invoices${query ? `?${query}` : ""}`;
}

function invoicePdfFileName(invoice: Invoice) {
  const safeNumber =
    invoice.number.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") ||
    "nota";

  return `nota-fiscal-${safeNumber}.pdf`;
}

function InvoicePdfButton({
  disabled,
  invoice,
  onExport,
  size = "icon",
}: {
  disabled?: boolean;
  invoice: Invoice;
  onExport: (path: string, fileName: string) => Promise<void>;
  size?: "default" | "icon" | "sm";
}) {
  return (
    <Button
      aria-label={`Exportar nota ${invoice.number} em PDF`}
      disabled={disabled}
      onClick={() =>
        void onExport(
          invoiceReportQuery({ invoiceId: invoice.id }),
          invoicePdfFileName(invoice),
        )
      }
      size={size}
      type="button"
      variant="outline"
    >
      <FileDown className="h-4 w-4" />
      {size === "icon" ? null : "Exportar nota"}
    </Button>
  );
}

function SupplierManagementDialog({
  onSaved,
  suppliers,
}: {
  onSaved: () => Promise<void>;
  suppliers: Supplier[];
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    cnpj: "",
    name: "",
    phone: "",
    tradeName: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await api<Supplier>("/suppliers", {
        body: JSON.stringify(draft),
        method: "POST",
      });
      setDraft({ cnpj: "", name: "", phone: "", tradeName: "" });
      await onSaved();
      setMessage("Fornecedor salvo.");
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao salvar fornecedor.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button" variant="outline">
        <Building2 className="h-4 w-4" />
        Fornecedores
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Fornecedores</DialogTitle>
            <DialogDescription>
              Cadastre empresas para agilizar a criacao de notas fiscais.
            </DialogDescription>
          </DialogHeader>
          {message ? <ResourceError message={message} /> : null}
          <Form onSubmit={submit}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField>
                <Label htmlFor="supplier-name">Razao social</Label>
                <Input
                  id="supplier-name"
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                  required
                  value={draft.name}
                />
              </FormField>
              <FormField>
                <Label htmlFor="supplier-trade-name">Nome fantasia</Label>
                <Input
                  id="supplier-trade-name"
                  onChange={(event) =>
                    setDraft({ ...draft, tradeName: event.target.value })
                  }
                  value={draft.tradeName}
                />
              </FormField>
              <FormField>
                <Label htmlFor="supplier-cnpj">CNPJ</Label>
                <MaskedInput
                  id="supplier-cnpj"
                  mask="cnpj"
                  onChange={(event) =>
                    setDraft({ ...draft, cnpj: event.target.value })
                  }
                  required
                  value={draft.cnpj}
                />
              </FormField>
              <FormField>
                <Label htmlFor="supplier-phone">Telefone</Label>
                <MaskedInput
                  id="supplier-phone"
                  mask="phone"
                  onChange={(event) =>
                    setDraft({ ...draft, phone: event.target.value })
                  }
                  value={draft.phone}
                />
              </FormField>
            </div>
            <Button disabled={saving} type="submit">
              {saving ? "Salvando..." : "Salvar fornecedor"}
            </Button>
          </Form>
          <DataTable
            columns={[
              {
                cell: (supplier) => (
                  <>
                    <p className="font-medium">{supplier.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {supplier.tradeName ?? "-"}
                    </p>
                  </>
                ),
                header: "Fornecedor",
                key: "supplier",
              },
              {
                cell: (supplier) => supplier.cnpj,
                header: "CNPJ",
                key: "cnpj",
              },
              {
                cell: (supplier) => supplier.phone ?? "-",
                header: "Contato",
                key: "contact",
              },
              {
                cell: (supplier) => (supplier.active ? "Ativo" : "Inativo"),
                header: "Status",
                key: "status",
              },
            ]}
            data={suppliers}
            emptyMessage="Nenhum fornecedor cadastrado."
            getRowId={(supplier) => supplier.id}
            searchPlaceholder="Buscar fornecedor..."
            searchText={(supplier) =>
              [
                supplier.name,
                supplier.tradeName,
                supplier.cnpj,
                supplier.phone,
              ].join(" ")
            }
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function InvoiceXmlImportDialog({
  categories,
  loading,
  onImported,
  products,
  warehouses,
}: {
  categories: ProductCategory[];
  loading: boolean;
  onImported: () => Promise<void>;
  products: Product[];
  warehouses: Warehouse[];
}) {
  const [open, setOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [xml, setXml] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<InvoiceXmlPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [productMappings, setProductMappings] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const productOptions = [
    {
      label: "Automatico",
      searchText: "criar atualizar sugerido",
      value: automaticProductMappingValue,
    },
    ...products.map((product) => ({
      label: `${product.code} - ${product.name}`,
      searchText: `${product.category.name} ${product.unit.abbreviation}`,
      value: product.id,
    })),
  ];

  function openDialog() {
    setWarehouseId(warehouses[0]?.id ?? "");
    setCategoryId(categories[0]?.id ?? "");
    setXml("");
    setFileName("");
    setPreview(null);
    setProductMappings({});
    setMessage(null);
    setOpen(true);
  }

  function resetXmlPreview() {
    setXml("");
    setFileName("");
    setPreview(null);
    setProductMappings({});
  }

  async function selectXml(file?: File) {
    setMessage(null);

    if (!file) {
      resetXmlPreview();
      return;
    }

    const selectedXml = await file.text();

    setFileName(file.name);
    setXml(selectedXml);
    setPreview(null);
    setProductMappings({});
    setPreviewLoading(true);

    try {
      const nextPreview = await api<InvoiceXmlPreview>("/invoices/import-xml/preview", {
        body: JSON.stringify({ xml: selectedXml }),
        method: "POST",
      });

      setPreview(nextPreview);
      setProductMappings(
        Object.fromEntries(
          nextPreview.items.map((item) => [
            item.index,
            item.suggestedProduct?.id ?? automaticProductMappingValue,
          ]),
        ),
      );
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error ? caughtError.message : "Falha ao ler XML.",
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  function updateProductMapping(itemIndex: number, productId: string) {
    setProductMappings((current) => ({
      ...current,
      [itemIndex]: productId,
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await api("/invoices/import-xml", {
        body: JSON.stringify({
          categoryId: categoryId || undefined,
          productMappings: (preview?.items ?? []).map((item) => {
            const mappedProductId = productMappings[item.index];

            return {
              itemIndex: item.index,
              productId:
                mappedProductId && mappedProductId !== automaticProductMappingValue
                  ? mappedProductId
                  : null,
            };
          }),
          warehouseId,
          xml,
        }),
        method: "POST",
      });
      await onImported();
      setOpen(false);
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error ? caughtError.message : "Falha ao importar XML.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button disabled={loading} onClick={openDialog} type="button" variant="outline">
        <Upload className="h-4 w-4" />
        Importar XML
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Importar nota por XML</DialogTitle>
            <DialogDescription>
              Confira os dados da nota e o mapeamento dos produtos antes de importar.
            </DialogDescription>
          </DialogHeader>
          <Form onSubmit={submit}>
            {message ? <ResourceError message={message} /> : null}
            <FormField>
              <Label htmlFor="invoice-import-warehouse">Almoxarifado</Label>
              <SearchSelect
                ariaLabel="Almoxarifado da importacao"
                id="invoice-import-warehouse"
                onValueChange={setWarehouseId}
                options={warehouses.map((warehouse) => ({
                  label: warehouse.name,
                  searchText: warehouse.category.name,
                  value: warehouse.id,
                }))}
                placeholder="Selecione"
                value={warehouseId}
              />
            </FormField>
            <FormField>
              <Label htmlFor="invoice-import-category">Categoria padrão</Label>
              <SearchSelect
                ariaLabel="Categoria padrao dos novos produtos"
                id="invoice-import-category"
                onValueChange={setCategoryId}
                options={categories.map((category) => ({
                  label: category.name,
                  value: category.id,
                }))}
                placeholder="Selecione"
                value={categoryId}
              />
            </FormField>
            <FormField>
              <Label htmlFor="invoice-import-file">XML da nota</Label>
              <Input
                accept=".xml,text/xml,application/xml"
                id="invoice-import-file"
                onChange={(event) => void selectXml(event.target.files?.[0])}
                type="file"
              />
              {fileName ? (
                <p className="text-xs text-muted-foreground">{fileName}</p>
              ) : null}
            </FormField>

            {previewLoading ? <LoadingLine /> : null}

            {preview ? (
              <div className="space-y-3">
                <div className="grid gap-3 rounded-lg border bg-card p-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      Empresa
                    </p>
                    <p className="font-medium">{preview.invoice.companyName}</p>
                    <p className="text-muted-foreground">
                      {preview.invoice.companyTradeName ?? "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      Documento
                    </p>
                    <p>{preview.invoice.cnpj}</p>
                    <p className="text-muted-foreground">
                      IE {preview.invoice.stateRegistration ?? "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      Nota
                    </p>
                    <p>
                      {preview.invoice.number}
                      {preview.invoice.series ? ` / serie ${preview.invoice.series}` : ""}
                    </p>
                    <p className="text-muted-foreground">
                      {formatDate(preview.invoice.issueDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      Endereco
                    </p>
                    <p>{preview.invoice.companyAddress ?? "-"}</p>
                    <p className="text-muted-foreground">
                      {[
                        preview.invoice.companyCity,
                        preview.invoice.companyState,
                      ]
                        .filter(Boolean)
                        .join(" / ") || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      Chave
                    </p>
                    <p className="truncate">{preview.invoice.invoiceKey ?? "-"}</p>
                    <p className="text-muted-foreground">
                      Tel. {preview.invoice.companyPhone ?? "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      Valor total
                    </p>
                    <p className="text-lg font-semibold">
                      {formatCurrency(preview.invoice.totalValue)}
                    </p>
                    <p className="text-muted-foreground">
                      {preview.items.length} item(ns)
                    </p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto no XML</TableHead>
                        <TableHead className="text-right">Qtd.</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="min-w-72">Produto no catálogo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.items.map((item) => {
                        const mappingValue =
                          productMappings[item.index] ?? automaticProductMappingValue;

                        return (
                          <TableRow key={`${item.index}-${item.code}`}>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium">{item.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.code || "-"} / {item.unit}
                                </p>
                                {item.suggestedProduct ? (
                                  <Badge variant="success">Sugerido</Badge>
                                ) : (
                                  <Badge variant="outline">Novo</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {item.quantity} {item.unit}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="space-y-1">
                                <p>{formatCurrency(item.totalValue)}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatCurrency(item.unitPrice)}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <SearchSelect
                                ariaLabel={`Produto do item ${item.index + 1}`}
                                id={`invoice-import-product-${item.index}`}
                                onValueChange={(productId) =>
                                  updateProductMapping(item.index, productId)
                                }
                                options={productOptions}
                                placeholder="Automatico"
                                searchPlaceholder="Buscar produto..."
                                value={mappingValue}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            <Button
              disabled={
                !warehouseId ||
                !categoryId ||
                !xml ||
                !preview ||
                previewLoading ||
                saving
              }
              type="submit"
            >
              <Upload className="h-4 w-4" />
              {saving ? "Importando..." : "Confirmar importacao"}
            </Button>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InvoiceExportDialog({
  from,
  invoices,
  loading,
  onExport,
  suppliers,
  to,
}: {
  from: string;
  invoices: Invoice[];
  loading: boolean;
  onExport: (path: string, fileName: string) => Promise<void>;
  suppliers: Supplier[];
  to: string;
}) {
  const [open, setOpen] = useState(false);
  const [invoiceId, setInvoiceId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [number, setNumber] = useState("");
  const [supplierId, setSupplierId] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const selectedInvoice = invoices.find((invoice) => invoice.id === invoiceId);

    void onExport(
      invoiceReportQuery({
        cnpj,
        companyName,
        from,
        invoiceId,
        number,
        supplierId,
        to,
      }),
      selectedInvoice ? invoicePdfFileName(selectedInvoice) : "relatorio-notas-fiscais.pdf",
    ).then(() => setOpen(false));
  }

  return (
    <>
      <Button disabled={loading} onClick={() => setOpen(true)} type="button">
        <FileDown className="h-4 w-4" />
        {loading ? "Gerando..." : "Exportar nota"}
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar notas fiscais</DialogTitle>
            <DialogDescription>
              Selecione uma nota ou refine por empresa, CNPJ e número.
            </DialogDescription>
          </DialogHeader>
          <Form onSubmit={submit}>
            <FormField>
              <Label htmlFor="invoice-export-select">Nota fiscal</Label>
              <SearchSelect
                ariaLabel="Selecionar nota fiscal"
                id="invoice-export-select"
                onValueChange={setInvoiceId}
                options={[
                  { label: "Todas as notas", value: "" },
                  ...invoices.map((invoice) => ({
                    label: `${invoice.number} - ${invoice.companyName}`,
                    searchText: `${invoice.cnpj} ${invoice.companyName}`,
                    value: invoice.id,
                  })),
                ]}
                placeholder="Todas as notas"
                searchPlaceholder="Buscar por nota, empresa ou CNPJ..."
                value={invoiceId}
              />
            </FormField>
            <FormField>
              <Label htmlFor="invoice-export-supplier">Fornecedor</Label>
              <SearchSelect
                ariaLabel="Fornecedor"
                id="invoice-export-supplier"
                onValueChange={setSupplierId}
                options={[
                  { label: "Todos os fornecedores", value: "" },
                  ...suppliers.map((supplier) => ({
                    label: supplier.name,
                    searchText: `${supplier.tradeName ?? ""} ${supplier.cnpj}`,
                    value: supplier.id,
                  })),
                ]}
                placeholder="Todos os fornecedores"
                value={supplierId}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField>
                <Label htmlFor="invoice-export-company">Empresa</Label>
                <Input
                  id="invoice-export-company"
                  placeholder="Empresa"
                  onChange={(event) => setCompanyName(event.target.value)}
                  value={companyName}
                />
              </FormField>
              <FormField>
                <Label htmlFor="invoice-export-cnpj">CNPJ</Label>
                <MaskedInput
                  id="invoice-export-cnpj"
                  mask="cnpj"
                  validate={false}
                  onChange={(event) => setCnpj(event.target.value)}
                  value={cnpj}
                />
              </FormField>
            </div>
            <FormField>
              <Label htmlFor="invoice-export-number">Número da nota</Label>
              <Input
                id="invoice-export-number"
                placeholder="010101"
                onChange={(event) => setNumber(event.target.value)}
                value={number}
              />
            </FormField>
            <Button disabled={loading} type="submit">
              <FileDown className="h-4 w-4" />
              {loading ? "Gerando..." : "Exportar notas"}
            </Button>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function InvoiceMovementsDialog({
  invoice,
  onExport,
  exporting,
}: {
  exporting?: boolean;
  invoice: Invoice;
  onExport?: (path: string, fileName: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const movements = invoice.movements ?? [];

  return (
    <>
      <Button
        aria-label={`Consultar movimentações da nota ${invoice.number}`}
        onClick={() => setOpen(true)}
        size="icon"
        variant="outline"
      >
        <FileSearch className="h-4 w-4" />
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Movimentações da nota {invoice.number}</DialogTitle>
            <DialogDescription>
              {invoice.companyName} em {formatDate(invoice.issueDate)}
            </DialogDescription>
          </DialogHeader>
          {onExport ? (
            <div className="flex justify-end">
              <InvoicePdfButton
                disabled={exporting}
                invoice={invoice}
                onExport={onExport}
                size="sm"
              />
            </div>
          ) : null}

          <div className="grid gap-3 rounded-lg border bg-card p-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Empresa</p>
              <p className="font-medium">{invoice.companyName}</p>
              <p className="text-muted-foreground">{invoice.companyTradeName ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Documento</p>
              <p>{invoice.cnpj}</p>
              <p className="text-muted-foreground">
                IE {invoice.stateRegistration ?? "-"} | IM{" "}
                {invoice.municipalRegistration ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Endereco</p>
              <p>{invoice.companyAddress ?? "-"}</p>
              <p className="text-muted-foreground">
                {[invoice.companyCity, invoice.companyState].filter(Boolean).join(" / ") ||
                  "-"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Nota</p>
              <p>
                Serie {invoice.series ?? "-"} | Chave {invoice.invoiceKey ?? "-"}
              </p>
              <p className="text-muted-foreground">
                CEP {invoice.companyZipCode ?? "-"} | Tel. {invoice.companyPhone ?? "-"}
              </p>
            </div>
          </div>

          {movements.length ? (
            <MovementsTable movements={movements} />
          ) : (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Nenhuma movimentação vinculada a esta nota.
            </div>
          )}
          <div className="flex flex-col gap-1 rounded-lg border bg-card p-3 text-right">
            <span className="text-sm text-muted-foreground">Valor da nota</span>
            <strong className="text-lg">{formatCurrency(invoiceTotal(invoice))}</strong>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function InvoicesPage() {
  const [searchParams] = useSearchParams();
  const invoices = useApiResource<Invoice[]>("/invoices", []);
  const warehouses = useApiResource<Warehouse[]>("/warehouses", []);
  const categories = useApiResource<ProductCategory[]>("/product-categories", []);
  const products = useApiResource<Product[]>("/products", []);
  const suppliers = useApiResource<Supplier[]>("/suppliers", []);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [movementFilter, setMovementFilter] = useState("all");
  const [supplierId, setSupplierId] = useState("");
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selectedInvoiceId = searchParams.get("invoiceId");
  const canDeleteInvoices = getStoredSession()?.user.role === "ADMIN";

  const filteredInvoices = useMemo(
    () =>
      invoices.data.filter((invoice) => {
        const issueDate = new Date(invoice.issueDate);
        const fromDate = from ? new Date(`${from}T00:00:00`) : null;
        const toDate = to ? new Date(`${to}T23:59:59.999`) : null;
        const movementCount = invoice.movements?.length ?? 0;

        return (
          (!selectedInvoiceId || invoice.id === selectedInvoiceId) &&
          (!supplierId || invoice.supplierId === supplierId) &&
          (!fromDate || issueDate >= fromDate) &&
          (!toDate || issueDate <= toDate) &&
          (movementFilter === "all" ||
            (movementFilter === "linked" && movementCount > 0) ||
            (movementFilter === "unlinked" && movementCount === 0))
        );
      }),
    [from, invoices.data, movementFilter, selectedInvoiceId, supplierId, to],
  );

  function clearFilters() {
    setFrom("");
    setSupplierId("");
    setTo("");
    setMovementFilter("all");
  }

  async function downloadReport(path: string, fileName: string) {
    setExporting(true);
    setMessage(null);

    try {
      const blob = await apiFile(path);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao exportar nota fiscal.",
      );
    } finally {
      setExporting(false);
    }
  }

  async function reloadAfterImport() {
    setMessage("Nota importada e estoque atualizado.");
    await Promise.all([invoices.reload(), products.reload()]);
  }

  async function removeInvoice(invoice: Invoice) {
    const confirmed = window.confirm(
      `Excluir nota ${invoice.number}? As movimentações vinculadas serão mantidas sem nota fiscal.`,
    );

    if (!confirmed) {
      return;
    }

    setMessage(null);

    try {
      await api<void>(`/invoices/${invoice.id}`, { method: "DELETE" });
      setMessage("Nota fiscal removida.");
      await invoices.reload();
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao remover nota fiscal.",
      );
    }
  }

  if (
    invoices.loading ||
    warehouses.loading ||
    categories.loading ||
    products.loading ||
    suppliers.loading
  ) {
    return <LoadingLine />;
  }

  if (
    invoices.error ||
    warehouses.error ||
    categories.error ||
    products.error ||
    suppliers.error
  ) {
    return (
      <ResourceError
        message={
          invoices.error ??
          warehouses.error ??
          categories.error ??
          products.error ??
          suppliers.error ??
          ""
        }
      />
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Documentos de entrada</p>
          <h2 className="text-2xl font-semibold">Notas fiscais</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <SupplierManagementDialog
            onSaved={suppliers.reload}
            suppliers={suppliers.data}
          />
          <InvoiceXmlImportDialog
            categories={categories.data}
            loading={exporting}
            onImported={reloadAfterImport}
            products={products.data}
            warehouses={warehouses.data}
          />
          <InvoiceExportDialog
            from={from}
            invoices={invoices.data}
            loading={exporting}
            onExport={downloadReport}
            suppliers={suppliers.data}
            to={to}
          />
        </div>
      </div>

      {message ? <ResourceError message={message} /> : null}

      <div className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]">
        <FormField>
          <Label htmlFor="invoice-from">Emissão de</Label>
          <Input
            id="invoice-from"
            onChange={(event) => setFrom(event.target.value)}
            type="date"
            value={from}
          />
        </FormField>
        <FormField>
          <Label htmlFor="invoice-to">Emissão ate</Label>
          <Input
            id="invoice-to"
            onChange={(event) => setTo(event.target.value)}
            type="date"
            value={to}
          />
        </FormField>
        <FormField>
          <Label htmlFor="invoice-movements">Movimentações</Label>
          <Select
            id="invoice-movements"
            onChange={(event) => setMovementFilter(event.target.value)}
            value={movementFilter}
          >
            <option value="all">Todas</option>
            <option value="linked">Com movimentações</option>
            <option value="unlinked">Sem movimentações</option>
          </Select>
        </FormField>
        <FormField>
          <Label htmlFor="invoice-supplier-filter">Fornecedor</Label>
          <SearchSelect
            ariaLabel="Filtrar fornecedor"
            id="invoice-supplier-filter"
            onValueChange={setSupplierId}
            options={[
              { label: "Todos", value: "" },
              ...suppliers.data.map((supplier) => ({
                label: supplier.name,
                searchText: `${supplier.tradeName ?? ""} ${supplier.cnpj}`,
                value: supplier.id,
              })),
            ]}
            placeholder="Todos"
            value={supplierId}
          />
        </FormField>
        <Button className="self-end" onClick={clearFilters} type="button" variant="outline">
          Limpar filtros
        </Button>
      </div>

      <DataTable
        columns={[
          {
            cell: (invoice) => (
              <>
                <p className="font-medium">{invoice.number}</p>
                {invoice.observation ? (
                  <p className="text-xs text-muted-foreground">{invoice.observation}</p>
                ) : null}
              </>
            ),
            header: "Nota fiscal",
            key: "invoice",
          },
          {
            cell: (invoice) => invoice.companyName,
            header: "Empresa",
            key: "company",
          },
          {
            cell: (invoice) => invoice.cnpj,
            header: "CNPJ",
            key: "cnpj",
          },
          {
            cell: (invoice) => formatDate(invoice.issueDate),
            header: "Data da nota",
            key: "issue-date",
          },
          {
            cell: (invoice) => formatCurrency(invoiceTotal(invoice)),
            header: "Valor da nota",
            key: "invoice-value",
          },
          {
            cell: (invoice) => (
              <Badge variant={(invoice.movements?.length ?? 0) ? "success" : "outline"}>
                {invoice.movements?.length ?? 0}
              </Badge>
            ),
            header: "Movimentações",
            key: "movements",
          },
          {
            cell: (invoice) => (
              <div className="flex justify-end gap-2">
                <InvoicePdfButton
                  disabled={exporting}
                  invoice={invoice}
                  onExport={downloadReport}
                />
                <InvoiceMovementsDialog
                  exporting={exporting}
                  invoice={invoice}
                  onExport={downloadReport}
                />
                {canDeleteInvoices ? (
                  <Button
                    aria-label={`Remover nota ${invoice.number}`}
                    onClick={() => void removeInvoice(invoice)}
                    size="icon"
                    type="button"
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
        ]}
        data={filteredInvoices}
        emptyMessage="Nenhuma nota fiscal cadastrada."
        getRowId={(invoice) => invoice.id}
        searchPlaceholder="Buscar nota, empresa ou CNPJ..."
        searchText={(invoice) =>
          [
            invoice.number,
            invoice.companyName,
            invoice.companyTradeName,
            invoice.cnpj,
            invoice.invoiceKey,
            invoice.observation,
            formatDate(invoice.issueDate),
            formatCurrency(invoiceTotal(invoice)),
            ...(invoice.movements ?? []).flatMap((movement) => [
              movement.product.name,
              movement.product.code,
              movement.warehouse.name,
            ]),
          ].join(" ")
        }
      />
    </section>
  );
}
