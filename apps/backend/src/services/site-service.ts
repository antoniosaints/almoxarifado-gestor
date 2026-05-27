import type {
  Prisma,
  PrismaClient,
  SiteBanner,
  SiteFeature,
  SiteFaq,
  SitePlan,
  SitePost,
  SiteSystem,
} from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { storeUploadAsset } from "./upload-service.js";

export const siteSettingsId = "site";

export const defaultSiteSettings = {
  contactEmail: null,
  eyebrow: "Solucoes para gestao publica",
  faviconUrl: null,
  footerText: "GEMA Sistemas - tecnologia para gestao publica.",
  headline: "Sistemas municipais para controlar rotinas criticas",
  heroImageUrl: null,
  logoUrl: null,
  primaryColor: "#0f766e",
  primaryCtaLabel: "Falar com especialista",
  secondaryCtaLabel: "Conhecer solucoes",
  siteName: "GEMA Sistemas",
  subheadline:
    "Frota e almoxarifado em uma plataforma pensada para equipes publicas que precisam de controle, rastreabilidade e suporte proximo.",
  whatsappMessage: "Ola, quero conhecer os sistemas municipais.",
  whatsappNumber: "5599999999999",
} satisfies Omit<
  Prisma.SiteSettingsUncheckedCreateInput,
  "createdAt" | "id" | "updatedAt"
>;

const defaultBanners = [
  {
    active: true,
    buttonLabel: "Falar com especialista",
    buttonUrl: "whatsapp",
    sortOrder: 1,
    subtitle:
      "Controle rotinas, reduza retrabalho e acompanhe indicadores com suporte proximo.",
    title: "Gestao publica com sistemas feitos para a rotina municipal",
  },
  {
    active: true,
    buttonLabel: "Conhecer solucoes",
    buttonUrl: "#sistemas",
    sortOrder: 2,
    subtitle:
      "Frota e almoxarifado organizados com rastreabilidade, permissoes e relatorios.",
    title: "Do estoque aos veiculos, tudo com dados confiaveis",
  },
] satisfies Prisma.SiteBannerCreateManyInput[];

const defaultSystems = [
  {
    active: true,
    description:
      "Acompanhe veiculos, motoristas, manutencoes, abastecimentos, vencimentos e custos operacionais em uma visao unica para a gestao publica.",
    featuresJson: stringifyList([
      "Cadastro de veiculos e motoristas",
      "Alertas de CNH, oleo, correias e servicos",
      "Relatorios de consumo, custo e disponibilidade",
      "Historico de operacoes e manutencoes",
    ]),
    key: "frota",
    name: "Controle de Frota",
    sortOrder: 1,
    summary: "Gestao completa de veiculos, condutores, custos e alertas.",
  },
  {
    active: true,
    description:
      "Controle almoxarifados, produtos, estoques minimos, entradas, saidas, transferencias, notas fiscais e solicitacoes internas com auditoria.",
    featuresJson: stringifyList([
      "Estoque por almoxarifado",
      "Entradas, saidas e transferencias",
      "Notas fiscais e fornecedores",
      "Relatorios e auditoria de movimentacoes",
    ]),
    key: "almoxarifado",
    name: "Almoxarifado",
    sortOrder: 2,
    summary: "Controle de estoque municipal com rastreabilidade e relatorios.",
  },
] satisfies Prisma.SiteSystemCreateManyInput[];

const defaultFeatures = [
  {
    active: true,
    description:
      "Dados operacionais com historico, responsaveis e rastreabilidade para apoiar decisoes.",
    group: "benefits",
    icon: "chart",
    sortOrder: 1,
    title: "Controle em tempo real",
  },
  {
    active: true,
    description:
      "Fluxos pensados para equipes administrativas, operadores e gestores municipais.",
    group: "benefits",
    icon: "workflow",
    sortOrder: 2,
    title: "Rotina mais simples",
  },
  {
    active: true,
    description:
      "Relatorios, filtros e exportacoes ajudam a prestar contas com seguranca.",
    group: "benefits",
    icon: "file",
    sortOrder: 3,
    title: "Transparencia e auditoria",
  },
  {
    active: true,
    description: "Entendemos o fluxo atual e ajustamos a implantacao a sua equipe.",
    group: "process",
    icon: "search",
    sortOrder: 1,
    title: "Diagnostico",
  },
  {
    active: true,
    description: "Configuramos cadastros, permissoes e dados iniciais do sistema.",
    group: "process",
    icon: "settings",
    sortOrder: 2,
    title: "Implantacao",
  },
  {
    active: true,
    description: "Treinamos usuarios e acompanhamos a entrada em operacao.",
    group: "process",
    icon: "support",
    sortOrder: 3,
    title: "Treinamento e suporte",
  },
] satisfies Prisma.SiteFeatureCreateManyInput[];

