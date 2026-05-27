import {
  CalendarClock,
  CreditCard,
  Eye,
  KeyRound,
  Pencil,
  Plus,
  Power,
  UsersRound,
} from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, useApiResource } from "@/lib/api";
import type { ManagerBilling, ManagerLicense, ManagerSubscriber } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

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

function licenseStatusLabel(status: ManagerLicense["status"]) {
  const labels = {
    ACTIVE: "Ativa",
    CANCELLED: "Cancelada",
    EXPIRED: "Expirada",
    LINKED: "Vinculada",
    PENDING: "Pendente",
  };

  return labels[status];
}

function billingStatusLabel(status: ManagerBilling["status"]) {
  const labels = {
    CANCELLED: "Cancelada",
    OPEN: "Aberta",
    OVERDUE: "Vencida",
    PAID: "Paga",
  };

  return labels[status];
}

function statusVariant(status: ManagerLicense["status"] | ManagerBilling["status"]) {
  if (status === "ACTIVE" || status === "LINKED" || status === "PAID") {
    return "success" as const;
  }

  if (status === "CANCELLED" || status === "EXPIRED" || status === "OVERDUE") {
    return "zero" as const;
  }

  return "low" as const;
}

function nextExpiration(licenses: ManagerLicense[] = []) {
  return [...licenses]
    .filter((license) => license.expiresAt)
    .sort((left, right) =>
      String(left.expiresAt).localeCompare(String(right.expiresAt)),
    )[0];
}

export function ManagerSubscribersPage() {
  const subscribers = useApiResource<ManagerSubscriber[]>("/manager/subscribers", []);
  const [detailsSubscriber, setDetailsSubscriber] = useState<ManagerSubscriber | null>(null);
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
                  aria-label={`Ver detalhes de ${subscriber.name}`}
                  onClick={() => setDetailsSubscriber(subscriber)}
                  size="icon"
                  variant="outline"
                >
                  <Eye className="h-4 w-4" />
                </Button>
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

      <Dialog
        onOpenChange={(open) => !open && setDetailsSubscriber(null)}
        open={Boolean(detailsSubscriber)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Detalhes do assinante</DialogTitle>
            <DialogDescription>
              Visão comercial com dados gerais, licenças, cobranças e vencimentos.
            </DialogDescription>
          </DialogHeader>
          {detailsSubscriber ? (
            <Tabs defaultValue="general">
              <TabsList>
                <TabsTrigger value="general">Geral</TabsTrigger>
                <TabsTrigger value="licenses">Licenças</TabsTrigger>
                <TabsTrigger value="billings">Cobranças</TabsTrigger>
                <TabsTrigger value="expirations">Vencimentos</TabsTrigger>
              </TabsList>

              <TabsContent forceMount value="general">
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    ["Nome", detailsSubscriber.name],
                    ["E-mail", detailsSubscriber.email],
                    ["Documento", detailsSubscriber.document || "-"],
                    ["Telefone", detailsSubscriber.phone || "-"],
                    [
                      "Localidade",
                      [detailsSubscriber.city, detailsSubscriber.state].filter(Boolean).join(" / ") ||
                        "-",
                    ],
                    ["Status", detailsSubscriber.active ? "Ativo" : "Inativo"],
                  ].map(([label, value]) => (
                    <div className="rounded-md border p-3" key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-medium">{value}</p>
                    </div>
                  ))}
                </div>
                {detailsSubscriber.notes ? (
                  <div className="mt-3 rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Observações</p>
                    <p className="text-sm">{detailsSubscriber.notes}</p>
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent forceMount value="licenses">
                <div className="space-y-3">
                  {(detailsSubscriber.licenses ?? []).map((license) => (
                    <div className="rounded-md border p-3" key={license.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs">{license.licenseKey}</p>
                          <p className="text-sm font-medium">{license.systemKey}</p>
                        </div>
                        <Badge variant={statusVariant(license.status)}>
                          {licenseStatusLabel(license.status)}
                        </Badge>
                      </div>
                      <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                        <span>Vencimento: {formatDate(license.expiresAt)}</span>
                        <span>Acessos: {license.seats}</span>
                        <span>Valor: {formatCurrency(Number(license.monthlyValue))}</span>
                        <span>Domínio: {license.linkedDomain || "-"}</span>
                        <span>IP: {license.linkedIp || "-"}</span>
                        <span>Validações: {license.validationCount ?? 0}</span>
                      </div>
                    </div>
                  ))}
                  {detailsSubscriber.licenses?.length ? null : (
                    <p className="rounded-md border p-4 text-sm text-muted-foreground">
                      Nenhuma licença cadastrada.
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent forceMount value="billings">
                <div className="space-y-3">
                  {(detailsSubscriber.billings ?? []).map((billing) => (
                    <div
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
                      key={billing.id}
                    >
                      <div>
                        <p className="font-medium">{billing.reference}</p>
                        <p className="text-sm text-muted-foreground">
                          {billing.systemKey} - vencimento {formatDate(billing.dueDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-semibold">{formatCurrency(Number(billing.amount))}</p>
                        <Badge variant={statusVariant(billing.status)}>
                          {billingStatusLabel(billing.status)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {detailsSubscriber.billings?.length ? null : (
                    <p className="rounded-md border p-4 text-sm text-muted-foreground">
                      Nenhuma cobrança cadastrada.
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent forceMount value="expirations">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border p-3">
                    <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <KeyRound className="h-4 w-4" />
                      Licenças
                    </div>
                    <p className="text-2xl font-semibold">
                      {detailsSubscriber.licenses?.length ?? 0}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <CreditCard className="h-4 w-4" />
                      Cobranças abertas
                    </div>
                    <p className="text-2xl font-semibold">
                      {
                        (detailsSubscriber.billings ?? []).filter((billing) =>
                          ["OPEN", "OVERDUE"].includes(billing.status),
                        ).length
                      }
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarClock className="h-4 w-4" />
                      Próximo vencimento
                    </div>
                    <p className="text-2xl font-semibold">
                      {formatDate(nextExpiration(detailsSubscriber.licenses)?.expiresAt)}
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>

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
                  <Label htmlFor="subscriber-email">E-mail</Label>
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
