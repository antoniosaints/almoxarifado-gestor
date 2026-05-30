import {
  MovementType,
  Prisma,
  RequestStatus,
  type PrismaClient,
} from "@prisma/client";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import htmlToPdfmake from "html-to-pdfmake";
import { JSDOM } from "jsdom";
import pdfMake from "pdfmake";
import type { PdfMakeFontDefinitions } from "pdfmake";
import { AppError } from "../lib/errors.js";
import { defaultSettings, settingsId } from "./settings-service.js";
import {
  convertQuantityToBase,
  quantityConversionAuditData,
} from "./unit-conversion-service.js";
import { getLocalUploadRoot } from "./upload-service.js";

const require = createRequire(import.meta.url);
const robotoFonts = require("pdfmake/fonts/Roboto") as PdfMakeFontDefinitions;
const allowedPdfFontPaths = new Set(
  Object.values(robotoFonts).flatMap((fontFamily) =>
    Object.values(fontFamily).map((fontPath) => path.resolve(fontPath)),
  ),
);

pdfMake.addFonts(robotoFonts);
pdfMake.setLocalAccessPolicy((filePath) =>
  allowedPdfFontPaths.has(path.resolve(filePath)),
);

type EntryRequestInput = {
  items?: Array<{
    productId: string;
    quantity: number;
    unitId?: string | null;
  }>;
  movementDate: Date;
  observation?: string | null;
  productId: string;
  quantity: number;
  unitId?: string | null;
  requestedById: string;
  warehouseId: string;
};

type ApprovalInput = {
  invoiceId?: string | null;
  items?: Array<{
    id?: string;
    productId?: string;
    quantity: number;
  }>;
  quantity?: number;
  requestId: string;
  reviewedById: string;
};

const officeRequestInclude = {
  items: {
    include: {
      product: {
        include: {
          unit: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  },
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

function assertPositiveRequestedQuantity(quantity: number) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new AppError(400, "Informe uma quantidade maior que zero.");
  }
}

function normalizeEntryRequestItems(input: EntryRequestInput) {
  const items = input.items?.length
    ? input.items
    : [
        {
          productId: input.productId,
          quantity: input.quantity,
          unitId: input.unitId,
        },
      ];

  for (const item of items) {
    assertPositiveRequestedQuantity(item.quantity);
  }

  return items;
}

type NormalizedApprovalItem = {
  id?: string;
  productId: string;
  quantity: number;
};

function requestItemsFromRecord(
  request: Prisma.EntryRequestGetPayload<{ include: { items: true } }>,
): NormalizedApprovalItem[] {
  if (request.items.length) {
    return request.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
    }));
  }

  return [
    {
      productId: request.productId,
      quantity: request.quantity,
    },
  ];
}

