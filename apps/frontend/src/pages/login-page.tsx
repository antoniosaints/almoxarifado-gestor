import { Boxes, LogIn } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import type { User } from "@/lib/types";

type LoginResponse = {
  token: string;
  user: User;
};

export function LoginPage() {
  const navigate = useNavigate();
  const { setSession } = useSession();
  const [email, setEmail] = useState("admin@prefeitura.local");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const session = await api<LoginResponse>("/auth/login", {
        body: JSON.stringify({ email, password }),
        method: "POST",
      });
      setSession(session);
      navigate("/dashboard");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Falha ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[linear-gradient(135deg,#f8fafc_0%,#ecfeff_44%,#f8fafc_100%)] p-4">
      <section className="w-full max-w-md">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Boxes className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Prefeitura</p>
            <h1 className="text-2xl font-semibold">Almoxarifado Municipal</h1>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Acessar estoque</CardTitle>
            <CardDescription>
              Entre com seu usuario para acompanhar o estoque municipal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form onSubmit={submit}>
              {error ? (
                <Alert className="border-rose-200 bg-rose-50 text-rose-950">
                  <AlertTitle>Entrada indisponivel</AlertTitle>
                  <AlertDescription className="text-rose-900">{error}</AlertDescription>
                </Alert>
              ) : null}
              <FormField>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  value={email}
                />
              </FormField>
              <FormField>
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  value={password}
                />
              </FormField>
              <Button className="w-full" disabled={loading} type="submit">
                <LogIn className="h-4 w-4" />
                Entrar
              </Button>
            </Form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
