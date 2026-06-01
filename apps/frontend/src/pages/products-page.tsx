import { Boxes, FileDown, Pencil, Plus, Ruler, Trash2, Upload } from "lucide-react";
import { useState, type FormEvent } from "react";
import { DataTable } from "@/components/domain/data-table";
import {
  CategoryCreateDialog,
  UnitCreateDialog,
} from "@/components/domain/catalog-quick-create-dialog";
import { LoadingLine, ResourceError } from "@/components/domain/feedback";
import { StockBadge } from "@/components/domain/stock-badge";
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
import { Textarea } from "@/components/ui/textarea";
import { api, useApiResource } from "@/lib/api";
import { readCsvFile } from "@/lib/csv";
import { hasPermission } from "@/lib/permissions";
import { useSession } from "@/lib/session";
import type {
  Product,
  ProductCategory,
  ProductCsvPreview,
  Stock,
  UnitConversion,
  UnitOfMeasure,
} from "@/lib/types";

export { readCsvFile };

type ProductDraft = {
  active: boolean;
  categoryId: string;
  code?: string;
  description: string;
  id?: string;
  minimumQuantity: string;
  name: string;
  unitId: string;
};

type ProductConversionDraft = {
  active: boolean;
  factorToBase: string;
  id?: string;
  fromUnitId: string;
};

function emptyDraft(categoryId = "", unitId = ""): ProductDraft {
  return {
    active: true,
    categoryId,
    description: "",
    minimumQuantity: "0",
    name: "",
    unitId,
  };
}

function conversionFactorLabel(value: number | string) {
  return Number(value).toLocaleString("pt-BR", {
    maximumFractionDigits: 6,
  });
}