function normalizeApprovalItems(
  request: Prisma.EntryRequestGetPayload<{ include: { items: true } }>,
  input: ApprovalInput,
) {
  const requestItems = requestItemsFromRecord(request);

  if (!input.items?.length) {
    const approvedQuantity = input.quantity ?? requestItems[0]?.quantity ?? request.quantity;

    assertPositiveQuantity(approvedQuantity);

    return requestItems.map((item, index) => ({
      ...item,
      quantity: index === 0 ? approvedQuantity : item.quantity,
    }));
  }

  const requestedById = new Map(
    requestItems
      .filter((item) => item.id)
      .map((item) => [item.id as string, item]),
  );
  const requestedByProductId = new Map(
    requestItems.map((item) => [item.productId, item]),
  );
  const approvedById = new Map<string, NonNullable<ApprovalInput["items"]>[number]>();
  const approvedByProductId = new Map<
    string,
    NonNullable<ApprovalInput["items"]>[number]
  >();

  for (const item of input.items) {
    assertPositiveQuantity(item.quantity);

    const requestedItem =
      (item.id ? requestedById.get(item.id) : undefined) ??
      (item.productId ? requestedByProductId.get(item.productId) : undefined);

    if (!requestedItem) {
      throw new AppError(400, "Item aprovado nao pertence a solicitacao.");
    }

    if (item.id) {
      approvedById.set(item.id, item);
    }

    if (item.productId) {
      approvedByProductId.set(item.productId, item);
    }
  }

  return requestItems.map((item) => {
    const approvedItem =
      (item.id ? approvedById.get(item.id) : undefined) ??
      approvedByProductId.get(item.productId);

    return {
      ...item,
      quantity: approvedItem?.quantity ?? item.quantity,
    };
  });
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
  const items = normalizeEntryRequestItems(input);
  const primaryItem = items[0];

  if (!primaryItem) {
    throw new AppError(400, "Informe ao menos um item para solicitar.");
  }

  return prisma.$transaction(async (transaction) => {
    const warehouse = await transaction.warehouse.findUnique({
      select: {
        isGeneral: true,
      },
      where: {
        id: input.warehouseId,
      },
    });
    const productIds = [...new Set(items.map((item) => item.productId))];
    const stocks = await transaction.stock.findMany({
      select: {
        productId: true,
      },
      where: {
        productId: {
          in: productIds,
        },
        warehouseId: input.warehouseId,
      },
    });
    const stockedProductIds = new Set(stocks.map((stock) => stock.productId));

    if (!warehouse || productIds.some((productId) => !stockedProductIds.has(productId))) {
      throw new AppError(
        400,
        "Solicite apenas produtos já cadastrados no estoque deste almoxarifado.",
      );
    }

    const convertedItems = await Promise.all(
      items.map(async (item) => ({
        ...item,
        converted: await convertQuantityToBase(transaction, {
          productId: item.productId,
          quantity: item.quantity,
          unitId: item.unitId,
        }),
      })),
    );
    const primaryConverted = convertedItems[0];

    const officeYear = input.movementDate.getFullYear();
    const shouldCreateOffice = !warehouse.isGeneral;
    const officeNumber = shouldCreateOffice
      ? await nextOfficeNumber(transaction, input.warehouseId, officeYear)
      : null;

    return transaction.entryRequest.create({
      data: {
        items: {
          create: convertedItems.map((item) => ({
            ...quantityConversionAuditData(item.converted),
            productId: item.productId,
            quantity: item.converted.baseQuantity,
          })),
        },
        movementDate: input.movementDate,
        observation: input.observation,
        officeNumber,
        officeYear: shouldCreateOffice ? officeYear : null,
        productId: primaryConverted.productId,
        quantity: primaryConverted.converted.baseQuantity,
        requestedById: input.requestedById,
        ...quantityConversionAuditData(primaryConverted.converted),
        warehouseId: input.warehouseId,
      },
    });
  });
}

