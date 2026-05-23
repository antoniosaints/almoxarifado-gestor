import { Check, PackagePlus, Warehouse, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "@/components/domain/data-table";
import { LoadingLine, ResourceError } from "@/components/domain/feedback";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SearchSelect } from "@/components/ui/search-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, useApiResource } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { EntryRequest, Invoice, TransferRequest } from "@/lib/types";
import { formatDate } from "@/lib/utils";

function StatusBadge({ status }: { status: string }) {
  const label = {
    APPROVED: "Aprovada",
    CANCELLED: "Cancelada",
    PENDING: "Pendente",
    PENDING_RECEIPT: "Aguardando recebimento",
    RECEIVED: "Recebida",
    REJECTED: "Rejeitada",
  }[status];

  return (
    <Badge
      variant={
        status === "APPROVED" || status === "RECEIVED"
          ? "success"
          : status === "REJECTED" || status === "CANCELLED"
            ? "zero"
            : "low"
      }
    >
      {label ?? status}
    </Badge>
  );
}

function ApprovalDialog({
  invoices,
  onApprove,
  request,
}: {
  invoices: Invoice[];
  onApprove: (requestId: string, invoiceId?: string) => Promise<void>;
  request: EntryRequest;
}) {
  const [invoiceId, setInvoiceId] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        <Check className="h-4 w-4" />
        Aprovar
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar entrada</DialogTitle>
            <DialogDescription>
              {request.product.name} para {request.warehouse.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor={`invoice-${request.id}`}>Nota fiscal opcional</Label>
              <SearchSelect
                ariaLabel="Nota fiscal opcional"
                id={`invoice-${request.id}`}
                onValueChange={setInvoiceId}
                options={[
                  { label: "Sem nota vinculada", value: "" },
                  ...invoices.map((invoice) => ({
                    label: `${invoice.number} - ${invoice.companyName}`,
                    searchText: invoice.cnpj,
                    value: invoice.id,
                  })),
                ]}
                placeholder="Sem nota vinculada"
                value={invoiceId}
              />
            </div>
            <Button
              onClick={() => {
                void onApprove(request.id, invoiceId || undefined).then(() =>
                  setOpen(false),
                );
              }}
            >
              Confirmar aprovacao
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReceiveDialog({
  onReceive,
  request,
}: {
  onReceive: (requestId: string) => Promise<void>;
  request: TransferRequest;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm">
        <PackagePlus className="h-4 w-4" />
        Confirmar recebimento
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar recebimento</DialogTitle>
            <DialogDescription>
              {request.quantity} {request.product.unit.abbreviation} de{" "}
              {request.product.name}
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={() => {
              void onReceive(request.id).then(() => setOpen(false));
            }}
          >
            Confirmar recebimento
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RequestsPage() {
  const { session } = useSession();
  const entries = useApiResource<EntryRequest[]>("/entry-requests", []);
  const transfers = useApiResource<TransferRequest[]>("/transfer-requests", []);
  const invoices = useApiResource<Invoice[]>("/invoices", []);
  const [activeTab, setActiveTab] = useState("entries");
  const [message, setMessage] = useState<{
    error: boolean;
    text: string;
  } | null>(null);
  const admin = session?.user.role === "ADMIN";

  async function approve(requestId: string, invoiceId?: string) {
    try {
      await api(`/entry-requests/${requestId}/approve`, {
        body: JSON.stringify({ invoiceId }),
        method: "POST",
      });
      setMessage({ error: false, text: "Solicitacao aprovada." });
      await entries.reload();
    } catch (caughtError) {
      setMessage({
        error: true,
        text: caughtError instanceof Error ? caughtError.message : "Falha ao aprovar.",
      });
    }
  }

  async function reject(requestId: string) {
    try {
      await api(`/entry-requests/${requestId}/reject`, { method: "POST" });
      setMessage({ error: false, text: "Solicitacao rejeitada." });
      await entries.reload();
    } catch (caughtError) {
      setMessage({
        error: true,
        text: caughtError instanceof Error ? caughtError.message : "Falha ao rejeitar.",
      });
    }
  }

  async function receive(requestId: string) {
    try {
      await api(`/transfer-requests/${requestId}/receive`, { method: "POST" });
      setMessage({ error: false, text: "Recebimento confirmado." });
      await transfers.reload();
    } catch (caughtError) {
      setMessage({
        error: true,
        text:
          caughtError instanceof Error
            ? caughtError.message
            : "Falha ao receber transferencia.",
      });
    }
  }

  if (entries.loading || transfers.loading || (admin && invoices.loading)) {
    return <LoadingLine />;
  }

  if (entries.error || transfers.error || (admin && invoices.error)) {
    return (
      <ResourceError message={entries.error ?? transfers.error ?? invoices.error ?? ""} />
    );
  }

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">Pendencias internas</p>
        <h2 className="text-2xl font-semibold">Solicitacoes</h2>
      </div>

      {message ? (
        <Alert
          className={
            message.error
              ? "border-rose-200 bg-rose-50 text-rose-950"
              : "border-emerald-200 bg-emerald-50 text-emerald-950"
          }
        >
          <AlertTitle>{message.error ? "Nao foi possivel concluir" : "Atualizacao"}</AlertTitle>
          <AlertDescription className="text-current">{message.text}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs onValueChange={setActiveTab} value={activeTab}>
        <TabsList>
          <TabsTrigger onClick={() => setActiveTab("entries")} value="entries">
            Entradas solicitadas
          </TabsTrigger>
          <TabsTrigger onClick={() => setActiveTab("transfers")} value="transfers">
            Recebimentos
          </TabsTrigger>
        </TabsList>
        <TabsContent value="entries">
          <DataTable
            columns={[
              {
                cell: (request) => (
                  <>
                    <p className="font-medium">{request.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(request.movementDate)}
                    </p>
                  </>
                ),
                header: "Produto",
                key: "product",
              },
              {
                cell: (request) => request.warehouse.name,
                header: "Almoxarifado",
                key: "warehouse",
              },
              {
                cell: (request) =>
                  `${request.quantity} ${request.product.unit.abbreviation}`,
                header: "Quantidade",
                key: "quantity",
              },
              {
                cell: (request) => request.requestedBy.name,
                header: "Solicitante",
                key: "requester",
              },
              {
                cell: (request) => <StatusBadge status={request.status} />,
                header: "Status",
                key: "status",
              },
              {
                cell: (request) => (
                  <div className="flex justify-end gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link
                        aria-label={`Abrir almoxarifado ${request.warehouse.name}`}
                        to={`/warehouses/${request.warehouse.id}`}
                      >
                        <Warehouse className="h-4 w-4" />
                        Almoxarifado
                      </Link>
                    </Button>
                    {admin && request.status === "PENDING" ? (
                      <>
                        <ApprovalDialog
                          invoices={invoices.data}
                          onApprove={approve}
                          request={request}
                        />
                        <Button
                          onClick={() => void reject(request.id)}
                          size="sm"
                          variant="outline"
                        >
                          <X className="h-4 w-4" />
                          Rejeitar
                        </Button>
                      </>
                    ) : null}
                  </div>
                ),
                cellClassName: "text-right",
                header: "Acoes",
                headerClassName: "text-right",
                key: "actions",
              },
            ]}
            data={entries.data}
            emptyMessage="Nenhuma solicitacao de entrada encontrada."
            getRowId={(request) => request.id}
            searchPlaceholder="Buscar entrada solicitada..."
            searchText={(request) =>
              [
                request.product.name,
                request.product.code,
                request.product.unit.abbreviation,
                request.warehouse.name,
                request.requestedBy.name,
                request.status,
                formatDate(request.movementDate),
              ].join(" ")
            }
          />
        </TabsContent>
        <TabsContent value="transfers">
          <DataTable
            columns={[
              {
                cell: (request) => (
                  <>
                    <p className="font-medium">{request.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(request.createdAt)}
                    </p>
                  </>
                ),
                header: "Produto",
                key: "product",
              },
              {
                cell: (request) => request.sourceWarehouse.name,
                header: "Origem",
                key: "source",
              },
              {
                cell: (request) => request.destinationWarehouse.name,
                header: "Destino",
                key: "destination",
              },
              {
                cell: (request) =>
                  `${request.quantity} ${request.product.unit.abbreviation}`,
                header: "Quantidade",
                key: "quantity",
              },
              {
                cell: (request) => <StatusBadge status={request.status} />,
                header: "Status",
                key: "status",
              },
              {
                cell: (request) => (
                  <div className="flex justify-end gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link
                        aria-label={`Abrir destino ${request.destinationWarehouse.name}`}
                        to={`/warehouses/${request.destinationWarehouse.id}`}
                      >
                        <Warehouse className="h-4 w-4" />
                        Destino
                      </Link>
                    </Button>
                    {request.status === "PENDING_RECEIPT" ? (
                      <ReceiveDialog onReceive={receive} request={request} />
                    ) : null}
                  </div>
                ),
                cellClassName: "text-right",
                header: "Acoes",
                headerClassName: "text-right",
                key: "actions",
              },
            ]}
            data={transfers.data}
            emptyMessage="Nenhum recebimento encontrado."
            getRowId={(request) => request.id}
            searchPlaceholder="Buscar recebimento..."
            searchText={(request) =>
              [
                request.product.name,
                request.product.code,
                request.product.unit.abbreviation,
                request.sourceWarehouse.name,
                request.destinationWarehouse.name,
                request.status,
                request.createdBy.name,
                request.receivedBy?.name,
                formatDate(request.createdAt),
              ].join(" ")
            }
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
