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
import { api, useApiResource } from "@/lib/api";
import type { UnitOfMeasure } from "@/lib/types";

type UnitDraft = {
  abbreviation: string;
  id?: string;
  name: string;
};

export function UnitsPage() {
  const units = useApiResource<UnitOfMeasure[]>("/units", []);
  const [draft, setDraft] = useState<UnitDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) {
      return;
    }

    try {
      await api<UnitOfMeasure>(draft.id ? `/units/${draft.id}` : "/units", {
        body: JSON.stringify(draft),
        method: draft.id ? "PUT" : "POST",
      });
      setDraft(null);
      setMessage(null);
      await units.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao salvar.");
    }
  }

  async function remove(id: string) {
    try {
      await api<void>(`/units/${id}`, { method: "DELETE" });
      await units.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao remover.");
    }
  }

  if (units.loading) {
    return <LoadingLine />;
  }

  if (units.error) {
    return <ResourceError message={units.error} />;
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Cadastros</p>
          <h2 className="text-2xl font-semibold">Unidades de medida</h2>
        </div>
        <Button onClick={() => setDraft({ abbreviation: "", name: "" })}>
          <Plus className="h-4 w-4" />
          Nova unidade
        </Button>
      </div>
      {message ? <ResourceError message={message} /> : null}
      <DataTable
        columns={[
          {
            cell: (unit) => unit.name,
            cellClassName: "font-medium",
            header: "Nome",
            key: "name",
          },
          {
            cell: (unit) => unit.abbreviation,
            header: "Sigla",
            key: "abbreviation",
          },
          {
            cell: (unit) => (
              <div className="flex justify-end gap-2">
                <Button
                  aria-label={`Editar ${unit.name}`}
                  onClick={() => setDraft(unit)}
                  size="icon"
                  variant="outline"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  aria-label={`Remover ${unit.name}`}
                  onClick={() => void remove(unit.id)}
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
        data={units.data}
        emptyMessage="Nenhuma unidade cadastrada."
        getRowId={(unit) => unit.id}
        searchPlaceholder="Buscar unidade ou sigla..."
        searchText={(unit) => [unit.name, unit.abbreviation].join(" ")}
      />

      <Dialog onOpenChange={(open) => !open && setDraft(null)} open={Boolean(draft)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar unidade" : "Nova unidade"}</DialogTitle>
            <DialogDescription>Nome e sigla usados no catalogo de produtos.</DialogDescription>
          </DialogHeader>
          {draft ? (
            <Form onSubmit={save}>
              <FormField>
                <Label htmlFor="unit-name">Nome</Label>
                <Input
                  id="unit-name"
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  required
                  value={draft.name}
                />
              </FormField>
              <FormField>
                <Label htmlFor="unit-abbreviation">Sigla</Label>
                <Input
                  id="unit-abbreviation"
                  onChange={(event) =>
                    setDraft({ ...draft, abbreviation: event.target.value })
                  }
                  required
                  value={draft.abbreviation}
                />
              </FormField>
              <Button type="submit">Salvar unidade</Button>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
