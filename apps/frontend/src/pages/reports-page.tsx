import { Boxes, ClipboardCheck, FileDown, FileText } from "lucide-react";
import { useState } from "react";
import { ResourceError } from "@/components/domain/feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFile } from "@/lib/api";

type ReportKey = "invoices" | "movements" | "stocks";

function reportQuery(from: string, to: string) {
  const params = new URLSearchParams();

  if (from) {
    params.set("from", from);
  }

  if (to) {
    params.set("to", to);
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function ReportsPage() {
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

  const query = reportQuery(from, to);

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">Exportacoes</p>
        <h2 className="text-2xl font-semibold">Relatorios</h2>
      </div>

      {message ? <ResourceError message={message} /> : null}

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
            <CardTitle>Movimentacoes de estoque</CardTitle>
            <CardDescription>Entradas, saidas e transferencias por almoxarifado.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              disabled={loading === "movements"}
              onClick={() =>
                void downloadReport(
                  "movements",
                  `/reports/movements${query}`,
                  "relatorio-movimentacoes.pdf",
                )
              }
            >
              <FileDown className="h-4 w-4" />
              {loading === "movements" ? "Gerando..." : "Exportar PDF"}
            </Button>
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
            <Button
              className="w-full"
              disabled={loading === "stocks"}
              onClick={() =>
                void downloadReport("stocks", "/reports/stocks", "relatorio-saldos.pdf")
              }
            >
              <FileDown className="h-4 w-4" />
              {loading === "stocks" ? "Gerando..." : "Exportar PDF"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-2 grid h-10 w-10 place-items-center rounded-lg bg-muted text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <CardTitle>Relatorios por notas</CardTitle>
            <CardDescription>Notas fiscais e movimentacoes vinculadas.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              disabled={loading === "invoices"}
              onClick={() =>
                void downloadReport(
                  "invoices",
                  `/reports/invoices${query}`,
                  "relatorio-notas-fiscais.pdf",
                )
              }
            >
              <FileDown className="h-4 w-4" />
              {loading === "invoices" ? "Gerando..." : "Exportar PDF"}
            </Button>
          </CardContent>
        </Card>
      </div>

    </section>
  );
}
