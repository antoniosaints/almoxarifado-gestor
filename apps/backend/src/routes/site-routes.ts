import { UserRole } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler, requireRole } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import {
  createSiteBanner,
  createSiteFaq,
  createSiteFeature,
  createSitePlan,
  createSitePost,
  createSiteSystem,
  deleteSiteRecord,
  getSiteContent,
  updateSiteBanner,
  updateSiteFaq,
  updateSiteFeature,
  updateSitePlan,
  updateSitePost,
  updateSiteSettings,
  updateSiteSystem,
} from "../services/site-service.js";
import { idParam } from "../validators/inputs.js";

export const publicSiteRoutes = Router();
export const siteAdminRoutes = Router();

const optionalText = z.string().trim().max(1000).optional().nullable();
const requiredText = z.string().trim().min(2).max(3000);
const assetUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => !value.startsWith("data:"), "Envie imagens pelo upload.")
  .optional()
  .nullable();

const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Informe uma cor hexadecimal valida.");

const siteSettingsInput = z.object({
  contactEmail: optionalText,
  eyebrow: z.string().trim().min(2).max(120).optional(),
  faviconUrl: assetUrl,
  footerText: z.string().trim().min(2).max(500).optional(),
  headline: z.string().trim().min(2).max(180).optional(),
  heroImageUrl: assetUrl,
  logoUrl: assetUrl,
  primaryColor: hexColor.optional(),
  primaryCtaLabel: z.string().trim().min(2).max(60).optional(),
  secondaryCtaLabel: z.string().trim().min(2).max(60).optional(),
  siteName: z.string().trim().min(2).max(80).optional(),
  subheadline: z.string().trim().min(2).max(500).optional(),
  whatsappMessage: z.string().trim().min(2).max(300).optional(),
  whatsappNumber: z.string().trim().min(8).max(30).optional(),
});

const siteBannerInput = z.object({
  active: z.boolean().default(true),
  buttonLabel: optionalText,
  buttonUrl: optionalText,
  imageUrl: assetUrl,
  sortOrder: z.coerce.number().int().default(0),
  subtitle: optionalText,
  title: requiredText,
});

const featureList = z.array(z.string().trim().min(1).max(140)).max(12).default([]);

const siteSystemInput = z.object({
  active: z.boolean().default(true),
  description: optionalText,
  features: featureList,
  imageUrl: assetUrl,
  key: z.string().trim().min(2).max(60),
  name: z.string().trim().min(2).max(120),
  sortOrder: z.coerce.number().int().default(0),
  summary: z.string().trim().min(2).max(300),
});

const siteFeatureInput = z.object({
  active: z.boolean().default(true),
  description: z.string().trim().min(2).max(500),
  group: z.string().trim().min(2).max(60).default("benefits"),
  icon: optionalText,
  sortOrder: z.coerce.number().int().default(0),
  title: z.string().trim().min(2).max(120),
});

const sitePostInput = z.object({
  content: z.string().trim().min(2).max(20000),
  coverImageUrl: assetUrl,
  published: z.boolean().default(false),
  publishedAt: z.coerce.date().optional().nullable(),
  slug: z.string().trim().min(2).max(140),
  summary: z.string().trim().min(2).max(500),
  title: z.string().trim().min(2).max(160),
});

const sitePlanInput = z.object({
  active: z.boolean().default(true),
  badge: optionalText,
  ctaLabel: z.string().trim().min(2).max(80).default("Consultar"),
  description: z.string().trim().min(2).max(500),
  features: featureList,
  highlighted: z.boolean().default(false),
  name: z.string().trim().min(2).max(120),
  sortOrder: z.coerce.number().int().default(0),
});

const siteFaqInput = z.object({
  active: z.boolean().default(true),
  answer: z.string().trim().min(2).max(1200),
  question: z.string().trim().min(2).max(240),
  sortOrder: z.coerce.number().int().default(0),
});

publicSiteRoutes.get(
  "/public",
  asyncHandler(async (_request, response) => {
    response.json(await getSiteContent(prisma));
  }),
);

siteAdminRoutes.use("/admin", requireRole(UserRole.ADMIN));

siteAdminRoutes.get(
  "/admin/content",
  asyncHandler(async (_request, response) => {
    response.json(await getSiteContent(prisma, { admin: true }));
  }),
);

siteAdminRoutes.put(
  "/admin/settings",
  asyncHandler(async (request, response) => {
    const input = siteSettingsInput.parse(request.body);

    response.json(await updateSiteSettings(prisma, input));
  }),
);

siteAdminRoutes.post(
  "/admin/banners",
  asyncHandler(async (request, response) => {
    const input = siteBannerInput.parse(request.body);

    response.status(201).json(await createSiteBanner(prisma, input));
  }),
);

siteAdminRoutes.put(
  "/admin/banners/:id",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const input = siteBannerInput.parse(request.body);

    response.json(await updateSiteBanner(prisma, id, input));
  }),
);

siteAdminRoutes.post(
  "/admin/systems",
  asyncHandler(async (request, response) => {
    const input = siteSystemInput.parse(request.body);

    response.status(201).json(await createSiteSystem(prisma, input));
  }),
);

siteAdminRoutes.put(
  "/admin/systems/:id",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const input = siteSystemInput.parse(request.body);

    response.json(await updateSiteSystem(prisma, id, input));
  }),
);

siteAdminRoutes.post(
  "/admin/features",
  asyncHandler(async (request, response) => {
    const input = siteFeatureInput.parse(request.body);

    response.status(201).json(await createSiteFeature(prisma, input));
  }),
);

siteAdminRoutes.put(
  "/admin/features/:id",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const input = siteFeatureInput.parse(request.body);

    response.json(await updateSiteFeature(prisma, id, input));
  }),
);

siteAdminRoutes.post(
  "/admin/posts",
  asyncHandler(async (request, response) => {
    const input = sitePostInput.parse(request.body);

    response.status(201).json(await createSitePost(prisma, input));
  }),
);

siteAdminRoutes.put(
  "/admin/posts/:id",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const input = sitePostInput.parse(request.body);

    response.json(await updateSitePost(prisma, id, input));
  }),
);

siteAdminRoutes.post(
  "/admin/plans",
  asyncHandler(async (request, response) => {
    const input = sitePlanInput.parse(request.body);

    response.status(201).json(await createSitePlan(prisma, input));
  }),
);

siteAdminRoutes.put(
  "/admin/plans/:id",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const input = sitePlanInput.parse(request.body);

    response.json(await updateSitePlan(prisma, id, input));
  }),
);

siteAdminRoutes.post(
  "/admin/faqs",
  asyncHandler(async (request, response) => {
    const input = siteFaqInput.parse(request.body);

    response.status(201).json(await createSiteFaq(prisma, input));
  }),
);

siteAdminRoutes.put(
  "/admin/faqs/:id",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const input = siteFaqInput.parse(request.body);

    response.json(await updateSiteFaq(prisma, id, input));
  }),
);

siteAdminRoutes.delete(
  "/admin/:collection/:id",
  asyncHandler(async (request, response) => {
    const { id } = idParam.parse(request.params);
    const collection = z
      .enum(["banners", "faqs", "features", "plans", "posts", "systems"])
      .parse(request.params.collection);

    response.json(await deleteSiteRecord(prisma, collection, id));
  }),
);
