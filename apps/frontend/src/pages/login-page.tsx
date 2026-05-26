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
import { resolveAssetUrl } from "@/lib/assets";
import { useSession } from "@/lib/session";
import { useSystemSettings } from "@/lib/system-settings";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

type LoginResponse = {
  token: string;
  user: User;
};

export function LoginPage() {
  const navigate = useNavigate();
  const { setSession } = useSession();
  const { darkMode, settings } = useSystemSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const loginBackgroundUrl = resolveAssetUrl(settings.loginBackgroundUrl);
  const loginImageUrl = resolveAssetUrl(settings.loginImageUrl);
  const logoUrl = resolveAssetUrl(settings.logoUrl);

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

  const backgroundStyle = loginBackgroundUrl
    ? {
        backgroundImage: darkMode
          ? `linear-gradient(135deg, rgb(2 6 23 / 0.88), rgb(15 23 42 / 0.1)), url("${loginBackgroundUrl.replace(/"/g, "%22")}")`
          : `linear-gradient(135deg, rgb(248 250 252 / 0.88), rgb(236 254 255 / 0.1)), url("${loginBackgroundUrl.replace(/"/g, "%22")}")`,
      }
    : undefined;

  return (
    <main
      className={cn(
        "grid min-h-screen place-items-center p-4",
        loginBackgroundUrl
          ? "bg-cover bg-center"
          : "bg-[linear-gradient(135deg,#f8fafc_0%,#ecfeff_44%,#f8fafc_100%)] dark:bg-[linear-gradient(135deg,#020617_0%,#0f172a_44%,#111827_100%)]",
      )}
      style={backgroundStyle}
    >
      <section
        className={cn(
          "w-full",
          loginImageUrl
            ? "grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-center"
            : "max-w-md",
        )}
      >
        {loginImageUrl ? (
          <div className="hidden overflow-hidden rounded-lg border bg-card shadow-sm lg:block">
            <img
              alt=""
              className="h-[31rem] w-full object-cover"
              src={loginImageUrl}
            />
          </div>
        ) : null}
        <div className="w-full max-w-md justify-self-center">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid w-12 place-items-center overflow-hidden rounded-lg border text-primary-foreground shadow-sm">
              {logoUrl ? (
                <img
                  alt=""
                  className="h-12 w-12 object-cover"
                  src={logoUrl}
                />
              ) : (
                <Boxes className="h-6 w-6" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {settings.systemName}
              </p>
              <h1 className="text-2xl font-semibold">{settings.loginTitle}</h1>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Acessar estoque</CardTitle>
              <CardDescription>{settings.loginSubtitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <Form onSubmit={submit}>
                {error ? (
                  <Alert className="border-rose-200 bg-rose-50 text-rose-950">
                    <AlertTitle>Entrada indisponivel</AlertTitle>
                    <AlertDescription className="text-rose-900">
                      {error}
                    </AlertDescription>
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
        </div>
      </section>
    </main>
  );
}
