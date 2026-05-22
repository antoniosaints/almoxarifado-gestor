# Almoxarifado Municipal MVP Design

## Goal

Build a local-first MVP for municipal warehouse and stock control with a clean operational interface for warehouses, products, stock balances, stock entries, ad hoc outputs, transfers, and movement history.

The MVP must be runnable as a `pnpm` monorepo with:

- `apps/frontend`: React, Vite, TypeScript, Tailwind CSS, and shadcn/ui.
- `apps/backend`: Node.js, TypeScript, Express, Prisma, and SQLite.

## Product Scope

The first release covers:

- Mock login that lands on a dashboard.
- Warehouse dashboard with a visually prominent general warehouse.
- CRUD for warehouses and warehouse categories.
- CRUD for products and product categories.
- CRUD for units of measure.
- Per-warehouse stock balances and stock minimum settings.
- Stock entry and ad hoc stock output.
- Transfer from the single general warehouse to another warehouse.
- Movement history with filters.
- Seed data and README setup instructions.

The MVP does not include:

- Real authentication, sessions, password management, or authorization roles.
- Purchase orders, suppliers, requisitions, approvals, or fiscal integrations.
- Multi-tenant municipal separation.
- Advanced reporting or export workflows.

## Architecture

The repository will be a `pnpm` workspace with separated frontend and backend applications.

### Backend

The backend uses Express with TypeScript and Prisma over SQLite. It exposes REST endpoints grouped by domain:

- `POST /auth/login`
- Warehouse and warehouse category CRUD routes.
- Product and product category CRUD routes.
- Unit of measure CRUD routes.
- Stock read and minimum-stock update routes.
- Movement read routes plus stock entry, output, and transfer routes.

Business rules live in backend services and are enforced independently of frontend visibility:

- At most one warehouse can be marked as general.
- Only the general warehouse can transfer products.
- Stock quantity can never become negative.
- Entry creates a stock row when the warehouse does not yet stock the product.
- Transfer creates destination stock when needed.
- Transfer updates balances and movement records inside a Prisma transaction.
- Product codes are backend-generated strings with exactly seven digits.

Validation will reject malformed payloads and return friendly messages for common operational failures such as insufficient quantity, duplicate category names, invalid destinations, and missing records.

### Frontend

The frontend uses React, Vite, TypeScript, Tailwind CSS, and shadcn/ui. The visual direction follows shadcn dashboard and login block patterns as reference, with a municipal operations tone: compact, clear, responsive, and scan-friendly.

The shell includes:

- Persistent sidebar navigation.
- Header with page context and mock user identity.
- Main content area with responsive cards, tables, forms, dialogs, sheets, tabs, badges, alerts, and separators.

Frontend routing centers the daily work around the dashboard and the warehouse detail view. The interface hides transfer controls for non-general warehouses but still depends on backend validation for correctness.

## Main Screens

### Login

The login page is intentionally simple. It accepts mock credentials or a minimal user action, calls `POST /auth/login`, stores enough mock user state for the MVP, and redirects to the dashboard.

### Dashboard

The dashboard displays warehouse cards after login.

- The single general warehouse appears first in a larger highlighted card.
- The general card shows a `Geral` badge.
- Other warehouses render below in smaller cards.
- Other warehouses are grouped visually by category when data permits.
- Each card exposes `Acessar almoxarifado`.

Each card summarizes:

- Warehouse name.
- Warehouse category.
- General status.
- Total products in stock.
- Products below minimum stock.
- Latest movement date.

### Warehouse Management

The warehouse management page provides CRUD for:

- Name.
- Description.
- Warehouse category.
- General warehouse marker.
- Active status.

The UI makes the general marker explicit and the backend prevents a second general warehouse from being created or updated into existence.

### Warehouse Detail

The warehouse detail page is the operational hub for a selected warehouse. It starts with summary cards and tabs:

- `Visão geral`.
- `Estoque`.
- `Entrada de estoque`.
- `Saída avulsa`.
- `Transferir para outro almoxarifado`, only for the general warehouse.
- `Histórico`.

Summary cards prioritize:

- Total products.
- Items below minimum stock.
- Items without stock.
- Entries in the current month.
- Outputs in the current month.

### Product Management

The product page provides CRUD for:

- Generated code, shown read-only.
- Name.
- Description.
- Product category.
- Unit of measure.
- Active status.

Product codes are not editable in the UI.

### Category Management

The category page contains separate areas or tabs for:

- Warehouse categories: name, description, optional visual color or icon label.
- Product categories: name and description.

### Unit Management

The unit page provides a small CRUD flow for unit name and abbreviation.

### Stock Views

Stocks show product, warehouse context, current quantity, minimum quantity, and last movement date. Each stock line exposes a clear state badge:

- Green for `Em estoque`.
- Yellow for `Baixo estoque`.
- Red for `Sem estoque`.

Minimum stock is configurable per product and warehouse.

### Movement History

The movement history page lists:

- Type.
- Product.
- Warehouse.
- Origin warehouse when applicable.
- Destination warehouse when applicable.
- Quantity.
- Observation.
- Date.
- Responsible mock user.

Filters include:

- Warehouse.
- Product.
- Movement type.
- Start date and end date.

## Data Model

Prisma will model:

- `User`.
- `Warehouse`.
- `WarehouseCategory`.
- `Product`.
- `ProductCategory`.
- `UnitOfMeasure`.
- `Stock`.
- `StockMovement`.

### Core Relations

- A warehouse category has many warehouses.
- A warehouse has many stocks and stock movements.
- A product category has many products.
- A unit of measure has many products.
- A product has many stocks and stock movements.
- Stock belongs to exactly one warehouse and one product.
- Stock movement belongs to a warehouse and product and may point to origin and destination warehouses.

### Core Constraints

- `Product.code` is unique and stored as a string.
- Generated product code format is exactly seven numeric digits, for example `0000001`.
- `Stock` has a unique compound constraint for `warehouseId` and `productId`.
- `Warehouse.isGeneral` is a boolean flag.
- Backend logic enforces that at most one warehouse has `isGeneral = true`.
- Primary operational models include `createdAt` and `updatedAt`.

### Movement Types

`MovementType` contains:

- `ENTRADA`.
- `SAIDA`.
- `TRANSFERENCIA_SAIDA`.
- `TRANSFERENCIA_ENTRADA`.

## Operational Flows

### Stock Entry

The entry form collects:

- Warehouse.
- Product.
- Quantity.
- Observation.
- Movement date.

Backend flow:

1. Validate warehouse, product, positive quantity, and date.
2. Find existing stock for warehouse and product.
3. Create stock with zero starting quantity when missing.
4. Add the entry quantity.
5. Update last movement date.
6. Create an `ENTRADA` movement with responsible mock user.

### Ad Hoc Stock Output

The output form collects:

- Warehouse.
- Product.
- Quantity.
- Destination or justification.
- Observation.
- Movement date.

Backend flow:

1. Validate warehouse, product, positive quantity, and date.
2. Require an existing stock balance with enough quantity.
3. Subtract quantity without allowing negative balances.
4. Update last movement date.
5. Create a `SAIDA` movement with the output context in observation fields available to the MVP.

Any warehouse may register this output.

### Transfer

The transfer form collects:

- General source warehouse.
- Destination warehouse.
- Product.
- Quantity.
- Observation.
- Movement date.

Frontend behavior:

- Show the transfer tab only for a general warehouse detail page.
- List only other warehouses as destinations.

Backend flow:

1. Validate positive quantity, product, source, destination, and date.
2. Reject source and destination equality.
3. Reject a source warehouse that is not general.
4. Require enough stock in source.
5. Subtract source stock.
6. Create destination stock if missing.
7. Add destination quantity.
8. Update last movement dates.
9. Create `TRANSFERENCIA_SAIDA` at source and `TRANSFERENCIA_ENTRADA` at destination.
10. Commit the full operation transactionally.

## Seed Data

Prisma seed includes:

- Mock admin user.
- Warehouse categories: Geral, Saúde, Educação, Obras.
- Warehouses:
  - Almoxarifado Central as the single general warehouse.
  - Almoxarifado da Saúde.
  - Almoxarifado da Educação.
  - Almoxarifado de Obras.
- Product categories:
  - Material de expediente.
  - Material de limpeza.
  - Medicamentos.
  - Merenda escolar.
- Units:
  - Unidade / UN.
  - Caixa / CX.
  - Pacote / PCT.
  - Litro / L.
  - Quilograma / KG.
- Example products with generated-format codes.
- Initial stock balances in the general warehouse.

## Error Handling

The API returns structured success and failure responses suitable for the React client. Domain failures use friendly Portuguese messages where the user needs them, including:

- `Já existe um almoxarifado geral cadastrado.`
- `Apenas o almoxarifado geral pode transferir produtos.`
- `Quantidade insuficiente em estoque.`
- `O estoque não pode ficar negativo.`
- `O almoxarifado de destino deve ser diferente da origem.`

Frontend forms surface errors near the affected workflow and preserve enough form context for a retry.

## Testing And Verification

Backend verification prioritizes stock correctness:

- Product code generation produces seven-digit codes.
- A second general warehouse is rejected.
- Entry creates missing stock and increments quantity.
- Output rejects insufficient quantity.
- Transfer rejects a non-general source.
- Transfer creates missing destination stock and records both transfer movements.

Frontend verification includes:

- Production build.
- Manual local login-to-dashboard flow.
- Dashboard rendering with highlighted general warehouse.
- Warehouse detail view hiding transfer controls for non-general warehouses.
- Successful entry, output, transfer, and movement-history visibility against seeded data.

## Delivery

The completed MVP includes:

- Monorepo workspace files at repository root.
- Functional backend and frontend apps.
- Prisma schema, migrations, SQLite configuration, and seed.
- shadcn/ui setup and main screens.
- README with local setup, migration, seed, and run commands.

