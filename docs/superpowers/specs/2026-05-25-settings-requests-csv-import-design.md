# Settings, Requests, and CSV Import Design

## Goal

Finish the production-facing stock workflow by adding image uploads for branding assets, direct entry requests from the requests page, corrected request button visibility inside warehouses, and a safe CSV purchase import flow.

## Branding Settings

System settings keep the current URL-based fields and add `faviconUrl`. Uploads are stored as small `data:image/...` values so the existing settings API remains simple and no file storage service is introduced. The frontend validates image type and size before saving. The backend validates that image fields are either empty, `http(s)` URLs, or image data URLs.

The settings page adds upload controls beside existing URL inputs for brand logo, login background/image, report logo, and favicon. Favicon is applied by the settings provider by updating or creating the document favicon link.

## Requests

Inside a non-general warehouse, both admins and operators can create entry requests. The general warehouse keeps the request button hidden.

The requests page adds a top-level `Solicitar` button. Because that page is outside a selected warehouse context, the dialog asks for a destination warehouse, then loads/request-filters available products for that warehouse. Submitting creates an `EntryRequest` through the existing backend endpoint.

The backend route for creating entry requests accepts admins as well as operators. Warehouse access rules stay unchanged: admins can request for any warehouse; operators can only request for assigned warehouses.

## CSV Purchase Import

The warehouse detail stock tab adds `Importar CSV`. The modal provides a downloadable semicolon-separated template with fixed columns:

```csv
numero_nota;cnpj_empresa;nome_empresa;data_nota;codigo_produto;nome_produto;unidade;quantidade;valor_unitario;valor_total;observacao
NF-001;12345678000190;Fornecedor Municipal;2026-05-25;PAP-A4;Papel A4;PCT;10;25,50;255,00;Compra mensal
```

The flow has two backend steps:

1. Preview parses and validates the CSV, suggests existing products by code/name, suggests or creates units by abbreviation, groups invoice data by `numero_nota`, and returns row-level errors/warnings without changing stock.
2. Import receives the CSV plus row actions/mappings. It runs inside one transaction, creates or reuses invoices, creates products only where allowed, creates missing units only when safe, and records stock entries with unit prices.

Rows with invoice number must include CNPJ, company name, and date. Rows without invoice number are allowed as stock entries without invoice. Duplicate invoices with existing movements are blocked to avoid accidental double stock entry.

Each row can be imported, skipped, mapped to an existing product, or marked to create a product. New products use the selected default category and the row unit. Quantities must be positive integers. Unit prices and totals must be non-negative currency values, and mismatched totals produce validation feedback.

## Safety

No stock quantity changes happen during preview. Final import is all-or-nothing. Backend tests cover parsing, duplicate invoice protection, product mapping/creation, skipped rows, and stock movement creation. Frontend tests cover the visible request buttons and request dialog entry points.
