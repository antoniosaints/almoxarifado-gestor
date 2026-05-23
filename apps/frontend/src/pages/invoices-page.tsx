import { FileSearch } from "lucide-react";
import { useMemo, useState } from "react";
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
import { FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useApiResource } from "@/lib/api";
import type { Invoice } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { MovementsTable } from "./movements-page";

export function InvoiceMovementsDialog({ invoice }: { invoice: Invoice }) {
  const [open, setOpen] = useState(false);
  const movements = invoice.movements ?? [];

  return (
    <>
      <Button
        aria-label={`Consultar movimentacoes da nota ${invoice.number}`}
        onClick={() => setOpen(true)}
        size="icon"
        variant="outline"
      >
        <FileSearch className="h-4 w-4" />
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Movimentacoes da nota {invoice.number}</DialogTitle>
            <DialogDescription>
              {invoice.companyName} em {formatDate(invoice.issueDate)}
            </DialogDescription>
          </DialogHeader>

          {movements.length ? (
            <MovementsTable movements={movements} />
          ) : (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Nenhuma movimentacao vinculada a esta nota.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function InvoicesPage() {
  const invoices = useApiResource<Invoice[]>("/invoices", []);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [movementFilter, setMovementFilter] = useState("all");

  const filteredInvoices = useMemo(
    () =>
      invoices.data.filter((invoice) => {
        const issueDate = new Date(invoice.issueDate);
        const fromDate = from ? new Date(`${from}T00:00:00`) : null;
        const toDate = to ? new Date(`${to}T23:59:59.999`) : null;
        const movementCount = invoice.movements?.length ?? 0;

        return (
          (!fromDate || issueDate >= fromDate) &&
          (!toDate || issueDate <= toDate) &&
          (movementFilter === "all" ||
            (movementFilter === "linked" && movementCount > 0) ||
            (movementFilter === "unlinked" && movementCount === 0))
        );
      }),
    [from, invoices.data, movementFilter, to],
  );

  function clearFilters() {
    setFrom("");
    setTo("");
    setMovementFilter("all");
  }

  if (invoices.loading) {
    return <LoadingLine />;
  }

  if (invoices.error) {
    return <ResourceError message={invoices.error} />;
  }

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">Documentos de entrada</p>
        <h2 className="text-2xl font-semibold">Notas fiscais</h2>
      </div>

      <div className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
        <FormField>
          <Label htmlFor="invoice-from">Emissao de</Label>
          <Input
            id="invoice-from"
            onChange={(event) => setFrom(event.target.value)}
            type="date"
            value={from}
          />
        </FormField>
        <FormField>
          <Label htmlFor="invoice-to">Emissao ate</Label>
          <Input
            id="invoice-to"
            onChange={(event) => setTo(event.target.value)}
            type="date"
            value={to}
          />
        </FormField>
        <FormField>
          <Label htmlFor="invoice-movements">Movimentacoes</Label>
          <Select
            id="invoice-movements"
            onChange={(event) => setMovementFilter(event.target.value)}
            value={movementFilter}
          >
            <option value="all">Todas</option>
            <option value="linked">Com movimentacoes</option>
            <option value="unlinked">Sem movimentacoes</option>
          </Select>
        </FormField>
        <Button className="self-end" onClick={clearFilters} type="button" variant="outline">
          Limpar filtros
        </Button>
      </div>

      <DataTable
        columns={[
          {
            cell: (invoice) => (
              <>
                <p className="font-medium">{invoice.number}</p>
                {invoice.observation ? (
                  <p className="text-xs text-muted-foreground">{invoice.observation}</p>
                ) : null}
              </>
            ),
            header: "Nota fiscal",
            key: "invoice",
          },
          {
            cell: (invoice) => invoice.companyName,
            header: "Empresa",
            key: "company",
          },
          {
            cell: (invoice) => invoice.cnpj,
            header: "CNPJ",
            key: "cnpj",
          },
          {
            cell: (invoice) => formatDate(invoice.issueDate),
            header: "Data da nota",
            key: "issue-date",
          },
          {
            cell: (invoice) => (
              <Badge variant={(invoice.movements?.length ?? 0) ? "success" : "outline"}>
                {invoice.movements?.length ?? 0}
              </Badge>
            ),
            header: "Movimentacoes",
            key: "movements",
          },
          {
            cell: (invoice) => (
              <div className="flex justify-end">
                <InvoiceMovementsDialog invoice={invoice} />
              </div>
            ),
            cellClassName: "text-right",
            header: "Acoes",
            headerClassName: "text-right",
            key: "actions",
          },
        ]}
        data={filteredInvoices}
        emptyMessage="Nenhuma nota fiscal cadastrada."
        getRowId={(invoice) => invoice.id}
        searchPlaceholder="Buscar nota, empresa ou CNPJ..."
        searchText={(invoice) =>
          [
            invoice.number,
            invoice.companyName,
            invoice.cnpj,
            invoice.observation,
            formatDate(invoice.issueDate),
            ...(invoice.movements ?? []).flatMap((movement) => [
              movement.product.name,
              movement.product.code,
              movement.warehouse.name,
            ]),
          ].join(" ")
        }
      />
    </section>
  );
}
