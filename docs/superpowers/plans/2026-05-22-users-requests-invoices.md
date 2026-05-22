# Users, Requests, And Invoices Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add credential login, admin/operator permissions, warehouse-scoped operators, pending entry approvals, pending transfer receipts, optional reusable invoices, notifications, user management, and modal-first warehouse actions.

**Architecture:** Prisma gains explicit role, assignment, request, invoice, and receipt models while stock movements remain the audit trail for effective stock mutations only. Express receives auth and scope middleware plus request services that approve or receive work transactionally; React reads authenticated session data to filter navigation and render shadcn-style dialogs, request tables, and header pending-work notifications.

**Tech Stack:** React, Vite, TypeScript, Tailwind CSS, shadcn/ui-style components, Express, Prisma, SQLite, bcryptjs, jose/JWT, Vitest, Supertest.

---

## File Map

- Data model and seed: `apps/backend/prisma/schema.prisma`, `apps/backend/prisma/seed.ts`, `apps/backend/prisma/migrations/**`.
- Backend auth and permissions: `apps/backend/src/lib/auth.ts`, `apps/backend/src/lib/http.ts`, `apps/backend/src/services/auth-service.ts`, `apps/backend/src/services/user-service.ts`.
- Backend requests: `apps/backend/src/services/entry-request-service.ts`, `apps/backend/src/services/transfer-request-service.ts`, request routes and validators.
- Backend protected data routes: warehouse, product, category, unit, stock, movement, invoice, user routes.
- Frontend session and shell: `apps/frontend/src/lib/session.tsx`, `apps/frontend/src/components/layout/app-shell.tsx`, API client and types.
- Frontend feature pages: `users-page.tsx`, `requests-page.tsx`, `warehouse-detail-page.tsx`, login/dashboard/movements pages.

### Task 1: Prisma And Auth Foundation

**Files:**
- Modify: `apps/backend/prisma/schema.prisma`
- Modify: `apps/backend/prisma/seed.ts`
- Modify: `apps/backend/package.json`
- Create: `apps/backend/src/lib/auth.ts`
- Create: `apps/backend/src/services/auth-service.ts`
- Test: `apps/backend/src/services/auth-service.test.ts`

- [ ] **Step 1: Add failing login/password test**

```ts
it("authenticates active users by password", async () => {
  const user = await createAdmin(prisma, "senha123");
  const session = await loginWithPassword(prisma, user.email, "senha123");
  expect(session.user.role).toBe(UserRole.ADMIN);
});
```

- [ ] **Step 2: Run focused backend test and verify RED**

Run: `pnpm --filter @almoxarifado/backend test -- src/services/auth-service.test.ts`

Expected: FAIL because auth service and role fields do not exist.

- [ ] **Step 3: Add role, assignments, request, invoice, and token dependencies**

```prisma
enum UserRole { ADMIN OPERATOR }
enum RequestStatus { PENDING APPROVED REJECTED }
enum TransferRequestStatus { PENDING_RECEIPT RECEIVED CANCELLED }
```

- [ ] **Step 4: Generate migration and seed admin/operator credentials**

Run: `pnpm db:migrate -- --name auth_requests_invoices`

Expected: schema migrates and seed credentials are available.

- [ ] **Step 5: Implement password hash and JWT session helpers**

```ts
export async function loginWithPassword(prisma, email, password) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active || !(await compare(password, user.passwordHash))) {
    throw new AppError(401, "Email ou senha invalidos.");
  }
  return createSession(user);
}
```

### Task 2: Permission And User CRUD

**Files:**
- Create: `apps/backend/src/services/user-service.ts`
- Create: `apps/backend/src/routes/user-routes.ts`
- Modify: `apps/backend/src/routes/auth-routes.ts`
- Modify: protected backend routes and validators
- Test: `apps/backend/src/app.test.ts`

- [ ] **Step 1: Add failing API tests for operator warehouse filtering and admin-only CRUD**

```ts
expect((await request(app).get("/warehouses").set(operatorAuth)).body).toHaveLength(1);
expect((await request(app).post("/products").set(operatorAuth).send(payload)).status).toBe(403);
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @almoxarifado/backend test -- src/app.test.ts`

Expected: FAIL because auth headers and restrictions are not enforced.

- [ ] **Step 3: Implement auth middleware and warehouse-scope helpers**

```ts
app.use(authenticate);
requireRole(UserRole.ADMIN);
assertWarehouseAccess(user, warehouseId);
```

- [ ] **Step 4: Implement admin user CRUD with operator assignments**

```ts
await prisma.user.create({
  data: {
    role: input.role,
    warehouseAssignments: { create: input.warehouseIds.map((warehouseId) => ({ warehouseId })) },
  },
});
```

- [ ] **Step 5: Re-run protected-route tests and verify GREEN**

Run: `pnpm --filter @almoxarifado/backend test -- src/app.test.ts`

Expected: PASS.

### Task 3: Entry Requests And Invoices With TDD

