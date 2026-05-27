import {
  AlertTriangle,
  AlignLeft,
  Bold,
  Building2,
  Database,
  FileText,
  Image,
  Italic,
  List,
  ListOrdered,
  Moon,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { DataTable } from "@/components/domain/data-table";
import { LoadingLine, ResourceError } from "@/components/domain/feedback";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, apiUpload, useApiResource } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/assets";
import {
  defaultSystemSettings,
  useSystemSettings,
} from "@/lib/system-settings";
import type { OfficeLetterTemplate, SystemSettings } from "@/lib/types";

type SettingsMessage = {
  kind: "error" | "success";
  text: string;
};

type ResetCatalogMode = "KEEP" | "RESET_DEFAULTS";

type ResetCatalogOptions = {
  productCategories: ResetCatalogMode;
  units: ResetCatalogMode;
  warehouseCategories: ResetCatalogMode;
};

const acceptedImageTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const maxImageSize = 1024 * 1024;
const settingsUploadSlots: Partial<Record<keyof SystemSettings, string>> = {
  faviconUrl: "favicon",
  loginBackgroundUrl: "login-background",
  loginImageUrl: "login-image",
  logoUrl: "brand-logo",
  officeLogoUrl: "office-logo",
  reportLogoUrl: "report-logo",
};

type SettingsUploadResponse = {
  field: keyof SystemSettings;
  url: string;
};

const defaultResetCatalogOptions: ResetCatalogOptions = {
  productCategories: "RESET_DEFAULTS",
  units: "RESET_DEFAULTS",
  warehouseCategories: "RESET_DEFAULTS",
};