async function createEntryRequestLegacy(
  prisma: PrismaClient,
  input: EntryRequestInput,
) {
  const items = normalizeEntryRequestItems(input);
  const primaryItem = items[0];

  if (!primaryItem) {
    throw new AppError(400, "Informe ao menos um item para solicitar.");
  }

  const stock = await prisma.stock.findUnique({
    where: {
      warehouseId_productId: {
        productId: primaryItem.productId,
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

  const convertedItems = await Promise.all(
    items.map(async (item) => ({
      ...item,
      converted: await convertQuantityToBase(prisma, {
        productId: item.productId,
        quantity: item.quantity,
        unitId: item.unitId,
      }),
    })),
  );
  const primaryConverted = convertedItems[0];

  return prisma.entryRequest.create({
    data: {
      items: {
          create: convertedItems.map((item) => ({
            ...quantityConversionAuditData(item.converted),
            productId: item.productId,
            quantity: item.converted.baseQuantity,
          })),
      },
      movementDate: input.movementDate,
      observation: input.observation,
      productId: primaryConverted.productId,
      quantity: primaryConverted.converted.baseQuantity,
      requestedById: input.requestedById,
      ...quantityConversionAuditData(primaryConverted.converted),
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
      include: {
        items: true,
      },
      where: { id: input.requestId },
    });

    if (request.status !== RequestStatus.PENDING) {
      throw new AppError(409, "Esta solicitação já foi analisada.");
    }

    const approvedItems = normalizeApprovalItems(request, input);
    const primaryItem = approvedItems[0];

    if (!primaryItem) {
      throw new AppError(400, "Informe ao menos um item para aprovar.");
    }

    const generalWarehouse = await transaction.warehouse.findFirst({
      where: {
        active: true,
        isGeneral: true,
      },
    });

    if (!generalWarehouse) {
      throw new AppError(409, "Cadastre um almoxarifado geral ativo para aprovar.");
    }

    const movementPairs = [];
    const summaries = [];

    for (const item of approvedItems) {
      const generalStock = await transaction.stock.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: generalWarehouse.id,
            productId: item.productId,
          },
        },
      });

      if (!generalStock || generalStock.currentQuantity < item.quantity) {
        throw new AppError(409, "Quantidade insuficiente no estoque geral.");
      }

      const destinationStockBefore = await transaction.stock.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: request.warehouseId,
            productId: item.productId,
          },
        },
        select: { currentQuantity: true },
      });

      const sourceStock = await transaction.stock.update({
        where: { id: generalStock.id },
        data: {
          currentQuantity: {
            decrement: item.quantity,
          },
          lastMovementAt: request.movementDate,
        },
      });

      const stock = await transaction.stock.upsert({
        where: {
          warehouseId_productId: {
            warehouseId: request.warehouseId,
            productId: item.productId,
          },
        },
        update: {
          currentQuantity: {
            increment: item.quantity,
          },
          lastMovementAt: request.movementDate,
        },
        create: {
          currentQuantity: item.quantity,
          lastMovementAt: request.movementDate,
          productId: item.productId,
          warehouseId: request.warehouseId,
        },
      });

      const sourceMovement = await transaction.stockMovement.create({
        data: {
          destinationWarehouseId: request.warehouseId,
          movementDate: request.movementDate,
          observation: request.observation,
          productId: item.productId,
          quantity: item.quantity,
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
          productId: item.productId,
          quantity: item.quantity,
          responsibleUserId: input.reviewedById,
          sourceWarehouseId: generalWarehouse.id,
          stockId: stock.id,
          type: MovementType.TRANSFERENCIA_ENTRADA,
          warehouseId: request.warehouseId,
        },
      });

      if (item.id) {
        await transaction.entryRequestItem.update({
          data: {
            quantity: item.quantity,
          },
          where: { id: item.id },
        });
      }

      movementPairs.push({
        movement,
        sourceMovement,
        sourceStock,
        stock,
      });
      summaries.push({
        approvedQuantity: item.quantity,
        destinationAfter:
          (destinationStockBefore?.currentQuantity ?? 0) + item.quantity,
        destinationBefore: destinationStockBefore?.currentQuantity ?? 0,
        productId: item.productId,
        sourceAfter: generalStock.currentQuantity - item.quantity,
        sourceBefore: generalStock.currentQuantity,
      });
    }

    const approvedRequest = await transaction.entryRequest.update({
      where: { id: request.id },
      data: {
        productId: primaryItem.productId,
        quantity: primaryItem.quantity,
        reviewedAt: new Date(),
        reviewedById: input.reviewedById,
        status: RequestStatus.APPROVED,
      },
    });
    const firstMovementPair = movementPairs[0];
    const firstSummary = summaries[0];

    return {
      itemSummaries: summaries,
      movement: firstMovementPair?.movement,
      movements: movementPairs.map((pair) => pair.movement),
      request: approvedRequest,
      sourceMovement: firstMovementPair?.sourceMovement,
      sourceMovements: movementPairs.map((pair) => pair.sourceMovement),
      sourceStock: firstMovementPair?.sourceStock,
      stock: firstMovementPair?.stock,
      summary: firstSummary,
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
    unitName: request.product.unit.name,
  };
}

type OfficeRequestItem = ReturnType<typeof requestItem>;

