import { FileSearch } from "lucide-react";
import { useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nota fiscal</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>CNPJ</TableHead>
            <TableHead>Data da nota</TableHead>
            <TableHead>Movimentacoes</TableHead>
            <TableHead className="text-right">Acoes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.data.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell>
                <p className="font-medium">{invoice.number}</p>
                {invoice.observation ? (
                  <p className="text-xs text-muted-foreground">{invoice.observation}</p>
                ) : null}
              </TableCell>
              <TableCell>{invoice.companyName}</TableCell>
              <TableCell>{invoice.cnpj}</TableCell>
              <TableCell>{formatDate(invoice.issueDate)}</TableCell>
              <TableCell>
                <Badge variant={(invoice.movements?.length ?? 0) ? "success" : "outline"}>
                  {invoice.movements?.length ?? 0}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <InvoiceMovementsDialog invoice={invoice} />
                </div>
              </TableCell>
            </TableRow>
          ))}
          {!invoices.data.length ? (
            <TableRow>
              <TableCell colSpan={6}>Nenhuma nota fiscal cadastrada.</TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </section>
  );
}
