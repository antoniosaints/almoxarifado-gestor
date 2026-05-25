import { Boxes, ClipboardCheck, FileDown, FileText } from "lucide-react";
import { useState, type FormEvent } from "react";
import { LoadingLine, ResourceError } from "@/components/domain/feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { apiFile, useApiResource } from "@/lib/api";
import type { Warehouse } from "@/lib/types";

type ReportKey = "invoices" | "movements" | "stocks";

function reportQuery(
  from: string,
  to: string,
  extra: Record<string, string | undefined> = {},
) {
  const params = new URLSearchParams();

  if (from) {
    params.set("from", from);
  }

  if (to) {
    params.set("to", to);
  }

  Object.entries(extra).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const query = params.toString();
  return query ? `?${query}` : "";
}

function InvoiceReportDialog({
  from,
  loading,
  onExport,
  to,
}: {
  from: string;
  loading: boolean;
  onExport: (path: string) => Promise<void>;
  to: string;
}) {
  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [number, setNumber] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onExport(
      `/reports/invoices${reportQuery(from, to, {
        companyName,
        cnpj,
        number,
      })}`,
    ).then(() => setOpen(false));
  }

  return (
    <>
      <Button
        className="w-full"
        disabled={loading}
        onClick={() => setOpen(true)}
        type="button"
      >
        <FileDown className="h-4 w-4" />
        {loading ? "Gerando..." : "Exportar PDF"}
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar notas fiscais</DialogTitle>
            <DialogDescription>
              Refine a exportacao por empresa, CNPJ ou numero da nota.
            </DialogDescription>
          </DialogHeader>
          <Form onSubmit={submit}>
            <FormField>
              <Label htmlFor="report-invoice-company">Empresa</Label>
              <Input
                id="report-invoice-company"
                onChange={(event) => setCompanyName(event.target.value)}
                value={companyName}
              />
            </FormField>
            <FormField>
              <Label htmlFor="report-invoice-cnpj">CNPJ</Label>
              <Input
                id="report-invoice-cnpj"
                onChange={(event) => setCnpj(event.target.value)}
                value={cnpj}
              />
            </FormField>
            <FormField>
              <Label htmlFor="report-invoice-number">Nota fiscal</Label>
              <Input
                id="report-invoice-number"
                onChange={(event) => setNumber(event.target.value)}
                value={number}
              />
            </FormField>
            <Button disabled={loading} type="submit">
              <FileDown className="h-4 w-4" />
              {loading ? "Gerando..." : "Exportar notas"}
            </Button>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function WarehouseReportDialog({
  fileName,
  from,
  loading,
  onExport,
  reportKey,
  title,
  to,
  warehouses,
}: {
  fileName: string;
  from: string;
  loading: boolean;
  onExport: (path: string, fileName: string) => Promise<void>;
  reportKey: "movements" | "stocks";
  title: string;
  to: string;
  warehouses: Warehouse[];
}) {
  const [open, setOpen] = useState(false);
  const [selectedWarehouseIds, setSelectedWarehouseIds] = useState<string[]>([]);

  function toggleWarehouse(warehouseId: string) {
    setSelectedWarehouseIds((current) =>
      current.includes(warehouseId)
        ? current.filter((id) => id !== warehouseId)
        : [...current, warehouseId],
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onExport(
      `/reports/${reportKey}${reportQuery(from, to, {
        warehouseIds: selectedWarehouseIds.join(","),
      })}`,
      fileName,
    ).then(() => setOpen(false));
  }

  return (
    <>
      <Button
        className="w-full"
        disabled={loading}
        onClick={() => setOpen(true)}
        type="button"
      >
        <FileDown className="h-4 w-4" />
        {loading ? "Gerando..." : "Exportar PDF"}
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Selecione os almoxarifados do PDF. Sem selecao, todos serao exportados.
            </DialogDescription>
          </DialogHeader>
          <Form onSubmit={submit}>
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border bg-card p-3">
              {warehouses.map((warehouse) => (
                <label
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  htmlFor={`report-${reportKey}-${warehouse.id}`}
                  key={warehouse.id}
                >
                  <input
                    checked={selectedWarehouseIds.includes(warehouse.id)}
                    id={`report-${reportKey}-${warehouse.id}`}
                    onChange={() => toggleWarehouse(warehouse.id)}
                    type="checkbox"
                  />
                  {warehouse.name}
                </label>
              ))}
              {!warehouses.length ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum almoxarifado disponivel.
                </p>
              ) : null}
            </div>
            <Button disabled={loading} type="submit">
              <FileDown className="h-4 w-4" />
              {loading ? "Gerando..." : title}
            </Button>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ReportsPage() {
  const warehouses = useApiResource<Warehouse[]>("/warehouses", []);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState<ReportKey | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function downloadReport(key: ReportKey, path: string, fileName: string) {
    setLoading(key);
    setMessage(null);

    try {
      const blob = await apiFile(path);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error ? caughtError.message : "Falha ao baixar relatorio.",
      );
    } finally {
      setLoading(null);
    }
  }

  if (warehouses.loading) {
    return <LoadingLine />;
  }

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">Exportações</p>
        <h2 className="text-2xl font-semibold">Relatórios</h2>
      </div>

      {message || warehouses.error ? (
        <ResourceError message={message ?? warehouses.error ?? ""} />
      ) : null}

      <div className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-[1fr_1fr_auto]">
        <FormField>
          <Label htmlFor="report-from">Periodo de</Label>
          <Input
            id="report-from"
            onChange={(event) => setFrom(event.target.value)}
            type="date"
            value={from}
          />
        </FormField>
        <FormField>
          <Label htmlFor="report-to">Periodo ate</Label>
          <Input
            id="report-to"
            onChange={(event) => setTo(event.target.value)}
            type="date"
            value={to}
          />
        </FormField>
        <Button
          className="self-end"
          onClick={() => {
            setFrom("");
            setTo("");
          }}
          type="button"
          variant="outline"
        >
          Limpar periodo
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="mb-2 grid h-10 w-10 place-items-center rounded-lg bg-muted text-primary">
              <ClipboardCheck className="h-5 w-5" />
            </div>
            <CardTitle>Movimentações de estoque</CardTitle>
            <CardDescription>Entradas, saidas e transferencias por almoxarifado.</CardDescription>
          </CardHeader>
          <CardContent>
            <WarehouseReportDialog
              fileName="relatorio-movimentacoes.pdf"
              from={from}
              loading={loading === "movements"}
              onExport={(path, fileName) => downloadReport("movements", path, fileName)}
              reportKey="movements"
              title="Exportar movimentacoes"
              to={to}
              warehouses={warehouses.data}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-2 grid h-10 w-10 place-items-center rounded-lg bg-muted text-primary">
              <Boxes className="h-5 w-5" />
            </div>
            <CardTitle>Saldos de estoques</CardTitle>
            <CardDescription>Saldo atual, minimo e estado por produto.</CardDescription>
          </CardHeader>
          <CardContent>
            <WarehouseReportDialog
              fileName="relatorio-saldos.pdf"
              from={from}
              loading={loading === "stocks"}
              onExport={(path, fileName) => downloadReport("stocks", path, fileName)}
              reportKey="stocks"
              title="Exportar saldos"
              to={to}
              warehouses={warehouses.data}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-2 grid h-10 w-10 place-items-center rounded-lg bg-muted text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <CardTitle>Relatorios por notas</CardTitle>
            <CardDescription>Notas fiscais e movimentações vinculadas.</CardDescription>
          </CardHeader>
          <CardContent>
            <InvoiceReportDialog
              from={from}
              loading={loading === "invoices"}
              onExport={(path) =>
                downloadReport("invoices", path, "relatorio-notas-fiscais.pdf")
              }
              to={to}
            />
          </CardContent>
        </Card>
      </div>

    </section>
  );
}