const defaultPlans = [
  {
    active: true,
    badge: "Sob consulta",
    ctaLabel: "Consultar",
    description: "Para iniciar a organizacao digital de uma area municipal.",
    featuresJson: stringifyList([
      "Um modulo principal",
      "Usuarios administrativos",
      "Configuracao assistida",
    ]),
    highlighted: false,
    name: "Essencial",
    sortOrder: 1,
  },
  {
    active: true,
    badge: "Mais completo",
    ctaLabel: "Falar com especialista",
    description: "Para operacoes que precisam integrar cadastros, relatorios e auditoria.",
    featuresJson: stringifyList([
      "Frota e almoxarifado",
      "Relatorios gerenciais",
      "Suporte de implantacao",
    ]),
    highlighted: true,
    name: "Gestao Municipal",
    sortOrder: 2,
  },
  {
    active: true,
    badge: "Sob medida",
    ctaLabel: "Agendar conversa",
    description: "Para prefeituras que desejam ampliar fluxos e integracoes.",
    featuresJson: stringifyList([
      "Modulos adicionais",
      "Ajustes por processo",
      "Evolucao planejada",
    ]),
    highlighted: false,
    name: "Expansao",
    sortOrder: 3,
  },
] satisfies Prisma.SitePlanCreateManyInput[];

const defaultFaqs = [
  {
    active: true,
    answer:
      "Nao. O contato e feito com um especialista para entender a necessidade e indicar a melhor configuracao.",
    question: "O site mostra precos?",
    sortOrder: 1,
  },
  {
    active: true,
    answer:
      "Sim. O sistema foi pensado para operacoes municipais e pode comecar por frota, almoxarifado ou ambos.",
    question: "Posso contratar apenas um sistema?",
    sortOrder: 2,
  },
  {
    active: true,
    answer:
      "Sim. O processo inclui configuracao inicial e orientacao para a equipe usar a plataforma.",
    question: "A implantacao tem treinamento?",
    sortOrder: 3,
  },
] satisfies Prisma.SiteFaqCreateManyInput[];

const defaultPosts = [
  {
    content:
      "A digitalizacao da gestao publica ajuda equipes a reduzir retrabalho, organizar documentos e acompanhar indicadores com mais confianca.",
    published: true,
    publishedAt: new Date("2026-05-27T12:00:00.000Z"),
    slug: "gestao-publica-digital",
    summary:
      "Veja como sistemas bem implantados tornam a rotina municipal mais rastreavel.",
    title: "Gestao publica digital com controle e rastreabilidade",
  },
] satisfies Prisma.SitePostCreateManyInput[];

export type SiteSettingsInput = Partial<
  Omit<
    Prisma.SiteSettingsUncheckedUpdateInput,
    "createdAt" | "id" | "updatedAt"
  >
>;

export type SiteBannerInput = Omit<
  Prisma.SiteBannerUncheckedCreateInput,
  "createdAt" | "id" | "updatedAt"
>;
export type SiteSystemInput = Omit<
  Prisma.SiteSystemUncheckedCreateInput,
  "createdAt" | "featuresJson" | "id" | "updatedAt"
> & { features?: string[] };
export type SiteFeatureInput = Omit<
  Prisma.SiteFeatureUncheckedCreateInput,
  "createdAt" | "id" | "updatedAt"
>;
export type SitePostInput = Omit<
  Prisma.SitePostUncheckedCreateInput,
  "createdAt" | "id" | "publishedAt" | "updatedAt"
> & { publishedAt?: Date | null };
export type SitePlanInput = Omit<
  Prisma.SitePlanUncheckedCreateInput,
  "createdAt" | "featuresJson" | "id" | "updatedAt"