export function ProductStocksDialog({
  product,
  stocks,
}: {
  product: Product;
  stocks: Stock[];
}) {
  const [open, setOpen] = useState(false);
  const productStocks = stocks.filter((stock) => stock.productId === product.id);

  return (
    <>
      <Button
        aria-label={`Consultar estoques de ${product.name}`}
        onClick={() => setOpen(true)}
        size="icon"
        variant="outline"
      >
        <Boxes className="h-4 w-4" />
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Estoques de {product.name}</DialogTitle>
            <DialogDescription>Quantidades do produto por almoxarifado.</DialogDescription>
          </DialogHeader>
          <DataTable
            columns={[
              {
                cell: (stock) => stock.warehouse?.name ?? "Almoxarifado",
                cellClassName: "font-medium",
                header: "Almoxarifado",
                key: "warehouse",
              },
              {
                cell: (stock) => `${stock.currentQuantity} ${product.unit.abbreviation}`,
                header: "Quantidade",
                key: "quantity",
              },
              {
                cell: (stock) => stock.minimumQuantity,
                header: "Estoque mínimo",
                key: "minimum",
              },
              {
                cell: (stock) => <StockBadge stock={stock} />,
                header: "Estado",
                key: "state",
              },
            ]}
            data={productStocks}
            emptyMessage="Nenhum estoque cadastrado."
            getRowId={(stock) => stock.id}
            initialPageSize={5}
            searchPlaceholder="Buscar almoxarifado..."
            searchText={(stock) =>
              [
                stock.warehouse?.name,
                stock.currentQuantity,
                stock.minimumQuantity,
                product.name,
              ].join(" ")
            }
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ProductConversionsDialog({
  onChanged,
  product,
  units,
}: {
  onChanged: (conversions: UnitConversion[]) => Promise<void> | void;
  product: Product;
  units: UnitOfMeasure[];
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ProductConversionDraft | null>(null);
  const [conversions, setConversions] = useState<UnitConversion[]>(
    product.unitConversions ?? [],
  );
  const [message, setMessage] = useState<string | null>(null);
  const [editorMessage, setEditorMessage] = useState<string | null>(null);
  const conversionOptions = units
    .filter(
      (unit) =>
        unit.id !== product.unitId &&
        (draft?.id ||
          !conversions.some(
            (conversion) => conversion.fromUnitId === unit.id && conversion.active,
          ) ||
          draft?.fromUnitId === unit.id),
    )
    .map((unit) => ({
      label: `${unit.name} / ${unit.abbreviation}`,
      value: unit.id,
    }));

  function newDraft() {
    setMessage(null);
    setEditorMessage(null);
    setDraft({
      active: true,
      factorToBase: "",
      fromUnitId: conversionOptions[0]?.value ?? "",
    });
  }

  function editDraft(conversion: UnitConversion) {
    setMessage(null);
    setEditorMessage(null);
    setDraft({
      active: conversion.active,
      factorToBase: String(conversion.factorToBase),
      fromUnitId: conversion.fromUnitId,
      id: conversion.id,
    });
  }

  async function saveConversion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft) {
      return;
    }

    setEditorMessage(null);

    try {
      const saved = await api<UnitConversion>(
        draft.id
          ? `/products/${product.id}/unit-conversions/${draft.id}`
          : `/products/${product.id}/unit-conversions`,
        {
          body: JSON.stringify({
            active: draft.active,
            factorToBase: draft.factorToBase,
            fromUnitId: draft.fromUnitId,
          }),
          method: draft.id ? "PUT" : "POST",
        },
      );

      const nextConversions = draft.id
        ? conversions.map((conversion) =>
            conversion.id === saved.id ? saved : conversion,
          )
        : [...conversions, saved];

      setConversions(nextConversions);
      setDraft(null);
      setEditorMessage(null);
      await onChanged(nextConversions);
    } catch (caughtError) {
      setEditorMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao salvar conversão.",
      );
    }
  }

  async function removeConversion(conversion: UnitConversion) {
    setMessage(null);

    try {
      await api<void>(
        `/products/${product.id}/unit-conversions/${conversion.id}`,
        { method: "DELETE" },
      );
      const nextConversions = conversions.filter(
        (currentConversion) => currentConversion.id !== conversion.id,
      );
      setConversions(nextConversions);
      if (draft?.id === conversion.id) {
        setDraft(null);
        setEditorMessage(null);
      }
      await onChanged(nextConversions);
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao remover conversão.",
      );
    }
  }

  return (
    <>
      <Button
        aria-label={`Configurar conversões de ${product.name}`}
        onClick={() => {
          setConversions(product.unitConversions ?? []);
          setDraft(null);
          setEditorMessage(null);
          setMessage(null);
          setOpen(true);
        }}
        size="icon"
        variant="outline"
      >
        <Ruler className="h-4 w-4" />
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Conversões de {product.name}</DialogTitle>
            <DialogDescription>
              Configure unidades alternativas para registrar o saldo em{" "}
              {product.unit.abbreviation}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {message ? <ResourceError message={message} /> : null}
            <div className="flex justify-end">
              <Button onClick={newDraft} type="button" variant="outline">
                <Plus className="h-4 w-4" />
                Nova conversão
              </Button>
            </div>
            <DataTable
              columns={[
                {
                  cell: (conversion) =>
                    `1 ${conversion.fromUnit.abbreviation} = ${conversionFactorLabel(
                      conversion.factorToBase,
                    )} ${product.unit.abbreviation}`,
                  cellClassName: "font-medium",
                  header: "Conversão",
                  key: "conversion",
                },
                {
                  cell: (conversion) => (
                    <Badge variant={conversion.active ? "success" : "zero"}>
                      {conversion.active ? "Ativa" : "Inativa"}
                    </Badge>
                  ),
                  header: "Status",
                  key: "status",
                },
                {
                  cell: (conversion) => (
                    <div className="flex justify-end gap-2">
                      <Button
                        aria-label={`Editar conversão ${conversion.fromUnit.abbreviation}`}
                        onClick={() => editDraft(conversion)}
                        size="icon"
                        type="button"
                        variant="outline"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        aria-label={`Remover conversão ${conversion.fromUnit.abbreviation}`}
                        onClick={() => void removeConversion(conversion)}
                        size="icon"
                        type="button"
                        variant="outline"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ),
                  cellClassName: "text-right",
                  header: "Ações",
                  headerClassName: "text-right",
                  key: "actions",
                },
              ]}
              data={conversions}
              emptyMessage="Nenhuma conversão cadastrada."
              getRowId={(conversion) => conversion.id}
              initialPageSize={5}
              searchPlaceholder="Buscar conversão..."
              searchText={(conversion) =>
                [
                  conversion.fromUnit.name,
                  conversion.fromUnit.abbreviation,
                  conversion.factorToBase,
                  product.unit.abbreviation,
                ].join(" ")
              }
            />
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        onOpenChange={(editorOpen) => {
          if (!editorOpen) {
            setDraft(null);
            setEditorMessage(null);
          }
        }}
        open={Boolean(draft)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? "Editar conversão" : "Nova conversão"}
            </DialogTitle>
            <DialogDescription>
              Informe como a unidade alternativa deve ser convertida para{" "}
              {product.unit.abbreviation}.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <Form onSubmit={saveConversion}>
              {editorMessage ? <ResourceError message={editorMessage} /> : null}
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
                <FormField>
                  <Label htmlFor="product-conversion-unit">
                    Unidade de entrada ou saída
                  </Label>
                  <SearchSelect
                    ariaLabel="Unidade de entrada ou saída"
                    id="product-conversion-unit"
                    onValueChange={(fromUnitId) => setDraft({ ...draft, fromUnitId })}
                    options={conversionOptions}
                    placeholder="Selecione"
                    value={draft.fromUnitId}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="product-conversion-factor">Equivale a</Label>
                  <Input
                    id="product-conversion-factor"
                    min="0.000001"
                    onChange={(event) =>
                      setDraft({ ...draft, factorToBase: event.target.value })
                    }
                    required
                    step="any"
                    type="number"
                    value={draft.factorToBase}
                  />
                </FormField>
              </div>
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                1 unidade escolhida será registrada como o fator informado em{" "}
                {product.unit.abbreviation}.
              </p>
              <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
                <input
                  checked={draft.active}
                  onChange={(event) =>
                    setDraft({ ...draft, active: event.target.checked })
                  }
                  type="checkbox"
                />
                Conversão ativa
              </label>
              <div className="flex justify-end gap-2">
                <Button onClick={() => setDraft(null)} type="button" variant="outline">
                  Cancelar
                </Button>
                <Button disabled={!draft.fromUnitId} type="submit">
                  Salvar conversão
                </Button>
              </div>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ProductCsvImportDialog({ onImported }: { onImported: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<ProductCsvPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const canSubmit = Boolean(preview) && (preview?.rows ?? []).every((row) => row.canImport);

  function openDialog() {
    setCsv("");
    setFileName("");
    setPreview(null);
    setMessage(null);
    setOpen(true);
  }

  function downloadTemplate() {
    const content = [
      "id;nome;unidade;minimo;categoria",
      ";Clips galvanizado;CX;12;Expediente",
      "0000042;Detergente;UN;5;Limpeza",
    ].join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "modelo-importacao-produtos.csv";
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
    setPreviewLoading(true);

    try {
      setPreview(
        await api<ProductCsvPreview>("/products/import-csv/preview", {
          body: JSON.stringify({ csv: selectedCsv }),
          method: "POST",
        }),
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
      await api("/products/import-csv", {
        body: JSON.stringify({ csv }),
        method: "POST",
      });
      await onImported();
      setOpen(false);
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao importar produtos.",
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Importar CSV de produtos</DialogTitle>
            <DialogDescription>
              Confira nomes, unidades, mínimos e categorias antes do cadastro.
            </DialogDescription>
          </DialogHeader>
          <Form onSubmit={submit}>
            {message ? <ResourceError message={message} /> : null}
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
              <FormField>
                <Label htmlFor="product-csv-file">Arquivo CSV</Label>
                <Input
                  accept=".csv,text/csv"
                  id="product-csv-file"
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

            {previewLoading ? <LoadingLine /> : null}

            {preview ? (
              <div className="overflow-hidden rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Linha</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead className="text-right">Mínimo</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((row) => (
                      <TableRow key={row.index}>
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell className="font-mono">
                          {row.code ?? "Automático"}
                        </TableCell>
                        <TableCell className="font-medium">{row.productName}</TableCell>
                        <TableCell>{row.unit}</TableCell>
                        <TableCell className="text-right">
                          {row.minimumQuantity}
                        </TableCell>
                        <TableCell>{row.categoryName}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {row.canImport ? (
                              row.willImport ? (
                                <Badge variant="success">Pronto</Badge>
                              ) : (
                                <Badge variant="outline">Já cadastrado</Badge>
                              )
                            ) : null}
                            {row.warnings.map((warning) => (
                              <Badge key={warning} variant="low">
                                {warning}
                              </Badge>
                            ))}
                            {row.errors.map((error) => (
                              <Badge key={error} variant="zero">
                                {error}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            <Button disabled={!canSubmit || saving || previewLoading} type="submit">
              <Upload className="h-4 w-4" />
              {saving ? "Importando..." : "Confirmar importação"}
            </Button>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ProductsPage() {
  const { session } = useSession();
  const products = useApiResource<Product[]>("/products", []);
  const categories = useApiResource<ProductCategory[]>("/product-categories", []);
  const stocks = useApiResource<Stock[]>("/stocks", []);
  const units = useApiResource<UnitOfMeasure[]>("/units", []);
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const canCreateProducts = hasPermission(session?.user, "CREATE_PRODUCTS");
  const canImportProducts = hasPermission(session?.user, "IMPORT_PRODUCTS_CSV");
  const canManageConversions = hasPermission(session?.user, "MANAGE_UNIT_CONVERSIONS");
  const canEditProducts = session?.user.role === "ADMIN";

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) {
      return;
    }

    const payload = {
      active: draft.active,
      categoryId: draft.categoryId,
      description: draft.description,
      minimumQuantity: draft.minimumQuantity,
      name: draft.name,
      unitId: draft.unitId,
    };

    try {
      await api<Product>(draft.id ? `/products/${draft.id}` : "/products", {
        body: JSON.stringify(payload),
        method: draft.id ? "PUT" : "POST",
      });
      setDraft(null);
      setMessage(null);
      await products.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao salvar.");
    }
  }

  async function remove(id: string) {
    try {
      await api<void>(`/products/${id}`, { method: "DELETE" });
      await products.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao remover.");
    }
  }

  async function selectCreatedCategory(category: ProductCategory) {
    await categories.reload();
    setDraft((current) => (current ? { ...current, categoryId: category.id } : current));
  }

  async function selectCreatedUnit(unit: UnitOfMeasure) {
    await units.reload();
    setDraft((current) => (current ? { ...current, unitId: unit.id } : current));
  }

  if (products.loading || categories.loading || stocks.loading || units.loading) {
    return <LoadingLine />;
  }

  if (products.error || categories.error || stocks.error || units.error) {
    return (
      <ResourceError
        message={products.error ?? categories.error ?? stocks.error ?? units.error ?? ""}
      />
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Catálogo</p>
          <h2 className="text-2xl font-semibold">Produtos</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {canImportProducts ? (
            <ProductCsvImportDialog onImported={products.reload} />
          ) : null}
          {canCreateProducts ? (
            <Button onClick={() => setDraft(emptyDraft(categories.data[0]?.id, units.data[0]?.id))}>
              <Plus className="h-4 w-4" />
              Novo produto
            </Button>
          ) : null}
        </div>
      </div>

      {message ? <ResourceError message={message} /> : null}

      <DataTable
        columns={[
          {
            cell: (product) => product.code,
            cellClassName: "font-mono",
            header: "Código",
            key: "code",
          },
          {
            cell: (product) => (
              <>
                <p className="font-medium">{product.name}</p>
                <p className="text-xs text-muted-foreground">{product.description}</p>
              </>
            ),
            header: "Produto",
            key: "product",
          },
          {
            cell: (product) => product.category.name,
            header: "Categoria",
            key: "category",
          },
          {
            cell: (product) => product.unit.abbreviation,
            header: "Unidade",
            key: "unit",
          },
          {
            cell: (product) => product.minimumQuantity,
            header: "Mínimo",
            key: "minimum",
          },
          {
            cell: (product) => (
              <Badge variant={product.active ? "success" : "zero"}>
                {product.active ? "Ativo" : "Inativo"}
              </Badge>
            ),
            header: "Status",
            key: "status",
          },
          {
            cell: (product) => (
              <div className="flex justify-end gap-2">
                <ProductStocksDialog product={product} stocks={stocks.data} />
                {canManageConversions ? (
                  <ProductConversionsDialog
                    onChanged={(conversions) =>
                      products.setData((currentProducts) =>
                        currentProducts.map((currentProduct) =>
                          currentProduct.id === product.id
                            ? { ...currentProduct, unitConversions: conversions }
                            : currentProduct,
                        ),
                      )
                    }
                    product={product}
                    units={units.data}
                  />
                ) : null}
                {canEditProducts ? (
                  <>
                    <Button
                      aria-label={`Editar ${product.name}`}
                      onClick={() =>
                        setDraft({
                          active: product.active,
                          categoryId: product.categoryId,
                          code: product.code,
                          description: product.description ?? "",
                          id: product.id,
                          minimumQuantity: String(product.minimumQuantity ?? 0),
                          name: product.name,
                          unitId: product.unitId,
                        })
                      }
                      size="icon"
                      variant="outline"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      aria-label={`Remover ${product.name}`}
                      onClick={() => void remove(product.id)}
                      size="icon"
                      variant="outline"
                    >
                      <Trash2 className="h-4 w-4" />
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
        data={products.data}
        emptyMessage="Nenhum produto cadastrado."
        getRowId={(product) => product.id}
        searchPlaceholder="Buscar por código, produto ou categoria..."
        searchText={(product) =>
          [
            product.code,
            product.name,
            product.description,
            product.category.name,
            product.unit.abbreviation,
            product.active ? "ativo" : "inativo",
          ].join(" ")
        }
      />

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setDraft(null);
          }
        }}
        open={Boolean(draft)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar produto" : "Novo produto"}</DialogTitle>
            <DialogDescription>
              O código de sete dígitos é gerado automaticamente pelo sistema.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <Form onSubmit={save}>
              <FormField>
                <Label htmlFor="product-code">Código</Label>
                <Input
                  disabled
                  id="product-code"
                  value={draft.code ?? "Gerado ao salvar"}
                />
              </FormField>
              <FormField>
                <Label htmlFor="product-name">Nome</Label>
                <Input
                  id="product-name"
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  required
                  value={draft.name}
                />
              </FormField>
              <FormField>
                <Label htmlFor="product-description">Descrição</Label>
                <Textarea
                  id="product-description"
                  onChange={(event) =>
                    setDraft({ ...draft, description: event.target.value })
                  }
                  value={draft.description}
                />
              </FormField>
              <FormField>
                <Label htmlFor="product-minimum">Mínimo padrão</Label>
                <Input
                  id="product-minimum"
                  min="0"
                  onChange={(event) =>
                    setDraft({ ...draft, minimumQuantity: event.target.value })
                  }
                  required
                  type="number"
                  value={draft.minimumQuantity}
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField>
                  <Label htmlFor="product-category">Categoria</Label>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <SearchSelect
                      ariaLabel="Categoria"
                      id="product-category"
                      onValueChange={(categoryId) => setDraft({ ...draft, categoryId })}
                      options={categories.data.map((category) => ({
                        label: category.name,
                        value: category.id,
                      }))}
                      placeholder="Selecione"
                      value={draft.categoryId}
                    />
                    <CategoryCreateDialog onCreated={selectCreatedCategory} />
                  </div>
                </FormField>
                <FormField>
                  <Label htmlFor="product-unit">Unidade</Label>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <SearchSelect
                      ariaLabel="Unidade"
                      id="product-unit"
                      onValueChange={(unitId) => setDraft({ ...draft, unitId })}
                      options={units.data.map((unit) => ({
                        label: `${unit.name} / ${unit.abbreviation}`,
                        value: unit.id,
                      }))}
                      placeholder="Selecione"
                      value={draft.unitId}
                    />
                    <UnitCreateDialog onCreated={selectCreatedUnit} />
                  </div>
                </FormField>
              </div>
              <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
                <input
                  checked={draft.active}
                  onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
                  type="checkbox"
                />
                Produto ativo
              </label>
              <Button type="submit">Salvar produto</Button>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