function requestItems(request: OfficeRequest): OfficeRequestItem[] {
  if (request.items.length) {
    return request.items.map((item) => ({
      productName: item.product.name,
      quantity: item.quantity,
      unit: item.product.unit.abbreviation,
      unitName: item.product.unit.name,
    }));
  }

  return [requestItem(request)];
}

function renderItemsHtml(items: OfficeRequestItem[]) {
  return items
    .map((item, index) => {
      const suffix = index === items.length - 1 ? "." : ";";

      return `${escapeHtml(item.productName)} - ${item.quantity} ${escapeHtml(
        item.unitName,
      )}${suffix}`;
    })
    .join("<br />");
}

function renderItemsText(items: OfficeRequestItem[]) {
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

type OfficeHeaderAlignment = "LEFT" | "CENTER" | "RIGHT";

type OfficeDocumentChrome = {
  footerText?: string | null;
  headerAlignment?: string | null;
  headerImageUrl?: string | null;
  headerText?: string | null;
};

const headerAlignmentStyles: Record<OfficeHeaderAlignment, string> = {
  CENTER: "center",
  LEFT: "left",
  RIGHT: "right",
};

const officeDocumentAttribute = 'data-office-letter-document="true"';

function isCompleteOfficeDocument(html: string) {
  return /\sdata-office-letter-document(?:\s*=\s*(?:"true"|'true'|true))?/i.test(
    html,
  );
}

function wrapOfficeDocument(contentHtml: string) {
  return [
    `<article ${officeDocumentAttribute} class="office-letter-document" style="min-height:297mm;width:210mm;margin:0 auto;padding:18mm 20mm;background:#fff;color:#111827;font-family:'Times New Roman',serif;font-size:12pt;line-height:1.45;">`,
    contentHtml,
    "</article>",
  ].join("");
}

function hasOfficeChrome(chrome?: OfficeDocumentChrome | null) {
  return Boolean(
    chrome?.headerImageUrl?.trim() ||
      chrome?.headerText?.trim() ||
      chrome?.footerText?.trim(),
  );
}

function normalizeHeaderAlignment(value?: string | null): OfficeHeaderAlignment {
  return value === "CENTER" || value === "RIGHT" ? value : "LEFT";
}

function unwrapOfficeDocument(contentHtml: string) {
  if (!isCompleteOfficeDocument(contentHtml)) {
    return contentHtml;
  }

  try {
    const { window } = new JSDOM(contentHtml) as {
      window: {
        document: {
          querySelector(selector: string): { innerHTML: string } | null;
        };
      };
    };
    const document = window.document;
    const documentRoot = document.querySelector("[data-office-letter-document]");

    return documentRoot?.innerHTML ?? contentHtml;
  } catch {
    return contentHtml;
  }
}

function renderMultilineHtmlText(text: string, variables: Record<string, string>) {
  return renderTemplate(text, variables)
    .split(/\r?\n/)
    .map((line) =>
      line.trim()
        ? `<p style="margin:0;">${line}</p>`
        : '<p style="margin:0;">&nbsp;</p>',
    )
    .join("");
}


function buildOfficeHeaderHtml(
  chrome: OfficeDocumentChrome | null | undefined,
  variables: Record<string, string>,
) {
  
  const imageUrl = chrome?.headerImageUrl
    ? renderPlainTemplate(chrome.headerImageUrl, variables).trim()
    : "";
  const headerText = chrome?.headerText?.trim() ?? "";

  if (!imageUrl && !headerText) {
    return "";
  }

  const alignment = headerAlignmentStyles[
    normalizeHeaderAlignment(chrome?.headerAlignment)
  ];
  const imageHtml = imageUrl
    ? `<div style="margin:0 0 8px 0;"><img src="${escapeHtml(
        imageUrl,
      )}" alt="" style="max-height:80px;max-width:180px;width:auto;height:auto;" /></div>`
    : "";
  const textHtml = headerText
    ? `<div style="font-size:11pt;line-height:1.25;">${renderMultilineHtmlText(
        headerText,
        variables,
      )}</div>`
    : "";

  return `<header data-office-letter-header="true" style="margin:0 0 18px 0;text-align:${alignment};">${imageHtml}${textHtml}</header>`;
}

function buildOfficeFooterHtml(
  chrome: OfficeDocumentChrome | null | undefined,
  variables: Record<string, string>,
) {
  const footerText = chrome?.footerText?.trim() ?? "";

  if (!footerText) {
    return "";
  }

  return `<footer data-office-letter-footer="true" style="margin:28px 0 0 0;text-align:center;color:#4b5563;font-size:9pt;line-height:1.25;">${renderMultilineHtmlText(
    footerText,
    variables,
  )}</footer>`;
}

function buildOfficeDocumentHtml(
  contentHtml: string,
  chrome?: OfficeDocumentChrome | null,
  variables: Record<string, string> = {},
) {
  if (isCompleteOfficeDocument(contentHtml) && !hasOfficeChrome(chrome)) {
    return contentHtml;
  }

  const bodyHtml = hasOfficeChrome(chrome)
    ? unwrapOfficeDocument(contentHtml)
    : contentHtml;
  const documentHtml = [
    buildOfficeHeaderHtml(chrome, variables),
    `<main data-office-letter-body="true">${bodyHtml}</main>`,
    buildOfficeFooterHtml(chrome, variables),
  ].join("");

  return wrapOfficeDocument(documentHtml);
}

function officeLetterFileName(numberFormatted: string, requestId: string) {
  const suffix = numberFormatted.replace(/[^\d]+/g, "-").replace(/^-|-$/g, "");

  return `oficio-${suffix || requestId}.pdf`;
}

function mimeTypeFromPath(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  if (extension === ".png") {
    return "image/png";
  }

  if (extension === ".svg") {
    return "image/svg+xml";
  }

  if (extension === ".webp") {
    return "image/webp";
  }

  return "application/octet-stream";
}

function localUploadPathFromImageSource(src: string) {
  const trimmed = src.trim();

  if (!trimmed || trimmed.startsWith("data:")) {
    return null;
  }

  let pathname = "";

  try {
    pathname = /^https?:\/\//i.test(trimmed)
      ? new URL(trimmed).pathname
      : trimmed.split("#")[0]?.split("?")[0] ?? "";
  } catch {
    return null;
  }

  const normalizedPathname = decodeURIComponent(pathname).replace(/\\/g, "/");
  const uploadPath = normalizedPathname.startsWith("/uploads/")
    ? normalizedPathname.slice("/uploads/".length)
    : normalizedPathname.startsWith("uploads/")
      ? normalizedPathname.slice("uploads/".length)
      : null;

  if (!uploadPath) {
    return null;
  }

  const uploadRoot = getLocalUploadRoot();
  const filePath = path.resolve(uploadRoot, uploadPath);
  const relativePath = path.relative(uploadRoot, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return filePath;
}

async function inlineLocalUploadImages(html: string) {
  const matches = Array.from(
    html.matchAll(/(<img\b[^>]*?\bsrc\s*=\s*)(["'])(.*?)\2/gi),
  );
  let preparedHtml = html;

  for (const match of matches) {
    const [fullMatch, prefix, quote, src] = match;
    const filePath = localUploadPathFromImageSource(src ?? "");

    if (!filePath) {
      continue;
    }

    try {
      const image = await readFile(filePath);
      const dataUrl = `data:${mimeTypeFromPath(filePath)};base64,${image.toString("base64")}`;

      preparedHtml = preparedHtml.replace(
        fullMatch,
        `${prefix}${quote}${dataUrl}${quote}`,
      );
    } catch {
      // If a legacy template references a missing local upload, keep the HTML intact.
    }
  }

  return preparedHtml;
}

function normalizeOfficeDocumentHtmlForPdf(html: string) {
  return html
    .replace(/<article\b/gi, "<div")
    .replace(/<\/article>/gi, "</div>")
    .replace(/<section\b/gi, "<div")
    .replace(/<\/section>/gi, "</div>");
}

function isAllowedOfficeImageUrl(value: string) {
  const allowedBases = [
    process.env.BACKEND_PUBLIC_URL,
    process.env.UPLOAD_PUBLIC_URL,
    process.env.S3_PUBLIC_URL,
  ].filter((base): base is string => Boolean(base?.trim()));

  if (!allowedBases.length) {
    return false;
  }

  try {
    const url = new URL(value);

    return allowedBases.some((base) => {
      try {
        const allowed = new URL(base);
        const allowedPath = allowed.pathname.replace(/\/$/, "");

        return (
          url.origin === allowed.origin &&
          (allowedPath === "" || url.pathname.startsWith(allowedPath))
        );
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

const supportedPdfFonts = new Set(Object.keys(robotoFonts));

function normalizePdfDefinitionFonts(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizePdfDefinitionFonts);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const normalized: Record<string, unknown> = {};

  for (const [key, entryValue] of Object.entries(value)) {
    if (
      key === "font" &&
      typeof entryValue === "string" &&
      !supportedPdfFonts.has(entryValue)
    ) {
      continue;
    }

    normalized[key] = normalizePdfDefinitionFonts(entryValue);
  }

  return normalized;
}

async function renderOfficePdfWithPdfmake(documentHtml: string) {
  const { window } = new JSDOM("");
  const preparedHtml = normalizeOfficeDocumentHtmlForPdf(
    await inlineLocalUploadImages(documentHtml),
  );
  const content = normalizePdfDefinitionFonts(
    htmlToPdfmake(preparedHtml, {
      removeExtraBlanks: false,
      window,
    }),
  );

  pdfMake.setUrlAccessPolicy(isAllowedOfficeImageUrl);

  return pdfMake
    .createPdf({
      content,
      defaultStyle: {
        font: "Roboto",
        fontSize: 12,
        lineHeight: 1,
      },
      pageMargins: [30, 30, 30, 30],
      pageSize: "A4",
    })
    .getBuffer();
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
    const items = requestItems(request);
    const firstItem = items[0] ?? requestItem(request);
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
      produto_nome: firstItem.productName,
      quantidade_solicitada: String(firstItem.quantity),
      secretaria_nome: request.warehouse.category.name,
      solicitante_nome: request.requestedBy.name,
      unidade_solicitada: firstItem.unit,
      usuario_logado: viewerName,
    };
    const subjectTemplate = template?.subject ?? defaultOfficeLetterSubject;
    const contentTemplate =
      template?.contentHtml ?? defaultOfficeLetterContentHtml;
    const subject = renderPlainTemplate(subjectTemplate, variables);
    const contentHtml = renderTemplate(
      contentTemplate,
      variables,
      new Set(["itens_solicitados_html"]),
    );
    const chrome = template
      ? {
          footerText: template.footerText,
          headerAlignment: template.headerAlignment,
          headerImageUrl: template.headerImageUrl,
          headerText: template.headerText,
        }
      : null;
    const header = {
      logoUrl:
        settings.officeLogoUrl ?? settings.reportLogoUrl ?? settings.logoUrl ?? null,
      subtitle: request.warehouse.name,
      title: request.warehouse.category.name,
    };

    return {
      contentHtml,
      documentHtml: buildOfficeDocumentHtml(contentHtml, chrome, variables),
      header,
      items,
      number: request.officeNumber,
      numberFormatted,
      request: {
        id: request.id,
        status: request.status,
        warehouseId: request.warehouseId,
      },
      subject,
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
  let pdfBuffer: Buffer | Uint8Array;

  try {
    pdfBuffer = await renderOfficePdfWithPdfmake(letter.documentHtml);
  } catch (error) {
    throw new AppError(
      500,
      "Nao foi possivel exportar o oficio em PDF a partir do modelo configurado.",
    );
  }

  return {
    buffer: Buffer.from(pdfBuffer),
    fileName: officeLetterFileName(letter.numberFormatted, requestId),
  };
}
