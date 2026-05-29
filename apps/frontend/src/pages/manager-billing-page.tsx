import { Ban, CheckCircle2, Pencil, Plus, QrCode, ReceiptText, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { api, useApiResource } from "@/lib/api";
import type {
  ManagerBilling,
  ManagerBillingPaymentMethod,
  ManagerBillingStatus,
  ManagerLicense,
  ManagerSubscriber,
} from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

type BillingDraft = {
  amount: string;
  description: string;
  dueDate: string;
  id?: string;
  licenseId: string;
  paidAt: string;
  reference: string;
  status: ManagerBillingStatus;
  subscriberId: string;
  systemKey: string;
};

const billingStatusOptions: Array<{ label: string; value: ManagerBillingStatus }> = [
  { label: "Aberto", value: "OPEN" },
  { label: "Pago", value: "PAID" },
  { label: "Vencido", value: "OVERDUE" },
  { label: "Cancelado", value: "CANCELLED" },
];

function dateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function currentReference() {
  return new Date().toISOString().slice(0, 7);
}

function billingStatusLabel(status: ManagerBillingStatus) {
  return billingStatusOptions.find((option) => option.value === status)?.label ?? status;
}

function billingStatusVariant(status: ManagerBillingStatus) {
  if (status === "PAID") {
    return "success" as const;
  }

  if (status === "OVERDUE" || status === "CANCELLED") {
    return "zero" as const;
  }

  return "low" as const;
}

function emptyDraft(subscriberId = "", license?: ManagerLicense): BillingDraft {
  return {
    amount: license ? String(license.monthlyValue) : "0",
    description: "",
    dueDate: todayInputValue(),
    licenseId: license?.id ?? "",
    paidAt: "",
    reference: currentReference(),
    status: "OPEN",
    subscriberId,
    systemKey: license?.systemKey ?? "Almoxarifado",
  };
}

function draftFromBilling(billing: ManagerBilling): BillingDraft {
  return {
    amount: String(billing.amount),
    description: billing.description ?? "",
    dueDate: dateInputValue(billing.dueDate),
    id: billing.id,
    licenseId: billing.licenseId ?? "",
    paidAt: dateInputValue(billing.paidAt),
    reference: billing.reference,
    status: billing.status,
    subscriberId: billing.subscriberId,
    systemKey: billing.systemKey,
  };
}

export function ManagerBillingPage() {
  const billings = useApiResource<ManagerBilling[]>("/manager/billings", []);
  const licenses = useApiResource<ManagerLicense[]>("/manager/licenses", []);
  const subscribers = useApiResource<ManagerSubscriber[]>("/manager/subscribers", []);
  const [draft, setDraft] = useState<BillingDraft | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const selectedSubscriberLicenses = useMemo(
    () =>
      draft
        ? licenses.data.filter((license) => license.subscriberId === draft.subscriberId)
        : [],
    [draft, licenses.data],
  );

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft) {
      return;
    }

    const payload = {
      amount: Number(draft.amount),
      description: draft.description || null,
      dueDate: draft.dueDate,
      licenseId: draft.licenseId || null,
      paidAt: draft.paidAt || null,
      reference: draft.reference,
      status: draft.status,
      subscriberId: draft.subscriberId,
      systemKey: draft.systemKey,
    };

    try {
      await api<ManagerBilling>(
        draft.id ? `/manager/billings/${draft.id}` : "/manager/billings",
        {
          body: JSON.stringify(payload),
          method: draft.id ? "PUT" : "POST",
        },
      );
      setDraft(null);
      setMessage(null);
      await billings.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao salvar.");
    }
  }

  async function markPaid(id: string) {
    try {
      await api<ManagerBilling>(`/manager/billings/${id}/pay`, {
        body: JSON.stringify({}),
        method: "POST",
      });
      await billings.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao baixar.");
    }
  }

  async function cancelBilling(id: string) {
    try {
      await api<ManagerBilling>(`/manager/billings/${id}/cancel`, {
        body: JSON.stringify({}),
        method: "POST",
      });
      await billings.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao cancelar.");
    }
  }

  async function generateGatewayBilling(
    id: string,
    method: ManagerBillingPaymentMethod,
  ) {
    try {
      await api<ManagerBilling>(`/manager/billings/${id}/faturar`, {
        body: JSON.stringify({
          gatewayProvider: "MERCADO_PAGO",
          method,
          mode: "GATEWAY",
        }),
        method: "POST",
      });
      await billings.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao faturar.");
    }
  }

  async function deleteBilling(id: string) {
    try {
      await api<void>(`/manager/billings/${id}`, {
        method: "DELETE",
      });
      await billings.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao apagar.");
    }
  }

  function createDraft() {
    const subscriberId = subscribers.data[0]?.id ?? "";
    const license = licenses.data.find((item) => item.subscriberId === subscriberId);

    setDraft(emptyDraft(subscriberId, license));
  }

  function selectLicense(licenseId: string) {
    if (!draft) {
      return;
    }

    const license = licenses.data.find((item) => item.id === licenseId);

    setDraft({
      ...draft,
      amount: license ? String(license.monthlyValue) : draft.amount,
      licenseId,
      systemKey: license?.systemKey ?? draft.systemKey,
    });
  }

  if (billings.loading || licenses.loading || subscribers.loading) {
    return <LoadingLine label="Carregando faturamento..." />;
  }

  if (billings.error || licenses.error || subscribers.error) {
    return (
      <ResourceError
        message={billings.error ?? licenses.error ?? subscribers.error ?? ""}
      />
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Receita por sistema e licença</p>
          <h2 className="text-2xl font-semibold">Faturamento</h2>
        </div>
        <Button disabled={!subscribers.data.length} onClick={createDraft}>
          <Plus className="h-4 w-4" />
          Nova cobrança
        </Button>
      </div>

      {message ? <ResourceError message={message} /> : null}

      <DataTable
        columns={[
          {
            cell: (billing) => (
              <>
                <p className="font-medium">{billing.subscriber?.name ?? "-"}</p>
                <p className="text-xs text-muted-foreground">{billing.reference}</p>
              </>
            ),
            header: "Assinante",
            key: "subscriber",
          },
          {
            cell: (billing) => (
              <>
                <p>{billing.systemKey}</p>
                <p className="text-xs text-muted-foreground">
                  {billing.license?.licenseKey ?? "Sem licença vinculada"}
                </p>
              </>
            ),
            header: "Sistema",
            key: "system",
          },
          {
            cell: (billing) => formatCurrency(Number(billing.amount)),
            header: "Valor",
            key: "amount",
          },
          {
            cell: (billing) => formatDate(billing.dueDate),
            header: "Vencimento",
            key: "dueDate",
          },
          {
            cell: (billing) => (
              <Badge variant={billingStatusVariant(billing.status)}>
                {billingStatusLabel(billing.status)}
              </Badge>
            ),
            header: "Status",
            key: "status",
          },
          {
            cell: (billing) => (
              <div className="flex justify-end gap-2">
                <Button
                  aria-label={`Editar cobrança ${billing.reference}`}
                  onClick={() => setDraft(draftFromBilling(billing))}
                  size="icon"
                  variant="outline"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  aria-label={`Marcar ${billing.reference} como pago`}
                  disabled={billing.status === "PAID" || billing.status === "CANCELLED"}
                  onClick={() => void markPaid(billing.id)}
                  size="icon"
                  variant="outline"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
                <Button
                  aria-label={`Gerar Pix para cobrança ${billing.reference}`}
                  disabled={billing.status === "PAID" || billing.status === "CANCELLED"}
                  onClick={() => void generateGatewayBilling(billing.id, "PIX")}
                  size="icon"
                  variant="outline"
                >
                  <QrCode className="h-4 w-4" />
                </Button>
                <Button
                  aria-label={`Gerar boleto para cobrança ${billing.reference}`}
                  disabled={billing.status === "PAID" || billing.status === "CANCELLED"}
                  onClick={() => void generateGatewayBilling(billing.id, "BOLETO")}
                  size="icon"
                  variant="outline"
                >
                  <ReceiptText className="h-4 w-4" />
                </Button>
                <Button
                  aria-label={`Cancelar cobrança ${billing.reference}`}
                  disabled={billing.status === "CANCELLED"}
                  onClick={() => void cancelBilling(billing.id)}
                  size="icon"
                  variant="outline"
                >
                  <Ban className="h-4 w-4" />
                </Button>
                <Button
                  aria-label={`Apagar cobrança ${billing.reference}`}
                  disabled={billing.status === "PAID"}
                  onClick={() => void deleteBilling(billing.id)}
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
        data={billings.data}
        emptyMessage="Nenhuma cobrança cadastrada."
        getRowId={(billing) => billing.id}
        searchPlaceholder="Buscar assinante, sistema, referência ou status..."
        searchText={(billing) =>
          [
            billing.subscriber?.name,
            billing.systemKey,
            billing.reference,
            billing.license?.licenseKey,
            billingStatusLabel(billing.status),
          ]
            .filter(Boolean)
            .join(" ")
        }
      />

      <Dialog onOpenChange={(open) => !open && setDraft(null)} open={Boolean(draft)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar cobrança" : "Nova cobrança"}</DialogTitle>
            <DialogDescription>
              Lance receitas por sistema e vincule à licença quando existir.
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <Form onSubmit={save}>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField>
                  <Label htmlFor="billing-subscriber">Assinante</Label>
                  <Select
                    id="billing-subscriber"
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        licenseId: "",
                        subscriberId: event.target.value,
                      })
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
                  <Label htmlFor="billing-license">Licença</Label>
                  <Select
                    id="billing-license"
                    onChange={(event) => selectLicense(event.target.value)}
                    value={draft.licenseId}
                  >
                    <option value="">Sem licença vinculada</option>
                    {selectedSubscriberLicenses.map((license) => (
                      <option key={license.id} value={license.id}>
                        {license.licenseKey} - {license.systemKey}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField>
                  <Label htmlFor="billing-system">Sistema</Label>
                  <Input
                    id="billing-system"
                    onChange={(event) =>
                      setDraft({ ...draft, systemKey: event.target.value })
                    }
                    required
                    value={draft.systemKey}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="billing-reference">Referência</Label>
                  <Input
                    id="billing-reference"
                    onChange={(event) =>
                      setDraft({ ...draft, reference: event.target.value })
                    }
                    required
                    value={draft.reference}
                  />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField>
                  <Label htmlFor="billing-amount">Valor</Label>
                  <CurrencyInput
                    id="billing-amount"
                    onValueChange={(amount) => setDraft({ ...draft, amount })}
                    required
                    value={draft.amount}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="billing-due">Vencimento</Label>
                  <Input
                    id="billing-due"
                    onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })}
                    required
                    type="date"
                    value={draft.dueDate}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="billing-status">Status</Label>
                  <Select
                    id="billing-status"
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        status: event.target.value as ManagerBillingStatus,
                      })
                    }
                    value={draft.status}
                  >
                    {billingStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
              {draft.status === "PAID" ? (
                <FormField>
                  <Label htmlFor="billing-paid">Pagamento</Label>
                  <Input
                    id="billing-paid"
                    onChange={(event) => setDraft({ ...draft, paidAt: event.target.value })}
                    type="date"
                    value={draft.paidAt}
                  />
                </FormField>
              ) : null}
              <FormField>
                <Label htmlFor="billing-description">Descrição</Label>
                <Textarea
                  id="billing-description"
                  onChange={(event) =>
                    setDraft({ ...draft, description: event.target.value })
                  }
                  value={draft.description}
                />
              </FormField>
              <Button type="submit">Salvar cobrança</Button>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