**Files:**
- Create: `apps/backend/src/services/entry-request-service.ts`
- Create: `apps/backend/src/routes/entry-request-routes.ts`
- Create: `apps/backend/src/routes/invoice-routes.ts`
- Modify: `apps/backend/src/services/movement-service.ts`
- Modify: validators
- Test: `apps/backend/src/services/entry-request-service.test.ts`

- [ ] **Step 1: Write failing request and approval tests**

```ts
it("creates an operator entry request without changing stock", async () => {
  await requestEntry(prisma, operator, input);
  expect(await prisma.stock.count()).toBe(0);
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @almoxarifado/backend test -- src/services/entry-request-service.test.ts`

Expected: FAIL because request service is absent.

- [ ] **Step 3: Implement invoice creation/listing and optional movement linkage**

```ts
invoiceId: input.invoiceId ?? undefined
```

- [ ] **Step 4: Implement entry-request create, approve, and reject services/routes**

```ts
const effectiveEntry = await createEntry(transaction, approvedInput);
await transaction.entryRequest.update({ data: { status: "APPROVED", reviewedById: admin.id } });
```

- [ ] **Step 5: Re-run entry request tests and verify GREEN**

Run: `pnpm --filter @almoxarifado/backend test -- src/services/entry-request-service.test.ts`

Expected: PASS.

### Task 4: Pending Transfers And Notifications

**Files:**
- Create: `apps/backend/src/services/transfer-request-service.ts`
- Create: `apps/backend/src/routes/transfer-request-routes.ts`
- Create: `apps/backend/src/routes/request-summary-routes.ts`
- Modify: existing movement transfer route
- Test: `apps/backend/src/services/transfer-request-service.test.ts`

- [ ] **Step 1: Write failing pending-transfer tests**

```ts
it("keeps stock unchanged until destination receives the transfer", async () => {
  await createTransferRequest(prisma, admin, input);
  expect(sourceStock.currentQuantity).toBe(10);
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @almoxarifado/backend test -- src/services/transfer-request-service.test.ts`

Expected: FAIL because transfer request service is absent.

- [ ] **Step 3: Implement pending transfer creation and authorized receipt transaction**

```ts
if (!canAccessWarehouse(receiver, request.destinationWarehouseId)) throw new AppError(403, ...);
await createTransferMovements(transaction, request, receiver);
```

- [ ] **Step 4: Implement request summary for header pending counts**

```ts
return { pendingEntryRequests, pendingReceipts, total };
```

- [ ] **Step 5: Re-run transfer request tests and verify GREEN**

Run: `pnpm --filter @almoxarifado/backend test -- src/services/transfer-request-service.test.ts`

Expected: PASS.

### Task 5: Frontend Session, Navigation, And Users

**Files:**
- Create: `apps/frontend/src/lib/session.tsx`
- Create: `apps/frontend/src/pages/users-page.tsx`
- Modify: `login-page.tsx`, `App.tsx`, `app-shell.tsx`, frontend types/API
- Test: `apps/frontend/src/components/layout/app-shell.test.tsx`

- [ ] **Step 1: Write failing operator-navigation test**

```tsx
expect(screen.queryByText("Produtos")).not.toBeInTheDocument();
expect(screen.queryByText("Usuarios")).not.toBeInTheDocument();
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @almoxarifado/frontend test -- src/components/layout/app-shell.test.tsx`

Expected: FAIL before role-aware navigation exists.

- [ ] **Step 3: Add session provider and authenticated API headers**

```ts
headers: { Authorization: `Bearer ${session.token}` }
```

- [ ] **Step 4: Implement admin-only user page with assignment dialog**

- [ ] **Step 5: Re-run navigation test and verify GREEN**

### Task 6: Frontend Requests, Notifications, And Modal Operations

**Files:**
- Create: `apps/frontend/src/pages/requests-page.tsx`
- Modify: `apps/frontend/src/pages/warehouse-detail-page.tsx`
- Modify: `apps/frontend/src/components/layout/app-shell.tsx`
- Test: warehouse detail and request notification tests

- [ ] **Step 1: Write failing role-specific warehouse action test**

```tsx
expect(screen.getByText("Solicitar entrada")).toBeInTheDocument();
expect(screen.queryByText("Entrada de estoque")).not.toBeInTheDocument();
```

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Move entry/output/transfer actions into dialogs**

- [ ] **Step 4: Add invoice modal/select fields**

- [ ] **Step 5: Add requests page for approvals and receipt confirmation**

- [ ] **Step 6: Add header notifications from request summary**

- [ ] **Step 7: Re-run frontend tests and verify GREEN**

### Task 7: Docs And Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document seeded credentials and new request workflows**

- [ ] **Step 2: Run full tests**

Run: `pnpm test`

Expected: all backend and frontend tests pass.

- [ ] **Step 3: Run production build**

Run: `pnpm build`

Expected: backend TypeScript and frontend Vite builds pass.

- [ ] **Step 4: Seed and browser-verify admin and operator flows**

Expected:

- Admin login reaches full navigation and users page.
- Operator login shows scoped navigation and assigned warehouse only.
- Operator entry request stays pending until admin approves.
- Transfer stays pending until destination-side receipt confirmation.

