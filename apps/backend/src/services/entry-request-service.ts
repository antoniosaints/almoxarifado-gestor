import {
  MovementType,
  Prisma,
  RequestStatus,
  type PrismaClient,
} from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";
import { AppError } from "../lib/errors.js";
import { defaultSettings, settingsId } from "./settings-service.js";
import { getLocalUploadRoot } from "./upload-service.js";

type EntryRequestInput = {
  movementDate: Date;
  observation?: string | null;
  productId: string;
  quantity: number;
  requestedById: string;
  warehouseId: string;
};

type ApprovalInput = {
  invoiceId?: string | null;
  quantity?: number;
  requestId: string;
  reviewedById: string;
};

const officeRequestInclude = {
  product: {
    include: {
      unit: true,
    },
  },
  requestedBy: {
    select: {
      email: true,
      id: true,
      name: true,
    },
  },
  warehouse: {
    include: {
      category: true,
    },
  },
} as const;

type OfficeRequest = Prisma.EntryRequestGetPayload<{
  include: typeof officeRequestInclude;
}>;

const defaultOfficeLetterSubject = "Solicitação de material/equipamento";
const defaultOfficeLetterContentHtml = [
  "<p><strong>OF&Iacute;CIO N&ordm; {{oficio_numero_ano}}</strong></p>",
  "<p><strong>Assunto:</strong> Solicita&ccedil;&atilde;o de material/equipamento</p>",
  "<p>Prezados,</p>",
  "<p>Venho, por meio deste, solicitar a disponibiliza&ccedil;&atilde;o do(s) seguinte(s) item(ns):</p>",
  "<p>{{itens_solicitados_html}}</p>",
  "<p>A presente solicita&ccedil;&atilde;o se faz necess&aacute;ria para atender &agrave;s demandas e necessidades deste setor, visando garantir o bom funcionamento das atividades desenvolvidas.</p>",
  "<p>Certos de contarmos com a colabora&ccedil;&atilde;o de Vossa Senhoria, aguardamos o atendimento desta solicita&ccedil;&atilde;o e renovamos nossos votos de estima e considera&ccedil;&atilde;o.</p>",
  "<p>Atenciosamente,</p>",
].join("");

function assertPositiveQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new AppError(400, "Informe uma quantidade maior que zero.");
  }
}

async function nextOfficeNumber(
  prisma: Prisma.TransactionClient,
  warehouseId: string,
  year: number,
) {
  const lastRequest = await prisma.entryRequest.findFirst({
    orderBy: { officeNumber: "desc" },
    select: { officeNumber: true },
    where: {
      officeNumber: { not: null },
      officeYear: year,
      warehouseId,
    },
  });

  return (lastRequest?.officeNumber ?? 0) + 1;
}

export function formatOfficeNumber(
  officeNumber: number | null | undefined,
  officeYear: number | null | undefined,
) {
  if (!officeNumber || !officeYear) {
    return "";
  }

  return `${String(officeNumber).padStart(3, "0")}/${officeYear}`;
}

export async function createEntryRequest(
  prisma: PrismaClient,
  input: EntryRequestInput,
) {
  assertPositiveQuantity(input.quantity);

  return prisma.$transaction(async (transaction) => {
    const stock = await transaction.stock.findUnique({
      include: {
        warehouse: {
          select: {
            isGeneral: true,
          },
        },
      },
      where: {
        warehouseId_productId: {
          productId: input.productId,
          warehouseId: input.warehouseId,
        },
      },
    });

    if (!stock) {
      throw new AppError(
        400,
        "Solicite apenas produtos já cadastrados no estoque deste almoxarifado.",
      );
    }

    const officeYear = input.movementDate.getFullYear();
    const shouldCreateOffice = !stock.warehouse.isGeneral;
    const officeNumber = shouldCreateOffice
      ? await nextOfficeNumber(transaction, input.warehouseId, officeYear)
      : null;

    return transaction.entryRequest.create({
      data: {
        movementDate: input.movementDate,
        observation: input.observation,
        officeNumber,
        officeYear: shouldCreateOffice ? officeYear : null,
        productId: input.productId,
        quantity: input.quantity,
        requestedById: input.requestedById,
        warehouseId: input.warehouseId,
      },
    });
  });
}

