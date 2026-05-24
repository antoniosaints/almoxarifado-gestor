import { UserRole } from "@prisma/client";
import PDFDocument from "pdfkit";
import { Router, type Response } from "express";
import type { SessionUser } from "../lib/auth.js";
import { asyncHandler, currentUser, requireRole } from "../lib/http.js";
import { warehouseScope } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import { getSystemSettings } from "../services/settings-service.js";

export const reportRoutes = Router();

reportRoutes.use(requireRole(UserRole.ADMIN, UserRole.OPERATOR));

type ReportColumn = {
  align?: "center" | "left" | "right";
  label: string;
  width: number;
};

type ReportSettings = Awaited<ReturnType<typeof getSystemSettings>>;

type ReportChrome = {
  generatedAt: Date;
  logo: Buffer | null;
  settings: ReportSettings;
  subtitle: string;
  title: string;
  user: SessionUser;
};

const firstPageMargins = {
  bottom: 64,
  left: 36,
  right: 36,
  top: 150,
};

const continuationPageMargins = {
  bottom: 64,
  left: 36,
  right: 36,
  top: 42,
};

function roleLabel(role: UserRole) {
  return role === UserRole.ADMIN ? "Administrador" : "Operador";
}

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
    return addContinuationPage(document);
  }

  return false;
}

function addContinuationPage(document: PDFKit.PDFDocument) {
  document.addPage({ margins: continuationPageMargins });
  return true;
}

function normalizeHex(color: string | null | undefined, fallback = "#0f766e") {
  return /^#[0-9a-fA-F]{6}$/.test(color ?? "") ? color ?? fallback : fallback;
}

function foregroundFor(hex: string) {
  const normalized = normalizeHex(hex).slice(1);
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255;
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

  return luminance > 0.62 ? "#0f172a" : "#ffffff";
}

function drawFallbackLogo(
  document: PDFKit.PDFDocument,
  settings: ReportSettings,
  x: number,
  y: number,
  size: number,
) {
  const primaryColor = normalizeHex(settings.reportPrimaryColor, settings.primaryColor);
  const initial = settings.systemName.trim().charAt(0).toUpperCase() || "A";

  document.roundedRect(x, y, size, size, 8).fillColor(primaryColor).fill();
  document
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor(foregroundFor(primaryColor))
    .text(initial, x, y + 16, { align: "center", width: size });
}

function drawMetadata(
  document: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
) {
  document
    .font("Helvetica-Bold")
    .fontSize(6.5)
    .fillColor("#64748b")
    .text(label.toUpperCase(), x, y, { width });
  document
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#0f172a")
    .text(value, x, y + 11, { height: 24, width });
}

function drawReportChrome(
  document: PDFKit.PDFDocument,
  meta: ReportChrome,
  pageNumber: number,
  pageCount: number,
) {
  const left = document.page.margins.left;
  const right = document.page.width - document.page.margins.right;
  const width = right - left;
  const primaryColor = normalizeHex(
    meta.settings.reportPrimaryColor,
    meta.settings.primaryColor,
  );
  const footerText = meta.settings.reportFooterText.trim();

  document.save();

  if (pageNumber === 1) {
    document.rect(0, 0, document.page.width, 8).fillColor(primaryColor).fill();

    document.roundedRect(left, 24, 54, 54, 8).fillColor("#ffffff").fill();
    document.roundedRect(left, 24, 54, 54, 8).strokeColor("#cbd5e1").stroke();

    if (meta.logo) {
      try {
        document.image(meta.logo, left + 6, 30, { fit: [42, 42] });
      } catch {
        drawFallbackLogo(document, meta.settings, left, 24, 54);
      }
    } else {
      drawFallbackLogo(document, meta.settings, left, 24, 54);
    }

    const titleX = left + 68;
    document
      .font("Helvetica-Bold")
      .fontSize(7)
      .fillColor("#64748b")
      .text(meta.settings.systemName.toUpperCase(), titleX, 24, {
        width: right - titleX,
      });
    document
      .font("Helvetica-Bold")
      .fontSize(17)
      .fillColor("#0f172a")
      .text(meta.title, titleX, 36, { width: right - titleX });
    document
      .font("Helvetica")
      .fontSize(8.5)
      .fillColor("#475569")
      .text(meta.subtitle, titleX, 60, { width: right - titleX });

    document.roundedRect(left, 88, width, 42, 7).fillColor("#f8fafc").fill();
    document.roundedRect(left, 88, width, 42, 7).strokeColor("#e2e8f0").stroke();

    const columnGap = 18;
    const columnWidth = (width - columnGap * 2) / 3;
    drawMetadata(
      document,
      "Emitido por",
      `${meta.user.name} (${meta.user.email})`,
      left + 12,
      99,
      columnWidth,
    );
    drawMetadata(
      document,
      "Gerado em",
      formatDate(meta.generatedAt),
      left + 12 + columnWidth + columnGap,
      99,
      columnWidth,
    );
    drawMetadata(
      document,
      "Responsavel",
      `${meta.user.name} - ${roleLabel(meta.user.role)}`,
      left + 12 + (columnWidth + columnGap) * 2,
      99,
      columnWidth,
    );
  }

  const footerY = document.page.height - 48;
  document
    .moveTo(left, footerY)
    .lineTo(right, footerY)
    .lineWidth(0.5)
    .strokeColor("#cbd5e1")
    .stroke();
  const originalBottomMargin = document.page.margins.bottom;

  document.page.margins.bottom = 0;
  try {
    document
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor("#64748b")
      .text(footerText, left, footerY + 8, {
        lineBreak: false,
        width: width - 90,
      });
    document.text(`Pagina ${pageNumber} de ${pageCount}`, right - 78, footerY + 8, {
      align: "right",
      lineBreak: false,
      width: 78,
    });
  } finally {
    document.page.margins.bottom = originalBottomMargin;
  }

  document.restore();
}

