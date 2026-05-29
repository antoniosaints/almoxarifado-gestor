import { CheckCircle2, Link2, Pencil, Plus, ShieldCheck, XCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { DataTable } from "@/components/domain/data-table";
import { LoadingLine, ResourceError } from "@/components/domain/feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
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
import { Select } from "@/components/ui/select";
import { api, useApiResource } from "@/lib/api";
import type {
  ManagerLicense,
  ManagerLicenseType,
  ManagerSubscriber,
} from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

type LicenseDraft = {
  expiresAt: string;
  id?: string;
  licenseKey: string;
  monthlyValue: string;
  seats: string;
  startsAt: string;
  subscriberId: string;
  systemKey: string;
  type: ManagerLicenseType;
};

const licenseTypeOptions: Array<{ label: string; value: ManagerLicenseType }> = [
  { label: "Mensal", value: "MONTHLY" },
  { label: "Anual", value: "ANNUAL" },
  { label: "Vitalícia", value: "LIFETIME" },
  { label: "Teste", value: "TRIAL" },
];

function dateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function emptyDraft(subscriberId = ""): LicenseDraft {
  return {
    expiresAt: "",
    licenseKey: "",
    monthlyValue: "0",
    seats: "1",
    startsAt: todayInputValue(),
    subscriberId,
    systemKey: "Almoxarifado",
    type: "MONTHLY",
  };
}

function draftFromLicense(license: ManagerLicense): LicenseDraft {
  return {
    expiresAt: dateInputValue(license.expiresAt),
    id: license.id,
    licenseKey: license.licenseKey,
    monthlyValue: String(license.monthlyValue),
    seats: String(license.seats),
    startsAt: dateInputValue(license.startsAt),
    subscriberId: license.subscriberId,
    systemKey: license.systemKey,
    type: license.type,
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

function licenseTypeLabel(type: ManagerLicenseType) {
  return licenseTypeOptions.find((option) => option.value === type)?.label ?? type;
}

function licenseStatusVariant(status: ManagerLicense["status"]) {
  if (status === "ACTIVE" || status === "LINKED") {
    return "success" as const;
  }

  if (status === "CANCELLED" || status === "EXPIRED") {
    return "zero" as const;
  }

  return "low" as const;
}

function licenseSearchText(license: ManagerLicense) {
  return [
    license.subscriber?.name,
    license.systemKey,
    license.licenseKey,
    licenseStatusLabel(license.status),
    licenseTypeLabel(license.type),
  ]
    .filter(Boolean)
    .join(" ");
}

export function ManagerLicensesPage() {
  const licenses = useApiResource<ManagerLicense[]>("/manager/licenses", []);
  const subscribers = useApiResource<ManagerSubscriber[]>("/manager/subscribers", []);
  const [draft, setDraft] = useState<LicenseDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft) {
      return;
    }

    const payload = {
      expiresAt: draft.expiresAt || null,
      licenseKey: draft.licenseKey || null,
      monthlyValue: Number(draft.monthlyValue),
      seats: Number(draft.seats),
      startsAt: draft.startsAt,
      subscriberId: draft.subscriberId,
      systemKey: draft.systemKey,
      type: draft.type,
    };

    try {
      await api<ManagerLicense>(
        draft.id ? `/manager/licenses/${draft.id}` : "/manager/licenses",
        {
          body: JSON.stringify(payload),
          method: draft.id ? "PUT" : "POST",
        },
      );
      setDraft(null);
      setMessage(null);
      await licenses.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao salvar.");
    }
  }

  async function validateLicense(id: string) {
    try {
      await api<ManagerLicense>(`/manager/licenses/${id}/validate`, {
        body: JSON.stringify({}),
        method: "POST",
      });
      await licenses.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao validar.");
    }
  }

  async function linkLicense(id: string) {
    try {
      await api<ManagerLicense>(`/manager/licenses/${id}/link`, {
        body: JSON.stringify({}),
        method: "POST",
      });
      await licenses.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao vincular.");
    }
  }

  async function cancelLicense(id: string) {
    const reason = window.prompt("Motivo do cancelamento", "");

    if (reason === null) {
      return;
    }

    try {
      await api<ManagerLicense>(`/manager/licenses/${id}/cancel`, {
        body: JSON.stringify({ reason }),
        method: "POST",
      });
      await licenses.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao cancelar.");
    }
  }

  if (licenses.loading || subscribers.loading) {
    return <LoadingLine label="Carregando licenças..." />;
  }

  if (licenses.error || subscribers.error) {
    return <ResourceError message={licenses.error ?? subscribers.error ?? ""} />;
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Chaves e vigências</p>
          <h2 className="text-2xl font-semibold">Licenças</h2>
        </div>
        <Button
          disabled={!subscribers.data.length}
          onClick={() => setDraft(emptyDraft(subscribers.data[0]?.id))}
        >
          <Plus className="h-4 w-4" />
          Nova licença
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-3">
            <div>
              <h3 className="font-semibold">Configuração do cliente</h3>
              <p className="text-sm text-muted-foreground">
                Use a chave da licença no sistema hospedado e aponte para o endpoint
                público do manager. Sem essas variáveis, o cliente fica livre e sem
                controle de licença.
              </p>
            </div>
            <div className="grid gap-3 text-sm lg:grid-cols-2">
              <div>
                <p className="mb-1 font-medium">Cliente</p>
                <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs text-foreground">
{`URL_VALIDATION_LICENSE=https://endpoint.instancia.manager/api/validation?secret=secretexistentenoenvdomanager
LICENSE_SYSTEM=ALMO-AC1619-A9E7F0`}
                </pre>
              </div>
              <div>
                <p className="mb-1 font-medium">Manager</p>
                <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs text-foreground">
{`SECRET_VALIDATION_LICENSE=secretvalidador`}
                </pre>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              O cliente valida uma vez ao dia, mantém a última validação conhecida se
              estiver offline e bloqueia apenas ações de escrita quando a licença vence.
              Leituras e exportações continuam disponíveis.
            </p>
          </div>
        </div>
      </div>

      {message ? <ResourceError message={message} /> : null}

      <DataTable
        columns={[
          {
            cell: (license) => (
              <>
                <p className="font-medium">{license.subscriber?.name ?? "-"}</p>
                <p className="text-xs text-muted-foreground">{license.systemKey}</p>
              </>
            ),
            header: "Assinante",
            key: "subscriber",
          },
          {
            cell: (license) => (
              <>
                <p className="font-mono text-xs">{license.licenseKey}</p>
                <p className="text-xs text-muted-foreground">
                  {licenseTypeLabel(license.type)} | {license.seats} acessos
                </p>
              </>
            ),
            header: "Licença",
            key: "license",
          },
          {
            cell: (license) => formatCurrency(Number(license.monthlyValue)),
            header: "Valor mensal",
            key: "value",
          },
          {
            cell: (license) => formatDate(license.expiresAt),
            header: "Vencimento",
            key: "expiresAt",
          },
          {
            cell: (license) => (
              <Badge variant={licenseStatusVariant(license.status)}>
                {licenseStatusLabel(license.status)}
              </Badge>
            ),
            header: "Status",
            key: "status",
          },
          {
            cell: (license) => (
              <div className="flex justify-end gap-2">
                <Button
                  aria-label={`Editar licença ${license.licenseKey}`}
                  onClick={() => setDraft(draftFromLicense(license))}
                  size="icon"
                  variant="outline"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  aria-label={`Validar licença ${license.licenseKey}`}
                  disabled={
                    license.status === "ACTIVE" ||
                    license.status === "LINKED" ||
                    license.status === "CANCELLED"
                  }
                  onClick={() => void validateLicense(license.id)}
                  size="icon"
                  variant="outline"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
                <Button
                  aria-label={`Vincular licença ${license.licenseKey}`}
                  disabled={license.status === "LINKED" || license.status === "CANCELLED"}
                  onClick={() => void linkLicense(license.id)}
                  size="icon"
                  variant="outline"
                >
                  <Link2 className="h-4 w-4" />
                </Button>
                <Button
                  aria-label={`Cancelar licença ${license.licenseKey}`}
                  disabled={license.status === "CANCELLED"}
                  onClick={() => void cancelLicense(license.id)}
                  size="icon"
                  variant="outline"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            ),
            cellClassName: "text-right",
            header: "Ações",
            headerClassName: "text-right",
            key: "actions",
          },
        ]}
        data={licenses.data}
        emptyMessage="Nenhuma licença cadastrada."
        getRowId={(license) => license.id}
        searchPlaceholder="Buscar licença, assinante, sistema ou status..."
        searchText={licenseSearchText}
      />

      <Dialog onOpenChange={(open) => !open && setDraft(null)} open={Boolean(draft)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar licença" : "Nova licença"}</DialogTitle>
            <DialogDescription>
              Crie e mantenha chaves administrativas sem ativar bloqueio de uso do sistema.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <Form onSubmit={save}>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField>
                  <Label htmlFor="license-subscriber">Assinante</Label>
                  <Select
                    id="license-subscriber"
                    onChange={(event) =>
                      setDraft({ ...draft, subscriberId: event.target.value })
                    }
                    required
                    value={draft.subscriberId}
                  >
                    {subscribers.data.map((subscriber) => (
                      <option key={subscriber.id} value={subscriber.id}>
                        {subscriber.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField>
                  <Label htmlFor="license-system">Sistema</Label>
                  <Input
                    id="license-system"
                    onChange={(event) =>
                      setDraft({ ...draft, systemKey: event.target.value })
                    }
                    required
                    value={draft.systemKey}
                  />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField>
                  <Label htmlFor="license-type">Tipo</Label>
                  <Select
                    id="license-type"
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        type: event.target.value as ManagerLicenseType,
                      })
                    }
                    value={draft.type}
                  >
                    {licenseTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField>
                  <Label htmlFor="license-seats">Acessos</Label>
                  <Input
                    id="license-seats"
                    min={1}
                    onChange={(event) => setDraft({ ...draft, seats: event.target.value })}
                    required
                    type="number"
                    value={draft.seats}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="license-value">Valor mensal</Label>
                  <CurrencyInput
                    id="license-value"
                    onValueChange={(monthlyValue) =>
                      setDraft({ ...draft, monthlyValue })
                    }
                    value={draft.monthlyValue}
                  />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField>
                  <Label htmlFor="license-start">Início</Label>
                  <Input
                    id="license-start"
                    onChange={(event) =>
                      setDraft({ ...draft, startsAt: event.target.value })
                    }
                    required
                    type="date"
                    value={draft.startsAt}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="license-expiration">Vencimento</Label>
                  <Input
                    id="license-expiration"
                    onChange={(event) =>
                      setDraft({ ...draft, expiresAt: event.target.value })
                    }
                    type="date"
                    value={draft.expiresAt}
                  />
                </FormField>
              </div>
              <FormField>
                <Label htmlFor="license-key">Chave</Label>
                <Input
                  id="license-key"
                  onChange={(event) =>
                    setDraft({ ...draft, licenseKey: event.target.value })
                  }
                  placeholder="Gerada automaticamente se ficar em branco"
                  value={draft.licenseKey}
                />
              </FormField>
              <Button type="submit">Salvar licença</Button>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
