# Audit Suppliers Office Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add supplier-backed invoices, movement audit details/PDF export, richer invoice movement auditing, and configurable office-letter templates.

**Architecture:** Extend the existing REST/Prisma modules with small route files for suppliers and office templates, keep invoices as fiscal snapshots linked to suppliers, and reuse the existing PDF report helpers. Frontend changes stay in the current shadcn-style pages and components, mainly `MovementsTable`, `InvoicesPage`, `WarehouseDetailPage`, and `SettingsPage`.

**Tech Stack:** Express, Prisma, SQLite-compatible migrations, Vitest, React, shadcn/Radix components, Tailwind, PDFKit.

---

### Task 1: Backend Domain And APIs

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/migrations/20260526143000_suppliers_office_templates/migration.sql`
- Modify: `apps/backend/src/validators/inputs.ts`
- Create: `apps/backend/src/services/supplier-service.ts`
- Create: `apps/backend/src/routes/supplier-routes.ts`
- Create: `apps/backend/src/routes/office-template-routes.ts`
- Modify: `apps/backend/src/app.ts`
- Modify: `apps/backend/src/test/database.ts`
- Test: `apps/backend/src/app.test.ts`

- [ ] **Step 1: Write failing backend API tests**

Add tests proving suppliers can be created/listed, duplicate CNPJ is rejected, invoices require `supplierId`, office templates reject unknown variables, and reset deletes the new data in the correct order.

- [ ] **Step 2: Run backend tests to verify RED**

Run: `pnpm --filter @almoxarifado/backend test -- src/app.test.ts`

Expected: failures for missing supplier route/model and missing office-template route/model.

- [ ] **Step 3: Implement schema, migration, validators, services, and routes**

Add `Supplier`, `Invoice.supplierId`, and `OfficeLetterTemplate`; add validators for supplier, invoice with `supplierId`, and office template content. Register `/suppliers` and `/office-templates` in `app.ts`.

- [ ] **Step 4: Run backend tests to verify GREEN**

Run: `pnpm --filter @almoxarifado/backend test -- src/app.test.ts`

Expected: new backend API tests pass.

### Task 2: Invoice Imports, Filters, And Movement Audit PDF

**Files:**
- Modify: `apps/backend/src/routes/invoice-routes.ts`
- Modify: `apps/backend/src/services/invoice-xml-service.ts`
- Modify: `apps/backend/src/services/stock-csv-import-service.ts`
- Modify: `apps/backend/src/routes/report-routes.ts`
- Modify: `apps/backend/src/routes/movement-routes.ts`
- Modify: `apps/backend/src/routes/warehouse-routes.ts`
- Test: `apps/backend/src/app.test.ts`
- Test: `apps/backend/src/services/stock-csv-import-service.test.ts`

- [ ] **Step 1: Write failing import/report tests**

Add tests for XML linking existing suppliers by CNPJ, XML creating suppliers for new CNPJs, CSV linking/creating suppliers, invoice filtering by supplier, and `GET /reports/movements/:id` returning PDF with warehouse scope enforced.

- [ ] **Step 2: Run tests to verify RED**

Run: `pnpm --filter @almoxarifado/backend test -- src/app.test.ts src/services/stock-csv-import-service.test.ts`

Expected: failures for missing supplier resolution and missing movement detail report.

- [ ] **Step 3: Implement supplier resolution in invoice creation/imports and movement PDF**

Resolve or create suppliers by normalized CNPJ in XML/CSV imports; require supplier for manual invoice creation; include supplier/responsible user in invoice, movement, and warehouse movement includes; add one-movement PDF endpoint.

- [ ] **Step 4: Run tests to verify GREEN**

Run: `pnpm --filter @almoxarifado/backend test -- src/app.test.ts src/services/stock-csv-import-service.test.ts`

Expected: all targeted backend import/report tests pass.

### Task 3: Frontend Supplier And Audit UI

**Files:**
- Modify: `apps/frontend/src/lib/types.ts`
- Modify: `apps/frontend/src/pages/movements-page.tsx`
- Modify: `apps/frontend/src/pages/invoices-page.tsx`
- Modify: `apps/frontend/src/pages/warehouse-detail-page.tsx`
- Test: `apps/frontend/src/pages/movements-page.test.tsx`
- Test: `apps/frontend/src/pages/invoices-page.test.tsx`
- Test: `apps/frontend/src/pages/warehouse-detail-page.test.tsx`

- [ ] **Step 1: Write failing frontend tests**

Add tests for movement audit modal/export, responsible user display in invoice movements, supplier quick-create during manual invoice creation, and supplier filter/export payload.

- [ ] **Step 2: Run frontend tests to verify RED**

Run: `pnpm --filter @almoxarifado/frontend test -- src/pages/movements-page.test.tsx src/pages/invoices-page.test.tsx src/pages/warehouse-detail-page.test.tsx`

Expected: failures for missing supplier UI and missing movement audit modal.

- [ ] **Step 3: Implement UI**

Update frontend types; add `MovementDetailsDialog`; add supplier management/quick-create dialog; update invoice filters/export; update manual invoice creation to require `supplierId`; show `Operado por` in movement tables.

- [ ] **Step 4: Run frontend tests to verify GREEN**

Run: `pnpm --filter @almoxarifado/frontend test -- src/pages/movements-page.test.tsx src/pages/invoices-page.test.tsx src/pages/warehouse-detail-page.test.tsx`

Expected: targeted frontend tests pass.

### Task 4: Office Templates Settings Tab

**Files:**
- Modify: `apps/frontend/src/lib/types.ts`
- Modify: `apps/frontend/src/pages/settings-page.tsx`
- Test: `apps/frontend/src/pages/settings-page.test.tsx`

- [ ] **Step 1: Write failing settings test**

Add a test that opens the Oficios tab, inserts `{{nome_empresa}}`, and saves a template through `/office-templates`.

- [ ] **Step 2: Run test to verify RED**

Run: `pnpm --filter @almoxarifado/frontend test -- src/pages/settings-page.test.tsx`

Expected: failure because the Oficios tab/editor does not exist.

- [ ] **Step 3: Implement settings tab and editor**

Add a shadcn-style tab with toolbar buttons, contenteditable editor, variable palette, preview, active switch, template list, and save/reset behavior.

- [ ] **Step 4: Run test to verify GREEN**

Run: `pnpm --filter @almoxarifado/frontend test -- src/pages/settings-page.test.tsx`

Expected: settings test passes.

### Task 5: Final Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Generate Prisma client**

Run: `pnpm --filter @almoxarifado/backend db:generate`

Expected: Prisma client generation succeeds with the updated schema.

- [ ] **Step 2: Run full build**

Run: `pnpm run build`

Expected: backend and frontend TypeScript builds pass.

- [ ] **Step 3: Run full test suite**

Run: `pnpm test`

Expected: backend and frontend test suites pass, or any pre-existing unrelated failure is reported with evidence.
