import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { DataTable } from "@/components/domain/data-table";
import { LoadingLine, ResourceError } from "@/components/domain/feedback";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, useApiResource } from "@/lib/api";
import type { ProductCategory, WarehouseCategory } from "@/lib/types";

type CategoryDraft = {
  color?: string;
  description: string;
  icon?: string;
  id?: string;
  name: string;
};

type CategoryPanelProps<T extends { description?: string | null; id: string; name: string }> = {
  createLabel: string;
  description: string;
  items: T[];
  onReload: () => Promise<void>;
  path: string;
  title: string;
  warehouseVisuals?: boolean;
};

function CategoryPanel<T extends { description?: string | null; id: string; name: string }>({
  createLabel,
  description,
  items,
  onReload,
  path,
  title,
  warehouseVisuals,
}: CategoryPanelProps<T>) {
  const [draft, setDraft] = useState<CategoryDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) {
      return;
    }

    try {
      await api<T>(draft.id ? `${path}/${draft.id}` : path, {
        body: JSON.stringify(draft),
        method: draft.id ? "PUT" : "POST",
      });
      setDraft(null);
      setMessage(null);
      await onReload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao salvar.");
    }
  }

  async function remove(id: string) {
    try {
      await api<void>(`${path}/${id}`, { method: "DELETE" });
      await onReload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao remover.");
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button onClick={() => setDraft({ description: "", name: "" })}>
          <Plus className="h-4 w-4" />
          {createLabel}
        </Button>
      </div>
      {message ? <ResourceError message={message} /> : null}
      <DataTable
        columns={[
          {
            cell: (item) => item.name,
            cellClassName: "font-medium",
            header: "Nome",
            key: "name",
          },
          {
            cell: (item) => item.description || "-",
            header: "Descrição",
            key: "description",
          },
          {
            cell: (item) => (
              <div className="flex justify-end gap-2">
                <Button
                  aria-label={`Editar ${item.name}`}
                  onClick={() =>
                    setDraft({
                      color: "color" in item ? String(item.color ?? "") : "",
                      description: item.description ?? "",
                      icon: "icon" in item ? String(item.icon ?? "") : "",
                      id: item.id,
                      name: item.name,
                    })
                  }
                  size="icon"
                  variant="outline"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  aria-label={`Remover ${item.name}`}
                  onClick={() => void remove(item.id)}
                  size="icon"
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
        data={items}
        emptyMessage="Nenhuma categoria cadastrada."
        getRowId={(item) => item.id}
        initialPageSize={10}
        searchPlaceholder="Buscar categoria..."
        searchText={(item) => [item.name, item.description].join(" ")}
      />

      <Dialog onOpenChange={(open) => !open && setDraft(null)} open={Boolean(draft)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar categoria" : "Nova categoria"}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {draft ? (
            <Form onSubmit={save}>
              <FormField>
                <Label htmlFor={`${path}-name`}>Nome</Label>
                <Input
                  id={`${path}-name`}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  required
                  value={draft.name}
                />
              </FormField>
              <FormField>
                <Label htmlFor={`${path}-description`}>Descrição</Label>
                <Textarea
                  id={`${path}-description`}
                  onChange={(event) =>
                    setDraft({ ...draft, description: event.target.value })
                  }
                  value={draft.description}
                />
              </FormField>
              {warehouseVisuals ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField>
                    <Label htmlFor={`${path}-color`}>Cor opcional</Label>
                    <Input
                      id={`${path}-color`}
                      onChange={(event) =>
                        setDraft({ ...draft, color: event.target.value })
                      }
                      placeholder="#0f766e"
                      value={draft.color ?? ""}
                    />
                  </FormField>
                  <FormField>
                    <Label htmlFor={`${path}-icon`}>Icone opcional</Label>
                    <Input
                      id={`${path}-icon`}
                      onChange={(event) => setDraft({ ...draft, icon: event.target.value })}
                      placeholder="warehouse"
                      value={draft.icon ?? ""}
                    />
                  </FormField>
                </div>
              ) : null}
              <Button type="submit">Salvar categoria</Button>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function CategoriesPage() {
  const warehouseCategories = useApiResource<WarehouseCategory[]>(
    "/warehouse-categories",
    [],
  );
  const productCategories = useApiResource<ProductCategory[]>("/product-categories", []);

  if (warehouseCategories.loading || productCategories.loading) {
    return <LoadingLine />;
  }

  if (warehouseCategories.error || productCategories.error) {
    return (
      <ResourceError message={warehouseCategories.error ?? productCategories.error ?? ""} />
    );
  }

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">Organização</p>
        <h2 className="text-2xl font-semibold">Categorias</h2>
      </div>
      <Tabs defaultValue="warehouses">
        <TabsList>
          <TabsTrigger value="warehouses">Categorias de almoxarifados</TabsTrigger>
          <TabsTrigger value="products">Categorias de produtos</TabsTrigger>
        </TabsList>
        <TabsContent value="warehouses">
          <CategoryPanel
            createLabel="Nova categoria"
            description="Agrupe almoxarifados por área municipal."
            items={warehouseCategories.data}
            onReload={warehouseCategories.reload}
            path="/warehouse-categories"
            title="Categorias de almoxarifados"
            warehouseVisuals
          />
        </TabsContent>
        <TabsContent value="products">
          <CategoryPanel
            createLabel="Nova categoria"
            description="Organize produtos por uso e reposição."
            items={productCategories.data}
            onReload={productCategories.reload}
            path="/product-categories"
            title="Categorias de produtos"
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
