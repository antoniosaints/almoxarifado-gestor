import {
  AlertTriangle,
  Building2,
  FileText,
  Image,
  Moon,
  Palette,
  RotateCcw,
  Save,
  Sun,
  Upload,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { LoadingLine, ResourceError } from "@/components/domain/feedback";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, apiUpload } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/assets";
import {
  defaultSystemSettings,
  useSystemSettings,
} from "@/lib/system-settings";
import type { SystemSettings } from "@/lib/types";

type SettingsMessage = {
  kind: "error" | "success";
  text: string;
};

const acceptedImageTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const maxImageSize = 1024 * 1024;
const settingsUploadSlots: Partial<Record<keyof SystemSettings, string>> = {
  faviconUrl: "favicon",
  loginBackgroundUrl: "login-background",
  loginImageUrl: "login-image",
  logoUrl: "brand-logo",
  reportLogoUrl: "report-logo",
};

type SettingsUploadResponse = {
  field: keyof SystemSettings;
  url: string;
};

function normalizeColor(color: string, fallback = defaultSystemSettings.primaryColor) {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

function validateImageFile(file: File) {
  if (!acceptedImageTypes.includes(file.type)) {
    throw new Error("Use PNG, JPG, WEBP ou SVG.");
  }

  if (file.size > maxImageSize) {
    throw new Error("A imagem deve ter no maximo 1 MB.");
  }
}

function ImageUrlField({
  field,
  label,
  onUpload,
  placeholder = "https://...",
  uploading,
  updateDraft,
  value,
}: {
  field: keyof SystemSettings;
  label: string;
  onUpload: (field: keyof SystemSettings, file?: File) => void;
  placeholder?: string;
  uploading?: boolean;
  updateDraft: (field: keyof SystemSettings, value: string) => void;
  value?: string | null;
}) {
  const inputId = `settings-${String(field)}`;
  const uploadId = `${inputId}-upload`;

  return (
    <FormField>
      <Label htmlFor={inputId}>{label}</Label>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          id={inputId}
          onChange={(event) => updateDraft(field, event.target.value)}
          placeholder={placeholder}
          value={value ?? ""}
        />
        <Button asChild type="button" variant="outline">
          <label
            aria-disabled={uploading}
            className={`cursor-pointer ${uploading ? "pointer-events-none opacity-60" : ""}`}
            htmlFor={uploadId}
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Enviando..." : "Upload"}
          </label>
        </Button>
      </div>
      <Input
        accept={acceptedImageTypes.join(",")}
        className="sr-only"
        id={uploadId}
        onChange={(event) => {
          onUpload(field, event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
        type="file"
      />
    </FormField>
  );
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
  const [message, setMessage] = useState<SettingsMessage | null>(null);
  const [resetStep, setResetStep] = useState<"closed" | "confirm" | "password">(
    "closed",
  );
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [uploadingField, setUploadingField] = useState<keyof SystemSettings | null>(
    null,
  );

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  function updateDraft(field: keyof SystemSettings, value: string) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function uploadImage(field: keyof SystemSettings, file?: File) {
    if (!file) {
      return;
    }

    setMessage(null);
    setUploadingField(field);

    try {
      validateImageFile(file);

      const slot = settingsUploadSlots[field];

      if (!slot) {
        throw new Error("Campo de upload inválido.");
      }

      const uploaded = await apiUpload<SettingsUploadResponse>(
        `/uploads/settings/${slot}`,
        file,
      );

      updateDraft(field, uploaded.url);
      setMessage({ kind: "success", text: "Imagem enviada." });
    } catch (caughtError) {
      setMessage({
        kind: "error",
        text:
          caughtError instanceof Error
            ? caughtError.message
            : "Falha ao carregar imagem.",
      });
    } finally {
      setUploadingField(null);
    }
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
      setMessage({ kind: "success", text: "Configurações salvas." });
    } catch (caughtError) {
      setMessage({
        kind: "error",
        text:
          caughtError instanceof Error
            ? caughtError.message
            : "Falha ao salvar configurações.",
      });
    } finally {
      setSaving(false);
    }
  }

  function openResetDialog() {
    setMessage(null);
    setResetError(null);
    setResetPassword("");
    setResetStep("password");
  }

  function closeResetDialog() {
    if (resetting) {
      return;
    }

    setResetError(null);
    setResetPassword("");
    setResetStep("closed");
  }

  function continueReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!resetPassword.trim()) {
      setResetError("Informe a senha do usuário admin.");
      return;
    }

    setResetError(null);
    setResetStep("confirm");
  }

  async function confirmReset() {
    setResetting(true);
    setResetError(null);
    setMessage(null);

    try {
      await api("/settings/reset-data", {
        body: JSON.stringify({ password: resetPassword }),
        method: "POST",
      });
      setMessage({
        kind: "success",
        text: "Dados do sistema apagados. Usuários preservados.",
      });
      setResetPassword("");
      setResetStep("closed");
    } catch (caughtError) {
      setResetError(
        caughtError instanceof Error
          ? caughtError.message
          : "Falha ao resetar os dados do sistema.",
      );
    } finally {
      setResetting(false);
    }
  }

  if (loading) {
    return <LoadingLine />;
  }

  const draftLogoUrl = resolveAssetUrl(draft.logoUrl);
  const draftLoginImageUrl = resolveAssetUrl(draft.loginImageUrl);
  const draftReportLogoUrl = resolveAssetUrl(draft.reportLogoUrl);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Sistema</p>
          <h2 className="text-2xl font-semibold">Configurações</h2>
        </div>
        <Button disabled={saving} form="system-settings-form" type="submit">
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      {error ? <ResourceError message={error} /> : null}
      {message ? (
        message.kind === "success" ? (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-950">
            <AlertTitle>Pronto</AlertTitle>
            <AlertDescription className="text-emerald-900">
              {message.text}
            </AlertDescription>
          </Alert>
        ) : (
          <ResourceError message={message.text} />
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
              Relatórios
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
              <ImageUrlField
                field="faviconUrl"
                label="Favicon"
                onUpload={(field, file) => void uploadImage(field, file)}
                uploading={uploadingField === "faviconUrl"}
                updateDraft={updateDraft}
                value={draft.faviconUrl}
              />
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
                <ImageUrlField
                  field="logoUrl"
                  label="Logo"
                  onUpload={(field, file) => void uploadImage(field, file)}
                  uploading={uploadingField === "logoUrl"}
                  updateDraft={updateDraft}
                  value={draft.logoUrl}
                />
              </div>
              <div className="rounded-lg border bg-background p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-lg bg-primary text-primary-foreground">
                    {draftLogoUrl ? (
                      <img
                        alt=""
                        className="h-full w-full object-cover"
                        src={draftLogoUrl}
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
                  <Label htmlFor="settings-login-title">Título do login</Label>
                  <Input
                    id="settings-login-title"
                    onChange={(event) => updateDraft("loginTitle", event.target.value)}
                    required
                    value={draft.loginTitle}
                  />
                </FormField>
                <FormField>
                  <Label htmlFor="settings-login-subtitle">Subtítulo do login</Label>
                  <Input
                    id="settings-login-subtitle"
                    onChange={(event) => updateDraft("loginSubtitle", event.target.value)}
                    required
                    value={draft.loginSubtitle}
                  />
                </FormField>
                <ImageUrlField
                  field="loginBackgroundUrl"
                  label="Background do login"
                  onUpload={(field, file) => void uploadImage(field, file)}
                  uploading={uploadingField === "loginBackgroundUrl"}
                  updateDraft={updateDraft}
                  value={draft.loginBackgroundUrl}
                />
                <ImageUrlField
                  field="loginImageUrl"
                  label="Imagem do login"
                  onUpload={(field, file) => void uploadImage(field, file)}
                  uploading={uploadingField === "loginImageUrl"}
                  updateDraft={updateDraft}
                  value={draft.loginImageUrl}
                />
              </div>
              <div className="overflow-hidden rounded-lg border bg-background">
                {draftLoginImageUrl ? (
                  <img
                    alt=""
                    className="h-56 w-full object-cover"
                    src={draftLoginImageUrl}
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
                    <Label htmlFor="settings-report-color-text">Cor do relatório</Label>
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
                  <Label htmlFor="settings-report-title">Título do cabeçalho</Label>
                  <Input
                    id="settings-report-title"
                    onChange={(event) => updateDraft("reportTitle", event.target.value)}
                    required
                    value={draft.reportTitle}
                  />
                </FormField>
                <ImageUrlField
                  field="reportLogoUrl"
                  label="Logo do relatório"
                  onUpload={(field, file) => void uploadImage(field, file)}
                  uploading={uploadingField === "reportLogoUrl"}
                  updateDraft={updateDraft}
                  value={draft.reportLogoUrl}
                />
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
                      {draftReportLogoUrl ? (
                        <img
                          alt=""
                          className="h-full w-full object-cover"
                          src={draftReportLogoUrl}
                        />
                      ) : (
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase text-muted-foreground">
                        {draft.reportTitle}
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

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-950">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-red-100 text-red-700">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium">Resetar dados do sistema</p>
            <p className="max-w-3xl text-sm text-red-900">
              Apaga almoxarifados, produtos, estoques, movimentações, notas,
              solicitações e vínculos de almoxarifado. Usuários e configurações
              permanecem.
            </p>
          </div>
        </div>
        <Button onClick={openResetDialog} type="button" variant="destructive">
          <RotateCcw className="h-4 w-4" />
          Resetar dados
        </Button>
      </section>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            closeResetDialog();
          }
        }}
        open={resetStep !== "closed"}
      >
        <DialogContent>
          {resetStep === "password" ? (
            <>
              <DialogHeader>
                <DialogTitle>Confirmar senha do admin</DialogTitle>
                <DialogDescription>
                  Os dados do sistema serão apagados e os usuários serão
                  mantidos.
                </DialogDescription>
              </DialogHeader>
              <form className="space-y-4" onSubmit={continueReset}>
                {resetError ? <ResourceError message={resetError} /> : null}
                <FormField>
                  <Label htmlFor="settings-reset-password">Senha do admin</Label>
                  <Input
                    autoFocus
                    id="settings-reset-password"
                    onChange={(event) => setResetPassword(event.target.value)}
                    type="password"
                    value={resetPassword}
                  />
                </FormField>
                <div className="flex justify-end gap-2">
                  <Button onClick={closeResetDialog} type="button" variant="outline">
                    Cancelar
                  </Button>
                  <Button type="submit" variant="destructive">
                    Continuar
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Apagar dados definitivamente</DialogTitle>
                <DialogDescription>
                  Esta ação não tem recuperação após a confirmação final.
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-950">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Almoxarifados, produtos, estoques, movimentações, notas fiscais
                  e solicitações serão removidos permanentemente.
                </p>
              </div>
              {resetError ? <ResourceError message={resetError} /> : null}
              <div className="flex justify-end gap-2">
                <Button
                  disabled={resetting}
                  onClick={() => {
                    setResetError(null);
                    setResetStep("password");
                  }}
                  type="button"
                  variant="outline"
                >
                  Voltar
                </Button>
                <Button
                  disabled={resetting}
                  onClick={confirmReset}
                  type="button"
                  variant="destructive"
                >
                  {resetting ? "Resetando..." : "Apagar definitivamente"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
