import {
  MovementType,
  Prisma,
  RequestStatus,
  type PrismaClient,
} from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { defaultSettings, settingsId } from "./settings-service.js";
import {
  convertQuantityToBase,
  quantityConversionAuditData,
} from "./unit-conversion-service.js";

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
  };
}

type OfficeRequestItem = ReturnType<typeof requestItem>;

function requestItems(request: OfficeRequest): OfficeRequestItem[] {
  if (request.items.length) {
    return request.items.map((item) => ({
      productName: item.product.name,
      quantity: item.quantity,
      unit: item.product.unit.abbreviation,
    }));
  }

  return [requestItem(request)];
}

function renderItemsHtml(items: OfficeRequestItem[]) {
  return items
    .map((item, index) => {
      const suffix = index === items.length - 1 ? "." : ";";

      return `${escapeHtml(item.productName)} - ${item.quantity} ${escapeHtml(
        item.unit,
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

function buildOfficeDocumentHtml(contentHtml: string) {
  if (isCompleteOfficeDocument(contentHtml)) {
    return contentHtml;
  }

  return wrapOfficeDocument(contentHtml);
}

function officeLetterFileName(numberFormatted: string, requestId: string) {
  const suffix = numberFormatted.replace(/[^\d]+/g, "-").replace(/^-|-$/g, "");

  return `oficio-${suffix || requestId}.pdf`;
}

function officePdfHtml(documentHtml: string) {
  const baseUrl = process.env.BACKEND_PUBLIC_URL ?? "http://127.0.0.1:3333";

  return [
    "<!doctype html>",
    '<html lang="pt-BR">',
    "<head>",
    '<meta charset="utf-8" />',
    `<base href="${escapeHtml(baseUrl)}" />`,
    "<style>",
    "@page{size:A4;margin:0}",
    "html,body{margin:0;padding:0;background:#fff;color:#111827}",
    "body{font-family:'Times New Roman',Times,serif;font-size:12pt;line-height:1.45}",
    ".office-letter-document{box-sizing:border-box}",
    ".office-letter-document *{box-sizing:border-box}",
    ".office-letter-document img{max-width:100%}",
    "</style>",
    "</head>",
    `<body>${documentHtml}</body>`,
    "</html>",
  ].join("");
}

async function renderOfficePdfWithBrowser(documentHtml: string) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({ viewport: { height: 1123, width: 794 } });

    await page.setContent(officePdfHtml(documentHtml), {
      waitUntil: "networkidle",
    });

    return page.pdf({
      format: "A4",
      margin: {
        bottom: "0",
        left: "0",
        right: "0",
        top: "0",
      },
      printBackground: true,
    });
  } finally {
    await browser.close();
  }
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
    const header = {
      logoUrl:
        settings.officeLogoUrl ?? settings.reportLogoUrl ?? settings.logoUrl ?? null,
      subtitle: request.warehouse.name,
      title: request.warehouse.category.name,
    };

    return {
      contentHtml,
      documentHtml: buildOfficeDocumentHtml(contentHtml),
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
  let browserPdf: Buffer | Uint8Array;

  try {
    browserPdf = await renderOfficePdfWithBrowser(letter.documentHtml);
  } catch (error) {
    throw new AppError(
      500,
      "Nao foi possivel exportar o oficio em PDF. Instale o Chromium do Playwright no ambiente do backend.",
    );
  }

  return {
    buffer: Buffer.from(browserPdf),
    fileName: officeLetterFileName(letter.numberFormatted, requestId),
  };
}
