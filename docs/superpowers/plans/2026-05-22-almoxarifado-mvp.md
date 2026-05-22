# Almoxarifado Municipal MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable municipal warehouse-control MVP with a React/shadcn frontend, Express/Prisma backend, SQLite data, stock movement rules, and seeded examples.

**Architecture:** The repository is a `pnpm` workspace with a backend that owns validation and stock invariants and a frontend that presents dashboard, CRUD, and warehouse-operation flows through a responsive shadcn-style shell. Prisma models current stock balances separately from immutable movement history so the UI can read fast balances while operational updates remain auditable.

**Tech Stack:** pnpm workspaces, React, Vite, TypeScript, Tailwind CSS, shadcn/ui, Express, Prisma, SQLite, Vitest, Supertest.

---

## File Map

- Root workspace files: `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `README.md`.
- Backend app config: `apps/backend/package.json`, `apps/backend/tsconfig.json`, `apps/backend/vitest.config.ts`, `apps/backend/.env.example`.
- Backend data layer: `apps/backend/prisma/schema.prisma`, `apps/backend/prisma/seed.ts`, `apps/backend/prisma/migrations/**`.
- Backend runtime: `apps/backend/src/server.ts`, `apps/backend/src/app.ts`, `apps/backend/src/lib/**`, `apps/backend/src/routes/**`, `apps/backend/src/services/**`, `apps/backend/src/validators/**`.
- Backend tests: `apps/backend/src/**/*.test.ts`, focused on product codes, warehouse-general rule, and movement services/routes.
- Frontend app config: `apps/frontend/package.json`, `apps/frontend/vite.config.ts`, `apps/frontend/tsconfig*.json`, `apps/frontend/tailwind.config.ts`, `apps/frontend/components.json`.
- Frontend runtime: `apps/frontend/src/main.tsx`, `apps/frontend/src/App.tsx`, `apps/frontend/src/lib/**`, `apps/frontend/src/components/**`, `apps/frontend/src/pages/**`.
- Frontend tests: `apps/frontend/src/**/*.test.tsx`, focused on general-warehouse dashboard ordering and transfer-tab visibility.

### Task 1: Workspace Foundation

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `apps/backend/package.json`
- Create: `apps/frontend/package.json`
- Create: `README.md`

- [ ] **Step 1: Add workspace scripts and package manifests**

```json
{
  "name": "almoxarifado-prefeitura",
  "private": true,
  "packageManager": "pnpm@10.11.0",
  "scripts": {
    "dev": "pnpm --parallel --filter @almoxarifado/backend --filter @almoxarifado/frontend dev",
    "dev:backend": "pnpm --filter @almoxarifado/backend dev",
    "dev:frontend": "pnpm --filter @almoxarifado/frontend dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "db:migrate": "pnpm --filter @almoxarifado/backend db:migrate",
    "db:seed": "pnpm --filter @almoxarifado/backend db:seed"
  }
}
```

- [ ] **Step 2: Configure workspace membership**

```yaml
packages:
  - apps/*
```

- [ ] **Step 3: Add focused ignore rules**

```gitignore
node_modules
dist
.env
*.db
*.db-journal
coverage
apps/backend/prisma/dev.db
```

- [ ] **Step 4: Add backend and frontend dependency manifests**

```json
{
  "name": "@almoxarifado/backend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "test": "vitest run",
    "db:migrate": "prisma migrate dev",
    "db:seed": "prisma db seed",
    "db:generate": "prisma generate"
  }
}
```

```json
{
  "name": "@almoxarifado/frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "test": "vitest run"
  }
}
```

- [ ] **Step 5: Install declared dependencies**

Run: `pnpm install`

Expected: workspace dependencies install successfully and a lockfile is created.

### Task 2: Prisma Schema And Seed

**Files:**
- Create: `apps/backend/prisma/schema.prisma`
- Create: `apps/backend/prisma/seed.ts`
- Create: `apps/backend/.env.example`
- Create: `apps/backend/src/lib/prisma.ts`

- [ ] **Step 1: Describe SQLite connection and Prisma generator**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

- [ ] **Step 2: Model warehouses, products, stocks, users, and movement history**

```prisma
enum MovementType {
  ENTRADA
  SAIDA
  TRANSFERENCIA_SAIDA
  TRANSFERENCIA_ENTRADA
}

model Stock {
  id               String   @id @default(cuid())
  warehouseId      String
  productId        String
  currentQuantity  Int      @default(0)
  minimumQuantity  Int      @default(0)
  lastMovementAt   DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  warehouse        Warehouse @relation(fields: [warehouseId], references: [id])
  product          Product @relation(fields: [productId], references: [id])

  @@unique([warehouseId, productId])
}
```

- [ ] **Step 3: Add seed records with one general warehouse and example stock**

```ts
await prisma.warehouse.upsert({
  where: { name: "Almoxarifado Central" },
  update: { isGeneral: true, active: true },
  create: {
    name: "Almoxarifado Central",
    description: "Estoque central da prefeitura",
    categoryId: generalCategory.id,
    isGeneral: true,
    active: true,
  },
});
```

- [ ] **Step 4: Generate client and create initial migration**

Run: `pnpm db:migrate -- --name init`

Expected: Prisma creates SQLite tables, migration files, and client artifacts.

- [ ] **Step 5: Seed data**

Run: `pnpm db:seed`

Expected: admin, categories, units, warehouses, products, and initial central stocks are inserted.

### Task 3: Backend Domain Rules With TDD

**Files:**
- Create: `apps/backend/src/lib/errors.ts`
- Create: `apps/backend/src/services/product-code.ts`
- Create: `apps/backend/src/services/product-service.ts`
- Create: `apps/backend/src/services/warehouse-service.ts`
- Create: `apps/backend/src/services/movement-service.ts`
- Test: `apps/backend/src/services/product-code.test.ts`
- Test: `apps/backend/src/services/warehouse-service.test.ts`
- Test: `apps/backend/src/services/movement-service.test.ts`

- [ ] **Step 1: Write a failing code-generation test**

```ts
import { describe, expect, it } from "vitest";
import { nextProductCode } from "./product-code";

describe("nextProductCode", () => {
  it("formats the next sequence as seven digits", () => {
    expect(nextProductCode("0000042")).toBe("0000043");
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @almoxarifado/backend test -- src/services/product-code.test.ts`

Expected: FAIL because `nextProductCode` does not exist yet.

- [ ] **Step 3: Implement the minimal code formatter**

```ts
export function nextProductCode(lastCode?: string | null) {
  const next = Number(lastCode ?? "0") + 1;
  if (next > 9_999_999) {
    throw new Error("Limite de códigos de produto atingido.");
  }
  return String(next).padStart(7, "0");
}
```

- [ ] **Step 4: Add failing service tests for stock invariants**

```ts
it("rejects transfer from a non-general warehouse", async () => {
  await expect(
    transferStock(prisma, {
      sourceWarehouseId: healthWarehouse.id,
      destinationWarehouseId: educationWarehouse.id,
      productId: paper.id,
      quantity: 1,
      movementDate: new Date(),
      userId: admin.id,
    }),
  ).rejects.toThrow("Apenas o almoxarifado geral pode transferir produtos.");
});
```

- [ ] **Step 5: Run service tests and verify RED**

Run: `pnpm --filter @almoxarifado/backend test -- src/services/warehouse-service.test.ts src/services/movement-service.test.ts`

Expected: FAIL because warehouse and movement services are absent.

- [ ] **Step 6: Implement minimal warehouse and movement services**

```ts
if (data.isGeneral) {
  const existingGeneral = await prisma.warehouse.findFirst({
    where: { isGeneral: true, NOT: id ? { id } : undefined },
  });
  if (existingGeneral) {
    throw new AppError(409, "Já existe um almoxarifado geral cadastrado.");
  }
}
```

```ts
if (!source.isGeneral) {
  throw new AppError(403, "Apenas o almoxarifado geral pode transferir produtos.");
}
if (!sourceStock || sourceStock.currentQuantity < input.quantity) {
  throw new AppError(409, "Quantidade insuficiente em estoque.");
}
```

- [ ] **Step 7: Re-run backend service tests and verify GREEN**

Run: `pnpm --filter @almoxarifado/backend test -- src/services/product-code.test.ts src/services/warehouse-service.test.ts src/services/movement-service.test.ts`

Expected: PASS.

### Task 4: Backend REST API

**Files:**
- Create: `apps/backend/src/app.ts`
- Create: `apps/backend/src/server.ts`
- Create: `apps/backend/src/lib/http.ts`
- Create: `apps/backend/src/routes/*.ts`
- Create: `apps/backend/src/validators/*.ts`
- Test: `apps/backend/src/app.test.ts`

- [ ] **Step 1: Write failing route tests for login, products, stocks, and transfer denial**

```ts
it("returns a mock user from login", async () => {
  const response = await request(app).post("/auth/login").send({
    email: "admin@prefeitura.local",
    password: "admin",
  });
  expect(response.status).toBe(200);
  expect(response.body.user.name).toBe("Administrador");
});
```

- [ ] **Step 2: Run route tests and verify RED**

Run: `pnpm --filter @almoxarifado/backend test -- src/app.test.ts`

Expected: FAIL because the Express app and routes do not exist.

- [ ] **Step 3: Implement Express composition and error middleware**

```ts
app.use(express.json());
app.use(cors());
app.use("/auth", authRoutes);
app.use("/warehouses", warehouseRoutes);
app.use("/products", productRoutes);
app.use("/movements", movementRoutes);
app.use(errorHandler);
```

- [ ] **Step 4: Implement CRUD routes and validators**

```ts
router.post("/", asyncHandler(async (req, res) => {
  const data = warehouseInput.parse(req.body);
  res.status(201).json(await createWarehouse(prisma, data));
}));
```

- [ ] **Step 5: Implement stock and movement endpoints**

```ts
router.post("/transfer", asyncHandler(async (req, res) => {
  const input = transferInput.parse(req.body);
  res.status(201).json(await transferStock(prisma, withMockUser(input)));
}));
```

- [ ] **Step 6: Re-run backend route tests and verify GREEN**

Run: `pnpm --filter @almoxarifado/backend test -- src/app.test.ts`

Expected: PASS.

### Task 5: Frontend Shell And API Client

**Files:**
- Create: `apps/frontend/src/main.tsx`
- Create: `apps/frontend/src/App.tsx`
- Create: `apps/frontend/src/index.css`
- Create: `apps/frontend/src/lib/api.ts`
- Create: `apps/frontend/src/lib/types.ts`
- Create: `apps/frontend/src/components/layout/app-shell.tsx`
- Create: `apps/frontend/src/components/ui/**`

- [ ] **Step 1: Scaffold Vite, Tailwind, aliases, and shadcn component foundation**

```ts
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { port: 5173 },
});
```

- [ ] **Step 2: Add API client primitives**

```ts
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message ?? "Não foi possível concluir a operação.");
  }
  return response.json() as Promise<T>;
}
```

- [ ] **Step 3: Build the navigation shell**

```tsx
const items = [
  ["Dashboard", "/dashboard"],
  ["Almoxarifados", "/warehouses"],
  ["Produtos", "/products"],
  ["Categorias", "/categories"],
  ["Unidades", "/units"],
  ["Movimentações", "/movements"],
];
```

- [ ] **Step 4: Verify the frontend type build**

Run: `pnpm --filter @almoxarifado/frontend build`

Expected: build reaches the application compiler with no config errors.

### Task 6: Frontend Login And Dashboard With TDD

**Files:**
- Create: `apps/frontend/src/pages/login-page.tsx`
- Create: `apps/frontend/src/pages/dashboard-page.tsx`
- Test: `apps/frontend/src/pages/dashboard-page.test.tsx`

- [ ] **Step 1: Write failing dashboard ordering test**

```tsx
it("shows the general warehouse before smaller warehouse cards", () => {
  render(<DashboardContent warehouses={[healthWarehouse, centralWarehouse]} />);
  const cards = screen.getAllByRole("article");
  expect(cards[0]).toHaveTextContent("Almoxarifado Central");
  expect(cards[0]).toHaveTextContent("Geral");
});
```

- [ ] **Step 2: Run the dashboard test and verify RED**

Run: `pnpm --filter @almoxarifado/frontend test -- src/pages/dashboard-page.test.tsx`

Expected: FAIL because dashboard components do not exist.

- [ ] **Step 3: Implement login page and dashboard content**

```tsx
const generalWarehouse = warehouses.find((warehouse) => warehouse.isGeneral);
const regularWarehouses = warehouses.filter((warehouse) => !warehouse.isGeneral);
```

- [ ] **Step 4: Re-run dashboard test and verify GREEN**

Run: `pnpm --filter @almoxarifado/frontend test -- src/pages/dashboard-page.test.tsx`

Expected: PASS.

### Task 7: Frontend CRUD And Warehouse Operations

**Files:**
- Create: `apps/frontend/src/pages/warehouses-page.tsx`
- Create: `apps/frontend/src/pages/warehouse-detail-page.tsx`
- Create: `apps/frontend/src/pages/products-page.tsx`
- Create: `apps/frontend/src/pages/categories-page.tsx`
- Create: `apps/frontend/src/pages/units-page.tsx`
- Create: `apps/frontend/src/pages/movements-page.tsx`
- Create: `apps/frontend/src/components/forms/**`
- Test: `apps/frontend/src/pages/warehouse-detail-page.test.tsx`

- [ ] **Step 1: Write failing non-general transfer visibility test**

```tsx
it("hides the transfer tab outside the general warehouse", () => {
  render(<WarehouseTabs warehouse={{ ...warehouse, isGeneral: false }} />);
  expect(screen.queryByText("Transferir para outro almoxarifado")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the warehouse detail test and verify RED**

Run: `pnpm --filter @almoxarifado/frontend test -- src/pages/warehouse-detail-page.test.tsx`

Expected: FAIL because the tabs component does not exist.

- [ ] **Step 3: Implement CRUD pages with dialogs, tables, badges, and forms**

```tsx
<Dialog>
  <DialogTrigger asChild><Button>Novo produto</Button></DialogTrigger>
  <ProductForm onSaved={reloadProducts} />
</Dialog>
```

- [ ] **Step 4: Implement warehouse operation tabs and stock-state badges**

```tsx
{warehouse.isGeneral && (
  <TabsTrigger value="transfer">Transferir para outro almoxarifado</TabsTrigger>
)}
```

- [ ] **Step 5: Implement movement filters**

```tsx
api<Movement[]>(`/movements?warehouseId=${warehouseId}&type=${type}&from=${from}&to=${to}`);
```

- [ ] **Step 6: Re-run frontend tests and verify GREEN**

Run: `pnpm --filter @almoxarifado/frontend test -- src/pages/dashboard-page.test.tsx src/pages/warehouse-detail-page.test.tsx`

Expected: PASS.

### Task 8: README, Build, And End-To-End Local Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document setup and run commands**

```md
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- [ ] **Step 2: Run full backend and frontend test suites**

Run: `pnpm test`

Expected: backend and frontend tests pass.

- [ ] **Step 3: Run production builds**

Run: `pnpm build`

Expected: backend TypeScript output and frontend Vite build complete.

- [ ] **Step 4: Start local backend and frontend servers**

Run: `pnpm dev`

Expected: backend API listens locally and frontend is available at its Vite URL.

- [ ] **Step 5: Verify main flows in the browser**

Expected:

- Mock login reaches dashboard.
- General warehouse card appears first and larger.
- Non-general warehouse detail hides transfer controls.
- General warehouse can create a transfer.
- Movement history updates after stock operations.

