import { Building2, FileText, Image, Moon, Palette, Save, Sun } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { LoadingLine, ResourceError } from "@/components/domain/feedback";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  defaultSystemSettings,
  useSystemSettings,
} from "@/lib/system-settings";
import type { SystemSettings } from "@/lib/types";

function normalizeColor(color: string, fallback = defaultSystemSettings.primaryColor) {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

export function SettingsPage() {
  const {
    darkMode,
    error,
    loading,
    saveSettings,
    setDarkMode,
    settings,
  } = useSystemSettings();
  const [draft, setDraft] = useState<SystemSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  function updateDraft(field: keyof SystemSettings, value: string) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const savedSettings = await saveSettings({
        ...draft,
        primaryColor: normalizeColor(draft.primaryColor),
        reportPrimaryColor: normalizeColor(
          draft.reportPrimaryColor,
          defaultSystemSettings.reportPrimaryColor,
        ),
      });

      setDraft(savedSettings);
      setMessage("Configuracoes salvas.");
    } catch (caughtError) {
      setMessage(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao salvar configuracoes.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingLine />;
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Sistema</p>
          <h2 className="text-2xl font-semibold">Configuracoes</h2>
        </div>
        <Button disabled={saving} form="system-settings-form" type="submit">
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      {error ? <ResourceError message={error} /> : null}
      {message ? (
        message === "Configuracoes salvas." ? (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950">
            <AlertTitle>Pronto</AlertTitle>
            <AlertDescription className="text-emerald-900">
              {message}
            </AlertDescription>
          </Alert>
        ) : (
          <ResourceError message={message} />
        )
      ) : null}

      <Form id="system-settings-form" onSubmit={submit}>
        <Tabs defaultValue="appearance">
          <TabsList>
            <TabsTrigger value="appearance">
              <Palette className="mr-1 h-4 w-4" />
              Aparencia
            </TabsTrigger>
            <TabsTrigger value="brand">
              <Building2 className="mr-1 h-4 w-4" />
              Marca
            </TabsTrigger>
            <TabsTrigger value="login">
              <Image className="mr-1 h-4 w-4" />
              Login
            </TabsTrigger>
            <TabsTrigger value="reports">
              <FileText className="mr-1 h-4 w-4" />
              Relatorios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appearance">
            <section className="space-y-4 rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-muted">
                    {darkMode ? (
                      <Moon className="h-4 w-4" />
                    ) : (
                      <Sun className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">Tema dark</p>
                    <p className="text-sm text-muted-foreground">
                      Alterna o tema neste navegador.
                    </p>
                  </div>
                </div>
                <Switch checked={darkMode} onCheckedChange={setDarkMode} />
              </div>

              <div className="grid gap-4 md:grid-cols-[7rem_minmax(0,1fr)] md:items-end">
                <FormField>
                  <Label htmlFor="settings-primary-color">Cor</Label>
                  <Input
                    className="h-10 p-1"
                    id="settings-primary-color"
                    onChange={(event) => updateDraft("primaryColor", event.target.value)}
                    type="color"
                    value={normalizeColor(draft.primaryColor)}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="settings-primary-color-text">Cor primaria</Label>
                  <Input
                    id="settings-primary-color-text"
                    onChange={(event) => updateDraft("primaryColor", event.target.value)}
                    pattern="^#[0-9a-fA-F]{6}$"
                    value={draft.primaryColor}
                  />
                </FormField>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="brand">
            <section className="grid gap-4 rounded-lg border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="space-y-4">
                <FormField>
                  <Label htmlFor="settings-system-name">Nome do sistema</Label>
                  <Input
                    id="settings-system-name"
                    onChange={(event) => updateDraft("systemName", event.target.value)}
                    required
                    value={draft.systemName}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="settings-logo-url">Logo</Label>
                  <Input
                    id="settings-logo-url"
                    onChange={(event) => updateDraft("logoUrl", event.target.value)}
                    placeholder="https://..."
                    value={draft.logoUrl ?? ""}
                  />
                </FormField>
              </div>
              <div className="rounded-lg border bg-background p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-lg bg-primary text-primary-foreground">
                    {draft.logoUrl ? (
                      <img
                        alt=""
                        className="h-full w-full object-cover"
                        src={draft.logoUrl}
                      />
                    ) : (
                      <Building2 className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{draft.systemName}</p>
                    <p className="text-sm text-muted-foreground">Almoxarifado</p>
                  </div>
                </div>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="login">
            <section className="grid gap-4 rounded-lg border bg-card p-4 lg:grid-cols-2">
              <div className="space-y-4">
                <FormField>
                  <Label htmlFor="settings-login-title">Titulo do login</Label>
                  <Input
                    id="settings-login-title"
                    onChange={(event) => updateDraft("loginTitle", event.target.value)}
                    required
                    value={draft.loginTitle}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="settings-login-subtitle">Subtitulo do login</Label>
                  <Input
                    id="settings-login-subtitle"
                    onChange={(event) => updateDraft("loginSubtitle", event.target.value)}
                    required
                    value={draft.loginSubtitle}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="settings-login-background-url">Background do login</Label>
                  <Input
                    id="settings-login-background-url"
                    onChange={(event) =>
                      updateDraft("loginBackgroundUrl", event.target.value)
                    }
                    placeholder="https://..."
                    value={draft.loginBackgroundUrl ?? ""}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="settings-login-image-url">Imagem do login</Label>
                  <Input
                    id="settings-login-image-url"
                    onChange={(event) => updateDraft("loginImageUrl", event.target.value)}
                    placeholder="https://..."
                    value={draft.loginImageUrl ?? ""}
                  />
                </FormField>
              </div>
              <div className="overflow-hidden rounded-lg border bg-background">
                {draft.loginImageUrl ? (
                  <img
                    alt=""
                    className="h-56 w-full object-cover"
                    src={draft.loginImageUrl}
                  />
                ) : (
                  <div className="grid h-56 place-items-center text-sm text-muted-foreground">
                    Sem imagem configurada
                  </div>
                )}
                <div className="space-y-1 p-4">
                  <p className="text-lg font-semibold">{draft.loginTitle}</p>
                  <p className="text-sm text-muted-foreground">{draft.loginSubtitle}</p>
                </div>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="reports">
            <section className="grid gap-4 rounded-lg border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[7rem_minmax(0,1fr)] md:items-end">
                  <FormField>
                    <Label htmlFor="settings-report-color">Cor</Label>
                    <Input
                      className="h-10 p-1"
                      id="settings-report-color"
                      onChange={(event) =>
                        updateDraft("reportPrimaryColor", event.target.value)
                      }
                      type="color"
                      value={normalizeColor(
                        draft.reportPrimaryColor,
                        defaultSystemSettings.reportPrimaryColor,
                      )}
                    />
                  </FormField>
                  <FormField>
                    <Label htmlFor="settings-report-color-text">Cor do relatorio</Label>
                    <Input
                      id="settings-report-color-text"
                      onChange={(event) =>
                        updateDraft("reportPrimaryColor", event.target.value)
                      }
                      pattern="^#[0-9a-fA-F]{6}$"
                      value={draft.reportPrimaryColor}
                    />
                  </FormField>
                </div>
                <FormField>
                  <Label htmlFor="settings-report-logo-url">Logo do relatorio</Label>
                  <Input
                    id="settings-report-logo-url"
                    onChange={(event) => updateDraft("reportLogoUrl", event.target.value)}
                    placeholder="https://..."
                    value={draft.reportLogoUrl ?? ""}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="settings-report-footer">Rodape</Label>
                  <Textarea
                    id="settings-report-footer"
                    onChange={(event) => updateDraft("reportFooterText", event.target.value)}
                    required
                    value={draft.reportFooterText}
                  />
                </FormField>
              </div>
              <div className="overflow-hidden rounded-lg border bg-background">
                <div
                  className="h-2"
                  style={{
                    backgroundColor: normalizeColor(
                      draft.reportPrimaryColor,
                      defaultSystemSettings.reportPrimaryColor,
                    ),
                  }}
                />
                <div className="space-y-4 p-4">
                  <div className="flex items-start gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted">
                      {draft.reportLogoUrl ? (
                        <img
                          alt=""
                          className="h-full w-full object-cover"
                          src={draft.reportLogoUrl}
                        />
                      ) : (
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase text-muted-foreground">
                        {draft.systemName}
                      </p>
                      <p className="font-semibold">Relatorio de saldos de estoque</p>
                      <p className="text-xs text-muted-foreground">
                        Emitido por Usuario do sistema
                      </p>
                    </div>
                  </div>
                  <div className="border-t pt-3 text-xs text-muted-foreground">
                    {draft.reportFooterText}
                  </div>
                </div>
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </Form>
    </section>
  );
}
