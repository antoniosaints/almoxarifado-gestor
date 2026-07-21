import {
  EntryRequestType,
  MovementType,
  Prisma,
  RequestStatus,
  type PrismaClient,
} from "@prisma/client";
import { JSDOM } from "jsdom";
import { AppError } from "../lib/errors.js";
import {
  convertQuantityToBase,
  quantityConversionAuditData,
  roundCurrency,
  toNumber,
} from "./unit-conversion-service.js";

type EntryRequestInput = {
  items?: Array<{
    productId: string;
    quantity: number;
    unitId?: string | null;
  }>;
  movementDate: Date;
  observation?: string | null;
  reason?: string | null;
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

/**
 * Retorna o menor número de ofício livre do almoxarifado no ano. Usar o menor
 * livre (em vez de "maior + 1") faz com que um número liberado por uma
 * rejeição volte a ser usado, mantendo a numeração contínua.
 */
async function nextOfficeNumber(
  prisma: Prisma.TransactionClient,
  warehouseId: string,
  year: number,
) {
  const usedNumbers = await prisma.entryRequest.findMany({
    orderBy: { officeNumber: "asc" },
    select: { officeNumber: true },
    where: {
      officeNumber: { not: null },
      officeYear: year,
      warehouseId,
    },
  });

  let candidate = 1;

  for (const { officeNumber } of usedNumbers) {
    if (officeNumber === null || officeNumber > candidate) {
      break;
    }

    if (officeNumber === candidate) {
      candidate += 1;
    }
  }

  return candidate;
}

async function assertAvailableGeneralStock(
  prisma: Prisma.TransactionClient,
  warehouseId: string,
  items: Array<{ productId: string; quantity: number }>,
) {
  const quantitiesByProduct = new Map<string, number>();

  for (const item of items) {
    quantitiesByProduct.set(
      item.productId,
      (quantitiesByProduct.get(item.productId) ?? 0) + item.quantity,
    );
  }

  const stocks = await prisma.stock.findMany({
    select: {
      currentQuantity: true,
      productId: true,
    },
    where: {
      productId: {
        in: [...quantitiesByProduct.keys()],
      },
      warehouseId,
    },
  });
  const stockByProduct = new Map(stocks.map((stock) => [stock.productId, stock]));

  for (const [productId, quantity] of quantitiesByProduct) {
    const stock = stockByProduct.get(productId);

    if (!stock || stock.currentQuantity < quantity) {
      throw new AppError(409, "Quantidade insuficiente no estoque geral.");
    }
  }
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
        reason: input.reason ?? null,
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

export async function createAdHocOutputRequest(
  prisma: PrismaClient,
  input: EntryRequestInput,
) {
  const reason = input.reason?.trim();

  if (!reason) {
    throw new AppError(400, "Informe o motivo da solicitação.");
  }

  const items = normalizeEntryRequestItems(input);
  const primaryItem = items[0];

  if (!primaryItem) {
    throw new AppError(400, "Informe ao menos um item para solicitar.");
  }

  return prisma.$transaction(async (transaction) => {
    const warehouse = await transaction.warehouse.findUnique({
      select: {
        active: true,
        isGeneral: true,
      },
      where: {
        id: input.warehouseId,
      },
    });

    if (!warehouse?.active || !warehouse.isGeneral) {
      throw new AppError(
        400,
        "Saida avulsa disponivel apenas no almoxarifado geral ativo.",
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

    await assertAvailableGeneralStock(
      transaction,
      input.warehouseId,
      convertedItems.map((item) => ({
        productId: item.productId,
        quantity: item.converted.baseQuantity,
      })),
    );

    const officeYear = input.movementDate.getFullYear();
    const officeNumber = await nextOfficeNumber(
      transaction,
      input.warehouseId,
      officeYear,
    );

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
        reason,
        officeNumber,
        officeYear,
        productId: primaryConverted.productId,
        quantity: primaryConverted.converted.baseQuantity,
        requestedById: input.requestedById,
        ...quantityConversionAuditData(primaryConverted.converted),
        type: EntryRequestType.AD_HOC_OUTPUT,
        warehouseId: input.warehouseId,
      },
    });
  });
}

export async function updateEntryRequest(
  prisma: PrismaClient,
  requestId: string,
  input: EntryRequestInput,
) {
  const items = normalizeEntryRequestItems(input);
  const primaryItem = items[0];

  if (!primaryItem) {
    throw new AppError(400, "Informe ao menos um item para solicitar.");
  }

  return prisma.$transaction(async (transaction) => {
    const request = await transaction.entryRequest.findUniqueOrThrow({
      select: {
        id: true,
        status: true,
        type: true,
        warehouseId: true,
      },
      where: { id: requestId },
    });

    if (request.status !== RequestStatus.PENDING) {
      throw new AppError(409, "Só é possível editar solicitações pendentes.");
    }

    const warehouse = await transaction.warehouse.findUnique({
      select: {
        active: true,
        isGeneral: true,
      },
      where: { id: request.warehouseId },
    });

    if (!warehouse) {
      throw new AppError(400, "Almoxarifado não encontrado.");
    }

    const isAdHocOutput = request.type === EntryRequestType.AD_HOC_OUTPUT;
    const reason = input.reason?.trim() || null;

    if (isAdHocOutput) {
      if (!warehouse.active || !warehouse.isGeneral) {
        throw new AppError(
          400,
          "Saida avulsa disponivel apenas no almoxarifado geral ativo.",
        );
      }

      if (!reason) {
        throw new AppError(400, "Informe o motivo da solicitação.");
      }
    }

    const productIds = [...new Set(items.map((item) => item.productId))];
    const stocks = await transaction.stock.findMany({
      select: {
        productId: true,
      },
      where: {
        productId: {
          in: productIds,
        },
        warehouseId: request.warehouseId,
      },
    });
    const stockedProductIds = new Set(stocks.map((stock) => stock.productId));

    if (productIds.some((productId) => !stockedProductIds.has(productId))) {
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

    if (isAdHocOutput) {
      await assertAvailableGeneralStock(
        transaction,
        request.warehouseId,
        convertedItems.map((item) => ({
          productId: item.productId,
          quantity: item.converted.baseQuantity,
        })),
      );
    }

    await transaction.entryRequestItem.deleteMany({
      where: { requestId: request.id },
    });

    return transaction.entryRequest.update({
      where: { id: request.id },
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
        reason,
        productId: primaryConverted.productId,
        quantity: primaryConverted.converted.baseQuantity,
        ...quantityConversionAuditData(primaryConverted.converted),
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

    if (request.type === EntryRequestType.AD_HOC_OUTPUT) {
      return approveAdHocOutputRequestInTransaction(transaction, request, input);
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
          entryRequestId: request.id,
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
          entryRequestId: request.id,
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

async function approveAdHocOutputRequestInTransaction(
  transaction: Prisma.TransactionClient,
  request: Prisma.EntryRequestGetPayload<{ include: { items: true } }>,
  input: ApprovalInput,
) {
  const warehouse = await transaction.warehouse.findUnique({
    select: {
      active: true,
      isGeneral: true,
    },
    where: {
      id: request.warehouseId,
    },
  });

  if (!warehouse?.active || !warehouse.isGeneral) {
    throw new AppError(
      400,
      "Saida avulsa disponivel apenas no almoxarifado geral ativo.",
    );
  }

  const approvedItems = normalizeApprovalItems(request, input);
  const primaryItem = approvedItems[0];

  if (!primaryItem) {
    throw new AppError(400, "Informe ao menos um item para aprovar.");
  }

  const movements = [];
  const stocks = [];
  const summaries = [];

  for (const item of approvedItems) {
    const stock = await transaction.stock.findUnique({
      where: {
        warehouseId_productId: {
          warehouseId: request.warehouseId,
          productId: item.productId,
        },
      },
    });

    if (!stock || stock.currentQuantity < item.quantity) {
      throw new AppError(409, "Quantidade insuficiente no estoque geral.");
    }

    const updatedStock = await transaction.stock.update({
      where: { id: stock.id },
      data: {
        currentQuantity: stock.currentQuantity - item.quantity,
        lastMovementAt: request.movementDate,
        totalValue: roundCurrency(
          (stock.currentQuantity - item.quantity) *
            toNumber(stock.unitPriceAverage),
        ),
      },
    });

    const movement = await transaction.stockMovement.create({
      data: {
        entryRequestId: request.id,
        movementDate: request.movementDate,
        observation: request.observation,
        productId: item.productId,
        quantity: item.quantity,
        responsibleUserId: input.reviewedById,
        stockId: stock.id,
        type: MovementType.SAIDA,
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

    movements.push(movement);
    stocks.push(updatedStock);
    summaries.push({
      approvedQuantity: item.quantity,
      productId: item.productId,
      sourceAfter: stock.currentQuantity - item.quantity,
      sourceBefore: stock.currentQuantity,
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

  return {
    itemSummaries: summaries,
    movement: movements[0],
    movements,
    request: approvedRequest,
    stock: stocks[0],
    stocks,
    summary: summaries[0],
  };
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
      // Libera o número do ofício para a próxima solicitação reaproveitar.
      officeNumber: null,
      officeYear: null,
      reviewedAt: new Date(),
      reviewedById,
      status: RequestStatus.REJECTED,
    },
  });
}

export async function undoEntryRequest(
  prisma: PrismaClient,
  requestId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const request = await transaction.entryRequest.findUniqueOrThrow({
      include: {
        movements: true,
      },
      where: { id: requestId },
    });

    if (request.status === RequestStatus.PENDING) {
      throw new AppError(409, "Esta solicitação já está pendente.");
    }

    const toPending = {
      reviewedAt: null,
      reviewedById: null,
      status: RequestStatus.PENDING,
    };

    // Rejeitadas não movimentaram estoque: basta voltar para pendente.
    if (request.status === RequestStatus.REJECTED) {
      return transaction.entryRequest.update({
        data: toPending,
        where: { id: request.id },
      });
    }

    // Aprovadas: estornar exatamente os efeitos das movimentações geradas.
    for (const movement of request.movements) {
      if (!movement.stockId) {
        continue;
      }

      if (movement.type === MovementType.TRANSFERENCIA_SAIDA) {
        // Saiu do estoque geral (origem) -> devolver.
        await transaction.stock.update({
          data: {
            currentQuantity: { increment: movement.quantity },
          },
          where: { id: movement.stockId },
        });
        continue;
      }

      if (movement.type === MovementType.TRANSFERENCIA_ENTRADA) {
        // Entrou no estoque destino -> retirar.
        await transaction.stock.update({
          data: {
            currentQuantity: { decrement: movement.quantity },
          },
          where: { id: movement.stockId },
        });
        continue;
      }

      if (movement.type === MovementType.SAIDA) {
        // Saída avulsa: devolver quantidade e recalcular o valor total.
        const stock = await transaction.stock.findUnique({
          where: { id: movement.stockId },
        });

        if (stock) {
          const restoredQuantity = stock.currentQuantity + movement.quantity;

          await transaction.stock.update({
            data: {
              currentQuantity: restoredQuantity,
              totalValue: roundCurrency(
                restoredQuantity * toNumber(stock.unitPriceAverage),
              ),
            },
            where: { id: stock.id },
          });
        }
      }
    }

    await transaction.stockMovement.deleteMany({
      where: { entryRequestId: request.id },
    });

    return transaction.entryRequest.update({
      data: toPending,
      where: { id: request.id },
    });
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

function renderItemsTable(items: OfficeRequestItem[]) {
  const cellStyle = "border:1px solid #111827;padding:4px 8px;text-align:left;";
  const headerStyle = `${cellStyle}font-weight:bold;`;
  const rows = items
    .map(
      (item) =>
        `<tr><td style="${cellStyle}">${escapeHtml(item.productName)}</td>` +
        `<td style="${cellStyle}text-align:center;">${item.quantity}</td>` +
        `<td style="${cellStyle}">${escapeHtml(item.unitName)}</td></tr>`,
    )
    .join("");

  return (
    '<table style="border-collapse:collapse;width:100%;">' +
    `<thead><tr><th style="${headerStyle}">Produto</th>` +
    `<th style="${headerStyle}text-align:center;">Qtd</th>` +
    `<th style="${headerStyle}">Unidade</th></tr></thead>` +
    `<tbody>${rows}</tbody></table>`
  );
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

type OfficeDocumentTemplate = {
  contentHtml?: string | null;
  footerText?: string | null;
  fontFamily?: string | null;
  fontSize?: number | null;
  marginTop?: number | null;
  marginRight?: number | null;
  marginBottom?: number | null;
  marginLeft?: number | null;
  subject?: string | null;
};

const officeLayoutDefaults = {
  fontFamily: "Arial",
  fontSize: 12,
  marginBottom: 20,
  marginLeft: 20,
  marginRight: 20,
  marginTop: 25,
};

const officeFontStacks: Record<string, string> = {
  Arial: "Arial, Helvetica, sans-serif",
  Calibri: "Calibri, 'Segoe UI', sans-serif",
  "Courier New": "'Courier New', Courier, monospace",
  Georgia: "Georgia, 'Times New Roman', serif",
  "Times New Roman": "'Times New Roman', Times, serif",
  Verdana: "Verdana, Geneva, sans-serif",
};

function officeFontStack(fontFamily?: string | null) {
  if (fontFamily && officeFontStacks[fontFamily]) {
    return officeFontStacks[fontFamily];
  }

  return officeFontStacks.Arial;
}

function clampMargin(value: number | null | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(60, Math.max(0, Math.round(value)));
}

const officeDocumentAttribute = 'data-office-letter-document="true"';

function isCompleteOfficeDocument(html: string) {
  return /\sdata-office-letter-document(?:\s*=\s*(?:"true"|'true'|true))?/i.test(
    html,
  );
}

function wrapOfficeDocument(
  contentHtml: string,
  template?: OfficeDocumentTemplate | null,
) {
  const top = clampMargin(template?.marginTop, officeLayoutDefaults.marginTop);
  const right = clampMargin(template?.marginRight, officeLayoutDefaults.marginRight);
  const bottom = clampMargin(template?.marginBottom, officeLayoutDefaults.marginBottom);
  const left = clampMargin(template?.marginLeft, officeLayoutDefaults.marginLeft);
  const fontFamily = officeFontStack(template?.fontFamily);
  const fontSize =
    typeof template?.fontSize === "number" && Number.isFinite(template.fontSize)
      ? Math.min(24, Math.max(8, Math.round(template.fontSize)))
      : officeLayoutDefaults.fontSize;

  // A geometria do papel (largura/altura A4) fica no CSS por mídia — inline vai
  // apenas o que é do modelo (margens, fonte) para não brigar com a impressão.
  return [
    `<article ${officeDocumentAttribute} class="office-letter-document" style="box-sizing:border-box;margin:0 auto;padding:${top}mm ${right}mm ${bottom}mm ${left}mm;background:#fff;color:#111827;font-family:${fontFamily};font-size:${fontSize}pt;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact;">`,
    contentHtml,
    "</article>",
  ].join("");
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


function buildOfficeFooterHtml(
  footerText: string | null | undefined,
  variables: Record<string, string>,
) {
  const text = footerText?.trim() ?? "";

  if (!text) {
    return "";
  }

  return `<footer data-office-letter-footer="true" style="margin:28px 0 0 0;text-align:center;color:#4b5563;font-size:9pt;line-height:1.25;break-inside:avoid;">${renderMultilineHtmlText(
    text,
    variables,
  )}</footer>`;
}

const blockTagInsideParagraph =
  /<(h[1-6]|div|table|hr|ul|ol|blockquote|section|figure)\b/i;

/**
 * Um <p> não pode conter elementos de bloco: ao reinterpretar o HTML o
 * navegador expulsa o bloco do parágrafo, e com ele se perde o estilo do
 * parágrafo (ex.: text-align:center de um cabeçalho com logo). Trocamos esses
 * parágrafos por <div>, preservando os atributos do autor. Como <p> não
 * aninha, o primeiro </p> encontrado é sempre o de fechamento.
 */
function normalizeBlockParagraphs(html: string) {
  return html.replace(
    /<p\b([^>]*)>([\s\S]*?)<\/p>/gi,
    (match, attributes: string, content: string) =>
      blockTagInsideParagraph.test(content)
        ? `<div${attributes}>${content}</div>`
        : match,
  );
}

function buildOfficeDocumentHtml(
  contentHtml: string,
  template?: OfficeDocumentTemplate | null,
  variables: Record<string, string> = {},
) {
  const bodyHtml = unwrapOfficeDocument(normalizeBlockParagraphs(contentHtml));
  const documentHtml = [
    `<main data-office-letter-body="true">${bodyHtml}</main>`,
    buildOfficeFooterHtml(template?.footerText, variables),
  ].join("");

  return wrapOfficeDocument(documentHtml, template);
}

export function renderOfficeLetterDocument(input: {
  template?: OfficeDocumentTemplate | null;
  variables: Record<string, string>;
}) {
  const template = input.template ?? null;
  const subjectTemplate = template?.subject ?? defaultOfficeLetterSubject;
  const contentTemplate =
    template?.contentHtml ?? defaultOfficeLetterContentHtml;
  const subject = renderPlainTemplate(subjectTemplate, input.variables);
  const contentHtml = renderTemplate(
    contentTemplate,
    input.variables,
    new Set(["itens_solicitados_html", "itens_solicitados_tabela"]),
  );

  return {
    contentHtml,
    documentHtml: buildOfficeDocumentHtml(contentHtml, template, input.variables),
    subject,
  };
}

const sampleOfficeItems: OfficeRequestItem[] = [
  { productName: "Papel A4", quantity: 10, unit: "RSM", unitName: "Resma" },
  {
    productName: "Caneta esferográfica azul",
    quantity: 24,
    unit: "UN",
    unitName: "Unidade",
  },
];

export function sampleOfficeVariables(): Record<string, string> {
  const today = formatDate(new Date());

  return {
    almoxarifado_nome: "Almoxarifado Central",
    ano_oficio: "2026",
    cnpj_empresa: "12.345.678/0001-90",
    data_atual: today,
    data_nota: today,
    data_solicitacao: today,
    itens_solicitados_html: renderItemsHtml(sampleOfficeItems),
    itens_solicitados_tabela: renderItemsTable(sampleOfficeItems),
    itens_solicitados_texto: renderItemsText(sampleOfficeItems),
    motivo_solicitacao: "Reposição de material de expediente",
    nome_empresa: "Fornecedor Exemplo LTDA",
    nome_fantasia_empresa: "Fornecedor Exemplo",
    numero_nota: "000123",
    numero_oficio: "001",
    oficio_numero_ano: "001/2026",
    produto_nome: "Papel A4",
    quantidade_solicitada: "10",
    secretaria_nome: "Secretaria de Administração",
    solicitante_nome: "Maria Souza",
    unidade_solicitada: "RSM",
    usuario_logado: "Maria Souza",
    valor_nota: "R$ 1.234,56",
  };
}

async function ensureOfficeNumber(
  prisma: Prisma.TransactionClient,
  request: OfficeRequest,
) {
  if (request.officeNumber && request.officeYear) {
    return request;
  }

  // Solicitações rejeitadas não consomem número: a numeração é reaproveitada
  // pela próxima solicitação.
  if (request.status === RequestStatus.REJECTED) {
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

    if (
      foundRequest.warehouse.isGeneral &&
      foundRequest.type !== EntryRequestType.AD_HOC_OUTPUT
    ) {
      throw new AppError(
        400,
        "Ofício disponível apenas para almoxarifados solicitantes.",
      );
    }

    const request = await ensureOfficeNumber(transaction, foundRequest);
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
      itens_solicitados_tabela: renderItemsTable(items),
      itens_solicitados_texto: renderItemsText(items),
      motivo_solicitacao: request.reason ?? "",
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
    const rendered = renderOfficeLetterDocument({ template, variables });

    return {
      contentHtml: rendered.contentHtml,
      documentHtml: rendered.documentHtml,
      items,
      number: request.officeNumber,
      numberFormatted,
      request: {
        id: request.id,
        status: request.status,
        warehouseId: request.warehouseId,
      },
      subject: rendered.subject,
      year: request.officeYear,
    };
  });
}
