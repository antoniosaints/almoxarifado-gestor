# Users, Requests, And Invoices Expansion Design

## Goal

Extend the municipal warehouse MVP with real simple user login, role-based access,
warehouse-scoped operators, pending stock-entry requests, pending transfer receipt
confirmation, invoice metadata, modal-first operational actions, and lightweight
internal notifications.

## Approved Decisions

- New users authenticate with email and password.
- `ADMIN` and `OPERATOR` are the first roles.
- Admins can always access the general warehouse and all administrative areas.
- Operators access only explicitly assigned warehouses.
- Operator stock entries become approval requests.
- Admins may still register stock entries directly.
- A transfer does not change stock until the destination confirms receipt.
- Transfer acceptance records the receiver user and receipt date/time.
- Invoice data is optional and may be shared by multiple stock entries.
- The UI continues to follow shadcn dashboard/block patterns.

## Scope

This expansion includes:

- User CRUD for admins.
- Login with user credentials and backend permission checks.
- User-to-warehouse assignment for operators.
- Menu and data filtering by role and warehouse scope.
- Entry-request approval flow.
- Transfer receipt-confirmation flow.
- Requests page and header pending-work notifications.
- Modal-first entry, output, transfer, request, and receipt actions.
- Optional invoice records reusable across multiple approved entries.

This expansion does not include:

- Password reset, email verification, multi-factor login, or production-grade
  identity lifecycle.
- Granular permissions beyond the two approved roles.
- External notification delivery by email, WhatsApp, or push.
- Full procurement or fiscal document workflows.

## Architecture

The backend remains the authority for every permission and stock invariant. The
frontend may hide disallowed pages and actions, but protected endpoints must also
reject disallowed requests.

### Authentication

`POST /auth/login` validates email and password and returns authenticated session
data for the frontend. Passwords are stored hashed. For this MVP, token handling
may remain intentionally small, but protected routes must be able to identify:

- User id.
- User role.
- Active status.
- Operator warehouse scope.

### Role Rules

`ADMIN`:

- Accesses the full dashboard and every warehouse.
- Always accesses the general warehouse.
- Manages users, warehouses, products, categories, units, and direct entries.
- Approves or rejects operator entry requests.
- Creates outbound transfers from the general warehouse.
- May confirm transfer receipts.

`OPERATOR`:

- Accesses only warehouses assigned through `UserWarehouse`.
- Reads stock and movements only for assigned warehouses.
- Creates ad hoc outputs only in assigned warehouses.
- Creates stock-entry requests only in assigned warehouses.
- Confirms transfer receipts only when the destination warehouse is assigned.
- Cannot manage users, warehouses, products, categories, or units.

## Domain Model

### Existing Models Updated

`User` gains:

- Password hash.
- Role.
- Active flag.
- Warehouse assignments.
- Relations to created requests, reviewed requests, and accepted receipts.

`StockMovement` remains the effective audit trail of stock changes. Pending
requests must not be represented as stock movements before they change stock.
Effective entry movements gain an optional invoice relation so direct entries and
approved entry requests can retain fiscal-document context after stock changes.

### New Models

`UserRole` enum:

- `ADMIN`.
- `OPERATOR`.

`UserWarehouse`:

- `userId`.
- `warehouseId`.
- Unique pair constraint.

`RequestStatus` enum:

- `PENDING`.
- `APPROVED`.
- `REJECTED`.

`TransferRequestStatus` enum:

- `PENDING_RECEIPT`.
- `RECEIVED`.
- `CANCELLED` if an admin cancels an unresolved transfer request.

`EntryRequest`:

- Target warehouse.
- Product.
- Quantity.
- Observation.
- Requested movement date.
- Requesting user.
- Optional reviewing admin.
- Status, decision date, and rejection note when rejected.
- Optional invoice relation.

`TransferRequest`:

- Source warehouse.
- Destination warehouse.
- Product.
- Quantity.
- Observation.
- Requested movement date.
- Creating admin.
- Status.
- Optional receiving user and received timestamp.

`Invoice`:

- Company name.
- CNPJ.
- Invoice number.
- Invoice date.
- Optional observation.
- Relation to multiple direct entries and approved entry requests.

### Notes On Invoice Linking

Invoice metadata belongs to the fiscal document, not to one stock line. The MVP
must allow an invoice to be selected or created while preparing a direct stock
entry or an entry request. More than one approved entry may reference the same
invoice.

## Entry Flow

### Admin Direct Entry

1. Admin opens an entry modal from a warehouse detail view.
2. Admin selects product and quantity, enters movement data and observation, and
   optionally links or creates an invoice.
3. Backend validates admin role and stock data.
4. Stock is created or incremented immediately.
5. An `ENTRADA` movement is recorded with the admin as responsible user and the
   invoice relation when provided.