async function createEntryRequestLegacy(
  prisma: PrismaClient,
  input: EntryRequestInput,
) {
  assertPositiveQuantity(input.quantity);

  const stock = await prisma.stock.findUnique({
    where: {
      warehouseId_productId: {
        productId: input.productId,
        warehouseId: input.warehouseId,
      },
    },
    select: {
      id: true,
    },
  });

  if (!stock) {
    throw new AppError(
      400,
      "Solicite apenas produtos já cadastrados no estoque deste almoxarifado.",
    );
  }

  return prisma.entryRequest.create({
    data: {
      movementDate: input.movementDate,
      observation: input.observation,
      productId: input.productId,
      quantity: input.quantity,
      requestedById: input.requestedById,
      warehouseId: input.warehouseId,
    },
  });
}

export async function approveEntryRequest(
  prisma: PrismaClient,
  input: ApprovalInput,
) {
  return prisma.$transaction(async (transaction) => {
    const request = await transaction.entryRequest.findUniqueOrThrow({
      where: { id: input.requestId },
    });

    if (request.status !== RequestStatus.PENDING) {
      throw new AppError(409, "Esta solicitação já foi analisada.");
    }

    const approvedQuantity = input.quantity ?? request.quantity;
    assertPositiveQuantity(approvedQuantity);

    const generalWarehouse = await transaction.warehouse.findFirst({
      where: {
        active: true,
        isGeneral: true,
      },
    });

    if (!generalWarehouse) {
      throw new AppError(409, "Cadastre um almoxarifado geral ativo para aprovar.");
    }

    const generalStock = await transaction.stock.findUnique({
      where: {
        warehouseId_productId: {
          warehouseId: generalWarehouse.id,
          productId: request.productId,
        },
      },
    });

    if (!generalStock || generalStock.currentQuantity < approvedQuantity) {
      throw new AppError(409, "Quantidade insuficiente no estoque geral.");
    }

    const destinationStockBefore = await transaction.stock.findUnique({
      where: {
        warehouseId_productId: {
          warehouseId: request.warehouseId,
          productId: request.productId,
        },
      },
      select: { currentQuantity: true },
    });

    const sourceStock = await transaction.stock.update({
      where: { id: generalStock.id },
      data: {
        currentQuantity: {
          decrement: approvedQuantity,
        },
        lastMovementAt: request.movementDate,
      },
    });

    const stock = await transaction.stock.upsert({
      where: {
        warehouseId_productId: {
          warehouseId: request.warehouseId,
          productId: request.productId,
        },
      },
      update: {
        currentQuantity: {
          increment: approvedQuantity,
        },
        lastMovementAt: request.movementDate,
      },
      create: {
        currentQuantity: approvedQuantity,
        lastMovementAt: request.movementDate,
        productId: request.productId,
        warehouseId: request.warehouseId,
      },
    });

    const sourceMovement = await transaction.stockMovement.create({
      data: {
        destinationWarehouseId: request.warehouseId,
        movementDate: request.movementDate,
        observation: request.observation,
        productId: request.productId,
        quantity: approvedQuantity,
        responsibleUserId: input.reviewedById,
        sourceWarehouseId: generalWarehouse.id,
        stockId: sourceStock.id,
        type: MovementType.TRANSFERENCIA_SAIDA,
        warehouseId: generalWarehouse.id,
      },
    });

    const movement = await transaction.stockMovement.create({
      data: {
        destinationWarehouseId: request.warehouseId,
        invoiceId: input.invoiceId,
        movementDate: request.movementDate,
        observation: request.observation,
        productId: request.productId,
        quantity: approvedQuantity,
        responsibleUserId: input.reviewedById,
        sourceWarehouseId: generalWarehouse.id,
        stockId: stock.id,
        type: MovementType.TRANSFERENCIA_ENTRADA,
        warehouseId: request.warehouseId,
      },
    });

    const approvedRequest = await transaction.entryRequest.update({
      where: { id: request.id },
      data: {
        quantity: approvedQuantity,
        reviewedAt: new Date(),
        reviewedById: input.reviewedById,
        status: RequestStatus.APPROVED,
      },
    });

    return {
      movement,
      request: approvedRequest,
      summary: {
        approvedQuantity,
        destinationAfter:
          (destinationStockBefore?.currentQuantity ?? 0) + approvedQuantity,
        destinationBefore: destinationStockBefore?.currentQuantity ?? 0,
        sourceAfter: generalStock.currentQuantity - approvedQuantity,
        sourceBefore: generalStock.currentQuantity,
      },
      sourceMovement,
      sourceStock,
      stock,
    };
  });
}

