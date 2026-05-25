# Settings Requests CSV Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add uploadable branding assets, request creation from warehouse/request pages, and a safe CSV stock import workflow.

**Architecture:** Keep image uploads as validated data URLs in `SystemSettings`. Reuse the current `EntryRequest` and `createEntry` stock movement services. Add a focused CSV import service with preview/import endpoints so stock changes only happen in the final transaction.

**Tech Stack:** React 19, TypeScript, Vitest, Express 5, Prisma, SQLite, Zod.

---

### Task 1: Tests for Settings and Request Visibility

**Files:**
- Modify: `apps/frontend/src/pages/warehouse-detail-page.test.tsx`
- Modify: `apps/frontend/src/pages/requests-page.test.tsx`
- Modify: `apps/backend/src/app.test.ts`

- [ ] Add a warehouse tab test proving admins see `Solicitar` in a non-general warehouse.
- [ ] Add a warehouse tab test proving `Solicitar` stays hidden in the general warehouse.
- [ ] Add a requests page test proving the top-level `Solicitar` button opens a dialog with destination warehouse and product fields.
- [ ] Add an API test proving admins can create entry requests and general stock is not changed by request creation.

### Task 2: Settings Uploads and Favicon

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Add: `apps/backend/prisma/migrations/20260525100000_system_favicon/migration.sql`
- Modify: `apps/backend/src/validators/inputs.ts`
- Modify: `apps/frontend/src/lib/types.ts`
- Modify: `apps/frontend/src/lib/system-settings.tsx`
- Modify: `apps/frontend/src/pages/settings-page.tsx`

- [ ] Add nullable `faviconUrl` to Prisma and TypeScript settings types.
- [ ] Accept image data URLs for all image settings and favicon.
- [ ] Add reusable frontend file-to-data-url validation for common image types and a conservative size limit.
- [ ] Add upload controls beside existing URL fields.
- [ ] Apply favicon in `SystemSettingsProvider`.

### Task 3: Entry Request Buttons

**Files:**
- Modify: `apps/backend/src/routes/entry-request-routes.ts`
- Modify: `apps/frontend/src/pages/warehouse-detail-page.tsx`
- Modify: `apps/frontend/src/pages/requests-page.tsx`

- [ ] Allow admins and operators to call `POST /entry-requests`.
- [ ] Change warehouse detail visibility to show `Solicitar` when the active tab is stock, the warehouse is not general, and the user is admin or operator.
- [ ] Add a request dialog on the requests page with destination warehouse, product, quantity, date, and observation.
- [ ] Reload entry requests after successful creation.

### Task 4: CSV Preview and Import Backend

**Files:**
- Add: `apps/backend/src/services/stock-csv-import-service.test.ts`
- Add: `apps/backend/src/services/stock-csv-import-service.ts`
- Modify: `apps/backend/src/validators/inputs.ts`
- Modify: `apps/backend/src/routes/warehouse-routes.ts`

- [ ] Write tests for CSV preview row parsing, required invoice fields, product suggestions, and total mismatch warnings.
- [ ] Write tests for CSV import transaction, duplicate invoice protection, skipped rows, mapped products, new product creation, invoice creation, and stock updates.
- [ ] Implement a small CSV parser for semicolon/comma delimiters with quoted values.
- [ ] Implement `previewWarehouseCsvImport`.
- [ ] Implement `importWarehouseCsv`.
- [ ] Add `POST /warehouses/:warehouseId/import-csv/preview` and `POST /warehouses/:warehouseId/import-csv`.

### Task 5: CSV Import Frontend

**Files:**
- Modify: `apps/frontend/src/lib/types.ts`
- Modify: `apps/frontend/src/pages/warehouse-detail-page.tsx`

- [ ] Add frontend types for CSV preview rows and import mappings.
- [ ] Add `Importar CSV` button in the stock tab.
- [ ] Add template download.
- [ ] Add CSV upload, preview table, row action controls, product mapping controls, default category, and final import action.
- [ ] Reload warehouse, movement, and product data after import.

### Task 6: Verification

**Files:**
- No new files.

- [ ] Run targeted backend service/API tests.
- [ ] Run targeted frontend page tests.
- [ ] Run full backend and frontend build if targeted tests pass.
