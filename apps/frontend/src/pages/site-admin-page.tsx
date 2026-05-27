import { useEffect, useMemo, useState } from "react";
import { LoadingLine, ResourceError } from "@/components/domain/feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, useApiResource } from "@/lib/api";
import type {
  SiteBanner,
  SiteContent,
  SiteFaq,
  SiteFeature,
  SitePlan,
  SitePost,
  SiteSettings,
  SiteSystem,
} from "@/lib/types";

type CollectionKey =
  | "banners"
  | "faqs"
  | "features"
  | "plans"
  | "posts"
  | "systems";

type EditableItem =
  | SiteBanner
  | SiteFaq
  | SiteFeature
  | SitePlan
  | SitePost
  | SiteSystem;

type DraftValue = boolean | number | string | string[] | null | undefined;
type Draft = Record<string, DraftValue>;

type FieldConfig = {
  label: string;
  name: string;
  type: "checkbox" | "lines" | "number" | "text" | "textarea";
};

type CollectionConfig = {
  collection: CollectionKey;
  description: string;
  fields: FieldConfig[];
  newLabel: string;
  title: string;
};

const emptyContent: SiteContent = {
  banners: [],
  faqs: [],
  features: [],
  plans: [],
  posts: [],
  settings: {
    contactEmail: "",
    eyebrow: "",
    footerText: "",
    headline: "",
    id: "site",
    primaryColor: "#0f766e",
    primaryCtaLabel: "",
    secondaryCtaLabel: "",
    siteName: "",
    subheadline: "",
    whatsappMessage: "",
    whatsappNumber: "",
  },
  systems: [],
};

const collectionConfigs: CollectionConfig[] = [
  {
    collection: "banners",
    description: "Gerencie os banners e chamadas do carrossel principal.",
    fields: [
      { label: "Titulo", name: "title", type: "text" },
      { label: "Subtitulo", name: "subtitle", type: "textarea" },
      { label: "URL da imagem", name: "imageUrl", type: "text" },
      { label: "Texto do botao", name: "buttonLabel", type: "text" },
      { label: "Link do botao", name: "buttonUrl", type: "text" },
      { label: "Ordem", name: "sortOrder", type: "number" },
      { label: "Ativo", name: "active", type: "checkbox" },
    ],
    newLabel: "Novo banner",
    title: "Banners",
  },
  {
    collection: "systems",
    description: "Edite os sistemas exibidos no site, como Frota e Almoxarifado.",
    fields: [
      { label: "Chave", name: "key", type: "text" },
      { label: "Nome", name: "name", type: "text" },
      { label: "Resumo", name: "summary", type: "textarea" },
      { label: "Descricao", name: "description", type: "textarea" },
      { label: "URL da imagem", name: "imageUrl", type: "text" },
      { label: "Recursos", name: "features", type: "lines" },
      { label: "Ordem", name: "sortOrder", type: "number" },
      { label: "Ativo", name: "active", type: "checkbox" },
    ],
    newLabel: "Novo sistema",
    title: "Sistemas",
  },
  {
    collection: "features",
    description: "Cards de beneficios e etapas de implantacao.",
    fields: [
      { label: "Titulo", name: "title", type: "text" },
      { label: "Descricao", name: "description", type: "textarea" },
      { label: "Grupo", name: "group", type: "text" },
      { label: "Icone", name: "icon", type: "text" },
      { label: "Ordem", name: "sortOrder", type: "number" },
      { label: "Ativo", name: "active", type: "checkbox" },
    ],
    newLabel: "Novo beneficio",
    title: "Beneficios",
  },
  {
    collection: "posts",
    description: "Conteudos e novidades para a area publica.",
    fields: [
      { label: "Titulo", name: "title", type: "text" },
      { label: "Slug", name: "slug", type: "text" },
      { label: "Resumo", name: "summary", type: "textarea" },
      { label: "Conteudo", name: "content", type: "textarea" },
      { label: "URL da capa", name: "coverImageUrl", type: "text" },
      { label: "Publicado", name: "published", type: "checkbox" },
    ],
    newLabel: "Novo post",
    title: "Posts",
  },
  {
    collection: "plans",
    description: "Cards de planos futuros, sem exibicao de preco.",
    fields: [
      { label: "Nome", name: "name", type: "text" },
      { label: "Descricao", name: "description", type: "textarea" },
      { label: "Selo", name: "badge", type: "text" },
      { label: "CTA", name: "ctaLabel", type: "text" },
      { label: "Recursos", name: "features", type: "lines" },
      { label: "Ordem", name: "sortOrder", type: "number" },
      { label: "Destaque", name: "highlighted", type: "checkbox" },
      { label: "Ativo", name: "active", type: "checkbox" },
    ],
    newLabel: "Novo plano",
    title: "Planos",
  },
  {
    collection: "faqs",
    description: "Perguntas frequentes exibidas antes do CTA final.",
    fields: [
      { label: "Pergunta", name: "question", type: "text" },
      { label: "Resposta", name: "answer", type: "textarea" },
      { label: "Ordem", name: "sortOrder", type: "number" },
      { label: "Ativo", name: "active", type: "checkbox" },
    ],
    newLabel: "Nova pergunta",
    title: "FAQ",
  },
];

