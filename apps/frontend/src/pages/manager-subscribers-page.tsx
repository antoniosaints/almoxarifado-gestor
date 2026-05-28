import {
  Ban,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cog,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  File,
  FileText,
  KeyRound,
  Link2,
  Pencil,
  Plus,
  Power,
  QrCode,
  ReceiptText,
  Settings,
  ShieldCheck,
  Trash2,
  WalletCards,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
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
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { API_URL, api, apiFile, useApiResource } from "@/lib/api";
import { getStoredSession } from "@/lib/session";
import type {
  ManagerBilling,
  ManagerBillingPayment,
  ManagerBillingPaymentMethod,
  ManagerGatewayConfig,
  ManagerLicense,
  ManagerSubscriber,
} from "@/lib/types";
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

type BillingDraft = {
  amount: string;
  description: string;
  dueDate: string;
  licenseId: string;
  reference: string;
  subscriberId: string;
  systemKey: string;
};

type BillingInvoiceDraft = {
  billingId: string;
  method: ManagerBillingPaymentMethod;
  mode: "GATEWAY" | "MANUAL";
  paidAt: string;
};

type GatewayDraft = {
  accessToken: string;
  active: boolean;
  clientId: string;
  clientSecret: string;
  publicKey: string;
  webhookSecret: string;
};

type SubscriberDetailsTab = "billings" | "expirations" | "gateway" | "general" | "licenses";

const detailPageSize = 4;

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

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function currentReference() {
  return new Date().toISOString().slice(0, 7);
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

function licenseTypeLabel(type: ManagerLicense["type"]) {
  const labels = {
    ANNUAL: "Anual",
    LIFETIME: "Vitalicia",
    MONTHLY: "Mensal",
    TRIAL: "Teste",
  };

  return labels[type];
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

function paymentStatusLabel(status: ManagerBillingPayment["status"]) {
  const labels = {
    APPROVED: "Aprovado",
    CANCELLED: "Cancelado",
    EXPIRED: "Expirado",
    PENDING: "Pendente",
    REFUNDED: "Estornado",
    REJECTED: "Rejeitado",
  };

  return labels[status];
}

function paymentMethodLabel(method: ManagerBillingPaymentMethod) {
  return method === "PIX" ? "Pix" : "Boleto";
}

function statusVariant(
  status:
    | ManagerBilling["status"]
    | ManagerBillingPayment["status"]
    | ManagerLicense["status"],
) {
  if (status === "ACTIVE" || status === "APPROVED" || status === "LINKED" || status === "PAID") {
    return "success" as const;
  }

  if (
    status === "CANCELLED" ||
    status === "EXPIRED" ||
    status === "OVERDUE" ||
    status === "REFUNDED" ||
    status === "REJECTED"
  ) {
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

function latestPayment(billing: ManagerBilling) {
  return billing.payments?.[0] ?? null;
}

function canDeleteBilling(billing: ManagerBilling) {
  const payment = latestPayment(billing);

  return billing.status !== "PAID" && payment?.status !== "APPROVED";
}

function qrImageSrc(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.startsWith("data:") ? value : `data:image/png;base64,${value}`;
}

function billingDraftFromLicense(subscriber: ManagerSubscriber, license: ManagerLicense): BillingDraft {
  return {
    amount: String(license.monthlyValue),
    description: `${license.systemKey} - ${currentReference()}`,
    dueDate: todayInputValue(),
    licenseId: license.id,
    reference: currentReference(),
    subscriberId: subscriber.id,
    systemKey: license.systemKey,
  };
}

function billingDraftForSubscriber(subscriber: ManagerSubscriber): BillingDraft {
  const license = subscriber.licenses?.[0];

  return {
    amount: license ? String(license.monthlyValue) : "0",
    description: license ? `${license.systemKey} - ${currentReference()}` : "",
    dueDate: todayInputValue(),
    licenseId: license?.id ?? "",
    reference: currentReference(),
    subscriberId: subscriber.id,
    systemKey: license?.systemKey ?? "Almoxarifado",
  };
}

function gatewayDraftFromConfig(gateway?: ManagerGatewayConfig): GatewayDraft {
  return {
    accessToken: "",
    active: gateway?.active ?? false,
    clientId: gateway?.clientId ?? "",
    clientSecret: "",
    publicKey: "",
    webhookSecret: "",
  };
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyText(value: string) {
  await navigator.clipboard?.writeText(value);
}

function DetailPager({
  currentPage,
  label,
  onPageChange,
  pageCount,
  total,
}: {
  currentPage: number;
  label: string;
  onPageChange: (page: number) => void;
  pageCount: number;
  total: number;
}) {
  if (total <= detailPageSize) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        Pagina {currentPage + 1} de {pageCount} - {total} {label}
      </span>
      <div className="flex items-center gap-2">
        <Button
          aria-label={`Pagina anterior de ${label}`}
          disabled={currentPage === 0}
          onClick={() => onPageChange(Math.max(0, currentPage - 1))}
          size="sm"
          type="button"
          variant="outline"
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        <Button
          aria-label={`Proxima pagina de ${label}`}
          disabled={currentPage >= pageCount - 1}
          onClick={() => onPageChange(Math.min(pageCount - 1, currentPage + 1))}
          size="sm"
          type="button"
          variant="outline"
        >
          Proxima
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function ManagerSubscribersPage() {
  const subscribers = useApiResource<ManagerSubscriber[]>("/manager/subscribers", []);
  const gateways = useApiResource<ManagerGatewayConfig[]>("/manager/gateways", []);
  const [detailsSubscriberId, setDetailsSubscriberId] = useState<string | null>(null);
  const [detailsTab, setDetailsTab] = useState<SubscriberDetailsTab>("general");
  const [licensePage, setLicensePage] = useState(0);
  const [billingPage, setBillingPage] = useState(0);
  const [draft, setDraft] = useState<SubscriberDraft | null>(null);
  const [billingDraft, setBillingDraft] = useState<BillingDraft | null>(null);
  const [invoiceDraft, setInvoiceDraft] = useState<BillingInvoiceDraft | null>(null);
  const [gatewayDraft, setGatewayDraft] = useState<GatewayDraft | null>(null);
  const [pixPayment, setPixPayment] = useState<ManagerBillingPayment | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const detailsSubscriber = useMemo(
    () =>
      detailsSubscriberId
        ? subscribers.data.find((subscriber) => subscriber.id === detailsSubscriberId) ?? null
        : null,
    [detailsSubscriberId, subscribers.data],
  );
  const mercadoPagoGateway = gateways.data.find(
    (gateway) => gateway.provider === "MERCADO_PAGO",
  );
  const detailsLicenses = detailsSubscriber?.licenses ?? [];
  const detailsBillings = detailsSubscriber?.billings ?? [];
  const licensePageCount = Math.max(1, Math.ceil(detailsLicenses.length / detailPageSize));
  const billingPageCount = Math.max(1, Math.ceil(detailsBillings.length / detailPageSize));
  const currentLicensePage = Math.min(licensePage, licensePageCount - 1);
  const currentBillingPage = Math.min(billingPage, billingPageCount - 1);
  const visibleLicenses = detailsLicenses.slice(
    currentLicensePage * detailPageSize,
    currentLicensePage * detailPageSize + detailPageSize,
  );
  const visibleBillings = detailsBillings.slice(
    currentBillingPage * detailPageSize,
    currentBillingPage * detailPageSize + detailPageSize,
  );

  useEffect(() => {
    setLicensePage((page) => Math.min(page, licensePageCount - 1));
    setBillingPage((page) => Math.min(page, billingPageCount - 1));
  }, [billingPageCount, licensePageCount]);

  useEffect(() => {
    if (!detailsSubscriberId || typeof WebSocket === "undefined") {
      return;
    }

    const session = getStoredSession();

    if (!session?.token) {
      return;
    }

    const url = new URL(API_URL, window.location.origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/manager/realtime";
    url.search = "";
    url.searchParams.set("token", session.token);

    const socket = new WebSocket(url.toString());

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data)) as {
          subscriberId?: string;
          type?: string;
        };

        if (
          payload.type === "manager.billing.updated" &&
          payload.subscriberId === detailsSubscriberId
        ) {
          void subscribers.reload();
        }
      } catch {
        // Ignore malformed realtime messages.
      }
    };

    return () => {
      socket.close();
    };
  }, [detailsSubscriberId, subscribers.reload]);

  async function reloadManager() {
    await Promise.all([subscribers.reload(), gateways.reload()]);
  }

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

  async function saveBilling(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!billingDraft) {
      return;
    }

    try {
      await api<ManagerBilling>("/manager/billings", {
        body: JSON.stringify({
          amount: Number(billingDraft.amount),
          description: billingDraft.description || null,
          dueDate: billingDraft.dueDate,
          licenseId: billingDraft.licenseId || null,
          reference: billingDraft.reference,
          status: "OPEN",
          subscriberId: billingDraft.subscriberId,
          systemKey: billingDraft.systemKey,
        }),
        method: "POST",
      });
      setBillingDraft(null);
      setMessage(null);
      await subscribers.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao gerar cobrança.");
    }
  }

  async function invoiceBilling(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!invoiceDraft) {
      return;
    }

    try {
      const payload =
        invoiceDraft.mode === "MANUAL"
          ? { mode: "MANUAL", paidAt: invoiceDraft.paidAt || null }
          : {
              gatewayProvider: "MERCADO_PAGO",
              method: invoiceDraft.method,
              mode: "GATEWAY",
            };

      await api<ManagerBilling>(`/manager/billings/${invoiceDraft.billingId}/faturar`, {
        body: JSON.stringify(payload),
        method: "POST",
      });
      setInvoiceDraft(null);
      setMessage(null);
      await subscribers.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao faturar.");
    }
  }

  async function runLicenseAction(
    id: string,
    action: "cancel" | "link" | "validate",
    body: Record<string, unknown> = {},
  ) {
    try {
      await api<ManagerLicense>(`/manager/licenses/${id}/${action}`, {
        body: JSON.stringify(body),
        method: "POST",
      });
      await subscribers.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha na licença.");
    }
  }

  async function cancelLicense(license: ManagerLicense) {
    const reason = window.prompt("Motivo do cancelamento", "");

    if (reason === null) {
      return;
    }

    await runLicenseAction(license.id, "cancel", { reason });
  }

  async function cancelBilling(id: string) {
    try {
      await api<ManagerBilling>(`/manager/billings/${id}/cancel`, {
        body: JSON.stringify({}),
        method: "POST",
      });
      await subscribers.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao cancelar.");
    }
  }

  async function deleteBilling(id: string) {
    try {
      await api<void>(`/manager/billings/${id}`, {
        method: "DELETE",
      });
      await subscribers.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao apagar.");
    }
  }

  async function cancelGatewayPayment(payment: ManagerBillingPayment) {
    try {
      setBusyAction(payment.id);
      await api<ManagerBillingPayment>(`/manager/payments/${payment.id}/cancel`, {
        body: JSON.stringify({}),
        method: "POST",
      });
      await subscribers.reload();
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error ? caughtError.message : "Falha ao cancelar no gateway.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function downloadPdf(path: string, fileName: string) {
    try {
      const blob = await apiFile(path);
      downloadBlob(blob, fileName);
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao exportar PDF.");
    }
  }

  async function saveGateway(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!gatewayDraft) {
      return;
    }

    try {
      await api<ManagerGatewayConfig>("/manager/gateways/mercado-pago", {
        body: JSON.stringify({
          accessToken: gatewayDraft.accessToken || null,
          active: gatewayDraft.active,
          clientId: gatewayDraft.clientId || null,
          clientSecret: gatewayDraft.clientSecret || null,
          publicKey: gatewayDraft.publicKey || null,
          webhookSecret: gatewayDraft.webhookSecret || null,
        }),
        method: "PUT",
      });
      setGatewayDraft(null);
      setMessage(null);
      await gateways.reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao salvar gateway.");
    }
  }

  async function startGatewayOAuth() {
    try {
      const response = await api<{ authorizationUrl: string }>(
        "/manager/gateways/mercado-pago/oauth/start",
        {
          body: JSON.stringify({}),
          method: "POST",
        },
      );

      window.open(response.authorizationUrl, "_blank", "noopener,noreferrer");
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao conectar.");
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
      {gateways.error ? <ResourceError message={gateways.error} /> : null}

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
            cell: (subscriber) =>
              (subscriber.billings ?? []).filter((billing) =>
                ["OPEN", "OVERDUE"].includes(billing.status),
              ).length,
            header: "Abertas",
            key: "open-billings",
          },
          {
            cell: (subscriber) => (
              <div className="flex justify-end gap-2">
                <Button
                  aria-label={`Ver detalhes de ${subscriber.name}`}
                  onClick={() => {
                    setDetailsTab("general");
                    setLicensePage(0);
                    setBillingPage(0);
                    setDetailsSubscriberId(subscriber.id);
                  }}
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
            <WalletCards className="h-4 w-4" />
            {subscribers.data.length} assinantes
          </div>
        }
      />

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setDetailsSubscriberId(null);
            setDetailsTab("general");
            setLicensePage(0);
            setBillingPage(0);
          }
        }}
        open={Boolean(detailsSubscriber)}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <DialogTitle>{detailsSubscriber?.name ?? "Detalhes do assinante"}</DialogTitle>
                <DialogDescription>
                  Operação comercial com licenças, cobranças, gateway e vencimentos.
                </DialogDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {detailsSubscriber ? (
                  <Button
                    onClick={() => setBillingDraft(billingDraftForSubscriber(detailsSubscriber))}
                    size="sm"
                  >
                    <ReceiptText className="h-4 w-4" />
                    Gerar cobrança
                  </Button>
                ) : null}
                <Button
                  onClick={() => setGatewayDraft(gatewayDraftFromConfig(mercadoPagoGateway))}
                  size="sm"
                  variant="outline"
                >
                  <Settings className="h-4 w-4" />
                  Gateway
                </Button>
              </div>
            </div>
          </DialogHeader>

          {detailsSubscriber ? (
            <Tabs
              onValueChange={(value) => setDetailsTab(value as SubscriberDetailsTab)}
              value={detailsTab}
            >
              <TabsList>
                <TabsTrigger value="general"><Cog className="mr-1 h-4 w-4" /> Geral</TabsTrigger>
                <TabsTrigger value="licenses"><File className="mr-1 h-4 w-4" /> Licenças</TabsTrigger>
                <TabsTrigger value="billings"><ReceiptText className="mr-1 h-4 w-4" /> Cobranças</TabsTrigger>
                <TabsTrigger value="gateway"><CreditCard className="mr-1 h-4 w-4" /> Gateway</TabsTrigger>
                <TabsTrigger value="expirations"><Clock className="mr-1 h-4 w-4" /> Vencimentos</TabsTrigger>
              </TabsList>

              <TabsContent value="general">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <div className="mt-1">
                      <Badge variant={detailsSubscriber.active ? "success" : "zero"}>
                        {detailsSubscriber.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Licenças</p>
                    <p className="text-xl font-semibold">
                      {detailsSubscriber.licenses?.length ?? 0}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">Cobranças abertas</p>
                    <p className="text-xl font-semibold">
                      {
                        (detailsSubscriber.billings ?? []).filter((billing) =>
                          ["OPEN", "OVERDUE"].includes(billing.status),
                        ).length
                      }
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
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
                    ["Criado em", formatDate(detailsSubscriber.createdAt)],
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

              <TabsContent value="licenses">
                <div className="space-y-3">
                  {visibleLicenses.map((license) => (
                    <div className="rounded-md border bg-card p-2.5" key={license.id}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">
                            {license.systemKey} · {licenseTypeLabel(license.type)}
                          </p>
                          <p
                            className="max-w-full truncate rounded-md border px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                            title={license.licenseKey}
                          >
                            {license.licenseKey}
                          </p>
                        </div>
                        <Badge variant={statusVariant(license.status)}>
                          {licenseStatusLabel(license.status)}
                        </Badge>
                      </div>
                      <div className="mt-2 grid gap-x-4 gap-y-1 text-xs text-muted-foreground md:grid-cols-3">
                        <span>Vencimento: {formatDate(license.expiresAt)}</span>
                        <span>Acessos: {license.seats}</span>
                        <span>Valor: {formatCurrency(Number(license.monthlyValue))}</span>
                        <span>Domínio: {license.linkedDomain || "-"}</span>
                        <span>IP: {license.linkedIp || "-"}</span>
                        <span>Validações: {license.validationCount ?? 0}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          onClick={() =>
                            setBillingDraft(billingDraftFromLicense(detailsSubscriber, license))
                          }
                          size="sm"
                        >
                          <ReceiptText className="h-4 w-4" />
                          Cobrar
                        </Button>
                        <Button
                          onClick={() =>
                            void downloadPdf(
                              `/manager/licenses/${license.id}/pdf`,
                              `licenca-${license.licenseKey}.pdf`,
                            )
                          }
                          size="sm"
                          variant="outline"
                        >
                          <Download className="h-4 w-4" />
                          PDF
                        </Button>
                        <Button
                          disabled={license.status === "ACTIVE" || license.status === "LINKED"}
                          onClick={() => void runLicenseAction(license.id, "validate")}
                          size="sm"
                          variant="outline"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Validar
                        </Button>
                        <Button
                          disabled={license.status === "LINKED" || license.status === "CANCELLED"}
                          onClick={() => void runLicenseAction(license.id, "link")}
                          size="sm"
                          variant="outline"
                        >
                          <Link2 className="h-4 w-4" />
                          Vincular
                        </Button>
                        <Button
                          disabled={license.status === "CANCELLED"}
                          onClick={() => void cancelLicense(license)}
                          size="sm"
                          variant="outline"
                        >
                          <XCircle className="h-4 w-4" />
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ))}
                  <DetailPager
                    currentPage={currentLicensePage}
                    label="licencas"
                    onPageChange={setLicensePage}
                    pageCount={licensePageCount}
                    total={detailsLicenses.length}
                  />
                  {detailsSubscriber.licenses?.length ? null : (
                    <p className="rounded-md border p-4 text-sm text-muted-foreground">
                      Nenhuma licença cadastrada.
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="billings">
                <div className="space-y-3">
                  {visibleBillings.map((billing) => {
                    const payment = latestPayment(billing);

                    return (
                      <div className="rounded-md border bg-card p-2.5" key={billing.id}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{billing.reference}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {billing.systemKey} · vencimento {formatDate(billing.dueDate)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{formatCurrency(Number(billing.amount))}</p>
                            <Badge variant={statusVariant(billing.status)}>
                              {billingStatusLabel(billing.status)}
                            </Badge>
                          </div>
                        </div>

                        {payment ? (
                          <div className="mt-2 rounded-md bg-muted p-2 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={statusVariant(payment.status)}>
                                  {paymentMethodLabel(payment.method)} · {paymentStatusLabel(payment.status)}
                                </Badge>
                                {payment.providerPaymentId ? (
                                  <span className="text-xs text-muted-foreground">
                                    MP {payment.providerPaymentId}
                                  </span>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {payment.qrCode ? (
                                  <Button
                                    onClick={() => setPixPayment(payment)}
                                    size="sm"
                                    variant="outline"
                                  >
                                    <QrCode className="h-4 w-4" />
                                    Ver Pix
                                  </Button>
                                ) : null}
                                {payment.ticketUrl ? (
                                  <Button asChild size="sm" variant="outline">
                                    <a href={payment.ticketUrl} rel="noreferrer" target="_blank">
                                      <ExternalLink className="h-4 w-4" />
                                      Abrir
                                    </a>
                                  </Button>
                                ) : null}
                                <Button
                                  disabled={
                                    busyAction === payment.id ||
                                    payment.status === "CANCELLED" ||
                                    payment.status === "REFUNDED"
                                  }
                                  onClick={() => void cancelGatewayPayment(payment)}
                                  size="sm"
                                  variant="outline"
                                >
                                  <Ban className="h-4 w-4" />
                                  {payment.status === "APPROVED" ? "Estornar" : "Cancelar MP"}
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            disabled={billing.status === "PAID" || billing.status === "CANCELLED"}
                            onClick={() =>
                              setInvoiceDraft({
                                billingId: billing.id,
                                method: "PIX",
                                mode: "GATEWAY",
                                paidAt: todayInputValue(),
                              })
                            }
                            size="sm"
                          >
                            <CreditCard className="h-4 w-4" />
                            Faturar
                          </Button>
                          <Button
                            onClick={() =>
                              void downloadPdf(
                                `/manager/billings/${billing.id}/pdf`,
                                `cobranca-${billing.reference}.pdf`,
                              )
                            }
                            size="sm"
                            variant="outline"
                          >
                            <FileText className="h-4 w-4" />
                            PDF
                          </Button>
                          <Button
                            disabled={billing.status === "CANCELLED" || billing.status === "PAID"}
                            onClick={() => void cancelBilling(billing.id)}
                            size="sm"
                            variant="outline"
                          >
                            <Ban className="h-4 w-4" />
                            Cancelar
                          </Button>
                          <Button
                            disabled={!canDeleteBilling(billing)}
                            onClick={() => void deleteBilling(billing.id)}
                            size="sm"
                            variant="outline"
                          >
                            <Trash2 className="h-4 w-4" />
                            Apagar
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  <DetailPager
                    currentPage={currentBillingPage}
                    label="cobrancas"
                    onPageChange={setBillingPage}
                    pageCount={billingPageCount}
                    total={detailsBillings.length}
                  />
                  {detailsSubscriber.billings?.length ? null : (
                    <p className="rounded-md border p-4 text-sm text-muted-foreground">
                      Nenhuma cobrança cadastrada.
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="gateway">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary" />
                        <p className="font-medium">Mercado Pago</p>
                      </div>
                      <Badge
                        variant={
                          mercadoPagoGateway?.active && mercadoPagoGateway.configured
                            ? "success"
                            : "low"
                        }
                      >
                        {mercadoPagoGateway?.active && mercadoPagoGateway.configured
                          ? "Ativo"
                          : "Pendente"}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                      <p>Conta: {mercadoPagoGateway?.accountId ?? "-"}</p>
                      <p>Token: {mercadoPagoGateway?.accessTokenPreview ?? "-"}</p>
                      <p>Webhook: {mercadoPagoGateway?.webhookUrl ?? "-"}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        onClick={() => setGatewayDraft(gatewayDraftFromConfig(mercadoPagoGateway))}
                        size="sm"
                      >
                        <Settings className="h-4 w-4" />
                        Configurar
                      </Button>
                      <Button onClick={() => void reloadManager()} size="sm" variant="outline">
                        <CheckCircle2 className="h-4 w-4" />
                        Atualizar
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-md border p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <QrCode className="h-4 w-4 text-primary" />
                      <p className="font-medium">Métodos disponíveis</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="low">Pix</Badge>
                      <Badge variant="low">Boleto</Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      A baixa automática acontece pelo webhook de pagamento aprovado e renova a licença vinculada.
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="expirations">
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

      <Dialog
        onOpenChange={(open) => !open && setBillingDraft(null)}
        open={Boolean(billingDraft)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerar cobrança</DialogTitle>
            <DialogDescription>
              Lance a cobrança no assinante e fature por baixa manual, Pix ou boleto.
            </DialogDescription>
          </DialogHeader>
          {billingDraft ? (
            <Form onSubmit={saveBilling}>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField>
                  <Label htmlFor="billing-license">Licença</Label>
                  <Select
                    id="billing-license"
                    onChange={(event) => {
                      const license = detailsSubscriber?.licenses?.find(
                        (item) => item.id === event.target.value,
                      );

                      setBillingDraft({
                        ...billingDraft,
                        amount: license ? String(license.monthlyValue) : billingDraft.amount,
                        licenseId: event.target.value,
                        systemKey: license?.systemKey ?? billingDraft.systemKey,
                      });
                    }}
                    value={billingDraft.licenseId}
                  >
                    <option value="">Sem licença vinculada</option>
                    {(detailsSubscriber?.licenses ?? []).map((license) => (
                      <option key={license.id} value={license.id}>
                        {license.licenseKey} - {license.systemKey}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField>
                  <Label htmlFor="billing-reference">Referência</Label>
                  <Input
                    id="billing-reference"
                    onChange={(event) =>
                      setBillingDraft({ ...billingDraft, reference: event.target.value })
                    }
                    required
                    value={billingDraft.reference}
                  />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField>
                  <Label htmlFor="billing-system">Sistema</Label>
                  <Input
                    id="billing-system"
                    onChange={(event) =>
                      setBillingDraft({ ...billingDraft, systemKey: event.target.value })
                    }
                    required
                    value={billingDraft.systemKey}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="billing-amount">Valor</Label>
                  <Input
                    id="billing-amount"
                    min={0}
                    onChange={(event) =>
                      setBillingDraft({ ...billingDraft, amount: event.target.value })
                    }
                    required
                    step="0.01"
                    type="number"
                    value={billingDraft.amount}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="billing-due">Vencimento</Label>
                  <Input
                    id="billing-due"
                    onChange={(event) =>
                      setBillingDraft({ ...billingDraft, dueDate: event.target.value })
                    }
                    required
                    type="date"
                    value={billingDraft.dueDate}
                  />
                </FormField>
              </div>
              <FormField>
                <Label htmlFor="billing-description">Descrição</Label>
                <Textarea
                  id="billing-description"
                  onChange={(event) =>
                    setBillingDraft({ ...billingDraft, description: event.target.value })
                  }
                  value={billingDraft.description}
                />
              </FormField>
              <Button type="submit">Salvar cobrança</Button>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setInvoiceDraft(null)}
        open={Boolean(invoiceDraft)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Faturar cobrança</DialogTitle>
            <DialogDescription>
              Baixe manualmente ou gere Pix/boleto pelo Mercado Pago.
            </DialogDescription>
          </DialogHeader>
          {invoiceDraft ? (
            <Form onSubmit={invoiceBilling}>
              <FormField>
                <Label htmlFor="invoice-mode">Ação</Label>
                <Select
                  id="invoice-mode"
                  onChange={(event) =>
                    setInvoiceDraft({
                      ...invoiceDraft,
                      mode: event.target.value as BillingInvoiceDraft["mode"],
                    })
                  }
                  value={invoiceDraft.mode}
                >
                  <option value="GATEWAY">Gerar no gateway</option>
                  <option value="MANUAL">Marcar como paga</option>
                </Select>
              </FormField>

              {invoiceDraft.mode === "GATEWAY" ? (
                <>
                  <div className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span>Mercado Pago</span>
                      <Badge
                        variant={
                          mercadoPagoGateway?.active && mercadoPagoGateway.configured
                            ? "success"
                            : "low"
                        }
                      >
                        {mercadoPagoGateway?.active && mercadoPagoGateway.configured
                          ? "Disponível"
                          : "Configurar"}
                      </Badge>
                    </div>
                  </div>
                  <FormField>
                    <Label htmlFor="invoice-method">Método</Label>
                    <Select
                      id="invoice-method"
                      onChange={(event) =>
                        setInvoiceDraft({
                          ...invoiceDraft,
                          method: event.target.value as ManagerBillingPaymentMethod,
                        })
                      }
                      value={invoiceDraft.method}
                    >
                      <option value="PIX">Pix</option>
                      <option value="BOLETO">Boleto</option>
                    </Select>
                  </FormField>
                </>
              ) : (
                <FormField>
                  <Label htmlFor="invoice-paid-at">Data do pagamento</Label>
                  <Input
                    id="invoice-paid-at"
                    onChange={(event) =>
                      setInvoiceDraft({ ...invoiceDraft, paidAt: event.target.value })
                    }
                    type="date"
                    value={invoiceDraft.paidAt}
                  />
                </FormField>
              )}

              <Button type="submit">
                <CreditCard className="h-4 w-4" />
                Confirmar faturamento
              </Button>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setPixPayment(null)}
        open={Boolean(pixPayment)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Pix da cobrança</DialogTitle>
            <DialogDescription>
              Visualize o QR Code e copie o Pix copia e cola sem ocupar espaco no card.
            </DialogDescription>
          </DialogHeader>
          {pixPayment ? (
            <div className="space-y-4">
              <div className="grid place-items-center rounded-md border bg-background p-4">
                {qrImageSrc(pixPayment.qrCodeBase64) ? (
                  <img
                    alt="QR Code Pix"
                    className="h-48 w-48 object-contain"
                    src={qrImageSrc(pixPayment.qrCodeBase64) ?? undefined}
                  />
                ) : (
                  <div className="grid h-48 w-48 place-items-center rounded-md bg-muted text-muted-foreground">
                    <QrCode className="h-12 w-12" />
                  </div>
                )}
              </div>
              <FormField>
                <Label htmlFor="pix-copy-code">Pix copia e cola</Label>
                <Textarea
                  className="max-h-40 font-mono text-xs"
                  id="pix-copy-code"
                  readOnly
                  value={pixPayment.qrCode ?? ""}
                />
              </FormField>
              <div className="flex justify-end gap-2">
                <Button
                  disabled={!pixPayment.qrCode}
                  onClick={() => void copyText(pixPayment.qrCode ?? "")}
                  type="button"
                >
                  <Copy className="h-4 w-4" />
                  Copiar Pix
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setGatewayDraft(null)}
        open={Boolean(gatewayDraft)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mercado Pago</DialogTitle>
            <DialogDescription>
              Vincule a conta recebedora para gerar Pix, boleto, baixa automatica e estorno.
            </DialogDescription>
          </DialogHeader>
          {gatewayDraft ? (
            <Form onSubmit={saveGateway}>
              <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
                <input
                  checked={gatewayDraft.active}
                  onChange={(event) =>
                    setGatewayDraft({ ...gatewayDraft, active: event.target.checked })
                  }
                  type="checkbox"
                />
                Gateway ativo
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField>
                  <Label htmlFor="mp-client-id">Client ID</Label>
                  <Input
                    id="mp-client-id"
                    onChange={(event) =>
                      setGatewayDraft({ ...gatewayDraft, clientId: event.target.value })
                    }
                    value={gatewayDraft.clientId}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="mp-client-secret">Client Secret</Label>
                  <Input
                    id="mp-client-secret"
                    onChange={(event) =>
                      setGatewayDraft({ ...gatewayDraft, clientSecret: event.target.value })
                    }
                    placeholder={
                      mercadoPagoGateway?.clientSecretConfigured
                        ? "Configurado"
                        : "Informe para OAuth"
                    }
                    type="password"
                    value={gatewayDraft.clientSecret}
                  />
                </FormField>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField>
                  <Label htmlFor="mp-access-token">Access Token</Label>
                  <Input
                    id="mp-access-token"
                    onChange={(event) =>
                      setGatewayDraft({ ...gatewayDraft, accessToken: event.target.value })
                    }
                    placeholder={mercadoPagoGateway?.accessTokenPreview ?? "APP_USR..."}
                    type="password"
                    value={gatewayDraft.accessToken}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="mp-public-key">Public Key</Label>
                  <Input
                    id="mp-public-key"
                    onChange={(event) =>
                      setGatewayDraft({ ...gatewayDraft, publicKey: event.target.value })
                    }
                    placeholder={mercadoPagoGateway?.publicKeyPreview ?? "APP_USR..."}
                    value={gatewayDraft.publicKey}
                  />
                </FormField>
              </div>
              <FormField>
                <Label htmlFor="mp-webhook-secret">Webhook Secret</Label>
                <Input
                  id="mp-webhook-secret"
                  onChange={(event) =>
                    setGatewayDraft({ ...gatewayDraft, webhookSecret: event.target.value })
                  }
                  placeholder={
                    mercadoPagoGateway?.webhookSecretConfigured ? "Configurado" : "Secret do webhook"
                  }
                  type="password"
                  value={gatewayDraft.webhookSecret}
                />
              </FormField>
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">URLs da integração</p>
                <p className="mt-2 break-all text-muted-foreground">
                  Webhook: {mercadoPagoGateway?.webhookUrl ?? "-"}
                </p>
                <p className="mt-1 break-all text-muted-foreground">
                  Redirect OAuth: {mercadoPagoGateway?.redirectUri ?? "-"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit">Salvar gateway</Button>
                <Button onClick={() => void startGatewayOAuth()} type="button" variant="outline">
                  <ExternalLink className="h-4 w-4" />
                  Conectar conta
                </Button>
              </div>
            </Form>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
