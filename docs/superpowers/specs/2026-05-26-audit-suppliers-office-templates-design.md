# Audit, Suppliers, And Office Templates Design

## Goal

Improve auditability around stock movements, make fiscal-note supplier data reusable,
and add configurable office-letter templates for future document generation flows.

## Approved Decisions

- The UI must continue using the existing shadcn-style components already present
  in the frontend.
- Manual invoice creation must require selecting an existing supplier.
- If the supplier does not exist during manual invoice creation, the user can create
  it quickly from the invoice flow.
- XML and CSV imports use the company data from the document.
- During XML and CSV imports, if the document CNPJ matches an existing supplier,
  the invoice is linked to that supplier automatically.
- During XML and CSV imports, if the document CNPJ does not match an existing
  supplier, the backend creates the supplier automatically from the document data
  and links the invoice to it.

## Scope

This feature includes:

- A supplier registry with list, create, update, and active/inactive status.
- Supplier selection and quick creation when manually creating invoices.
- Supplier linking for XML invoice import and warehouse CSV purchase import.
- Supplier-based filtering for invoices and invoice PDFs.
- A movement details action with a complete audit modal.
- A PDF export for one movement's audit details.
- A richer invoice-movements dialog that shows who performed each movement.
- A new settings tab for office-letter templates, with variable placeholders and
  a rich editor similar to Summernote.

This feature does not include:

- Generating real office letters from the templates in operational flows.
- Digital signing, protocol numbering, or official outbound-document delivery.
- Replacing invoice fiscal snapshots with live supplier data.
- A full fiscal validation service for CNPJ beyond uniqueness and required fields.

## Domain Model

### Supplier

Add `Supplier` as the reusable company registry:

- `id`
- `name`
- `tradeName`
- `cnpj` unique
- `stateRegistration`
- `municipalRegistration`
- `address`
- `city`
- `state`
- `zipCode`
- `phone`
- `email`
- `notes`
- `active`
- `createdAt`
- `updatedAt`

Supplier names and CNPJ are required. Optional fields mirror the invoice company
metadata so XML imports can populate suppliers without losing fiscal context.

### Invoice Supplier Link

`Invoice` gains a required `supplierId` relation for new records. The existing
company fields remain on `Invoice` as an immutable-ish fiscal snapshot of the
document at import/creation time:

- `companyName`
- `companyTradeName`
- `cnpj`
- registrations
- address fields
- phone

The backend writes these snapshot fields from the selected or imported supplier
when creating or updating invoice data. This keeps historical invoices stable if
the supplier registry is edited later.

Existing invoices from previous versions need a migration path. The migration
creates suppliers from distinct invoice CNPJs and links each invoice to the
matching supplier. If old invoices have blank or malformed CNPJs, the migration
uses the existing invoice company name with a generated `LEGACY-<invoice-id>`
supplier document only for the backfill, records that origin in supplier notes,
and future API validation still requires real CNPJ input.

### OfficeLetterTemplate

Add `OfficeLetterTemplate`:

- `id`
- `name`
- `description`
- `subject`
- `contentHtml`
- `variables`
- `active`
- `createdAt`
- `updatedAt`

`variables` stores a JSON string array of allowed placeholders used by the
template. The first supported variables are:

- `{{nome_empresa}}`
- `{{cnpj_empresa}}`
- `{{nome_fantasia_empresa}}`
- `{{numero_nota}}`
- `{{data_nota}}`
- `{{valor_nota}}`
- `{{data_atual}}`
- `{{usuario_logado}}`

The templates are only configured in this phase. Future flows can decide where
and how to render them.

## Backend API

### Suppliers

Add `/suppliers` routes behind authentication:

- `GET /suppliers` lists suppliers, supports `search`, `active`, `page`, and
  `limit`.
- `POST /suppliers` creates a supplier.
- `PUT /suppliers/:id` updates a supplier.
- `DELETE /suppliers/:id` deactivates a supplier when it is referenced by
  invoices, or deletes it only when it has no references.

Admins can manage suppliers. Operators can list active suppliers for invoice
selection when they are allowed to create stock entries in their warehouses.

### Invoices

Update invoice creation:

- `POST /invoices` requires `supplierId`.
- The backend fetches the supplier, validates it is active, and fills invoice
  company snapshot fields from the supplier.
- The response includes `supplier`.

Update invoice listing:

- `GET /invoices` includes `supplier`.
- Filters can include `supplierId`.
- Existing operator warehouse scoping remains unchanged.

XML import:

- Preview still returns company data from XML.
- Import resolves a supplier by normalized CNPJ.
- If found, the invoice links to that supplier and keeps the invoice snapshot
  from the XML document so the fiscal record matches the imported file.
- If not found, the backend creates a supplier from XML company fields and links
  the invoice.

CSV import:

- Preview continues to validate invoice company fields per row.
- Final import resolves or creates suppliers by each row group's CNPJ before
  creating invoices.
- Duplicate invoice protection remains based on CNPJ plus invoice number or
  invoice key where available.

### Movement Audit PDF

Add `GET /reports/movements/:id`:

- Enforces the same warehouse scope rules as movement listing.
- Loads one movement with product, unit, warehouse, source, destination, invoice,
  supplier, and responsible user.
- Generates a one-movement PDF containing the full audit record.

The existing `/reports/movements` list PDF remains unchanged except it may include
responsible user when layout permits.

### Office Templates

Add `/office-templates` routes for admins:

- `GET /office-templates`
- `POST /office-templates`
- `PUT /office-templates/:id`
- `DELETE /office-templates/:id`

