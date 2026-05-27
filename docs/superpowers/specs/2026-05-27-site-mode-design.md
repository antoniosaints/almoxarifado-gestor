# Site Mode Design

## Goal

Add a public commercial website mode to the existing system, enabled by
`VITE_TYPE_SYSTEM=site`, with a dedicated site admin at `/admin` and broad content
management for images, banners, system descriptions, posts, future plans, FAQ, and
WhatsApp contact details.

## Approved Decisions

- `VITE_TYPE_SYSTEM=site` activates the site mode in the frontend.
- The public website lives at `/`.
- The site admin lives at `/admin`.
- The site admin reuses the existing login and `ADMIN` users.
- Operators cannot manage site content.
- Commercial CTAs lead to WhatsApp.
- No prices are shown on the site.
- Most visible site information should be editable from the admin.
- The initial systems shown are Frota and Almoxarifado.
- The implementation must avoid conflicts with the operational stock/fleet modes.

## Inspiration

The site should use the supplied references only as direction, not as copied
content or structure:

- Vime: direct software-service landing page, WhatsApp CTAs, process and cases.
- HubSpot: conversion-oriented sections, content/resources, strong lead path.
- TOTVS: product/segment organization, trust proof, content and final CTA.
- Base44: modern SaaS/product-card presentation and simple product messaging.

## Scope

This feature includes:

- A public landing website for the software platform.
- A site admin with focused management screens.
- Public API content loading.
- Protected API CRUD for site content.
- Image upload support for site assets.
- Seed/default content so the site renders professionally before admin edits.

This feature does not include:

- Payment, subscriptions, or pricing checkout.
- Persisting lead form submissions.
- Sending e-mail from contact forms.
- A visual page builder with arbitrary free-form sections.
- Replacing `SystemSettings`, which remains responsible for operational app
  login/report branding.

## Architecture

### Frontend

`apps/frontend/src/lib/system-mode.ts` gains `isSiteSystem`.

`apps/frontend/src/App.tsx` branches before the existing protected operational
routes:

- In site mode, `/` renders the public website.
- In site mode, `/login` renders the existing login page.
- In site mode, `/admin` and `/admin/*` require a session and an `ADMIN` user.
- Unknown public paths redirect to `/`.
- Unknown admin paths redirect to `/admin`.

The public website should not use `AppShell`. It needs its own public layout with
marketing navigation, responsive sections, elegant typography, visual assets,
clear CTAs, and a footer.

The admin uses `AppShell` with site-specific navigation items. This preserves the
theme switch, session handling, and layout consistency without exposing
Almoxarifado or Frota menus.

### Backend

Add `apps/backend/src/routes/site-routes.ts` and
`apps/backend/src/services/site-service.ts`.

Register routes in `apps/backend/src/app.ts`:

- `GET /site/public` before `authenticate`, returning all public active content.
- `POST /site/admin/*`, `PUT /site/admin/*`, `DELETE /site/admin/*`, and
  `GET /site/admin/*` after `authenticate`, restricted to `ADMIN`.

The site module should not depend on warehouse, stock, fleet, or manager data.

## Domain Model

Add independent Prisma models:

### SiteSettings

- `id` default `site`
- `siteName`
- `headline`
- `subheadline`
- `eyebrow`
- `primaryCtaLabel`
- `secondaryCtaLabel`
- `heroImageUrl`
- `logoUrl`
- `faviconUrl`
- `primaryColor`
- `whatsappNumber`
- `whatsappMessage`
- `contactEmail`
- `footerText`
- `createdAt`
- `updatedAt`

### SiteBanner

- `id`
- `title`
- `subtitle`
- `imageUrl`
- `buttonLabel`
- `buttonUrl`
- `sortOrder`
- `active`
- timestamps

### SiteSystem

- `id`
- `key`
- `name`
- `summary`
- `description`
- `imageUrl`
- `featuresJson`
- `sortOrder`
- `active`
- timestamps

### SiteFeature

- `id`
- `title`
- `description`
- `icon`
- `group`
- `sortOrder`
- `active`
- timestamps

### SitePost

- `id`
- `title`
- `slug`
- `summary`
- `content`
- `coverImageUrl`
- `published`
- `publishedAt`
- timestamps

### SitePlan

- `id`
- `name`
- `description`
- `featuresJson`
- `badge`
- `ctaLabel`
- `highlighted`
- `sortOrder`
- `active`
- timestamps

Plans must not include price fields in this phase.

### SiteFaq

- `id`
- `question`
- `answer`
- `sortOrder`
- `active`
- timestamps

## Public Website UX

The public home renders:

- Header with logo/name, navigation anchors, and WhatsApp CTA.
- Hero with editable headline, subheadline, CTAs, and a real visual area.
- Banner carousel managed by admin.
- Systems section for Frota and Almoxarifado.
- Benefits/features grid.
- Process section explaining discovery, configuration, training, and support.
- Future plans section with cards and no pricing.
- Posts/resources section.
- FAQ.
- Final CTA to WhatsApp.
- Footer with contact and legal text.

The page should feel like a professional software company site. It should not
look like the operational dashboard and should avoid prices.

## Site Admin UX

The admin should expose focused screens:

- Dashboard: quick counts and content status.
- Identidade: global site text, logo, favicon, color and footer.
- Banners: carousel CRUD.
- Sistemas: Frota and Almoxarifado CRUD/editing.
- Beneficios: feature/process cards.
- Posts: content CRUD and publish status.
- Planos: future plan cards with no price.
- FAQ: questions and answers.
- Contato: WhatsApp, message, e-mail, CTA labels.

Forms should use existing React/shadcn-style components, loading states, empty
states, and responsive layouts.

## Data Flow

Public page:

1. Fetches `GET /site/public`.
2. Renders active content ordered by `sortOrder` or publication date.
3. Builds WhatsApp URLs from settings.
4. Falls back to defaults if the API is unavailable.

Admin:

1. Uses existing session token.
2. Loads content through `/site/admin/content`.
3. Saves settings and content through site-admin endpoints.
4. Uploads images through `/uploads/site/:slot`.
5. Refreshes the public preview data after changes.

## Error Handling

- Public page should render default content if public API loading fails.
- Admin pages should show `LoadingLine`, `ResourceError`, and inline form errors
  following existing project patterns.
- Backend validation returns 400 with clear zod messages.
- Missing records return 404 through existing Prisma/AppError handling.
- Non-admin access returns the existing 403 behavior.

## Testing

Backend tests:

- `GET /site/public` returns default content without authentication.
- Admin endpoints require authentication and `ADMIN`.
- Operators receive 403 on site admin writes.
- Settings and content can be updated and listed.

Frontend tests:

- `VITE_TYPE_SYSTEM=site` renders public routes and site admin navigation.
- Public home renders default systems and WhatsApp CTA.
- `/admin` redirects unauthenticated users to `/login`.
- Site admin hides operational/fleet/manager navigation.

Verification:

- Targeted frontend and backend tests.
- Backend build.
- Frontend build.
- `git diff --check`.
