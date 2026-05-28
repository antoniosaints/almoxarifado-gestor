import type { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { AppError } from "../lib/errors.js";
import { getSystemSettings } from "./settings-service.js";
import { getLocalUploadRoot } from "./upload-service.js";

type ReportSettings = Awaited<ReturnType<typeof getSystemSettings>>;

type ReportChrome = {
  generatedAt: Date;
  logo: Buffer | null;
  settings: ReportSettings;
  subtitle: string;
  title: string;
  viewerName: string;
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

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  style: "currency",
});

function formatDate(value: Date | string | null | undefined) {
  return value ? dateFormatter.format(new Date(value)) : "-";
}

function formatCurrency(value: unknown) {
  const amount = Number(value ?? 0);

  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0);
}

function fileSafe(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "documento"
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "Ativa",
    ANNUAL: "Anual",
    APPROVED: "Aprovado",
    BOLETO: "Boleto",
    CANCELLED: "Cancelada",
    EXPIRED: "Expirada",
    LIFETIME: "Vitalicia",
    LINKED: "Vinculada",
    MONTHLY: "Mensal",
    OPEN: "Aberta",
    OVERDUE: "Vencida",
    PAID: "Paga",
    PENDING: "Pendente",
    PIX: "Pix",
    REFUNDED: "Estornado",
    REJECTED: "Rejeitado",
    TRIAL: "Teste",
  };

  return labels[status] ?? status;
}

function ensureSpace(document: PDFKit.PDFDocument, height: number) {
  if (document.y + height > document.page.height - document.page.margins.bottom) {
    document.addPage({ margins: continuationPageMargins });
    return true;
  }

  return false;
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
  const initial = settings.systemName.trim().charAt(0).toUpperCase() || "M";

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
      .text(meta.settings.reportTitle.toUpperCase(), titleX, 24, {
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
    drawMetadata(document, "Emitido por", meta.viewerName, left + 12, 99, columnWidth);
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
      "Modulo",
      "Gestor de licencas",
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

function localUploadPathFromPublicUrl(url: string) {
  const prefixedUrl = url.startsWith("uploads/") ? `/${url}` : url;

  if (!prefixedUrl.startsWith("/uploads/")) {
    return null;
  }

  let pathname: string;

  try {
    pathname = new URL(prefixedUrl, "http://local").pathname;
  } catch {
    return null;
  }

  if (!pathname.startsWith("/uploads/")) {
    return null;
  }

  let relativePath: string;

  try {
    relativePath = decodeURIComponent(pathname.slice("/uploads/".length));
  } catch {
    return null;
  }

  const uploadRoot = getLocalUploadRoot();
  const filePath = path.resolve(uploadRoot, relativePath);
  const relativeToRoot = path.relative(uploadRoot, filePath);

  if (
    relativeToRoot === ".." ||
    relativeToRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToRoot)
  ) {
    return null;
  }

  return filePath;
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

  const localUploadPath = localUploadPathFromPublicUrl(normalizedUrl);

  if (localUploadPath) {
    try {
      return await readFile(localUploadPath);
    } catch {
      return null;
    }
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

function section(document: PDFKit.PDFDocument, title: string) {
  ensureSpace(document, 28);
  document
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#0f172a")
    .text(title);
  document.moveDown(0.35);
}

function writeRows(document: PDFKit.PDFDocument, rows: Array<[string, string]>) {
  const labelWidth = 116;
  const valueWidth =
    document.page.width -
    document.page.margins.left -
    document.page.margins.right -
    labelWidth;

  document.fontSize(9);
  for (const [label, value] of rows) {
    const rowHeight =
      Math.max(
        document.heightOfString(label, { width: labelWidth }),
        document.heightOfString(value, { width: valueWidth }),
      ) + 4;

    ensureSpace(document, rowHeight);
    const rowY = document.y;

    document
      .font("Helvetica-Bold")
      .fillColor("#334155")
      .text(label, document.page.margins.left, rowY, {
        width: labelWidth,
      });
    document
      .font("Helvetica")
      .fillColor("#0f172a")
      .text(value, document.page.margins.left + labelWidth, rowY, {
        width: valueWidth,
      });
    document.y = rowY + rowHeight;
  }

  document.moveDown(0.5);
}

async function buildPdf(
  prisma: PrismaClient,
  title: string,
  subtitle: string,
  viewerName: string,
  draw: (document: PDFKit.PDFDocument) => void,
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

    try {
      draw(document);

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
            viewerName,
          },
          index - range.start + 1,
          range.count,
        );
      }

      document.end();
    } catch (error) {
      reject(error);
    }
  });
}

