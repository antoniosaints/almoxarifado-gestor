import { Boxes, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { api, useApiResource } from "@/lib/api";
import type { Product, ProductCategory, Stock, UnitOfMeasure } from "@/lib/types";

type ProductDraft = {
  active: boolean;
  categoryId: string;
  code?: string;
  description: string;
  id?: string;
  name: string;
  unitId: string;
};

function emptyDraft(categoryId = "", unitId = ""): ProductDraft {
  return {
    active: true,
    categoryId,
    description: "",
    name: "",
    unitId,
  };
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
                header: "Estoque minimo",
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

export function ProductsPage() {
  const products = useApiResource<Product[]>("/products", []);
  const categories = useApiResource<ProductCategory[]>("/product-categories", []);
  const stocks = useApiResource<Stock[]>("/stocks", []);
  const units = useApiResource<UnitOfMeasure[]>("/units", []);
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) {
      return;
    }

    const payload = {
      active: draft.active,
      categoryId: draft.categoryId,
      description: draft.description,
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
          <p className="text-sm text-muted-foreground">Catalogo</p>
          <h2 className="text-2xl font-semibold">Produtos</h2>
        </div>
        <Button onClick={() => setDraft(emptyDraft(categories.data[0]?.id, units.data[0]?.id))}>
          <Plus className="h-4 w-4" />
          Novo produto
        </Button>
      </div>

      {message ? <ResourceError message={message} /> : null}

      <DataTable
        columns={[
          {
            cell: (product) => product.code,
            cellClassName: "font-mono",
            header: "Codigo",
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
                <Button
                  aria-label={`Editar ${product.name}`}
                  onClick={() =>
                    setDraft({
                      active: product.active,
                      categoryId: product.categoryId,
                      code: product.code,
                      description: product.description ?? "",
                      id: product.id,
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
              </div>
            ),
            cellClassName: "text-right",
            header: "Acoes",
            headerClassName: "text-right",
            key: "actions",
          },
        ]}
        data={products.data}
        emptyMessage="Nenhum produto cadastrado."
        getRowId={(product) => product.id}
        searchPlaceholder="Buscar por codigo, produto ou categoria..."
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
              O codigo de sete digitos e gerado automaticamente pelo sistema.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <Form onSubmit={save}>
              <FormField>
                <Label htmlFor="product-code">Codigo</Label>
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
                <Label htmlFor="product-description">Descricao</Label>
                <Textarea
                  id="product-description"
                  onChange={(event) =>
                    setDraft({ ...draft, description: event.target.value })
                  }
                  value={draft.description}
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
