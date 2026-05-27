import {
  ArrowRight,
  Boxes,
  Car,
  CheckCircle2,
  FileText,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useApiResource } from "@/lib/api";
import { resolveAssetUrl } from "@/lib/assets";
import type { SiteContent, SiteFeature, SiteSettings, SiteSystem } from "@/lib/types";
import { cn } from "@/lib/utils";

const fallbackSiteContent: SiteContent = {
  banners: [
    {
      active: true,
      buttonLabel: "Falar com especialista",
      buttonUrl: "whatsapp",
      id: "default-banner",
      sortOrder: 1,
      subtitle:
        "Controle estoque, veículos, documentos e indicadores com implantação assistida.",
      title: "Sistemas profissionais para prefeituras",
    },
  ],
  faqs: [
    {
      active: true,
      answer:
        "Não. O contato é feito por WhatsApp para entender a demanda e montar a melhor proposta.",
      id: "faq-price",
      question: "O site mostra preços?",
      sortOrder: 1,
    },
    {
      active: true,
      answer:
        "Sim. A prefeitura pode iniciar por Frota, Almoxarifado ou pelos dois módulos.",
      id: "faq-modules",
      question: "Posso começar por um módulo?",
      sortOrder: 2,
    },
  ],
  features: [
    {
      active: true,
      description:
        "Histórico de movimentações, responsáveis e indicadores para acompanhar a operação.",
      group: "benefits",
      id: "benefit-control",
      sortOrder: 1,
      title: "Controle em tempo real",
    },
    {
      active: true,
      description:
        "Fluxos objetivos para equipes administrativas, operadores e gestores.",
      group: "benefits",
      id: "benefit-flow",
      sortOrder: 2,
      title: "Rotina mais simples",
    },
    {
      active: true,
      description:
        "Relatórios e registros ajudam na prestação de contas e na tomada de decisão.",
      group: "benefits",
      id: "benefit-audit",
      sortOrder: 3,
      title: "Auditoria e transparência",
    },
    {
      active: true,
      description: "Mapeamos cadastros, permissões e prioridades da equipe.",
      group: "process",
      id: "process-diagnosis",
      sortOrder: 1,
      title: "Diagnóstico",
    },
    {
      active: true,
      description: "Configuramos os módulos e acompanhamos os primeiros usos.",
      group: "process",
      id: "process-setup",
      sortOrder: 2,
      title: "Implantação",
    },
    {
      active: true,
      description: "Treinamento e suporte para manter a operação evoluindo.",
      group: "process",
      id: "process-support",
      sortOrder: 3,
      title: "Suporte",
    },
  ],
  plans: [
    {
      active: true,
      badge: "Sob consulta",
      ctaLabel: "Consultar",
      description: "Para iniciar com um sistema e organizar a rotina principal.",
      features: ["Implantação assistida", "Usuários administrativos", "Relatórios"],
      highlighted: false,
      id: "plan-essential",
      name: "Essencial",
      sortOrder: 1,
    },
    {
      active: true,
      badge: "Mais completo",
      ctaLabel: "Falar com especialista",
      description: "Para equipes que precisam operar Frota e Almoxarifado juntos.",
      features: ["Dois módulos", "Auditoria", "Suporte de implantação"],
      highlighted: true,
      id: "plan-management",
      name: "Gestão Municipal",
      sortOrder: 2,
    },
  ],
  posts: [
    {
      content: "",
      id: "post-default",
      published: true,
      slug: "gestao-publica-digital",
      summary: "Como dados confiáveis melhoram controle, prestação de contas e rotina.",
      title: "Gestão pública digital com rastreabilidade",
    },
  ],
  settings: {
    contactEmail: null,
    eyebrow: "Soluções para gestão pública",
    faviconUrl: null,
    footerText: "GEMA Sistemas - tecnologia para gestão pública.",
    headline: "Sistemas municipais para controlar rotinas críticas",
    heroImageUrl: null,
    id: "site",
    logoUrl: null,
    primaryColor: "#0f766e",
    primaryCtaLabel: "Falar com especialista",
    secondaryCtaLabel: "Conhecer sistemas",
    siteName: "GEMA Sistemas",
    subheadline:
      "Frota e almoxarifado em uma plataforma pensada para equipes públicas que precisam de controle, rastreabilidade e suporte próximo.",
    whatsappMessage: "Olá, quero conhecer os sistemas municipais.",
    whatsappNumber: "5599999999999",
  },
  systems: [
    {
      active: true,
      description:
        "Acompanhe veículos, motoristas, abastecimentos, manutenções, vencimentos e custos operacionais.",
      features: [
        "Cadastro de veículos e motoristas",
        "Alertas de vencimento",
        "Custos e consumo",
      ],
      id: "system-fleet",
      key: "frota",
      name: "Controle de Frota",
      sortOrder: 1,
      summary: "Gestão completa da frota municipal.",
    },
    {
      active: true,
      description:
        "Controle almoxarifados, produtos, entradas, saídas, transferências, notas fiscais e solicitações.",
      features: [
        "Estoque por almoxarifado",
        "Movimentações auditadas",
        "Relatórios e documentos",
      ],
      id: "system-stock",
      key: "almoxarifado",
      name: "Almoxarifado",
      sortOrder: 2,
      summary: "Estoque municipal com rastreabilidade.",
    },
  ],
};