export async function rejectEntryRequest(
  prisma: PrismaClient,
  requestId: string,
  reviewedById: string,
) {
  const request = await prisma.entryRequest.findUniqueOrThrow({
    where: { id: requestId },
  });

  if (request.status !== RequestStatus.PENDING) {
    throw new AppError(409, "Esta solicitação já foi analisada.");
  }

  return prisma.entryRequest.update({
    where: { id: request.id },
    data: {
      reviewedAt: new Date(),
      reviewedById,
      status: RequestStatus.REJECTED,
    },
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR").format(value);
}

function requestItem(request: OfficeRequest) {
  return {
    productName: request.product.name,
    quantity: request.quantity,
    unit: request.product.unit.abbreviation,
  };
}

function renderItemsHtml(items: ReturnType<typeof requestItem>[]) {
  return items
    .map((item, index) => {
      const suffix = index === items.length - 1 ? "." : ";";

      return `${escapeHtml(item.productName)} - ${item.quantity} ${escapeHtml(
        item.unit,
      )}${suffix}`;
    })
    .join("<br />");
}

function renderItemsText(items: ReturnType<typeof requestItem>[]) {
  return items
    .map((item, index) => {
      const suffix = index === items.length - 1 ? "." : ";";

      return `${item.productName} - ${item.quantity} ${item.unit}${suffix}`;
    })
    .join("\n");
}

function renderTemplate(
  template: string,
  variables: Record<string, string>,
  htmlVariables = new Set<string>(),
) {
  return template.replace(
    /{{\s*([a-zA-Z0-9_]+)\s*}}/g,
    (_match, variable: string) => {
      const value = variables[variable] ?? "";

      return htmlVariables.has(variable) ? value : escapeHtml(value);
    },
  );
}

function renderPlainTemplate(template: string, variables: Record<string, string>) {
  return template.replace(
    /{{\s*([a-zA-Z0-9_]+)\s*}}/g,
    (_match, variable: string) => variables[variable] ?? "",
  );
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

async function loadOfficeLogo(url: string | null | undefined) {
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

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    ccedil: "ç",
    eacute: "é",
    gt: ">",
    iacute: "í",
    lt: "<",
    nbsp: " ",
    ordm: "º",
    quot: '"',
    aacute: "á",
    agrave: "à",
    acirc: "â",
    atilde: "ã",
    egrave: "è",
    ecirc: "ê",
    oacute: "ó",
    ocirc: "ô",
    otilde: "õ",
    uacute: "ú",
  };

  return value.replace(
    /&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g,
    (match, entity: string) => {
      if (entity.startsWith("#x")) {
        const codePoint = Number.parseInt(entity.slice(2), 16);

        return Number.isFinite(codePoint)
          ? String.fromCodePoint(codePoint)
          : match;
      }

      if (entity.startsWith("#")) {
        const codePoint = Number.parseInt(entity.slice(1), 10);

        return Number.isFinite(codePoint)
          ? String.fromCodePoint(codePoint)
          : match;
      }

      return namedEntities[entity.toLocaleLowerCase("pt-BR")] ?? match;
    },
  );
}

function htmlToPdfParagraphs(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6])>\s*<\s*(p|div|h[1-6])[^>]*>/gi, "\n\n")
      .replace(/<li[^>]*>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\u00a0/g, " "),
  )
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .split("\n")
        .map((line) => line.trim())
        .join("\n")
        .trim(),
    )
    .filter(Boolean);
}

