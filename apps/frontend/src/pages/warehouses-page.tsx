import { ArrowRight, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
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
import { SearchSelect } from "@/components/ui/search-select";
import { Textarea } from "@/components/ui/textarea";
import { api, useApiResource } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { Warehouse, WarehouseCategory } from "@/lib/types";

type WarehouseDraft = {
  active: boolean;
  categoryId: string;
  description: string;
  id?: string;
  isGeneral: boolean;
  name: string;
};

function emptyDraft(categoryId = ""): WarehouseDraft {
  return {
    active: true,
    categoryId,
    description: "",
    isGeneral: false,
    name: "",
  };
}

export function WarehousesPage() {
  const { session } = useSession();
  const warehouses = useApiResource<Warehouse[]>("/warehouses", []);
  const categories = useApiResource<WarehouseCategory[]>("/warehouse-categories", []);
  const [draft, setDraft] = useState<WarehouseDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const admin = session?.user.role === "ADMIN";

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) {
      return;
    }

    try {
      await api<Warehouse>(draft.id ? `/warehouses/${draft.id}` : "/warehouses", {
        body: JSON.stringify(draft),
        method: draft.id ? "PUT" : "POST",
      });
      setDraft(null);
      setMessage(null);
      await warehouses.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao salvar.");
    }
  }

  async function remove(id: string) {
    try {
      await api<void>(`/warehouses/${id}`, { method: "DELETE" });
      await warehouses.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao remover.");
    }
  }

  if (warehouses.loading || categories.loading) {
    return <LoadingLine />;
  }

  if (warehouses.error || categories.error) {
    return <ResourceError message={warehouses.error ?? categories.error ?? ""} />;
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Cadastros</p>
          <h2 className="text-2xl font-semibold">Almoxarifados</h2>
        </div>
        {admin ? (
          <Button onClick={() => setDraft(emptyDraft(categories.data[0]?.id))}>
            <Plus className="h-4 w-4" />
            Novo almoxarifado
          </Button>
        ) : null}
      </div>

      {message ? <ResourceError message={message} /> : null}

      <DataTable
        columns={[
          {
            cell: (warehouse) => (
              <div className="flex flex-wrap items-center gap-2 font-medium">
                {warehouse.name}
                {warehouse.isGeneral ? <Badge>Geral</Badge> : null}
              </div>
            ),
            header: "Nome",
            key: "name",
          },
          {
            cell: (warehouse) => warehouse.category.name,
            header: "Categoria",
            key: "category",
          },
          {
            cell: (warehouse) => (
              <Badge variant={warehouse.active ? "success" : "zero"}>
                {warehouse.active ? "Ativo" : "Inativo"}
              </Badge>
            ),
            header: "Status",
            key: "status",
          },
          {
            cell: (warehouse) => warehouse.summary.stockedProducts,
            header: "Produtos",
            key: "products",
          },
          {
            cell: (warehouse) => (
              <div className="flex justify-end gap-2">
                <Button
                  aria-label={`Acessar ${warehouse.name}`}
                  asChild
                  size="icon"
                  variant="outline"
                >
                  <Link to={`/warehouses/${warehouse.id}`}>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                {admin ? (
                  <>
                    <Button
                      aria-label={`Editar ${warehouse.name}`}
                      onClick={() =>
                        setDraft({
                          active: warehouse.active,
                          categoryId: warehouse.categoryId,
                          description: warehouse.description ?? "",
                          id: warehouse.id,
                          isGeneral: warehouse.isGeneral,
                          name: warehouse.name,
                        })
                      }
                      size="icon"
                      variant="outline"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      aria-label={`Remover ${warehouse.name}`}
                      onClick={() => void remove(warehouse.id)}
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
        data={warehouses.data}
        emptyMessage="Nenhum almoxarifado cadastrado."
        getRowId={(warehouse) => warehouse.id}
        searchPlaceholder="Buscar almoxarifado ou categoria..."
        searchText={(warehouse) =>
          [
            warehouse.name,
            warehouse.description,
            warehouse.category.name,
            warehouse.isGeneral ? "geral" : "",
            warehouse.active ? "ativo" : "inativo",
          ].join(" ")
        }
      />

      <Dialog onOpenChange={(open) => !open && setDraft(null)} open={Boolean(draft)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar almoxarifado" : "Novo almoxarifado"}</DialogTitle>
            <DialogDescription>
              Defina a categoria, o status e se este e o almoxarifado geral.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <Form onSubmit={save}>
              <FormField>
                <Label htmlFor="warehouse-name">Nome</Label>
                <Input
                  id="warehouse-name"
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  required
                  value={draft.name}
                />
              </FormField>
              <FormField>
                <Label htmlFor="warehouse-description">Descrição</Label>
                <Textarea
                  id="warehouse-description"
                  onChange={(event) =>
                    setDraft({ ...draft, description: event.target.value })
                  }
                  value={draft.description}
                />
              </FormField>
              <FormField>
                <Label htmlFor="warehouse-category">Categoria</Label>
                <SearchSelect
                  ariaLabel="Categoria"
                  id="warehouse-category"
                  onValueChange={(categoryId) => setDraft({ ...draft, categoryId })}
                  options={categories.data.map((category) => ({
                    label: category.name,
                    value: category.id,
                  }))}
                  placeholder="Selecione"
                  value={draft.categoryId}
                />
              </FormField>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
                  <input
                    checked={draft.isGeneral}
                    onChange={(event) =>
                      setDraft({ ...draft, isGeneral: event.target.checked })
                    }
                    type="checkbox"
                  />
                  Almoxarifado geral
                </label>
                <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
                  <input
                    checked={draft.active}
                    onChange={(event) =>
                      setDraft({ ...draft, active: event.target.checked })
                    }
                    type="checkbox"
                  />
                  Cadastro ativo
                </label>
              </div>
              <Button type="submit">Salvar almoxarifado</Button>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
