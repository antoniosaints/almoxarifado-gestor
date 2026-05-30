# Oficios Frontend A4 Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move office-letter PDF export from backend conversion to a frontend A4 print route that opens in the browser.

**Architecture:** The backend keeps generating office-letter data and final HTML, while the frontend owns the printable A4 view. The requests page opens a print route instead of downloading a backend PDF, and settings previews reuse the same A4 rendering boundary.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS, Express, Prisma, Vitest, Testing Library.

---

### Task 1: Frontend Print Helpers And A4 Renderer

**Files:**
- Create: `apps/frontend/src/lib/office-letter.ts`
- Create: `apps/frontend/src/lib/office-letter.test.ts`
- Create: `apps/frontend/src/components/domain/office-letter-document.tsx`
- Modify: `apps/frontend/src/index.css`

- [ ] **Step 1: Write helper tests**

Add tests for `officeLetterPrintPath`, `officeLetterFileSuffix`, and popup-blocker behavior.

- [ ] **Step 2: Run helper tests red**

Run: `pnpm --filter @almoxarifado/frontend test -- src/lib/office-letter.test.ts`
Expected: FAIL because the helper module does not exist.

- [ ] **Step 3: Implement helpers and A4 renderer**

Create a helper that builds `/requests/:id/office-letter/print`, sanitizes file suffixes, and opens a new tab with `window.open`. Create a small renderer that wraps raw HTML in an A4 preview frame without mutating the saved HTML.

- [ ] **Step 4: Add print CSS**

Add A4 screen and print classes to `apps/frontend/src/index.css`, including `@page A4` and hiding `.office-letter-print-actions` during print.

- [ ] **Step 5: Run helper tests green**

Run: `pnpm --filter @almoxarifado/frontend test -- src/lib/office-letter.test.ts`
Expected: PASS.

### Task 2: Requests Page Opens Frontend Print Route

**Files:**
- Modify: `apps/frontend/src/pages/requests-page.tsx`
- Modify: `apps/frontend/src/pages/requests-page.test.tsx`

- [ ] **Step 1: Update the existing test first**

Change the office-letter test to expect `window.open('/requests/entry-request/office-letter/print', '_blank', 'noopener,noreferrer')` and to verify no request is made to `/office-letter/pdf`.

- [ ] **Step 2: Run requests test red**

Run: `pnpm --filter @almoxarifado/frontend test -- src/pages/requests-page.test.tsx -t "opens the office letter"`
Expected: FAIL because the page still downloads the backend PDF.

- [ ] **Step 3: Update page behavior**

Remove `apiFile` from the office-letter flow, keep the existing modal, preserve the `sm:max-w-4xl` local width, and replace `Exportar PDF` with `Abrir PDF`.

- [ ] **Step 4: Run requests test green**

Run: `pnpm --filter @almoxarifado/frontend test -- src/pages/requests-page.test.tsx -t "opens the office letter"`
Expected: PASS.

### Task 3: Add Office Letter Print Page

**Files:**
- Create: `apps/frontend/src/pages/office-letter-print-page.tsx`
- Create: `apps/frontend/src/pages/office-letter-print-page.test.tsx`
- Modify: `apps/frontend/src/App.tsx`

- [ ] **Step 1: Write print page tests**

Test that the page loads `/entry-requests/:id/office-letter`, renders the returned document HTML, and calls `window.print` when `Imprimir / Salvar PDF` is clicked.

- [ ] **Step 2: Run print page tests red**

Run: `pnpm --filter @almoxarifado/frontend test -- src/pages/office-letter-print-page.test.tsx`
Expected: FAIL because the page does not exist.

- [ ] **Step 3: Implement print page and route**

Add a route outside `ProtectedLayout` so the page has no app shell. The page checks session, fetches the office letter, renders the A4 document, and shows print/close actions outside the printable region.

- [ ] **Step 4: Run print page tests green**

Run: `pnpm --filter @almoxarifado/frontend test -- src/pages/office-letter-print-page.test.tsx`
Expected: PASS.

### Task 4: Settings Preview Uses A4 Renderer

**Files:**
- Modify: `apps/frontend/src/pages/settings-page.tsx`
- Modify: `apps/frontend/src/pages/settings-page.test.tsx`

- [ ] **Step 1: Write preview test**

Add an assertion that the office-template preview renders inside the A4 preview frame and still does not save `data-office-letter-document` into `contentHtml`.

- [ ] **Step 2: Run settings test red**

Run: `pnpm --filter @almoxarifado/frontend test -- src/pages/settings-page.test.tsx -t "stores only the office template body html"`
Expected: FAIL because the shared A4 renderer is not used yet.

- [ ] **Step 3: Use shared renderer**

Import `OfficeLetterDocument` and replace the raw preview `dangerouslySetInnerHTML` block with the shared A4 preview component.

- [ ] **Step 4: Run settings test green**

Run: `pnpm --filter @almoxarifado/frontend test -- src/pages/settings-page.test.tsx -t "stores only the office template body html"`
Expected: PASS.

### Task 5: Remove Backend Office PDF Endpoint

**Files:**
- Modify: `apps/backend/src/routes/entry-request-routes.ts`
- Modify: `apps/backend/src/services/entry-request-service.ts`
- Modify: `apps/backend/src/app.test.ts`
- Modify: `apps/backend/src/entry-request-office-pdf.test.ts`
- Modify: `apps/backend/package.json`
- Modify: `apps/backend/src/types/pdf-rendering.d.ts`
- Modify: `README.md`

- [ ] **Step 1: Update backend tests red**

Remove expectations for `/entry-requests/:id/office-letter/pdf` and add/keep assertions that `/entry-requests/:id/office-letter` returns `documentHtml`.

- [ ] **Step 2: Run relevant backend tests**

Run: `pnpm --filter @almoxarifado/backend test -- src/entry-request-office-pdf.test.ts src/app.test.ts`
Expected: Existing PDF endpoint expectations fail until production code is removed.

- [ ] **Step 3: Remove production PDF code**

Delete the PDF route and service functions for office letters only. Remove `pdfmake` and `html-to-pdfmake` imports/types if no other backend code uses them. Keep `pdfkit` because reports still use it.

- [ ] **Step 4: Update README**

Replace the README statement about backend office-letter PDF export with the frontend A4 print-export behavior.

- [ ] **Step 5: Run backend tests green**

Run: `pnpm --filter @almoxarifado/backend test -- src/entry-request-office-pdf.test.ts src/app.test.ts`
Expected: PASS.

### Task 6: Full Verification

**Files:**
- Verify all touched files.

- [ ] **Step 1: Run frontend focused tests**

Run: `pnpm --filter @almoxarifado/frontend test -- src/lib/office-letter.test.ts src/pages/requests-page.test.tsx src/pages/office-letter-print-page.test.tsx src/pages/settings-page.test.tsx`
Expected: PASS.

- [ ] **Step 2: Run backend focused tests**

Run: `pnpm --filter @almoxarifado/backend test -- src/entry-request-office-pdf.test.ts src/app.test.ts`
Expected: PASS.

- [ ] **Step 3: Run package builds**

Run: `pnpm --filter @almoxarifado/backend build`
Expected: PASS.

Run: `pnpm --filter @almoxarifado/frontend build`
Expected: PASS.

- [ ] **Step 4: Run whitespace check**

Run: `git diff --check`
Expected: no whitespace errors.