The backend validates template name, subject, and HTML content. It extracts
`{{variable}}` tokens from `contentHtml` and stores the allowed list in
`variables`. Unknown variables are rejected with a friendly message.

## Frontend UX

### Suppliers

Supplier management follows the existing dashboard CRUD pattern:

- Header with title and action button.
- Search/filter block.
- Data table with supplier, CNPJ, contact, city/state, active state, and actions.
- Dialog form using existing shadcn fields.
- Toast or inline feedback through the current `ResourceError`/alert pattern.

The navigation can expose suppliers near invoices or settings depending on the
existing sidebar grouping. If adding a new sidebar item creates clutter, the
invoice creation dialog can still provide the quick-create supplier path, and
supplier full management can be reachable from the invoice page action area.

### Manual Invoice Creation

The manual invoice modal in the warehouse detail page changes from free-text
company/CNPJ inputs to:

- Supplier `SearchSelect`.
- `Novo fornecedor` quick-create button beside the supplier select.
- Invoice number.
- Issue date.
- Observation.

After quick-create succeeds, the modal selects the new supplier and keeps the
invoice draft intact.

### Invoice Filters

Invoice page and invoice export dialogs add supplier filters:

- Supplier `SearchSelect`.
- Search text continues to include invoice number, supplier name, trade name, and
  CNPJ.
- Existing date and movement-status filters remain.

### Movement Audit Modal

Each row in `MovementsTable` gets a view action. The modal shows:

- Operation type.
- Movement date and time.
- User who operated.
- Product code/name/unit.
- Warehouse.
- Source warehouse.
- Destination warehouse or destination note.
- Quantity.
- Unit price.
- Total value.
- Invoice number and supplier/company when present.
- Observation.
- Created and updated timestamps when available.

The modal includes `Exportar PDF`, which downloads `/reports/movements/:id`.

The action should appear anywhere `MovementsTable` is used, including the general
movements page, warehouse history, product movement dialogs, and invoice
movements dialog.

### Invoice Movements Dialog

The invoice movements dialog keeps its current summary cards but the embedded
movements table now exposes who performed the operation. This can be a dedicated
`Operado por` column or a compact line in the movement details modal. The table
column is preferred for this modal because the user specifically wants the note
movement modal to be more complete at a glance.

### Office Templates Settings Tab

The settings page gains an `Oficios` tab:

- Template list on the left or top.
- Form for name, description, subject, active status, and content.
- Toolbar with bold, italic, underline, ordered list, unordered list, heading,
  alignment, link, undo, and redo where practical.
- Editor area stores sanitized HTML.
- Variable palette with click-to-insert buttons such as `{{nome_empresa}}`.
- Preview block rendering the HTML with sample values.

The UI should look like the existing settings tabs: bordered card sections,
compact labels, responsive layout, and dark-mode classes.

## Data Flow

Manual invoice:

1. Frontend loads suppliers.
2. User selects supplier or quick-creates one.
3. Frontend posts invoice with `supplierId`, number, date, and observation.
4. Backend snapshots supplier data into invoice fields.
5. Created invoice is selected in the stock entry flow.

XML import:

1. Frontend previews XML and shows document company data.
2. Backend import resolves or creates supplier by XML CNPJ.
3. Backend creates or updates invoice with `supplierId` and document snapshot.
4. Backend creates stock entries and movements.

CSV import:

1. Preview validates row groups and document company data.
2. Import groups rows by invoice.
3. Backend resolves or creates suppliers by CNPJ per group.
4. Backend creates invoices and stock movements in one transaction.

Movement audit:

1. User clicks view action.
2. Frontend opens modal using movement data already loaded.
3. Export button downloads the dedicated one-movement PDF.

Office templates:

1. Admin creates template in settings.
2. Frontend posts HTML and metadata.
3. Backend validates variables and persists the template.
4. Templates remain available for future flows.

## Error Handling

Expected backend errors:

- Supplier CNPJ already exists.
- Supplier is inactive when selected for a new invoice.
- Invoice creation missing supplier.
- XML or CSV document has invalid company data.
- Office template contains unknown variables.
- Movement audit PDF requested for a movement outside the user's warehouse scope.

Frontend dialogs should preserve entered data after recoverable failures and
surface messages in the same dialog where the action happened.

## Testing

Backend tests must cover:

- Supplier CRUD and duplicate CNPJ rejection.
- Manual invoice creation requiring supplier and snapshotting supplier data.
- Invoice listing includes supplier and filters by `supplierId`.
- XML import links an existing supplier by CNPJ.
- XML import creates a supplier when CNPJ is new.
- CSV import links or creates suppliers by row group CNPJ.
- Movement detail PDF returns a PDF and respects warehouse scope.
- Office template CRUD and unknown-variable rejection.

Frontend tests must cover:

- Manual invoice creation requires a supplier and supports quick supplier create.
- Invoice filters include supplier selection.
- Invoice movements show responsible user.
- Movement table view action opens complete audit modal.
- Movement audit PDF export calls the correct endpoint.
- Settings page shows the Oficios tab, editor toolbar, variable insertion, and
  template save.

## Delivery Notes

Implementation should update:

- Prisma schema and migration.
- Backend validators, services, routes, and app route registration.
- Existing invoice XML and CSV import services.
- Report PDF route generation.
- Frontend API types.
- `MovementsTable`, invoice page, warehouse detail invoice form, and settings
  page.
- Focused backend and frontend tests before implementation changes.
