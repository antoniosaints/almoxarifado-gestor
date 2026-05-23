import { UserRole } from "@prisma/client";
import PDFDocument from "pdfkit";
import { Router, type Response } from "express";
import { asyncHandler, currentUser, requireRole } from "../lib/http.js";
import { warehouseScope } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";

export const reportRoutes = Router();

reportRoutes.use(requireRole(UserRole.ADMIN, UserRole.OPERATOR));

type ReportColumn = {
  align?: "center" | "left" | "right";
  label: string;
  width: number;
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const dateOnlyFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
});

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "-";
  }

  return dateFormatter.format(new Date(value));
}

function formatDateOnly(value: Date | string | null | undefined) {
  if (!value) {
    return "-";
  }

  return dateOnlyFormatter.format(new Date(value));
}

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function reportDateRange(query: Record<string, unknown>) {
  const from = typeof query.from === "string" && query.from ? new Date(query.from) : undefined;
  const to =
    typeof query.to === "string" && query.to
      ? new Date(`${query.to.slice(0, 10)}T23:59:59.999`)
      : undefined;

  return { from, to };
}

function queryString(query: Record<string, unknown>, key: string) {
  const value = query[key];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function queryList(query: Record<string, unknown>, key: string) {
  return (queryString(query, key) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function ensureSpace(document: PDFKit.PDFDocument, height: number) {
  if (document.y + height > document.page.height - document.page.margins.bottom) {
    document.addPage();
  }
}

function writeReportHeader(document: PDFKit.PDFDocument, title: string, subtitle: string) {
  document.fontSize(16).font("Helvetica-Bold").text(title);
  document.moveDown(0.25);
  document.fontSize(9).font("Helvetica").fillColor("#475569").text(subtitle);
  document.fillColor("#0f172a");
  document.moveDown();
}

function writeSectionTitle(document: PDFKit.PDFDocument, title: string) {
  ensureSpace(document, 28);
  document.fontSize(12).font("Helvetica-Bold").fillColor("#0f172a").text(title);
  document.moveDown(0.35);
}

function writeFieldRows(
  document: PDFKit.PDFDocument,
  rows: Array<[string, string]>,
) {
  const labelWidth = 116;
  const valueWidth = 390;

  document.fontSize(9);
  for (const [label, value] of rows) {
    const rowHeight =
      Math.max(
        document.heightOfString(label, { width: labelWidth }),
        document.heightOfString(value, { width: valueWidth }),
      ) + 4;

    ensureSpace(document, rowHeight);
    const rowY = document.y;

    document.font("Helvetica-Bold").fillColor("#334155").text(label, document.page.margins.left, rowY, {
      width: labelWidth,
    });
    document.font("Helvetica").fillColor("#0f172a").text(value, document.page.margins.left + labelWidth, rowY, {
      width: valueWidth,
    });
    document.y = rowY + rowHeight;
  }

  document.moveDown(0.5);
}

function writeTable(
  document: PDFKit.PDFDocument,
  columns: ReportColumn[],
  rows: string[][],
) {
  const startX = document.page.margins.left;
  const headerHeight = 22;

  ensureSpace(document, headerHeight);
  let x = startX;
  const headerY = document.y;

  document.fontSize(8).font("Helvetica-Bold");
  for (const column of columns) {
    document.text(column.label, x, headerY, {
      align: column.align ?? "left",
      width: column.width,
    });
    x += column.width;
  }

  document
    .moveTo(startX, headerY + 15)
    .lineTo(startX + columns.reduce((total, column) => total + column.width, 0), headerY + 15)
    .strokeColor("#cbd5e1")
    .stroke();
  document.y = headerY + headerHeight;

  if (!rows.length) {
    document.fontSize(9).font("Helvetica").fillColor("#475569").text("Nenhum registro encontrado.");
    document.fillColor("#0f172a");
    return;
  }

  document.fontSize(8).font("Helvetica");
  for (const row of rows) {
    const rowHeight =
      Math.max(
        ...row.map((cell, index) =>
          document.heightOfString(cell, { width: columns[index]?.width ?? 80 }),
        ),
      ) + 10;

    ensureSpace(document, rowHeight);
    x = startX;
    const rowY = document.y;

    row.forEach((cell, index) => {
      const column = columns[index];
      document.text(cell, x, rowY, {
        align: column?.align ?? "left",
        width: column?.width ?? 80,
      });
      x += column?.width ?? 80;
    });

    document.y = rowY + rowHeight;
  }
}

function buildPdf(title: string, subtitle: string, draw: (document: PDFKit.PDFDocument) => void) {
  return new Promise<Buffer>((resolve, reject) => {
    const document = new PDFDocument({ margin: 42, size: "A4" });
    const chunks: Buffer[] = [];

    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    writeReportHeader(document, title, subtitle);
    draw(document);
    document.end();
  });
}

function movementValue(movement: { quantity: number; unitPrice?: unknown }) {
  const unitPrice =
    movement.unitPrice === null || movement.unitPrice === undefined
      ? 0
      : Number(movement.unitPrice);

  return Number.isFinite(unitPrice) ? unitPrice * movement.quantity : 0;
}

function sendPdf(response: Response, fileName: string, buffer: Buffer) {
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  response.send(buffer);
}

reportRoutes.get(
  "/movements",
  asyncHandler(async (request, response) => {
    const user = currentUser(response);
    const { from, to } = reportDateRange(request.query);
    const warehouseIds = queryList(request.query, "warehouseIds");
    const productId = queryString(request.query, "productId");
    const invoiceId = queryString(request.query, "invoiceId");
    const invoiceOnly = queryString(request.query, "invoiceOnly") === "1";
    const movements = await prisma.stockMovement.findMany({
      where: {
        invoiceId: invoiceId ?? (invoiceOnly ? { not: null } : undefined),
        movementDate:
          from || to
            ? {
                gte: from,
                lte: to,
              }
            : undefined,
        productId,
        warehouseId: warehouseIds.length ? { in: warehouseIds } : undefined,
        warehouse: warehouseScope(user),
      },
      include: {
        destinationWarehouse: true,
        invoice: true,
        product: {
          include: {
            unit: true,
          },
        },
        sourceWarehouse: true,
        warehouse: true,
      },
      orderBy: { movementDate: "desc" },
    });

    const buffer = await buildPdf(
      "Relatorio de movimentacoes",
      `Gerado em ${formatDate(new Date())}`,
      (document) => {
        writeTable(
          document,
          [
            { label: "Data", width: 68 },
            { label: "Tipo", width: 78 },
            { label: "Produto", width: 110 },
            { label: "Almox.", width: 84 },
            { label: "Origem/Destino", width: 92 },
            { align: "right", label: "Qtd.", width: 38 },
            { align: "right", label: "Valor", width: 40 },
          ],
          movements.map((movement) => {
            const unitPrice =
              movement.unitPrice === null || movement.unitPrice === undefined
                ? 0
                : Number(movement.unitPrice);

            return [
              formatDate(movement.movementDate),
              movement.type.replaceAll("_", " "),
              `${movement.product.code} - ${movement.product.name}`,
              movement.warehouse.name,
              `${movement.sourceWarehouse?.name ?? "-"} / ${
                movement.destinationWarehouse?.name ??
                movement.destinationNote ??
                movement.invoice?.number ??
                "-"
              }`,
              `${movement.quantity} ${movement.product.unit.abbreviation}`,
              unitPrice ? formatCurrency(unitPrice * movement.quantity) : "-",
            ];
          }),
        );
      },
    );

    sendPdf(response, "relatorio-movimentacoes.pdf", buffer);
  }),
);

reportRoutes.get(
  "/stocks",
  asyncHandler(async (request, response) => {
    const user = currentUser(response);
    const warehouseIds = queryList(request.query, "warehouseIds");
    const stocks = await prisma.stock.findMany({
      include: {
        product: {
          include: {
            unit: true,
          },
        },
        warehouse: {
          include: {
            category: true,
          },
        },
      },
      orderBy: [{ warehouse: { name: "asc" } }, { product: { name: "asc" } }],
      where: {
        warehouseId: warehouseIds.length ? { in: warehouseIds } : undefined,
        warehouse: warehouseScope(user),
      },
    });

    const buffer = await buildPdf(
      "Relatorio de saldos de estoque",
      `Gerado em ${formatDate(new Date())}`,
      (document) => {
        writeTable(
          document,
          [
            { label: "Almoxarifado", width: 120 },
            { label: "Categoria", width: 85 },
            { label: "Produto", width: 130 },
            { align: "right", label: "Saldo", width: 54 },
            { align: "right", label: "Min.", width: 38 },
            { label: "Estado", width: 82 },
          ],
          stocks.map((stock) => [
            stock.warehouse.name,
            stock.warehouse.category.name,
            `${stock.product.code} - ${stock.product.name}`,
            `${stock.currentQuantity} ${stock.product.unit.abbreviation}`,
            String(stock.minimumQuantity),
            stock.currentQuantity === 0
              ? "Sem estoque"
              : stock.currentQuantity <= stock.minimumQuantity
                ? "Baixo estoque"
                : "Adequado",
          ]),
        );
      },
    );

    sendPdf(response, "relatorio-saldos.pdf", buffer);
  }),
);

reportRoutes.get(
  "/invoices",
  asyncHandler(async (request, response) => {
    const user = currentUser(response);
    const { from, to } = reportDateRange(request.query);
    const companyName = queryString(request.query, "companyName");
    const cnpj = queryString(request.query, "cnpj");
    const invoiceId = queryString(request.query, "invoiceId");
    const number = queryString(request.query, "number");
    const scopedMovementWhere = {
      warehouse: warehouseScope(user),
    };
    const invoiceScope =
      user.role === UserRole.ADMIN
        ? undefined
        : {
            some: scopedMovementWhere,
          };
    const invoices = await prisma.invoice.findMany({
      include: {
        movements: {
          where: user.role === UserRole.ADMIN ? undefined : scopedMovementWhere,
          include: {
            product: {
              include: {
                unit: true,
              },
            },
            responsibleUser: true,
            warehouse: true,
          },
          orderBy: { movementDate: "desc" },
        },
      },
      orderBy: [{ issueDate: "desc" }, { number: "asc" }],
      where: {
        OR: companyName
          ? [
              { companyName: { contains: companyName } },
              { companyTradeName: { contains: companyName } },
            ]
          : undefined,
        cnpj: cnpj ? { contains: cnpj } : undefined,
        id: invoiceId,
        issueDate:
          from || to
            ? {
                gte: from,
                lte: to,
              }
            : undefined,
        movements: invoiceScope,
        number: number ? { contains: number } : undefined,
      },
    });

    const buffer = await buildPdf(
      "Relatorio por notas fiscais",
      `Gerado em ${formatDate(new Date())}`,
      (document) => {
        if (!invoices.length) {
          document
            .fontSize(9)
            .font("Helvetica")
            .fillColor("#475569")
            .text("Nenhuma nota fiscal encontrada para os filtros informados.");
          document.fillColor("#0f172a");
          return;
        }

        invoices.forEach((invoice, index) => {
          const movementTotalValue = invoice.movements.reduce(
            (total, movement) => total + movementValue(movement),
            0,
          );
          const invoiceTotalValue = movementTotalValue;
          const warehouses = Array.from(
            new Set(invoice.movements.map((movement) => movement.warehouse.name)),
          ).join(", ");

          if (index > 0) {
            document.addPage();
          }

          writeSectionTitle(document, `Nota fiscal ${invoice.number}`);
          writeFieldRows(document, [
            ["Empresa", invoice.companyName],
            ["CNPJ", invoice.cnpj],
            ["Numero da nota", invoice.number],
            ["Data de emissao", formatDateOnly(invoice.issueDate)],
            ["Observacao", invoice.observation ?? "-"],
            ["Almoxarifados", warehouses || "-"],
            ["Movimentacoes", String(invoice.movements.length)],
            ["Valor total da nota", formatCurrency(invoiceTotalValue)],
          ]);

          writeSectionTitle(document, "Itens e movimentacoes vinculadas");
          writeTable(
            document,
            [
              { label: "Data", width: 66 },
              { label: "Almox.", width: 76 },
              { label: "Produto", width: 128 },
              { align: "right", label: "Qtd.", width: 42 },
              { align: "right", label: "Vlr. unit.", width: 58 },
              { align: "right", label: "Vlr. total", width: 62 },
              { label: "Responsavel", width: 84 },
            ],
            invoice.movements.map((movement) => {
              const unitPrice =
                movement.unitPrice === null || movement.unitPrice === undefined
                  ? 0
                  : Number(movement.unitPrice);

              return [
                formatDate(movement.movementDate),
                movement.warehouse.name,
                `${movement.product.code} - ${movement.product.name}`,
                `${movement.quantity} ${movement.product.unit.abbreviation}`,
                unitPrice ? formatCurrency(unitPrice) : "-",
                unitPrice ? formatCurrency(unitPrice * movement.quantity) : "-",
                movement.responsibleUser?.name ?? "-",
              ];
            }),
          );
        });
      },
    );

    sendPdf(response, "relatorio-notas-fiscais.pdf", buffer);
  }),
);
