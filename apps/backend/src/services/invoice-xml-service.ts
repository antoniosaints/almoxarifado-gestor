import { Prisma, type PrismaClient } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { nextProductCode } from "./product-code.js";
import { createEntry } from "./movement-service.js";
import {
  invoiceSnapshotFromDocument,
  resolveSupplierByDocument,
} from "./supplier-service.js";

type InvoiceXmlImportInput = {
  categoryId?: string | null;
  minimumQuantity: number;
  productMappings: Array<{
    itemIndex: number;
    productId?: string | null;
  }>;
  userId: string;
  warehouseId: string;
  xml: string;
};

type InvoiceXmlPreviewInput = {
  xml: string;
};

type ParsedXmlItem = {
  code: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
};

type ParsedInvoiceXml = {
  cnpj: string;
  companyAddress?: string | null;
  companyCity?: string | null;
  companyName: string;
  companyPhone?: string | null;
  companyState?: string | null;
  companyTradeName?: string | null;
  companyZipCode?: string | null;
  invoiceKey?: string | null;
  issueDate: Date;
  items: ParsedXmlItem[];
  municipalRegistration?: string | null;
  number: string;
  series?: string | null;
  stateRegistration?: string | null;
  totalValue: number;
};

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    category: true;
    unit: true;
  };
}>;

function textFrom(block: string, tag: string) {
  const match = block.match(
    new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "i"),
  );

  return match?.[1] ? decodeXml(match[1].trim()) : "";
}

function blockFrom(block: string, tag: string) {
  const match = block.match(
    new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "i"),
  );

  return match?.[1] ?? "";
}