function itemTitle(item: EditableItem) {
  if ("title" in item) {
    return item.title;
  }

  if ("name" in item) {
    return item.name;
  }

  return item.question;
}

function itemDescription(item: EditableItem) {
  if ("summary" in item) {
    return item.summary;
  }

  if ("description" in item) {
    return item.description ?? "";
  }

  if ("answer" in item) {
    return item.answer;
  }

  return "";
}

function blankDraft(config: CollectionConfig): Draft {
  return Object.fromEntries(
    config.fields.map((field) => {
      if (field.type === "checkbox") {
        return [field.name, field.name === "active"];
      }

      if (field.type === "number") {
        return [field.name, 0];
      }

      if (field.type === "lines") {
        return [field.name, []];
      }

      return [field.name, ""];
    }),
  );
}

function draftFromItem(item: EditableItem, config: CollectionConfig): Draft {
  const draft = blankDraft(config);

  for (const field of config.fields) {
    draft[field.name] = (item as unknown as Draft)[field.name] ?? draft[field.name];
  }

  return draft;
}

function normalizeDraft(draft: Draft, config: CollectionConfig) {
  return Object.fromEntries(
    config.fields.map((field) => {
      const value = draft[field.name];

      if (field.type === "number") {
        return [field.name, Number(value ?? 0)];
      }

      if (field.type === "checkbox") {
        return [field.name, Boolean(value)];
      }

      if (field.type === "lines") {
        const lines = Array.isArray(value)
          ? value
          : String(value ?? "")
              .split("\n")
              .map((line) => line.trim());

        return [field.name, lines.filter(Boolean)];
      }

      return [field.name, value === "" ? null : value];
    }),
  );
}

function linesValue(value: DraftValue) {
  return Array.isArray(value) ? value.join("\n") : String(value ?? "");
}

function EditableField({
  draft,
  field,
  setDraft,
}: {
  draft: Draft;
  field: FieldConfig;
  setDraft: (draft: Draft) => void;
}) {
  const id = `${field.name}-${field.type}`;
  const value = draft[field.name];

  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 rounded-md border p-3 text-sm">
        <input
          checked={Boolean(value)}
          onChange={(event) =>
            setDraft({ ...draft, [field.name]: event.target.checked })
          }
          type="checkbox"
        />
        {field.label}
      </label>
    );
  }

  if (field.type === "textarea" || field.type === "lines") {
    return (
      <div className="grid gap-2">
        <Label htmlFor={id}>{field.label}</Label>
        <Textarea
          id={id}
          onChange={(event) => setDraft({ ...draft, [field.name]: event.target.value })}
          rows={field.type === "lines" ? 5 : 4}
          value={field.type === "lines" ? linesValue(value) : String(value ?? "")}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{field.label}</Label>
      <Input
        id={id}
        onChange={(event) => setDraft({ ...draft, [field.name]: event.target.value })}
        type={field.type === "number" ? "number" : "text"}
        value={String(value ?? "")}
      />
    </div>
  );
}