function ensurePdfSpace(document: PDFKit.PDFDocument, height: number) {
  if (document.y + height > document.page.height - document.page.margins.bottom) {
    document.addPage();
  }
}

function drawOfficeFallbackLogo(document: PDFKit.PDFDocument, x: number, y: number) {
  document
    .roundedRect(x, y, 74, 48, 6)
    .lineWidth(0.8)
    .strokeColor("#94a3b8")
    .stroke();
  document
    .font("Helvetica-Bold")
    .fontSize(16)
    .fillColor("#0f172a")
    .text("OF", x, y + 16, { align: "center", width: 74 });
}

function drawOfficeHeader(
  document: PDFKit.PDFDocument,
  letter: Awaited<ReturnType<typeof getEntryRequestOfficeLetter>>,
  logo: Buffer | null,
) {
  const left = document.page.margins.left;
  const right = document.page.width - document.page.margins.right;
  const titleX = left + 92;

  if (logo) {
    try {
      document.image(logo, left, 42, { fit: [74, 48] });
    } catch {
      drawOfficeFallbackLogo(document, left, 42);
    }
  } else {
    drawOfficeFallbackLogo(document, left, 42);
  }

  document
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#111827")
    .text(letter.header.title, titleX, 44, { width: right - titleX });
  document
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#374151")
    .text(letter.header.subtitle, titleX, 62, { width: right - titleX });
  document
    .moveTo(left, 104)
    .lineTo(right, 104)
    .lineWidth(0.6)
    .strokeColor("#d1d5db")
    .stroke();
  document.x = left;
  document.y = 132;
}

function drawOfficeFooter(document: PDFKit.PDFDocument) {
  const range = document.bufferedPageRange();

  for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
    document.switchToPage(pageIndex);

    const left = document.page.margins.left;
    const right = document.page.width - document.page.margins.right;
    const footerY = document.page.height - 52;
    const originalBottomMargin = document.page.margins.bottom;

    document
      .moveTo(left, footerY)
      .lineTo(right, footerY)
      .lineWidth(0.5)
      .strokeColor("#e5e7eb")
      .stroke();

    document.page.margins.bottom = 0;
    try {
      document
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#6b7280")
        .text(`Pagina ${pageIndex + 1} de ${range.count}`, left, footerY + 10, {
          align: "right",
          lineBreak: false,
          width: right - left,
        });
    } finally {
      document.page.margins.bottom = originalBottomMargin;
    }
  }
}

function officeLetterFileName(numberFormatted: string, requestId: string) {
  const suffix = numberFormatted.replace(/[^\d]+/g, "-").replace(/^-|-$/g, "");

  return `oficio-${suffix || requestId}.pdf`;
}

async function ensureOfficeNumber(
  prisma: Prisma.TransactionClient,
  request: OfficeRequest,
) {
  if (request.officeNumber && request.officeYear) {
    return request;
  }

  const officeYear = request.officeYear ?? request.movementDate.getFullYear();
  const officeNumber = await nextOfficeNumber(
    prisma,
    request.warehouseId,
    officeYear,
  );

  return prisma.entryRequest.update({
    data: {
      officeNumber,
      officeYear,
    },
    include: officeRequestInclude,
    where: { id: request.id },
  });
}