function blocksFrom(block: string, tag: string) {
  return Array.from(
    block.matchAll(
      new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>[\\s\\S]*?</(?:\\w+:)?${tag}>`, "gi"),
    ),
    (match) => match[0],
  );
}

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function numberFrom(value: string) {
  const parsed = Number(value.replace(",", "."));

  return Number.isFinite(parsed) ? parsed : 0;
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function optionalText(value: string) {
  return value.trim() || null;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function invoiceKeyFrom(xml: string) {
  const direct = textFrom(xml, "chNFe");

  if (direct) {
    return direct;
  }

  const idMatch = xml.match(/<(?:\w+:)?infNFe\b[^>]*\bId=["']NFe([^"']+)["']/i);
  return idMatch?.[1] ?? "";
}

function parseIssueDate(value: string) {
  const parsed = new Date(value);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const dateOnly = new Date(`${value}T00:00:00.000`);

  if (!Number.isNaN(dateOnly.getTime())) {
    return dateOnly;
  }

  throw new AppError(400, "Não foi possível identificar a data da nota no XML.");
}

function parseInvoiceXml(xml: string): ParsedInvoiceXml {
  const ide = blockFrom(xml, "ide");
  const emit = blockFrom(xml, "emit");
  const address = blockFrom(emit, "enderEmit");
  const total = blockFrom(blockFrom(xml, "total"), "ICMSTot");
  const items = blocksFrom(xml, "det")
    .map((det) => blockFrom(det, "prod"))
    .filter(Boolean)
    .map((product): ParsedXmlItem => {
      const quantity = numberFrom(textFrom(product, "qCom"));
      const totalValue = numberFrom(textFrom(product, "vProd"));
      const unitPrice = numberFrom(textFrom(product, "vUnCom")) || totalValue / quantity;

      return {
        code: textFrom(product, "cProd"),
        name: textFrom(product, "xProd"),
        quantity: Math.max(1, Math.round(quantity)),
        unit: (textFrom(product, "uCom") || "UN").slice(0, 10).toLocaleUpperCase("pt-BR"),
        unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
      };
    });

  const parsed = {
    cnpj: onlyDigits(textFrom(emit, "CNPJ")),
    companyAddress: optionalText(
      [
        textFrom(address, "xLgr"),
        textFrom(address, "nro"),
        textFrom(address, "xCpl"),
        textFrom(address, "xBairro"),
      ]
        .filter(Boolean)
        .join(", "),
    ),
    companyCity: optionalText(textFrom(address, "xMun")),
    companyName: textFrom(emit, "xNome"),
    companyPhone: optionalText(textFrom(address, "fone")),
    companyState: optionalText(textFrom(address, "UF")),
    companyTradeName: optionalText(textFrom(emit, "xFant")),
    companyZipCode: optionalText(textFrom(address, "CEP")),
    invoiceKey: optionalText(invoiceKeyFrom(xml)),
    issueDate: parseIssueDate(textFrom(ide, "dhEmi") || textFrom(ide, "dEmi")),
    items,
    municipalRegistration: optionalText(textFrom(emit, "IM")),
    number: textFrom(ide, "nNF"),
    series: optionalText(textFrom(ide, "serie")),
    stateRegistration: optionalText(textFrom(emit, "IE")),
    totalValue: numberFrom(textFrom(total, "vNF")),
  } satisfies ParsedInvoiceXml;

  if (!parsed.companyName || !parsed.cnpj || !parsed.number || !parsed.items.length) {
    throw new AppError(400, "XML de nota fiscal incompleto ou inválido.");
  }

  return parsed;
}

function findMatchingProduct(products: ProductWithRelations[], item: ParsedXmlItem) {
  return products.find(
    (candidate) =>
      candidate.code === item.code || normalize(candidate.name) === normalize(item.name),
  );
}

function summarizeProduct(product?: ProductWithRelations | null) {
  return product
    ? {
        code: product.code,
        id: product.id,
        name: product.name,
        unit: {
          abbreviation: product.unit.abbreviation,
          id: product.unit.id,
          name: product.unit.name,
        },
      }
    : null;
}

async function ensureCategory(
  transaction: Prisma.TransactionClient,
  categoryId?: string | null,
) {
  if (categoryId) {
    const category = await transaction.productCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new AppError(404, "Categoria padrão não encontrada.");
    }

    return category;
  }

  const category = await transaction.productCategory.findFirst({
    orderBy: { name: "asc" },
  });

  if (!category) {
    throw new AppError(400, "Cadastre ao menos uma categoria de produto.");
  }

  return category;
}

async function ensureUnit(transaction: Prisma.TransactionClient, abbreviation: string) {
  const unit = await transaction.unitOfMeasure.findUnique({
    where: { abbreviation },
  });

  if (unit) {
    return unit;
  }

  return transaction.unitOfMeasure.create({
    data: {
      abbreviation,
      name: abbreviation,
    },
  });
}

async function findOrCreateProduct(
  transaction: Prisma.TransactionClient,
  item: ParsedXmlItem,
  categoryId: string,
  unitId: string,
  mappedProductId?: string | null,
) {
  const products = await transaction.product.findMany({
    include: {
      category: true,
      unit: true,
    },
  });
  const product = mappedProductId
    ? products.find((candidate) => candidate.id === mappedProductId)
    : findMatchingProduct(products, item);

  if (mappedProductId && !product) {
    throw new AppError(404, "Produto mapeado não encontrado.");
  }

  if (product) {
    return transaction.product.update({
      where: { id: product.id },
      data: {
        active: true,
        categoryId: product.categoryId || categoryId,
        description: product.description || `Importado da nota fiscal.`,
        name: product.name || item.name,
        unitId,
      },
      include: {
        category: true,
        unit: true,
      },
    });
  }

  const lastProduct = await transaction.product.findFirst({
    orderBy: { code: "desc" },
    select: { code: true },
  });

  return transaction.product.create({
    data: {
      active: true,
      categoryId,
      code: nextProductCode(lastProduct?.code),
      description: item.code ? `Código do fornecedor: ${item.code}` : null,
      name: item.name,
      unitId,
    },
    include: {
      category: true,
      unit: true,
    },
  });
}

export async function previewInvoiceXml(
  prisma: PrismaClient,
  input: InvoiceXmlPreviewInput,
) {
  const parsed = parseInvoiceXml(input.xml);
  const products = await prisma.product.findMany({
    include: {
      category: true,
      unit: true,
    },
    orderBy: { code: "asc" },
  });

  return {
    invoice: {
      cnpj: parsed.cnpj,
      companyAddress: parsed.companyAddress,
      companyCity: parsed.companyCity,
      companyName: parsed.companyName,
      companyPhone: parsed.companyPhone,
      companyState: parsed.companyState,
      companyTradeName: parsed.companyTradeName,
      companyZipCode: parsed.companyZipCode,
      invoiceKey: parsed.invoiceKey,
      issueDate: parsed.issueDate,
      municipalRegistration: parsed.municipalRegistration,
      number: parsed.number,
      series: parsed.series,
      stateRegistration: parsed.stateRegistration,
      totalValue: parsed.totalValue,
    },
    items: parsed.items.map((item, index) => {
      const suggestedProduct = findMatchingProduct(products, item);

      return {
        ...item,
        index,
        suggestedProduct: summarizeProduct(suggestedProduct),
        totalValue: roundCurrency(item.quantity * item.unitPrice),
      };
    }),
  };
}

function invoiceData(parsed: ParsedInvoiceXml, supplierId: string) {
  return {
    invoiceKey: parsed.invoiceKey,
    issueDate: parsed.issueDate,
    number: parsed.number,
    observation: "Importada por XML.",
    series: parsed.series,
    supplierId,
    ...invoiceSnapshotFromDocument({
      address: parsed.companyAddress,
      city: parsed.companyCity,
      cnpj: parsed.cnpj,
      municipalRegistration: parsed.municipalRegistration,
      name: parsed.companyName,
      phone: parsed.companyPhone,
      state: parsed.companyState,
      stateRegistration: parsed.stateRegistration,
      tradeName: parsed.companyTradeName,
      zipCode: parsed.companyZipCode,
    }),
    totalValue: parsed.totalValue,
  };
}

export async function importInvoiceXml(
  prisma: PrismaClient,
  input: InvoiceXmlImportInput,
) {
  const parsed = parseInvoiceXml(input.xml);

  return prisma.$transaction(async (transaction) => {
    const category = await ensureCategory(transaction, input.categoryId);
    const supplier = await resolveSupplierByDocument(transaction, {
      address: parsed.companyAddress,
      city: parsed.companyCity,
      cnpj: parsed.cnpj,
      municipalRegistration: parsed.municipalRegistration,
      name: parsed.companyName,
      phone: parsed.companyPhone,
      state: parsed.companyState,
      stateRegistration: parsed.stateRegistration,
      tradeName: parsed.companyTradeName,
      zipCode: parsed.companyZipCode,
    });
    const productMappings = new Map(
      input.productMappings.map((mapping) => [
        mapping.itemIndex,
        mapping.productId ?? null,
      ]),
    );
    const existingInvoice = parsed.invoiceKey
      ? await transaction.invoice.findUnique({
          where: { invoiceKey: parsed.invoiceKey },
          include: { movements: true },
        })
      : await transaction.invoice.findFirst({
          where: {
            cnpj: parsed.cnpj,
            number: parsed.number,
          },
          include: { movements: true },
        });

    if (existingInvoice?.movements.length) {
      throw new AppError(409, "Esta nota já foi importada com movimentações.");
    }

    const invoice = existingInvoice
      ? await transaction.invoice.update({
          where: { id: existingInvoice.id },
          data: invoiceData(parsed, supplier.id),
        })
      : await transaction.invoice.create({
          data: invoiceData(parsed, supplier.id),
        });

    const importedItems: Array<{
      product: {
        code: string;
        id: string;
        name: string;
      };
      quantity: number;
      unitPrice: number;
    }> = [];

    for (const [itemIndex, item] of parsed.items.entries()) {
      const unit = await ensureUnit(transaction, item.unit);
      const product = await findOrCreateProduct(
        transaction,
        item,
        category.id,
        unit.id,
        productMappings.get(itemIndex),
      );
      await createEntry(transaction, {
        invoiceId: invoice.id,
        minimumQuantity: input.minimumQuantity,
        movementDate: parsed.issueDate,
        observation: `Importado da nota fiscal ${parsed.number}.`,
        productId: product.id,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        userId: input.userId,
        warehouseId: input.warehouseId,
      });

      importedItems.push({
        product,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      });
    }

    return {
      invoice: await transaction.invoice.findUniqueOrThrow({
        where: { id: invoice.id },
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
          },
          supplier: true,
        },
      }),
      items: importedItems,
    };
  });
}