### Operator Entry Request

1. Operator opens `Solicitar entrada` from an assigned warehouse.
2. Operator selects product and quantity, movement data, observation, and
   optional invoice.
3. Backend validates operator access to the warehouse.
4. `EntryRequest` is created as `PENDING`.
5. Stock is unchanged.
6. Admin sees the request on `Solicitações` and through the header pending-work
   notifications.
7. Admin approval revalidates the referenced records, increments stock, creates
   the `ENTRADA` movement, and stores review metadata.
8. Admin rejection stores the reviewer, decision date, and rejection context
   without changing stock.

## Transfer Flow

1. Admin opens transfer modal from the general warehouse.
2. Admin chooses destination, product, quantity, observation, and requested date.
3. Backend validates that source is general and destination differs from source.
4. `TransferRequest` is created as pending.
5. Source and destination stock remain unchanged.
6. Authorized destination-side users see a receipt pending item in the requests
   view and header pending-work notifications.
7. Receipt confirmation revalidates that the receiving user may access the
   destination and that the source stock still has enough quantity.
8. On successful acceptance, backend subtracts source stock, creates or increments
   destination stock, creates `TRANSFERENCIA_SAIDA` and
   `TRANSFERENCIA_ENTRADA`, stores receiving user and timestamp, and marks the
   transfer received.
9. If source stock is no longer sufficient at receipt time, acceptance fails with
   a friendly message and the request remains unresolved.

## API Direction

The existing REST style remains, with new route families such as:

- `/users` for admin user CRUD.
- `/entry-requests` for operator creation and admin decisions.
- `/transfer-requests` for admin creation and destination receipt.
- `/invoices` for invoice lookup and creation.
- `/notifications` or `/requests/summary` for pending counts and list snippets.

Existing warehouse, movement, stock, product, category, and unit routes must
filter or reject based on authenticated user role and warehouse scope.

## Frontend UX

### Navigation

Admin navigation gains:

- `Usuários`.
- `Solicitações`.

Operator navigation exposes:

- Dashboard.
- Assigned warehouses.
- Movements scoped to assignments.
- Requests relevant to the operator.

Operator navigation does not expose product, unit, category, or user management.

### Header Notifications

The header gains a bell-style pending-work control:

- Badge/count for pending items.
- Short list of pending entry requests for admins.
- Short list of pending receipt confirmations for destination-side users.
- Links into the requests page or relevant detail panel.

For the MVP, the list and count may be derived from pending request tables rather
than persisted as a separate notification inbox.

### Requests Page

Admin requests view:

- Pending operator entry requests.
- Approve and reject actions.
- Clear requester, warehouse, product, quantity, date, invoice, and observation
  context.

Operator requests view:

- Their own entry requests and decision status.
- Pending transfer receipts for assigned destination warehouses.
- Receipt confirmation modal.

### Modal-First Operations

Current inline forms in warehouse operation tabs move into dialogs:

- Direct stock entry.
- Operator stock-entry request.
- Ad hoc stock output.
- General-warehouse transfer.
- Transfer receipt acceptance.
- Invoice create/select flow.

Tabs remain useful for context, stock, and history, but creation and decision
actions should be opened through clear buttons.

## Error Handling

Friendly backend failures include:

- User lacks access to a warehouse.
- Operator attempts admin-only CRUD.
- Non-admin attempts direct entry or outbound transfer.
- Transfer receipt fails because origin stock became insufficient.
- Duplicate user email.
- Invalid invoice data or malformed CNPJ fields.

Frontend dialogs must preserve entered data on recoverable failures and surface
messages close to the action.

## Verification

Backend tests must cover:

- Admin user permissions and guaranteed general-warehouse access.
- Operator warehouse filtering.
- Operator rejection from product, unit, category, warehouse, and user CRUD.
- Operator entry request creation without stock mutation.
- Admin entry-request approval mutating stock and movement history.
- Pending transfer creation without stock mutation.
- Authorized receipt acceptance mutating both stocks and recording receiver and
  timestamp.
- Unauthorized receipt acceptance rejection.
- Movement listing filtered to operator warehouses.
- Optional invoice reuse across more than one effective entry.

Frontend tests should cover:

- Operator navigation hides admin-only menus.
- Modal action for entry/request differs by role.
- Pending receipt and entry-request notification counts render from request
  summary data.
- Receipt controls appear only for relevant transfer destinations.

## Delivery Notes

Implementation should update:

- Prisma schema, migration, seed, and tests.
- Auth and permission middleware/services.
- REST endpoints and frontend API types.
- Header notifications and requests page.
- User management page.
- Warehouse operation dialogs.
- README with seeded admin/operator credentials and updated flows.