function maybeQrBuffer(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const payload = value.includes(",") ? value.split(",").pop() : value;

  try {
    return Buffer.from(payload ?? "", "base64");
  } catch {
    return null;
  }
}

export async function buildManagerLicensePdf(
  prisma: PrismaClient,
  id: string,
  viewerName: string,
) {
  const license = await prisma.managerLicense.findUnique({
    include: { subscriber: true },
    where: { id },
  });

  if (!license) {
    throw new AppError(404, "Licenca nao encontrada.");
  }

  const buffer = await buildPdf(
    prisma,
    `Licenca ${license.licenseKey}`,
    `Documento comercial de licenca gerado em ${formatDate(new Date())}.`,
    viewerName,
    (document) => {
      section(document, "Assinante");
      writeRows(document, [
        ["Nome", license.subscriber.name],
        ["Documento", license.subscriber.document ?? "-"],
        ["Email", license.subscriber.email],
        ["Telefone", license.subscriber.phone ?? "-"],
      ]);
      section(document, "Licenca");
      writeRows(document, [
        ["Sistema", license.systemKey],
        ["Chave", license.licenseKey],
        ["Tipo", statusLabel(license.type)],
        ["Status", statusLabel(license.status)],
        ["Acessos", String(license.seats)],
        ["Inicio", formatDate(license.startsAt)],
        ["Vencimento", formatDate(license.expiresAt)],
        ["Valor", formatCurrency(license.monthlyValue)],
        ["Dominio vinculado", license.linkedDomain ?? "-"],
        ["IP vinculado", license.linkedIp ?? "-"],
        ["Validacoes", String(license.validationCount)],
      ]);
    },
  );

  return {
    buffer,
    fileName: `licenca-${fileSafe(license.licenseKey)}.pdf`,
  };
}

export async function buildManagerBillingPdf(
  prisma: PrismaClient,
  id: string,
  viewerName: string,
) {
  const billing = await prisma.managerBilling.findUnique({
    include: {
      license: true,
      payments: {
        orderBy: { createdAt: "desc" },
      },
      subscriber: true,
    },
    where: { id },
  });

  if (!billing) {
    throw new AppError(404, "Cobranca nao encontrada.");
  }

  const payment = billing.payments[0];
  const qrBuffer = maybeQrBuffer(payment?.qrCodeBase64);
  const buffer = await buildPdf(
    prisma,
    `Cobranca ${billing.reference}`,
    `Documento comercial de cobranca gerado em ${formatDate(new Date())}.`,
    viewerName,
    (document) => {
      section(document, "Assinante");
      writeRows(document, [
        ["Nome", billing.subscriber.name],
        ["Documento", billing.subscriber.document ?? "-"],
        ["Email", billing.subscriber.email],
      ]);
      section(document, "Cobranca");
      writeRows(document, [
        ["Sistema", billing.systemKey],
        ["Referencia", billing.reference],
        ["Descricao", billing.description ?? "-"],
        ["Valor", formatCurrency(billing.amount)],
        ["Vencimento", formatDate(billing.dueDate)],
        ["Status", statusLabel(billing.status)],
        ["Pago em", formatDate(billing.paidAt)],
        ["Licenca", billing.license?.licenseKey ?? "-"],
      ]);

      if (payment) {
        section(document, "Pagamento");
        writeRows(document, [
          ["Gateway", "Mercado Pago"],
          ["Metodo", statusLabel(payment.method)],
          ["Status", statusLabel(payment.status)],
          ["ID Mercado Pago", payment.providerPaymentId ?? "-"],
          ["Link", payment.ticketUrl ?? "-"],
          ["Codigo de barras", payment.barcode ?? "-"],
          ["Pix copia e cola", payment.qrCode ?? "-"],
        ]);

        if (qrBuffer) {
          ensureSpace(document, 170);
          document.image(qrBuffer, document.page.margins.left, document.y, {
            fit: [150, 150],
          });
        }
      }
    },
  );

  return {
    buffer,
    fileName: `cobranca-${fileSafe(billing.reference)}.pdf`,
  };
}
