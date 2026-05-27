CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'site',
    "siteName" TEXT NOT NULL DEFAULT 'GEMA Sistemas',
    "eyebrow" TEXT NOT NULL DEFAULT 'Solucoes para gestao publica',
    "headline" TEXT NOT NULL DEFAULT 'Sistemas municipais para controlar rotinas criticas',
    "subheadline" TEXT NOT NULL DEFAULT 'Frota e almoxarifado em uma plataforma pensada para equipes publicas que precisam de controle, rastreabilidade e suporte proximo.',
    "primaryCtaLabel" TEXT NOT NULL DEFAULT 'Falar com especialista',
    "secondaryCtaLabel" TEXT NOT NULL DEFAULT 'Conhecer solucoes',
    "heroImageUrl" TEXT,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#0f766e',
    "whatsappNumber" TEXT NOT NULL DEFAULT '5599999999999',
    "whatsappMessage" TEXT NOT NULL DEFAULT 'Ola, quero conhecer os sistemas municipais.',
    "contactEmail" TEXT,
    "footerText" TEXT NOT NULL DEFAULT 'GEMA Sistemas - tecnologia para gestao publica.',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "SiteBanner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "imageUrl" TEXT,
    "buttonLabel" TEXT,
    "buttonUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "SiteSystem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "featuresJson" TEXT NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "SiteFeature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "group" TEXT NOT NULL DEFAULT 'benefits',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "SitePost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "SitePlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "featuresJson" TEXT NOT NULL DEFAULT '[]',
    "badge" TEXT,
    "ctaLabel" TEXT NOT NULL DEFAULT 'Consultar',
    "highlighted" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "SiteFaq" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "SiteSystem_key_key" ON "SiteSystem"("key");
CREATE UNIQUE INDEX "SitePost_slug_key" ON "SitePost"("slug");
CREATE INDEX "SiteBanner_active_idx" ON "SiteBanner"("active");
CREATE INDEX "SiteBanner_sortOrder_idx" ON "SiteBanner"("sortOrder");
CREATE INDEX "SiteSystem_active_idx" ON "SiteSystem"("active");
CREATE INDEX "SiteSystem_sortOrder_idx" ON "SiteSystem"("sortOrder");
CREATE INDEX "SiteFeature_active_idx" ON "SiteFeature"("active");
CREATE INDEX "SiteFeature_group_idx" ON "SiteFeature"("group");
CREATE INDEX "SiteFeature_sortOrder_idx" ON "SiteFeature"("sortOrder");
CREATE INDEX "SitePost_published_idx" ON "SitePost"("published");
CREATE INDEX "SitePost_publishedAt_idx" ON "SitePost"("publishedAt");
CREATE INDEX "SitePlan_active_idx" ON "SitePlan"("active");
CREATE INDEX "SitePlan_sortOrder_idx" ON "SitePlan"("sortOrder");
CREATE INDEX "SiteFaq_active_idx" ON "SiteFaq"("active");
CREATE INDEX "SiteFaq_sortOrder_idx" ON "SiteFaq"("sortOrder");
