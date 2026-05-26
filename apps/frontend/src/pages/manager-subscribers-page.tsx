import { Pencil, Plus, Power, UsersRound } from "lucide-react";
import { useState, type FormEvent } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { api, useApiResource } from "@/lib/api";
import type { ManagerSubscriber } from "@/lib/types";

type SubscriberDraft = {
  active: boolean;
  city: string;
  document: string;
  email: string;
  id?: string;
  name: string;
  notes: string;
  phone: string;
  state: string;
};

function emptyDraft(): SubscriberDraft {
  return {
    active: true,
    city: "",
    document: "",
    email: "",
    name: "",
    notes: "",
    phone: "",
    state: "",
  };
}

function draftFromSubscriber(subscriber: ManagerSubscriber): SubscriberDraft {
  return {
    active: subscriber.active,
    city: subscriber.city ?? "",
    document: subscriber.document ?? "",
    email: subscriber.email,
    id: subscriber.id,
    name: subscriber.name,
    notes: subscriber.notes ?? "",
    phone: subscriber.phone ?? "",
    state: subscriber.state ?? "",
  };
}

export function ManagerSubscribersPage() {
  const subscribers = useApiResource<ManagerSubscriber[]>("/manager/subscribers", []);
  const [draft, setDraft] = useState<SubscriberDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft) {
      return;
    }

    try {
      await api<ManagerSubscriber>(
        draft.id ? `/manager/subscribers/${draft.id}` : "/manager/subscribers",
        {
          body: JSON.stringify(draft),
          method: draft.id ? "PUT" : "POST",
        },
      );
      setDraft(null);
      setMessage(null);
      await subscribers.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao salvar.");
    }
  }

  async function deactivate(id: string) {
    try {
      await api<ManagerSubscriber>(`/manager/subscribers/${id}`, {
        method: "DELETE",
      });
      await subscribers.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao inativar.");
    }
  }

  if (subscribers.loading) {
    return <LoadingLine label="Carregando assinantes..." />;
  }

  if (subscribers.error) {
    return <ResourceError message={subscribers.error} />;
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Controle comercial</p>
          <h2 className="text-2xl font-semibold">Assinantes</h2>
        </div>
        <Button onClick={() => setDraft(emptyDraft())}>
          <Plus className="h-4 w-4" />
          Novo assinante
        </Button>
      </div>

      {message ? <ResourceError message={message} /> : null}

      <DataTable
        columns={[
          {
            cell: (subscriber) => (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{subscriber.name}</p>
                  <Badge variant={subscriber.active ? "success" : "zero"}>
                    {subscriber.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{subscriber.email}</p>
              </>
            ),
            header: "Assinante",
            key: "subscriber",
          },
          {
            cell: (subscriber) => subscriber.document || "-",
            header: "Documento",
            key: "document",
          },
          {
            cell: (subscriber) =>
              [subscriber.city, subscriber.state].filter(Boolean).join(" / ") || "-",
            header: "Localidade",
            key: "location",
          },
          {
            cell: (subscriber) => subscriber.licenses?.length ?? 0,
            header: "Licenças",
            key: "licenses",
          },
          {
            cell: (subscriber) => subscriber.billings?.length ?? 0,
            header: "Faturas",
            key: "billings",
          },
          {
            cell: (subscriber) => (
              <div className="flex justify-end gap-2">
                <Button
                  aria-label={`Editar ${subscriber.name}`}
                  onClick={() => setDraft(draftFromSubscriber(subscriber))}
                  size="icon"
                  variant="outline"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  aria-label={`Inativar ${subscriber.name}`}
                  disabled={!subscriber.active}
                  onClick={() => void deactivate(subscriber.id)}
                  size="icon"
                  variant="outline"
                >
                  <Power className="h-4 w-4" />
                </Button>
              </div>
            ),
            cellClassName: "text-right",
            header: "Ações",
            headerClassName: "text-right",
            key: "actions",
          },
        ]}
        data={subscribers.data}
        emptyMessage="Nenhum assinante cadastrado."
        getRowId={(subscriber) => subscriber.id}
        searchPlaceholder="Buscar assinante, email, cidade ou documento..."
        searchText={(subscriber) =>
          [
            subscriber.name,
            subscriber.email,
            subscriber.document,
            subscriber.city,
            subscriber.state,
            subscriber.active ? "ativo" : "inativo",
          ]
            .filter(Boolean)
            .join(" ")
        }
        toolbar={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <UsersRound className="h-4 w-4" />
            {subscribers.data.length} assinantes
          </div>
        }
      />

      <Dialog onOpenChange={(open) => !open && setDraft(null)} open={Boolean(draft)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar assinante" : "Novo assinante"}</DialogTitle>
            <DialogDescription>
              Dados comerciais usados para licenças, cobranças e vencimentos.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <Form onSubmit={save}>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField>
                  <Label htmlFor="subscriber-name">Nome</Label>
                  <Input
                    id="subscriber-name"
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    required
                    value={draft.name}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="subscriber-email">Email</Label>
                  <Input
                    id="subscriber-email"
                    onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                    required
                    type="email"
                    value={draft.email}
                  />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField>
                  <Label htmlFor="subscriber-document">Documento</Label>
                  <MaskedInput
                    id="subscriber-document"
                    mask="cpfCnpj"
                    onChange={(event) =>
                      setDraft({ ...draft, document: event.target.value })
                    }
                    value={draft.document}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="subscriber-phone">Telefone</Label>
                  <MaskedInput
                    id="subscriber-phone"
                    mask="phone"
                    onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                    value={draft.phone}
                  />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
                <FormField>
                  <Label htmlFor="subscriber-city">Cidade</Label>
                  <Input
                    id="subscriber-city"
                    onChange={(event) => setDraft({ ...draft, city: event.target.value })}
                    value={draft.city}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="subscriber-state">UF</Label>
                  <Input
                    id="subscriber-state"
                    maxLength={2}
                    onChange={(event) =>
                      setDraft({ ...draft, state: event.target.value.toUpperCase() })
                    }
                    value={draft.state}
                  />
                </FormField>
              </div>
              <FormField>
                <Label htmlFor="subscriber-notes">Observações</Label>
                <Textarea
                  id="subscriber-notes"
                  onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                  value={draft.notes}
                />
              </FormField>
              <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
                <input
                  checked={draft.active}
                  onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
                  type="checkbox"
                />
                Assinante ativo
              </label>
              <Button type="submit">Salvar assinante</Button>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