function whatsappUrl(settings: SiteSettings, message?: string | null) {
  const phone = settings.whatsappNumber.replace(/\D/g, "");
  const text = encodeURIComponent(message || settings.whatsappMessage);

  return `https://wa.me/${phone}?text=${text}`;
}

function featureIcon(feature: SiteFeature) {
  const key = `${feature.icon ?? feature.title}`.toLowerCase();

  if (key.includes("audit") || key.includes("segur") || key.includes("transpar")) {
    return ShieldCheck;
  }

  if (key.includes("file") || key.includes("relat")) {
    return FileText;
  }

  return Sparkles;
}

function systemIcon(system: SiteSystem) {
  return system.key.toLowerCase().includes("frota") ? Car : Boxes;
}

function SiteLogo({ settings }: { settings: SiteSettings }) {
  const logoUrl = resolveAssetUrl(settings.logoUrl);

  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-lg border bg-white text-teal-700 shadow-sm">
        {logoUrl ? (
          <img alt="" className="h-full w-full object-cover" src={logoUrl} />
        ) : (
          <Boxes className="h-5 w-5" />
        )}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-950">{settings.siteName}</p>
        <p className="text-xs text-slate-500">Sistemas municipais</p>
      </div>
    </div>
  );
}

function HeroPreview() {
  return (
    <div className="relative min-h-[22rem] overflow-hidden rounded-lg border bg-slate-950 p-4 text-white shadow-2xl">
      <div className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(90deg,#14b8a6,#0284c7,#f59e0b)] opacity-90" />
      <div className="relative grid gap-4">
        <div className="flex items-center justify-between rounded-md bg-white/10 p-3 backdrop-blur">
          <div>
            <p className="text-xs text-white/65">Painel municipal</p>
            <p className="text-lg font-semibold">Operação integrada</p>
          </div>
          <Badge className="border-white/20 bg-white text-slate-950">Online</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Frota ativa", "128"],
            ["Itens rastreados", "4.812"],
            ["Alertas", "17"],
          ].map(([label, value]) => (
            <div className="rounded-md bg-white p-3 text-slate-950 shadow-sm" key={label}>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-md bg-white p-4 text-slate-950">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-medium">Fluxos acompanhados</p>
              <span className="text-xs text-slate-500">Hoje</span>
            </div>
            <div className="space-y-3">
              {["Entrada de materiais", "Manutenção preventiva", "Transferência interna"].map(
                (item, index) => (
                  <div className="flex items-center gap-3" key={item}>
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        index === 0
                          ? "bg-teal-500"
                          : index === 1
                            ? "bg-sky-500"
                            : "bg-amber-500",
                      )}
                    />
                    <span className="text-sm">{item}</span>
                  </div>
                ),
              )}
            </div>
          </div>
          <div className="rounded-md bg-white/10 p-4">
            <p className="mb-4 text-sm font-medium">Indicadores</p>
            <div className="flex h-32 items-end gap-2">
              {[45, 72, 58, 88, 64, 96].map((height, index) => (
                <span
                  className="flex-1 rounded-t bg-white/80"
                  key={`${height}-${index}`}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SitePublicPage() {
  const site = useApiResource<SiteContent>("/site/public", fallbackSiteContent);
  const content = site.data;
  const { settings } = content;
  const heroImageUrl = resolveAssetUrl(settings.heroImageUrl);
  const benefits = content.features.filter((feature) => feature.group === "benefits");
  const process = content.features.filter((feature) => feature.group === "process");
  const primaryWhatsappUrl = whatsappUrl(settings);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 md:px-6">
          <SiteLogo settings={settings} />
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
            <a className="hover:text-slate-950" href="#sistemas">
              Sistemas
            </a>
            <a className="hover:text-slate-950" href="#beneficios">
              Benefícios
            </a>
            <a className="hover:text-slate-950" href="#planos">
              Planos
            </a>
            <a className="hover:text-slate-950" href="#conteudos">
              Conteúdos
            </a>
          </nav>
          <Button asChild className="hidden md:inline-flex">
            <a href={primaryWhatsappUrl} rel="noreferrer" target="_blank">
              <MessageCircle className="h-4 w-4" />
              {settings.primaryCtaLabel}
            </a>
          </Button>
        </div>
      </header>

      <section className="relative overflow-hidden border-b bg-white">
        {heroImageUrl ? (
          <img
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-20"
            src={heroImageUrl}
          />
        ) : null}
        <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-7xl gap-10 px-4 py-12 md:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:py-16">
          <div className="max-w-3xl">
            <Badge className="mb-5 border-teal-200 bg-teal-50 text-teal-900" variant="outline">
              {settings.eyebrow}
            </Badge>
            <h1 className="max-w-4xl text-4xl font-semibold leading-tight text-slate-950 md:text-6xl">
              {settings.headline}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              {settings.subheadline}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-11 px-5">
                <a href={primaryWhatsappUrl} rel="noreferrer" target="_blank">
                  <MessageCircle className="h-4 w-4" />
                  {settings.primaryCtaLabel}
                </a>
              </Button>
              <Button asChild className="h-11 px-5" variant="outline">
                <a href="#sistemas">
                  {settings.secondaryCtaLabel}
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
            </div>
            <div className="mt-10 grid max-w-xl gap-3 text-sm text-slate-600 sm:grid-cols-3">
              {["Frota", "Almoxarifado", "Suporte"].map((item) => (
                <div className="flex items-center gap-2" key={item}>
                  <CheckCircle2 className="h-4 w-4 text-teal-600" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <HeroPreview />
        </div>
      </section>

      {content.banners.length ? (
        <section className="border-b bg-slate-100">
          <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-8 md:grid-cols-2 md:px-6 xl:grid-cols-3">
            {content.banners.slice(0, 3).map((banner) => (
              <article
                className="rounded-lg border bg-white p-5 shadow-sm"
                key={banner.id}
              >
                <p className="text-sm font-semibold text-teal-700">{banner.title}</p>
                {banner.subtitle ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {banner.subtitle}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto w-full max-w-7xl px-4 py-16 md:px-6" id="sistemas">
        <div className="mb-8 max-w-3xl">
          <p className="text-sm font-semibold uppercase text-teal-700">Sistemas</p>
          <h2 className="mt-2 text-3xl font-semibold">Soluções por rotina municipal</h2>
          <p className="mt-3 text-slate-600">
            Comece pelos módulos que a prefeitura precisa agora e evolua com dados
            consistentes.
          </p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {content.systems.map((system) => {
            const Icon = systemIcon(system);

            return (
              <Card className="overflow-hidden" key={system.id}>
                <CardHeader>
                  <div className="mb-3 grid h-12 w-12 place-items-center rounded-lg bg-slate-950 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle>{system.name}</CardTitle>
                  <CardDescription>{system.summary}</CardDescription>
                </CardHeader>
                <CardContent>
                  {system.description ? (
                    <p className="mb-5 text-sm leading-6 text-slate-600">
                      {system.description}
                    </p>
                  ) : null}
                  <div className="grid gap-2">
                    {system.features.map((feature) => (
                      <div className="flex items-start gap-2 text-sm" key={feature}>
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="bg-white py-16" id="beneficios">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
          <div className="mb-8 max-w-3xl">
            <p className="text-sm font-semibold uppercase text-sky-700">Benefícios</p>
            <h2 className="mt-2 text-3xl font-semibold">Mais controle sem complicar a equipe</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {benefits.map((feature) => {
              const Icon = featureIcon(feature);

              return (
                <article className="rounded-lg border p-5" key={feature.id}>
                  <Icon className="mb-4 h-5 w-5 text-sky-700" />
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {feature.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-16 md:px-6">
        <div className="mb-8 max-w-3xl">
          <p className="text-sm font-semibold uppercase text-amber-700">Implantação</p>
          <h2 className="mt-2 text-3xl font-semibold">Do diagnóstico ao uso diário</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {process.map((step, index) => (
            <article className="rounded-lg border bg-white p-5" key={step.id}>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-100 text-sm font-semibold text-amber-900">
                {index + 1}
              </span>
              <h3 className="mt-4 font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-slate-950 py-16 text-white" id="planos">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
          <div className="mb-8 max-w-3xl">
            <p className="text-sm font-semibold uppercase text-teal-300">Planos</p>
            <h2 className="mt-2 text-3xl font-semibold">Opções para conversar com a equipe</h2>
            <p className="mt-3 text-slate-300">
              Sem preços públicos. Cada plano é ajustado depois de entender o cenário da prefeitura.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {content.plans.map((plan) => (
              <article
                className={cn(
                  "rounded-lg border p-5",
                  plan.highlighted
                    ? "border-teal-300 bg-white text-slate-950"
                    : "border-white/15 bg-white/5",
                )}
                key={plan.id}
              >
                {plan.badge ? (
                  <Badge variant={plan.highlighted ? "default" : "outline"}>
                    {plan.badge}
                  </Badge>
                ) : null}
                <h3 className="mt-4 text-xl font-semibold">{plan.name}</h3>
                <p
                  className={cn(
                    "mt-2 text-sm leading-6",
                    plan.highlighted ? "text-slate-600" : "text-slate-300",
                  )}
                >
                  {plan.description}
                </p>
                <div className="mt-5 grid gap-2">
                  {plan.features.map((feature) => (
                    <div className="flex items-start gap-2 text-sm" key={feature}>
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <Button asChild className="mt-6 w-full" variant={plan.highlighted ? "default" : "secondary"}>
                  <a href={whatsappUrl(settings, `Olá, quero consultar o plano ${plan.name}.`)} rel="noreferrer" target="_blank">
                    {plan.ctaLabel}
                  </a>
                </Button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-16 md:px-6 lg:grid-cols-[0.9fr_1.1fr]" id="conteudos">
        <div>
          <p className="text-sm font-semibold uppercase text-sky-700">Conteúdos</p>
          <h2 className="mt-2 text-3xl font-semibold">Informações e novidades</h2>
          <p className="mt-3 text-slate-600">
            Publique posts para orientar clientes, explicar módulos e apresentar novidades.
          </p>
        </div>
        <div className="grid gap-3">
          {content.posts.slice(0, 3).map((post) => (
            <article className="rounded-lg border bg-white p-5" key={post.id}>
              <h3 className="font-semibold">{post.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{post.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 md:px-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-semibold uppercase text-teal-700">FAQ</p>
            <h2 className="mt-2 text-3xl font-semibold">Dúvidas frequentes</h2>
          </div>
          <div className="grid gap-3">
            {content.faqs.map((faq) => (
              <article className="rounded-lg border p-5" key={faq.id}>
                <h3 className="font-semibold">{faq.question}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-teal-700 py-14 text-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="text-sm font-semibold uppercase text-teal-100">Contato</p>
            <h2 className="mt-2 text-3xl font-semibold">Converse sobre o melhor caminho para sua prefeitura</h2>
          </div>
          <Button asChild className="h-11 px-5" variant="secondary">
            <a href={primaryWhatsappUrl} rel="noreferrer" target="_blank">
              <MessageCircle className="h-4 w-4" />
              {settings.primaryCtaLabel}
            </a>
          </Button>
        </div>
      </section>

      <footer className="bg-slate-950 py-8 text-sm text-slate-300">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 md:flex-row md:items-center md:justify-between md:px-6">
          <p>{settings.footerText}</p>
          {settings.contactEmail ? <p>{settings.contactEmail}</p> : null}
        </div>
      </footer>
    </main>
  );
}
