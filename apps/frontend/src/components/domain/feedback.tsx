import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ResourceError({ message }: { message: string }) {
  return (
    <Alert className="border-rose-200 bg-rose-50 text-rose-950">
      <AlertTitle>Nao foi possivel carregar</AlertTitle>
      <AlertDescription className="text-rose-900">{message}</AlertDescription>
    </Alert>
  );
}

export function LoadingLine({ label = "Carregando dados..." }: { label?: string }) {
  return <p className="text-sm text-muted-foreground">{label}</p>;
}