async function loadReportLogo(url: string | null | undefined) {
  const normalizedUrl = url?.trim();

  if (!normalizedUrl) {
    return null;
  }

  if (normalizedUrl.startsWith("data:image/")) {
    const commaIndex = normalizedUrl.indexOf(",");

    if (commaIndex < 0) {
      return null;
    }

    const metadata = normalizedUrl.slice(0, commaIndex);
    const payload = normalizedUrl.slice(commaIndex + 1);

    return Buffer.from(
      metadata.includes(";base64") ? payload : decodeURIComponent(payload),
      metadata.includes(";base64") ? "base64" : "utf8",
    );
  }

  if (!/^https?:\/\//i.test(normalizedUrl)) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(normalizedUrl, { signal: controller.signal });

    if (!response.ok) {
      return null;
    }

    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
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
  accentColor: string,
) {
  const startX = document.page.margins.left;
  const tableWidth = columns.reduce((total, column) => total + column.width, 0);
  const headerHeight = 24;
  const primaryColor = normalizeHex(accentColor);

  function writeTableHeader() {
    ensureSpace(document, headerHeight);
    let x = startX;
    const headerY = document.y;

    document.roundedRect(startX, headerY, tableWidth, headerHeight, 6).fillColor(primaryColor).fill();
    document.fontSize(7.5).font("Helvetica-Bold").fillColor(foregroundFor(primaryColor));

    for (const column of columns) {
      document.text(column.label, x + 4, headerY + 7, {
        align: column.align ?? "left",
        width: column.width - 8,
      });
      x += column.width;
    }

    document.y = headerY + headerHeight + 3;
  }

  writeTableHeader();

  if (!rows.length) {
    document.fontSize(9).font("Helvetica").fillColor("#475569").text("Nenhum registro encontrado.");
    document.fillColor("#0f172a");
    return;
  }

  document.fontSize(8).font("Helvetica");
  rows.forEach((row, rowIndex) => {
    const rowHeight =
      Math.max(
        ...row.map((cell, index) =>
          document.heightOfString(cell, {
            width: (columns[index]?.width ?? 80) - 8,
          }),
        ),
      ) + 10;

    if (ensureSpace(document, rowHeight)) {
      writeTableHeader();
    }

    let x = startX;
    const rowY = document.y;

    if (rowIndex % 2 === 0) {
      document.rect(startX, rowY - 2, tableWidth, rowHeight).fillColor("#f8fafc").fill();
    }

    document.font("Helvetica").fontSize(8).fillColor("#0f172a");
    row.forEach((cell, index) => {
      const column = columns[index];
      document.text(cell, x + 4, rowY + 3, {
        align: column?.align ?? "left",
        width: (column?.width ?? 80) - 8,
      });
      x += column?.width ?? 80;
    });

    document
      .moveTo(startX, rowY + rowHeight - 1)
      .lineTo(startX + tableWidth, rowY + rowHeight - 1)
      .lineWidth(0.5)
      .strokeColor("#e2e8f0")
      .stroke();
    document.y = rowY + rowHeight;
  });
}

async function buildPdf(
  title: string,
  subtitle: string,
  user: SessionUser,
  draw: (
    document: PDFKit.PDFDocument,
    settings: ReportSettings,
  ) => Promise<void> | void,
) {
  const settings = await getSystemSettings(prisma);
  const logo = await loadReportLogo(settings.reportLogoUrl ?? settings.logoUrl);
  const generatedAt = new Date();

  return new Promise<Buffer>((resolve, reject) => {
    const document = new PDFDocument({
      bufferPages: true,
      margins: firstPageMargins,
      size: "A4",
    });
    const chunks: Buffer[] = [];

    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    Promise.resolve(draw(document, settings))
      .then(() => {
        const range = document.bufferedPageRange();

        for (let index = range.start; index < range.start + range.count; index += 1) {
          document.switchToPage(index);
          drawReportChrome(
            document,
            {
              generatedAt,
              logo,
              settings,
              subtitle,
              title,
              user,
            },
            index - range.start + 1,
            range.count,
          );
        }

        document.end();
      })
      .catch(reject);
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
      "Entradas, saidas e transferencias por almoxarifado.",
      user,
      (document, settings) => {
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
          settings.reportPrimaryColor,
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
      "Saldo atual, minimo e estado dos produtos por almoxarifado.",
      user,
      (document, settings) => {
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
          settings.reportPrimaryColor,
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
    const scopedInvoiceMovements =
      user.role === UserRole.ADMIN ? { some: {} } : { some: scopedMovementWhere };
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
        movements: scopedInvoiceMovements,
        number: number ? { contains: number } : undefined,
      },
    });

    const buffer = await buildPdf(
      "Relatorio por notas fiscais",
      "Notas fiscais e movimentacoes vinculadas ao estoque.",
      user,
      (document, settings) => {
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
            addContinuationPage(document);
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
            settings.reportPrimaryColor,
          );
        });
      },
    );

    sendPdf(response, "relatorio-notas-fiscais.pdf", buffer);
  }),
);