> & { features?: string[] };
export type SiteFaqInput = Omit<
  Prisma.SiteFaqUncheckedCreateInput,
  "createdAt" | "id" | "updatedAt"
>;

type SiteCollection =
  | "banners"
  | "faqs"
  | "features"
  | "plans"
  | "posts"
  | "systems";

type SiteContentOptions = {
  admin?: boolean;
};

function stringifyList(values: string[]) {
  return JSON.stringify(values);
}

function parseList(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function withSystemFeatures(system: SiteSystem) {
  return {
    ...system,
    features: parseList(system.featuresJson),
  };
}

function withPlanFeatures(plan: SitePlan) {
  return {
    ...plan,
    features: parseList(plan.featuresJson),
  };
}

export async function ensureDefaultSiteContent(prisma: PrismaClient) {
  const settings = await prisma.siteSettings.upsert({
    create: {
      id: siteSettingsId,
      ...defaultSiteSettings,
    },
    update: {},
    where: { id: siteSettingsId },
  });

  if ((await prisma.siteBanner.count()) === 0) {
    await prisma.siteBanner.createMany({ data: defaultBanners });
  }

  if ((await prisma.siteSystem.count()) === 0) {
    await prisma.siteSystem.createMany({ data: defaultSystems });
  }

  if ((await prisma.siteFeature.count()) === 0) {
    await prisma.siteFeature.createMany({ data: defaultFeatures });
  }

  if ((await prisma.sitePlan.count()) === 0) {
    await prisma.sitePlan.createMany({ data: defaultPlans });
  }

  if ((await prisma.siteFaq.count()) === 0) {
    await prisma.siteFaq.createMany({ data: defaultFaqs });
  }

  if ((await prisma.sitePost.count()) === 0) {
    await prisma.sitePost.createMany({ data: defaultPosts });
  }

  return settings;
}

export async function getSiteContent(
  prisma: PrismaClient,
  options: SiteContentOptions = {},
) {
  const admin = options.admin ?? false;
  const settings = await ensureDefaultSiteContent(prisma);
  const [banners, systems, features, plans, faqs, posts] = await Promise.all([
    prisma.siteBanner.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      where: admin ? undefined : { active: true },
    }),
    prisma.siteSystem.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      where: admin ? undefined : { active: true },
    }),
    prisma.siteFeature.findMany({
      orderBy: [{ group: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      where: admin ? undefined : { active: true },
    }),
    prisma.sitePlan.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      where: admin ? undefined : { active: true },
    }),
    prisma.siteFaq.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      where: admin ? undefined : { active: true },
    }),
    prisma.sitePost.findMany({
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      where: admin ? undefined : { published: true },
    }),
  ]);

  return {
    banners,
    faqs,
    features,
    plans: plans.map(withPlanFeatures),
    posts,
    settings,
    systems: systems.map(withSystemFeatures),
  };
}

export async function updateSiteSettings(
  prisma: PrismaClient,
  input: SiteSettingsInput,
) {
  return prisma.siteSettings.upsert({
    create: {
      id: siteSettingsId,
      ...defaultSiteSettings,
      ...input,
    } as Prisma.SiteSettingsUncheckedCreateInput,
    update: input,
    where: { id: siteSettingsId },
  });
}

export function normalizeSiteSystemInput(input: SiteSystemInput) {
  const { features, ...data } = input;

  return {
    ...data,
    featuresJson: stringifyList(features ?? []),
  };
}

export function normalizeSitePlanInput(input: SitePlanInput) {
  const { features, ...data } = input;

  return {
    ...data,
    featuresJson: stringifyList(features ?? []),
  };
}

export async function createSiteBanner(prisma: PrismaClient, input: SiteBannerInput) {
  return prisma.siteBanner.create({ data: input });
}

export async function updateSiteBanner(
  prisma: PrismaClient,
  id: string,
  input: SiteBannerInput,
) {
  return prisma.siteBanner.update({ data: input, where: { id } });
}

export async function deleteSiteBanner(prisma: PrismaClient, id: string) {
  return prisma.siteBanner.delete({ where: { id } });
}

export async function createSiteSystem(prisma: PrismaClient, input: SiteSystemInput) {
  const system = await prisma.siteSystem.create({
    data: normalizeSiteSystemInput(input),
  });

  return withSystemFeatures(system);
}

