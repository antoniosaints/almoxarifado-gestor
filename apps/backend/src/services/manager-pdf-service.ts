import type { PrismaClient } from "@prisma/client";
import PDFDocument from "pdfkit";
import { AppError } from "../lib/errors.js";

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
    APPROVED: "Aprovado",
    BOLETO: "Boleto",
    CANCELLED: "Cancelada",
    EXPIRED: "Expirada",
    LINKED: "Vinculada",
    OPEN: "Aberta",
    OVERDUE: "Vencida",
    PAID: "Paga",
    PENDING: "Pendente",
    PIX: "Pix",
    REFUNDED: "Estornado",
    REJECTED: "Rejeitado",
  };

  return labels[status] ?? status;
}

function writeHeader(document: PDFKit.PDFDocument, title: string, subtitle: string) {
  document.rect(0, 0, document.page.width, 8).fillColor("#0f766e").fill();
  document
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor("#0f172a")
    .text(title, 44, 42, { width: 507 });
  document
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#475569")
    .text(subtitle, 44, 66, { width: 507 });
  document.moveTo(44, 92).lineTo(551, 92).strokeColor("#cbd5e1").stroke();
  document.y = 118;
}

function writeRows(document: PDFKit.PDFDocument, rows: Array<[string, string]>) {
  for (const [label, value] of rows) {
    const y = document.y;
    const height =
      Math.max(
        document.heightOfString(label, { width: 130 }),
        document.heightOfString(value, { width: 350 }),
      ) + 8;

    if (document.y + height > 770) {
      document.addPage();
      document.y = 44;
    }

    document
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#334155")
      .text(label, 44, y, { width: 130 });
    document
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#0f172a")
      .text(value, 176, y, { width: 350 });
    document.y = y + height;
  }

  document.moveDown(0.5);
}

function section(document: PDFKit.PDFDocument, title: string) {
  if (document.y > 735) {
    document.addPage();
    document.y = 44;
  }

  document
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#0f172a")
    .text(title);
  document.moveDown(0.35);
}

function buildPdf(draw: (document: PDFKit.PDFDocument) => void) {
  const document = new PDFDocument({
    bufferPages: true,
    margins: {
      bottom: 56,
      left: 44,
      right: 44,
      top: 42,
    },
    size: "A4",
  });
  const chunks: Buffer[] = [];

  return new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    draw(document);

    const range = document.bufferedPageRange();

    for (let index = range.start; index < range.start + range.count; index += 1) {
      document.switchToPage(index);
      document
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor("#64748b")
        .text(
          `Pagina ${index - range.start + 1} de ${range.count}`,
          44,
          document.page.height - 42,
          { align: "right", width: 507 },
        );
    }

    document.end();
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

  const buffer = await buildPdf((document) => {
    writeHeader(
      document,
      `Licenca ${license.licenseKey}`,
      `Documento gerado por ${viewerName} em ${formatDate(new Date())}.`,
    );
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
  });

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
  const buffer = await buildPdf((document) => {
    writeHeader(
      document,
      `Cobranca ${billing.reference}`,
      `Documento gerado por ${viewerName} em ${formatDate(new Date())}.`,
    );
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
        document.image(qrBuffer, 44, document.y, { fit: [150, 150] });
      }
    }
  });

  return {
    buffer,
    fileName: `cobranca-${fileSafe(billing.reference)}.pdf`,
  };
}
