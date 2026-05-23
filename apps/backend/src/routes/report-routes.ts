import { UserRole } from "@prisma/client";
import PDFDocument from "pdfkit";
import { Router, type Response } from "express";
import { asyncHandler, requireRole } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

export const reportRoutes = Router();

reportRoutes.use(requireRole(UserRole.ADMIN));

type ReportColumn = {
  align?: "center" | "left" | "right";
  label: string;
  width: number;
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
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

function sendPdf(response: Response, fileName: string, buffer: Buffer) {
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  response.send(buffer);
}

reportRoutes.get(
  "/movements",
  asyncHandler(async (request, response) => {
    const { from, to } = reportDateRange(request.query);
    const movements = await prisma.stockMovement.findMany({
      where: {
        movementDate:
          from || to
            ? {
                gte: from,
                lte: to,
              }
            : undefined,
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
  asyncHandler(async (_request, response) => {
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
    const { from, to } = reportDateRange(request.query);
    const invoices = await prisma.invoice.findMany({
      include: {
        movements: {
          include: {
            product: {
              include: {
                unit: true,
              },
            },
            warehouse: true,
          },
          orderBy: { movementDate: "desc" },
        },
      },
      orderBy: [{ issueDate: "desc" }, { number: "asc" }],
      where: {
        issueDate:
          from || to
            ? {
                gte: from,
                lte: to,
              }
            : undefined,
      },
    });

    const buffer = await buildPdf(
      "Relatorio por notas fiscais",
      `Gerado em ${formatDate(new Date())}`,
      (document) => {
        writeTable(
          document,
          [
            { label: "Nota", width: 70 },
            { label: "Empresa", width: 120 },
            { label: "CNPJ", width: 80 },
            { label: "Emissao", width: 68 },
            { label: "Produto", width: 110 },
            { align: "right", label: "Qtd.", width: 42 },
          ],
          invoices.flatMap((invoice) =>
            invoice.movements.length
              ? invoice.movements.map((movement) => [
                  invoice.number,
                  invoice.companyName,
                  invoice.cnpj,
                  formatDate(invoice.issueDate),
                  `${movement.product.code} - ${movement.product.name}`,
                  `${movement.quantity} ${movement.product.unit.abbreviation}`,
                ])
              : [
                  [
                    invoice.number,
                    invoice.companyName,
                    invoice.cnpj,
                    formatDate(invoice.issueDate),
                    "Sem movimentacoes vinculadas",
                    "-",
                  ],
                ],
          ),
        );
      },
    );

    sendPdf(response, "relatorio-notas-fiscais.pdf", buffer);
  }),
);