export async function getEntryRequestOfficeLetter(
  prisma: PrismaClient,
  requestId: string,
  viewerName: string,
) {
  return prisma.$transaction(async (transaction) => {
    const foundRequest = await transaction.entryRequest.findUnique({
      include: officeRequestInclude,
      where: { id: requestId },
    });

    if (!foundRequest) {
      throw new AppError(404, "Solicitação não encontrada.");
    }

    if (foundRequest.warehouse.isGeneral) {
      throw new AppError(
        400,
        "Ofício disponível apenas para almoxarifados solicitantes.",
      );
    }

    const request = await ensureOfficeNumber(transaction, foundRequest);
    const settings = await transaction.systemSettings.upsert({
      create: defaultSettings,
      update: {},
      where: { id: settingsId },
    });
    const template = await transaction.officeLetterTemplate.findFirst({
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      where: { active: true },
    });
    const items = [requestItem(request)];
    const numberFormatted = formatOfficeNumber(
      request.officeNumber,
      request.officeYear,
    );
    const variables = {
      almoxarifado_nome: request.warehouse.name,
      ano_oficio: String(request.officeYear ?? ""),
      data_atual: formatDate(new Date()),
      data_solicitacao: formatDate(request.movementDate),
      itens_solicitados_html: renderItemsHtml(items),
      itens_solicitados_texto: renderItemsText(items),
      numero_oficio: request.officeNumber
        ? String(request.officeNumber).padStart(3, "0")
        : "",
      oficio_numero_ano: numberFormatted,
      produto_nome: request.product.name,
      quantidade_solicitada: String(request.quantity),
      secretaria_nome: request.warehouse.category.name,
      solicitante_nome: request.requestedBy.name,
      unidade_solicitada: request.product.unit.abbreviation,
      usuario_logado: viewerName,
    };
    const subjectTemplate = template?.subject ?? defaultOfficeLetterSubject;
    const contentTemplate =
      template?.contentHtml ?? defaultOfficeLetterContentHtml;

    return {
      contentHtml: renderTemplate(
        contentTemplate,
        variables,
        new Set(["itens_solicitados_html"]),
      ),
      header: {
        logoUrl:
          settings.officeLogoUrl ?? settings.reportLogoUrl ?? settings.logoUrl ?? null,
        subtitle: request.warehouse.name,
        title: request.warehouse.category.name,
      },
      items,
      number: request.officeNumber,
      numberFormatted,
      request: {
        id: request.id,
        status: request.status,
        warehouseId: request.warehouseId,
      },
      subject: renderPlainTemplate(subjectTemplate, variables),
      year: request.officeYear,
    };
  });
}

export async function buildEntryRequestOfficeLetterPdf(
  prisma: PrismaClient,
  requestId: string,
  viewerName: string,
) {
  const letter = await getEntryRequestOfficeLetter(prisma, requestId, viewerName);
  const logo = await loadOfficeLogo(letter.header.logoUrl);
  const document = new PDFDocument({
    bufferPages: true,
    margins: {
      bottom: 72,
      left: 72,
      right: 72,
      top: 42,
    },
    size: "A4",
  });
  const chunks: Buffer[] = [];

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    drawOfficeHeader(document, letter, logo);

    for (const paragraph of htmlToPdfParagraphs(letter.contentHtml)) {
      const isTitle = /^OF[IÍ]CIO\s+N[º°]/i.test(paragraph);
      const contentX = document.page.margins.left;
      const contentWidth =
        document.page.width -
        document.page.margins.left -
        document.page.margins.right;

      document
        .font(isTitle ? "Times-Bold" : "Times-Roman")
        .fontSize(isTitle ? 13 : 12);

      const paragraphHeight = document.heightOfString(paragraph, {
        align: isTitle ? "center" : "left",
        width: contentWidth,
      });

      ensurePdfSpace(document, paragraphHeight + 18);
      document
        .fillColor("#111827")
        .text(paragraph, contentX, document.y, {
          align: isTitle ? "center" : "left",
          lineGap: 4,
          width: contentWidth,
        });
      document.moveDown(isTitle ? 1.2 : 0.8);
    }

    drawOfficeFooter(document);
    document.end();
  });

  return {
    buffer,
    fileName: officeLetterFileName(letter.numberFormatted, requestId),
  };
}