export async function updateSiteSystem(
  prisma: PrismaClient,
  id: string,
  input: SiteSystemInput,
) {
  const system = await prisma.siteSystem.update({
    data: normalizeSiteSystemInput(input),
    where: { id },
  });

  return withSystemFeatures(system);
}

export async function deleteSiteSystem(prisma: PrismaClient, id: string) {
  return prisma.siteSystem.delete({ where: { id } });
}

export async function createSiteFeature(
  prisma: PrismaClient,
  input: SiteFeatureInput,
) {
  return prisma.siteFeature.create({ data: input });
}

export async function updateSiteFeature(
  prisma: PrismaClient,
  id: string,
  input: SiteFeatureInput,
) {
  return prisma.siteFeature.update({ data: input, where: { id } });
}

export async function deleteSiteFeature(prisma: PrismaClient, id: string) {
  return prisma.siteFeature.delete({ where: { id } });
}

export async function createSitePost(prisma: PrismaClient, input: SitePostInput) {
  return prisma.sitePost.create({
    data: {
      ...input,
      publishedAt: input.published ? (input.publishedAt ?? new Date()) : null,
    },
  });
}

export async function updateSitePost(
  prisma: PrismaClient,
  id: string,
  input: SitePostInput,
) {
  return prisma.sitePost.update({
    data: {
      ...input,
      publishedAt: input.published ? (input.publishedAt ?? new Date()) : null,
    },
    where: { id },
  });
}

export async function deleteSitePost(prisma: PrismaClient, id: string) {
  return prisma.sitePost.delete({ where: { id } });
}

export async function createSitePlan(prisma: PrismaClient, input: SitePlanInput) {
  const plan = await prisma.sitePlan.create({
    data: normalizeSitePlanInput(input),
  });

  return withPlanFeatures(plan);
}

export async function updateSitePlan(
  prisma: PrismaClient,
  id: string,
  input: SitePlanInput,
) {
  const plan = await prisma.sitePlan.update({
    data: normalizeSitePlanInput(input),
    where: { id },
  });

  return withPlanFeatures(plan);
}

export async function deleteSitePlan(prisma: PrismaClient, id: string) {
  return prisma.sitePlan.delete({ where: { id } });
}

export async function createSiteFaq(prisma: PrismaClient, input: SiteFaqInput) {
  return prisma.siteFaq.create({ data: input });
}

export async function updateSiteFaq(
  prisma: PrismaClient,
  id: string,
  input: SiteFaqInput,
) {
  return prisma.siteFaq.update({ data: input, where: { id } });
}

export async function deleteSiteFaq(prisma: PrismaClient, id: string) {
  return prisma.siteFaq.delete({ where: { id } });
}

export async function deleteSiteRecord(
  prisma: PrismaClient,
  collection: SiteCollection,
  id: string,
) {
  if (collection === "banners") {
    return deleteSiteBanner(prisma, id);
  }

  if (collection === "systems") {
    return deleteSiteSystem(prisma, id);
  }

  if (collection === "features") {
    return deleteSiteFeature(prisma, id);
  }

  if (collection === "posts") {
    return deleteSitePost(prisma, id);
  }

  if (collection === "plans") {
    return deleteSitePlan(prisma, id);
  }

  return deleteSiteFaq(prisma, id);
}

export async function uploadSiteAsset(
  prisma: PrismaClient,
  {
    buffer,
    contentType,
    slot,
  }: {
    buffer: Buffer;
    contentType: string;
    slot: string;
  },
) {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(slot)) {
    throw new AppError(400, "Tipo de upload do site invalido.");
  }

  const upload = await storeUploadAsset({
    buffer,
    contentType,
    key: slot,
    namespace: "site",
  });

  const settingsFieldBySlot: Record<string, keyof Prisma.SiteSettingsUncheckedUpdateInput> = {
    favicon: "faviconUrl",
    hero: "heroImageUrl",
    logo: "logoUrl",
  };
  const settingsField = settingsFieldBySlot[slot];

  if (settingsField) {
    await updateSiteSettings(prisma, { [settingsField]: upload.url });
  }

  return {
    driver: upload.driver,
    key: upload.key,
    slot,
    url: upload.url,
  };
}