const resetCatalogModeLabels: Record<ResetCatalogMode, string> = {
  KEEP: "Manter atuais",
  RESET_DEFAULTS: "Restaurar padrão do sistema",
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

const officeVariables = [
  "{{oficio_numero_ano}}",
  "{{numero_oficio}}",
  "{{ano_oficio}}",
  "{{secretaria_nome}}",
  "{{almoxarifado_nome}}",
  "{{solicitante_nome}}",
  "{{data_solicitacao}}",
  "{{itens_solicitados_html}}",
  "{{itens_solicitados_texto}}",
  "{{produto_nome}}",
  "{{quantidade_solicitada}}",
  "{{unidade_solicitada}}",
  "{{nome_empresa}}",
  "{{cnpj_empresa}}",
  "{{nome_fantasia_empresa}}",
  "{{numero_nota}}",
  "{{data_nota}}",
  "{{valor_nota}}",
  "{{data_atual}}",
  "{{usuario_logado}}",
];

type OfficeTemplateDraft = {
  active: boolean;
  contentHtml: string;
  description: string;
  name: string;
  subject: string;
};

const defaultOfficeTemplateContentHtml = [
  "<p><strong>OF&Iacute;CIO N&ordm; {{oficio_numero_ano}}</strong></p>",
  "<p><strong>Assunto:</strong> Solicita&ccedil;&atilde;o de material/equipamento</p>",
  "<p>Prezados,</p>",
  "<p>Venho, por meio deste, solicitar a disponibiliza&ccedil;&atilde;o do(s) seguinte(s) item(ns):</p>",
  "<p>{{itens_solicitados_html}}</p>",
  "<p>A presente solicita&ccedil;&atilde;o se faz necess&aacute;ria para atender &agrave;s demandas e necessidades deste setor, visando garantir o bom funcionamento das atividades desenvolvidas.</p>",
  "<p>Certos de contarmos com a colabora&ccedil;&atilde;o de Vossa Senhoria, aguardamos o atendimento desta solicita&ccedil;&atilde;o e renovamos nossos votos de estima e considera&ccedil;&atilde;o.</p>",
  "<p>Atenciosamente,</p>",
].join("");

function createDefaultOfficeTemplateDraft(): OfficeTemplateDraft {
  return {
    active: true,
    contentHtml: defaultOfficeTemplateContentHtml,
    description: "Modelo padrao para solicitacao de material por almoxarifado.",
    name: "Solicitacao de material",
    subject: "Solicitacao de material/equipamento",
  };
}

function OfficeTemplatesTab({
  officeLogoUrl,
  onUpload,
  uploadingLogo,
  updateSettingsDraft,
}: {
  officeLogoUrl?: string | null;
  onUpload: (field: keyof SystemSettings, file?: File) => void;
  uploadingLogo?: boolean;
  updateSettingsDraft: (field: keyof SystemSettings, value: string) => void;
}) {
  const templates = useApiResource<OfficeLetterTemplate[]>("/office-templates", []);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const editorInitialContentRef = useRef(defaultOfficeTemplateContentHtml);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [draft, setDraft] = useState<OfficeTemplateDraft>(
    createDefaultOfficeTemplateDraft,
  );
  const [editing, setEditing] = useState(false);
  const [templateToDelete, setTemplateToDelete] =
    useState<OfficeLetterTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(
    null,
  );
  const [togglingTemplateId, setTogglingTemplateId] = useState<string | null>(
    null,
  );
  const [message, setMessage] = useState<SettingsMessage | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const resolvedOfficeLogoUrl = resolveAssetUrl(officeLogoUrl);

  const attachEditor = useCallback((node: HTMLDivElement | null) => {
    editorRef.current = node;

    if (node) {
      node.innerHTML = editorInitialContentRef.current;
    }
  }, []);

  function openEditTemplate(template: OfficeLetterTemplate) {
    const nextDraft = {
      active: template.active,
      contentHtml: template.contentHtml,
      description: template.description ?? "",
      name: template.name,
      subject: template.subject,
    };

    editorInitialContentRef.current = nextDraft.contentHtml;
    setSelectedTemplateId(template.id);
    setDraft(nextDraft);
    setEditing(true);
    setEditorError(null);
    setMessage(null);
  }

  function openNewTemplate() {
    const nextDraft = createDefaultOfficeTemplateDraft();

    editorInitialContentRef.current = nextDraft.contentHtml;
    setSelectedTemplateId("");
    setDraft(nextDraft);
    setEditing(true);
    setEditorError(null);
    setMessage(null);
  }

  function closeEditor(open: boolean) {
    if (saving) {
      return;
    }

    setEditing(open);

    if (!open) {
      setEditorError(null);
    }
  }

  function syncEditorContent() {
    setDraft((current) => ({
      ...current,
      contentHtml: editorRef.current?.innerHTML ?? "",
    }));
  }

  function setContentHtml(contentHtml: string) {
    editorInitialContentRef.current = contentHtml;
    setDraft((current) => ({
      ...current,
      contentHtml,
    }));

    if (editorRef.current && editorRef.current.innerHTML !== contentHtml) {
      editorRef.current.innerHTML = contentHtml;
    }
  }

  function formatContent(command: "bold" | "insertOrderedList" | "insertUnorderedList" | "italic" | "justifyLeft") {
    editorRef.current?.focus();

    if (typeof document.execCommand === "function") {
      document.execCommand(command);
      syncEditorContent();
    }
  }

  function insertVariable(variable: string) {
    const editor = editorRef.current;

    if (!editor) {
      setContentHtml(`${draft.contentHtml}${variable}`);
      return;
    }

    editor.focus();

    if (typeof document.execCommand === "function") {
      document.execCommand("insertHTML", false, variable);
    } else {
      editor.innerHTML = `${editor.innerHTML}${variable}`;
    }

    syncEditorContent();
  }

  async function saveTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      ...draft,
      contentHtml: editorRef.current?.innerHTML ?? draft.contentHtml,
    };

    if (
      !payload.name.trim() ||
      !payload.subject.trim() ||
      !payload.contentHtml.trim()
    ) {
      setEditorError("Informe nome, assunto e conteudo do oficio.");
      return;
    }

    setSaving(true);
    setMessage(null);
    setEditorError(null);

    try {
      const saved = await api<OfficeLetterTemplate>(
        selectedTemplateId
          ? `/office-templates/${selectedTemplateId}`
          : "/office-templates",
        {
          body: JSON.stringify(payload),
          method: selectedTemplateId ? "PUT" : "POST",
        },
      );

      setSelectedTemplateId(saved.id);
      setMessage({ kind: "success", text: "Modelo de oficio salvo." });
      setEditing(false);
      await templates.reload();
    } catch (caughtError) {
      setEditorError(
          caughtError instanceof Error
            ? caughtError.message
            : "Falha ao salvar modelo de oficio.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate() {
    if (!templateToDelete) {
      return;
    }

    setDeletingTemplateId(templateToDelete.id);
    setMessage(null);

    try {
      await api<void>(`/office-templates/${templateToDelete.id}`, {
        method: "DELETE",
      });
      templates.setData((current) =>
        current.filter((template) => template.id !== templateToDelete.id),
      );
      setTemplateToDelete(null);
      setMessage({ kind: "success", text: "Modelo de oficio excluido." });
      await templates.reload();
    } catch (caughtError) {
      setMessage({
        kind: "error",
        text:
          caughtError instanceof Error
            ? caughtError.message
            : "Falha ao excluir modelo de oficio.",
      });
    } finally {
      setDeletingTemplateId(null);
    }
  }

  async function toggleTemplateActive(
    template: OfficeLetterTemplate,
    active: boolean,
  ) {
    setTogglingTemplateId(template.id);
    setMessage(null);

    try {
      await api<OfficeLetterTemplate>(`/office-templates/${template.id}`, {
        body: JSON.stringify({
          active,
          contentHtml: template.contentHtml,
          description: template.description ?? "",
          name: template.name,
          subject: template.subject,
        }),
        method: "PUT",
      });
      templates.setData((current) =>
        current.map((currentTemplate) => ({
          ...currentTemplate,
          active: active
            ? currentTemplate.id === template.id
            : currentTemplate.id === template.id
              ? false
              : currentTemplate.active,
        })),
      );
      setMessage({
        kind: "success",
        text: active ? "Modelo ativado." : "Modelo inativado.",
      });
      await templates.reload();
    } catch (caughtError) {
      setMessage({
        kind: "error",
        text:
          caughtError instanceof Error
            ? caughtError.message
            : "Falha ao alterar status do modelo.",
      });
    } finally {
      setTogglingTemplateId(null);
    }
  }

  function templateVariablesLabel(template: OfficeLetterTemplate) {
    return template.variables.length
      ? template.variables.map((variable) => `{{${variable}}}`).join(", ")
      : "-";
  }

  return (
    <section className="space-y-4 rounded-lg border bg-card p-4">
      <div className="grid gap-4 rounded-md border bg-background p-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <ImageUrlField
          field="officeLogoUrl"
          label="Logo do cabecalho do oficio"
          onUpload={onUpload}
          uploading={uploadingLogo}
          updateDraft={updateSettingsDraft}
          value={officeLogoUrl}
        />
        <div className="flex items-center gap-3 rounded-md border bg-card p-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted">
            {resolvedOfficeLogoUrl ? (
              <img
                alt=""
                className="h-full w-full object-contain"
                src={resolvedOfficeLogoUrl}
              />
            ) : (
              <Building2 className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Secretaria</p>
            <p className="truncate text-xs text-muted-foreground">
              Almoxarifado solicitante
            </p>
          </div>
        </div>
      </div>

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

      {templates.loading ? (
        <LoadingLine label="Carregando modelos de oficio..." />
      ) : templates.error ? (
        <ResourceError message={templates.error} />
      ) : (
        <DataTable
          columns={[
            {
              cell: (template) => (
                <>
                  <p className="font-medium">{template.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {template.description || "Sem descricao"}
                  </p>
                </>
              ),
              header: "Modelo",
              key: "name",
            },
            {
              cell: (template) => template.subject,
              header: "Assunto",
              key: "subject",
            },
            {
              cell: (template) => (
                <p
                  className="max-w-xs truncate text-xs text-muted-foreground"
                  title={templateVariablesLabel(template)}
                >
                  {templateVariablesLabel(template)}
                </p>
              ),
              header: "Variaveis",
              key: "variables",
            },
            {
              cell: (template) => (
                <div className="flex items-center gap-2">
                  <Switch
                    aria-label={`${template.active ? "Inativar" : "Ativar"} ${template.name}`}
                    checked={template.active}
                    disabled={togglingTemplateId === template.id}
                    onCheckedChange={(active) => {
                      void toggleTemplateActive(template, active);
                    }}
                  />
                  <Badge variant={template.active ? "success" : "zero"}>
                    {template.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              ),
              header: "Ativo",
              key: "status",
            },
            {
              cell: (template) => (
                <div className="flex justify-end gap-2">
                  <Button
                    aria-label={`Editar ${template.name}`}
                    onClick={() => openEditTemplate(template)}
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    aria-label={`Excluir ${template.name}`}
                    onClick={() => setTemplateToDelete(template)}
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ),
              cellClassName: "text-right",
              header: "Acoes",
              headerClassName: "text-right",
              key: "actions",
            },
          ]}
          data={templates.data}
          emptyMessage="Nenhum modelo cadastrado."
          getRowId={(template) => template.id}
          searchPlaceholder="Buscar modelo, assunto ou variavel..."
          searchText={(template) =>
            [
              template.name,
              template.description,
              template.subject,
              template.active ? "ativo" : "inativo",
              ...template.variables,
            ].join(" ")
          }
          toolbar={
            <Button onClick={openNewTemplate} type="button">
              <Plus className="h-4 w-4" />
              Novo modelo
            </Button>
          }
        />
      )}

      <Dialog onOpenChange={closeEditor} open={editing}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplateId ? "Editar modelo de oficio" : "Novo modelo de oficio"}
            </DialogTitle>
            <DialogDescription>
              Configure os textos que serao usados na geracao do oficio.
            </DialogDescription>
          </DialogHeader>
          <Form onSubmit={saveTemplate}>
            {editorError ? <ResourceError message={editorError} /> : null}
            <div className="grid gap-4 md:grid-cols-2">
              <FormField>
                <Label htmlFor="office-template-name">Nome do modelo</Label>
                <Input
                  id="office-template-name"
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                  value={draft.name}
                />
              </FormField>
              <FormField>
                <Label htmlFor="office-template-subject">Assunto</Label>
                <Input
                  id="office-template-subject"
                  onChange={(event) =>
                    setDraft({ ...draft, subject: event.target.value })
                  }
                  value={draft.subject}
                />
              </FormField>
            </div>
            <FormField>
              <Label htmlFor="office-template-description">Descricao</Label>
              <Input
                id="office-template-description"
                onChange={(event) =>
                  setDraft({ ...draft, description: event.target.value })
                }
                value={draft.description}
              />
            </FormField>
            <div className="flex flex-wrap gap-2 rounded-md border bg-background p-2">
              <Button
                aria-label="Negrito"
                onClick={() => formatContent("bold")}
                size="icon"
                title="Negrito"
                type="button"
                variant="outline"
              >
                <Bold className="h-4 w-4" />
              </Button>
              <Button
                aria-label="Italico"
                onClick={() => formatContent("italic")}
                size="icon"
                title="Italico"
                type="button"
                variant="outline"
              >
                <Italic className="h-4 w-4" />
              </Button>
              <Button
                aria-label="Lista"
                onClick={() => formatContent("insertUnorderedList")}
                size="icon"
                title="Lista"
                type="button"
                variant="outline"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                aria-label="Lista numerada"
                onClick={() => formatContent("insertOrderedList")}
                size="icon"
                title="Lista numerada"
                type="button"
                variant="outline"
              >
                <ListOrdered className="h-4 w-4" />
              </Button>
              <Button
                aria-label="Alinhar a esquerda"
                onClick={() => formatContent("justifyLeft")}
                size="icon"
                title="Alinhar a esquerda"
                type="button"
                variant="outline"
              >
                <AlignLeft className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => setContentHtml(defaultOfficeTemplateContentHtml)}
                type="button"
                variant="outline"
              >
                Usar modelo padrao
              </Button>
            </div>
            <FormField>
              <Label htmlFor="office-template-content">Conteudo do oficio</Label>
              <div
                aria-label="Conteudo do oficio"
                aria-multiline="true"
                className="min-h-48 rounded-md border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                contentEditable
                id="office-template-content"
                onInput={syncEditorContent}
                ref={attachEditor}
                role="textbox"
                suppressContentEditableWarning
              />
            </FormField>
            <div className="space-y-2 rounded-md border bg-background p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Variaveis
              </p>
              <div className="flex flex-wrap gap-2">
                {officeVariables.map((variable) => (
                  <Button
                    key={variable}
                    onClick={() => insertVariable(variable)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {variable}
                  </Button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={draft.active}
                onCheckedChange={(active) => setDraft({ ...draft, active })}
              />
              Modelo ativo
            </label>
            <div className="rounded-md border bg-background p-4">
              <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                Previa
              </p>
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: draft.contentHtml || "-" }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                disabled={saving}
                onClick={() => closeEditor(false)}
                type="button"
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                disabled={
                  saving ||
                  !draft.name.trim() ||
                  !draft.subject.trim() ||
                  !draft.contentHtml.trim()
                }
                type="submit"
              >
                <Save className="h-4 w-4" />
                {saving ? "Salvando..." : "Salvar modelo"}
              </Button>
            </div>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open && !deletingTemplateId) {
            setTemplateToDelete(null);
          }
        }}
        open={Boolean(templateToDelete)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir modelo de oficio</DialogTitle>
            <DialogDescription>
              O modelo sera removido da lista de modelos disponiveis.
            </DialogDescription>
          </DialogHeader>
          {templateToDelete ? (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{templateToDelete.name}</p>
              <p className="text-muted-foreground">{templateToDelete.subject}</p>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              disabled={Boolean(deletingTemplateId)}
              onClick={() => setTemplateToDelete(null)}
              type="button"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              disabled={Boolean(deletingTemplateId)}
              onClick={deleteTemplate}
              type="button"
              variant="destructive"
            >
              {deletingTemplateId ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
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
  const [resetCatalogOptions, setResetCatalogOptions] =
    useState<ResetCatalogOptions>(defaultResetCatalogOptions);
  const [activeTab, setActiveTab] = useState("appearance");
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
    setResetCatalogOptions(defaultResetCatalogOptions);
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

  function updateResetCatalogOption(
    field: keyof ResetCatalogOptions,
    value: ResetCatalogMode,
  ) {
    setResetCatalogOptions((current) => ({
      ...current,
      [field]: value,
    }));
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
        body: JSON.stringify({
          password: resetPassword,
          productCategories: resetCatalogOptions.productCategories,
          units: resetCatalogOptions.units,
          warehouseCategories: resetCatalogOptions.warehouseCategories,
        }),
        method: "POST",
      });
      setMessage({
        kind: "success",
        text: "Dados do sistema apagados. Usuários, configurações e catálogos foram tratados conforme selecionado.",
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
  const resetProductCategoryLabel =
    resetCatalogModeLabels[resetCatalogOptions.productCategories];
  const resetWarehouseCategoryLabel =
    resetCatalogModeLabels[resetCatalogOptions.warehouseCategories];
  const resetUnitLabel = resetCatalogModeLabels[resetCatalogOptions.units];

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
        <Tabs onValueChange={setActiveTab} value={activeTab}>
          <TabsList>
            <TabsTrigger onClick={() => setActiveTab("appearance")} value="appearance">
              <Palette className="mr-1 h-4 w-4" />
              Aparencia
            </TabsTrigger>
            <TabsTrigger onClick={() => setActiveTab("brand")} value="brand">
              <Building2 className="mr-1 h-4 w-4" />
              Marca
            </TabsTrigger>
            <TabsTrigger onClick={() => setActiveTab("login")} value="login">
              <Image className="mr-1 h-4 w-4" />
              Login
            </TabsTrigger>
            <TabsTrigger onClick={() => setActiveTab("reports")} value="reports">
              <FileText className="mr-1 h-4 w-4" />
              Relatórios
            </TabsTrigger>
            <TabsTrigger onClick={() => setActiveTab("office")} value="office">
              <FileText className="mr-1 h-4 w-4" />
              Oficios
            </TabsTrigger>
            <TabsTrigger onClick={() => setActiveTab("data")} value="data">
              <Database className="mr-1 h-4 w-4" />
              Dados
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

          <TabsContent value="office">
            <OfficeTemplatesTab
              officeLogoUrl={draft.officeLogoUrl}
              onUpload={(field, file) => void uploadImage(field, file)}
              uploadingLogo={uploadingField === "officeLogoUrl"}
              updateSettingsDraft={updateDraft}
            />
          </TabsContent>
          <TabsContent value="data">
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
                    permanecem. Categorias e unidades podem ser mantidas ou restauradas
                    para o padrão do sistema na próxima etapa.
                  </p>
                </div>
              </div>
              <Button onClick={openResetDialog} type="button" variant="destructive">
                <RotateCcw className="h-4 w-4" />
                Resetar dados
              </Button>
            </section>
          </TabsContent>
        </Tabs>
      </Form>

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
                  mantidos. Escolha também o que fazer com categorias e unidades.
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
                <div className="grid gap-3">
                  <FormField>
                    <Label htmlFor="settings-reset-product-categories">
                      Categorias de produtos
                    </Label>
                    <Select
                      id="settings-reset-product-categories"
                      onChange={(event) =>
                        updateResetCatalogOption(
                          "productCategories",
                          event.target.value as ResetCatalogMode,
                        )
                      }
                      value={resetCatalogOptions.productCategories}
                    >
                      <option value="RESET_DEFAULTS">Restaurar padrão do sistema</option>
                      <option value="KEEP">Manter atuais</option>
                    </Select>
                  </FormField>
                  <FormField>
                    <Label htmlFor="settings-reset-warehouse-categories">
                      Categorias de almoxarifados
                    </Label>
                    <Select
                      id="settings-reset-warehouse-categories"
                      onChange={(event) =>
                        updateResetCatalogOption(
                          "warehouseCategories",
                          event.target.value as ResetCatalogMode,
                        )
                      }
                      value={resetCatalogOptions.warehouseCategories}
                    >
                      <option value="RESET_DEFAULTS">Restaurar padrão do sistema</option>
                      <option value="KEEP">Manter atuais</option>
                    </Select>
                  </FormField>
                  <FormField>
                    <Label htmlFor="settings-reset-units">Unidades de medida</Label>
                    <Select
                      id="settings-reset-units"
                      onChange={(event) =>
                        updateResetCatalogOption(
                          "units",
                          event.target.value as ResetCatalogMode,
                        )
                      }
                      value={resetCatalogOptions.units}
                    >
                      <option value="RESET_DEFAULTS">Restaurar padrão do sistema</option>
                      <option value="KEEP">Manter atuais</option>
                    </Select>
                  </FormField>
                </div>
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
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="font-medium">Catálogos após o reset</p>
                <dl className="mt-2 grid gap-1 text-muted-foreground">
                  <div className="flex justify-between gap-3">
                    <dt>Categorias de produtos</dt>
                    <dd className="text-right text-foreground">
                      {resetProductCategoryLabel}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Categorias de almoxarifados</dt>
                    <dd className="text-right text-foreground">
                      {resetWarehouseCategoryLabel}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Unidades de medida</dt>
                    <dd className="text-right text-foreground">{resetUnitLabel}</dd>
                  </div>
                </dl>
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