function CollectionEditor({
  config,
  items,
  reload,
}: {
  config: CollectionConfig;
  items: EditableItem[];
  reload: () => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const [draft, setDraft] = useState<Draft>(() => blankDraft(config));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(selected ? draftFromItem(selected, config) : blankDraft(config));
  }, [config, selected]);

  async function save() {
    setSaving(true);
    setMessage(null);

    try {
      const body = JSON.stringify(normalizeDraft(draft, config));
      const path = selected
        ? `/site/admin/${config.collection}/${selected.id}`
        : `/site/admin/${config.collection}`;

      await api(path, {
        body,
        method: selected ? "PUT" : "POST",
      });
      setMessage("Conteudo salvo.");
      setSelectedId(null);
      await reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setSaving(true);
    setMessage(null);

    try {
      await api(`/site/admin/${config.collection}/${id}`, { method: "DELETE" });
      setSelectedId(null);
      await reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao excluir.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <CardHeader>
          <CardTitle>{config.title}</CardTitle>
          <CardDescription>{config.description}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Button onClick={() => setSelectedId(null)} variant="outline">
            {config.newLabel}
          </Button>
          {items.length ? (
            items.map((item) => (
              <article className="rounded-lg border p-3" key={item.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium">{itemTitle(item)}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {itemDescription(item)}
                    </p>
                    {"active" in item && !item.active ? (
                      <Badge className="mt-2" variant="outline">
                        Inativo
                      </Badge>
                    ) : null}
                    {"published" in item && item.published ? (
                      <Badge className="mt-2" variant="success">
                        Publicado
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => setSelectedId(item.id)} size="sm" variant="outline">
                      Editar
                    </Button>
                    <Button onClick={() => remove(item.id)} size="sm" variant="destructive">
                      Excluir
                    </Button>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Nenhum item cadastrado.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{selected ? "Editar item" : config.newLabel}</CardTitle>
          <CardDescription>
            Campos vazios podem ser preenchidos depois. Itens inativos nao aparecem no site publico.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {config.fields.map((field) => (
            <EditableField
              draft={draft}
              field={field}
              key={field.name}
              setDraft={setDraft}
            />
          ))}
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <Button disabled={saving} onClick={save}>
            {saving ? "Salvando..." : selected ? "Salvar alteracoes" : "Criar item"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsEditor({
  content,
  reload,
}: {
  content: SiteContent;
  reload: () => Promise<void>;
}) {
  const [settings, setSettings] = useState<SiteSettings>(content.settings);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSettings(content.settings);
  }, [content.settings]);

  function update<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setMessage(null);

    try {
      await api<SiteSettings>("/site/admin/settings", {
        body: JSON.stringify(settings),
        method: "PUT",
      });
      setMessage("Identidade salva.");
      await reload();
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Identidade e contato</CardTitle>
        <CardDescription>
          Edite textos principais, CTAs, WhatsApp, logos e cores usados no site publico.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="site-name">Nome do site</Label>
          <Input
            id="site-name"
            onChange={(event) => update("siteName", event.target.value)}
            value={settings.siteName}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="site-eyebrow">Chamada curta</Label>
          <Input
            id="site-eyebrow"
            onChange={(event) => update("eyebrow", event.target.value)}
            value={settings.eyebrow}
          />
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label htmlFor="site-headline">Titulo principal</Label>
          <Input
            id="site-headline"
            onChange={(event) => update("headline", event.target.value)}
            value={settings.headline}
          />
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label htmlFor="site-subheadline">Subtitulo</Label>
          <Textarea
            id="site-subheadline"
            onChange={(event) => update("subheadline", event.target.value)}
            value={settings.subheadline}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="site-whatsapp">WhatsApp</Label>
          <Input
            id="site-whatsapp"
            onChange={(event) => update("whatsappNumber", event.target.value)}
            value={settings.whatsappNumber}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="site-email">Email</Label>
          <Input
            id="site-email"
            onChange={(event) => update("contactEmail", event.target.value)}
            value={settings.contactEmail ?? ""}
          />
        </div>
        <div className="grid gap-2 md:col-span-2">
          <Label htmlFor="site-message">Mensagem padrao do WhatsApp</Label>
          <Textarea
            id="site-message"
            onChange={(event) => update("whatsappMessage", event.target.value)}
            value={settings.whatsappMessage}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="site-logo">URL do logo</Label>
          <Input
            id="site-logo"
            onChange={(event) => update("logoUrl", event.target.value)}
            value={settings.logoUrl ?? ""}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="site-hero">Imagem principal</Label>
          <Input
            id="site-hero"
            onChange={(event) => update("heroImageUrl", event.target.value)}
            value={settings.heroImageUrl ?? ""}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="site-primary-cta">CTA principal</Label>
          <Input
            id="site-primary-cta"
            onChange={(event) => update("primaryCtaLabel", event.target.value)}
            value={settings.primaryCtaLabel}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="site-secondary-cta">CTA secundario</Label>
          <Input
            id="site-secondary-cta"
            onChange={(event) => update("secondaryCtaLabel", event.target.value)}
            value={settings.secondaryCtaLabel}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="site-color">Cor principal</Label>
          <Input
            id="site-color"
            onChange={(event) => update("primaryColor", event.target.value)}
            type="color"
            value={settings.primaryColor}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="site-footer">Rodape</Label>
          <Input
            id="site-footer"
            onChange={(event) => update("footerText", event.target.value)}
            value={settings.footerText}
          />
        </div>
        <div className="md:col-span-2">
          {message ? <p className="mb-3 text-sm text-muted-foreground">{message}</p> : null}
          <Button disabled={saving} onClick={save}>
            {saving ? "Salvando..." : "Salvar identidade"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function SiteAdminPage() {
  const content = useApiResource<SiteContent>("/site/admin/content", emptyContent);
  const defaultTab = (() => {
    const section = window.location.pathname.split("/").filter(Boolean).at(-1);

    if (!section || section === "admin") {
      return "identity";
    }

    if (section === "benefits") {
      return "features";
    }

    return section;
  })();
  const counts = useMemo(
    () => [
      ["Banners", content.data.banners.length],
      ["Sistemas", content.data.systems.length],
      ["Posts", content.data.posts.length],
      ["Planos", content.data.plans.length],
    ],
    [content.data],
  );

  if (content.loading) {
    return <LoadingLine label="Carregando admin do site..." />;
  }

  if (content.error) {
    return <ResourceError message={content.error} />;
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Modo site</p>
        <h2 className="text-2xl font-semibold">Admin do site</h2>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {counts.map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardDescription>{label}</CardDescription>
              <CardTitle>{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo do conteudo</CardTitle>
          <CardDescription>
            Sistemas e planos visiveis para revisao rapida antes de editar.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-medium">Sistemas</p>
            <div className="grid gap-2">
              {content.data.systems.map((system) => (
                <div className="rounded-md border p-3 text-sm" key={system.id}>
                  <p className="font-medium">{system.name}</p>
                  <p className="text-muted-foreground">{system.summary}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Planos</p>
            <div className="grid gap-2">
              {content.data.plans.map((plan) => (
                <div className="rounded-md border p-3 text-sm" key={plan.id}>
                  <p className="font-medium">{plan.name}</p>
                  <p className="text-muted-foreground">{plan.badge ?? "Sem selo"}</p>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue={defaultTab} key={defaultTab}>
        <TabsList>
          <TabsTrigger value="identity">Identidade</TabsTrigger>
          {collectionConfigs.map((config) => (
            <TabsTrigger key={config.collection} value={config.collection}>
              {config.title}
            </TabsTrigger>
          ))}
          <TabsTrigger value="contact">Contato</TabsTrigger>
        </TabsList>

        <TabsContent value="identity">
          <SettingsEditor content={content.data} reload={content.reload} />
        </TabsContent>
        {collectionConfigs.map((config) => (
          <TabsContent key={config.collection} value={config.collection}>
            <CollectionEditor
              config={config}
              items={content.data[config.collection] as EditableItem[]}
              reload={content.reload}
            />
          </TabsContent>
        ))}
        <TabsContent value="contact">
          <SettingsEditor content={content.data} reload={content.reload} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
