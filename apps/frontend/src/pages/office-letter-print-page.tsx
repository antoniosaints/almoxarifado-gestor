import { Printer, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { OfficeLetterDocument } from "@/components/domain/office-letter-document";
import { LoadingLine, ResourceError } from "@/components/domain/feedback";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { OfficeLetter } from "@/lib/types";

export function OfficeLetterPrintPage() {
  const { requestId } = useParams();
  const { session } = useSession();
  const [letter, setLetter] = useState<OfficeLetter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session || !requestId) {
      setLoading(false);
      return;
    }

    let active = true;

    async function loadLetter() {
      setLoading(true);
      setError(null);

      try {
        const loaded = await api<OfficeLetter>(
          `/entry-requests/${requestId}/office-letter`,
        );

        if (active) {
          setLetter(loaded);
        }
      } catch (caughtError) {
        if (active) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Falha ao carregar o ofício.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadLetter();

    return () => {
      active = false;
    };
  }, [requestId, session]);

  if (!session) {
    return <Navigate replace to="/login" />;
  }

  return (
    <main className="office-letter-print-screen bg-muted px-4 py-4 text-foreground print:bg-white">
      <div className="office-letter-print-actions mx-auto mb-4 flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3 shadow-sm">
        <div>
          <h1 className="text-base font-semibold">Ofício para impressão</h1>
          <p className="text-sm text-muted-foreground">
            {letter?.numberFormatted
              ? `Ofício ${letter.numberFormatted}`
              : "Documento A4"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Para o PDF sair idêntico ao preview, no diálogo de impressão use
            Margens: <strong>Padrão</strong> e desative
            {" "}<strong>Cabeçalhos e rodapés</strong>.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            disabled={!letter || loading}
            onClick={() => window.print()}
            type="button"
          >
            <Printer className="h-4 w-4" />
            Imprimir / Salvar PDF
          </Button>
          <Button onClick={() => window.close()} type="button" variant="outline">
            <X className="h-4 w-4" />
            Fechar
          </Button>
        </div>
      </div>

      <div className="office-letter-print-frame mx-auto max-w-5xl">
        {loading ? <LoadingLine label="Carregando ofício..." /> : null}
        {error ? <ResourceError message={error} /> : null}
        {letter ? (
          <OfficeLetterDocument html={letter.documentHtml ?? letter.contentHtml} />
        ) : null}
      </div>
    </main>
  );
}
