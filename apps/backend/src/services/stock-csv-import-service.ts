import { Prisma, type PrismaClient } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { createEntry } from "./movement-service.js";
import { nextProductCode } from "./product-code.js";

type PrismaWriter = PrismaClient | Prisma.TransactionClient;

type CsvRowAction = {
  action: "IMPORT" | "SKIP";
  createProduct?: boolean;
  productId?: string | null;
  rowIndex: number;
};

type CsvImportInput = {
  categoryId?: string | null;
  csv: string;
  minimumQuantity?: number;
  rows?: CsvRowAction[];
  userId: string;
  warehouseId: string;
};

type CsvPreviewInput = {
  csv: string;
  warehouseId: string;
};

type ParsedCsvRow = {
  cnpj: string;
  companyName: string;
  invoiceNumber: string;
  issueDate: Date | null;
  observation: string | null;
  productCode: string;
  productName: string;
  quantity: number;
  rowNumber: number;
  totalValue: number;
  unit: string;
  unitPrice: number;
};

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    category: true;
    unit: true;
  };
}>;

const headerMap = {
  cnpj: "cnpj_empresa",
  companyName: "nome_empresa",
  invoiceNumber: "numero_nota",
  issueDate: "data_nota",
  observation: "observacao",
  productCode: "codigo_produto",
  productName: "nome_produto",
  quantity: "quantidade",
  totalValue: "valor_total",
  unit: "unidade",
  unitPrice: "valor_unitario",
} as const;

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

function optionalText(value: string) {
  return value.trim() || null;
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseCurrency(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return 0;
  }

  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseDate(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const dateOnly = new Date(`${trimmed}T00:00:00.000`);

  return Number.isNaN(dateOnly.getTime()) ? null : dateOnly;
}

function parseCsvLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && quoted && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(csv: string) {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim());

  if (lines.length < 2) {
    throw new AppError(400, "CSV deve conter cabecalho e ao menos uma linha.");
  }

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = parseCsvLine(lines[0], delimiter).map(normalize);
  const headerIndex = new Map(headers.map((header, index) => [header, index]));

  for (const expectedHeader of Object.values(headerMap)) {
    if (!headerIndex.has(expectedHeader)) {
      throw new AppError(400, `CSV sem coluna obrigatoria: ${expectedHeader}.`);
    }
  }

  return lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line, delimiter);
    const value = (header: string) => cells[headerIndex.get(header) ?? -1] ?? "";

    return {
      cnpj: onlyDigits(value(headerMap.cnpj)),
      companyName: value(headerMap.companyName).trim(),
      invoiceNumber: value(headerMap.invoiceNumber).trim(),
      issueDate: parseDate(value(headerMap.issueDate)),
      observation: optionalText(value(headerMap.observation)),
      productCode: value(headerMap.productCode).trim(),
      productName: value(headerMap.productName).trim(),
      quantity: Number.parseInt(value(headerMap.quantity).trim(), 10),
      rowNumber: index + 2,
      totalValue: parseCurrency(value(headerMap.totalValue)),
      unit: value(headerMap.unit).trim().toLocaleUpperCase("pt-BR").slice(0, 10),
      unitPrice: parseCurrency(value(headerMap.unitPrice)),
    } satisfies ParsedCsvRow;
  });
}

function findMatchingProduct(
  products: ProductWithRelations[],
  row: ParsedCsvRow,
) {
  return products.find(
    (product) =>
      (row.productCode && product.code === row.productCode) ||
      normalize(product.name) === normalize(row.productName),
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

function validateRow(row: ParsedCsvRow) {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (row.invoiceNumber) {
    if (!row.cnpj) {
      errors.push("Informe o CNPJ da empresa para linhas com numero de nota.");
    }

    if (!row.companyName) {
      errors.push("Informe o nome da empresa para linhas com numero de nota.");
    }

    if (!row.issueDate) {
      errors.push("Informe uma data valida para linhas com numero de nota.");
    }
  }

  if (!row.productName && !row.productCode) {
    errors.push("Informe o produto da linha.");
  }

  if (!row.unit) {
    errors.push("Informe a unidade de medida.");
  }

  if (!Number.isInteger(row.quantity) || row.quantity <= 0) {
    errors.push("Informe uma quantidade inteira maior que zero.");
  }

  if (!Number.isFinite(row.unitPrice) || row.unitPrice < 0) {
    errors.push("Informe um valor unitario valido.");
  }

  if (!Number.isFinite(row.totalValue) || row.totalValue < 0) {
    errors.push("Informe um valor total valido.");
  } else if (
    Number.isInteger(row.quantity) &&
    Number.isFinite(row.unitPrice) &&
    Math.abs(roundCurrency(row.quantity * row.unitPrice) - roundCurrency(row.totalValue)) >
      0.01
  ) {
    warnings.push(
      "Valor total diverge da quantidade multiplicada pelo valor unitario.",
    );
  }

  return { errors, warnings };
}

async function loadPreviewContext(prisma: PrismaClient) {
  const [products, units] = await Promise.all([
    prisma.product.findMany({
      include: {
        category: true,
        unit: true,
      },
      orderBy: { code: "asc" },
    }),
    prisma.unitOfMeasure.findMany({
      orderBy: { abbreviation: "asc" },
    }),
  ]);

  return { products, units };
}

export async function previewWarehouseCsvImport(
  prisma: PrismaClient,
  input: CsvPreviewInput,
) {
  await prisma.warehouse.findUniqueOrThrow({
    where: { id: input.warehouseId },
  });

  const rows = parseCsv(input.csv);
  const { products, units } = await loadPreviewContext(prisma);

  return {
    rows: rows.map((row, index) => {
      const { errors, warnings } = validateRow(row);
      const suggestedProduct = findMatchingProduct(products, row);
      const suggestedUnit =
        units.find((unit) => unit.abbreviation === row.unit) ?? null;

      return {
        canImport: errors.length === 0,
        cnpj: row.cnpj,
        companyName: row.companyName,
        errors,
        index,
        invoiceNumber: row.invoiceNumber,
        issueDate: row.issueDate,
        observation: row.observation,
        productCode: row.productCode,
        productName: row.productName,
        quantity: row.quantity,
        rowNumber: row.rowNumber,
        suggestedProduct: summarizeProduct(suggestedProduct),
        suggestedUnit,
        totalValue: row.totalValue,
        unit: row.unit,
        unitPrice: row.unitPrice,
        warnings,
      };
    }),
  };
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
      throw new AppError(404, "Categoria padrao nao encontrada.");
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

async function ensureUnit(
  transaction: Prisma.TransactionClient,
  abbreviation: string,
) {
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

async function resolveProduct(
  transaction: Prisma.TransactionClient,
  row: ParsedCsvRow,
  inputRow: CsvRowAction,
  categoryId?: string | null,
) {
  if (inputRow.productId) {
    const product = await transaction.product.findUnique({
      where: { id: inputRow.productId },
      include: {
        category: true,
        unit: true,
      },
    });

    if (!product) {
      throw new AppError(404, "Produto mapeado nao encontrado.");
    }

    return product;
  }

  const products = await transaction.product.findMany({
    include: {
      category: true,
      unit: true,
    },
  });
  const matchedProduct = findMatchingProduct(products, row);

  if (matchedProduct) {
    return matchedProduct;
  }

  if (!inputRow.createProduct) {
    throw new AppError(
      400,
      `Mapeie ou permita criar o produto da linha ${row.rowNumber}.`,
    );
  }

  const [category, unit, lastProduct] = await Promise.all([
    ensureCategory(transaction, categoryId),
    ensureUnit(transaction, row.unit),
    transaction.product.findFirst({
      orderBy: { code: "desc" },
      select: { code: true },
    }),
  ]);

  return transaction.product.create({
    data: {
      active: true,
      categoryId: category.id,
      code: nextProductCode(lastProduct?.code),
      description: row.productCode
        ? `Codigo do fornecedor: ${row.productCode}`
        : "Importado por CSV.",
      name: row.productName || row.productCode,
      unitId: unit.id,
    },
    include: {
      category: true,
      unit: true,
    },
  });
}

function invoiceKeyFor(row: ParsedCsvRow) {
  return `${row.cnpj}:${row.invoiceNumber}`;
}

function assertInvoiceConsistency(rows: ParsedCsvRow[]) {
  const groupedRows = new Map<string, ParsedCsvRow>();

  for (const row of rows.filter((item) => item.invoiceNumber)) {
    const key = invoiceKeyFor(row);
    const existing = groupedRows.get(key);

    if (!existing) {
      groupedRows.set(key, row);
      continue;
    }

    const sameCompany = existing.companyName === row.companyName;
    const sameDate =
      existing.issueDate?.toISOString().slice(0, 10) ===
      row.issueDate?.toISOString().slice(0, 10);

    if (!sameCompany || !sameDate) {
      throw new AppError(
        400,
        `A nota ${row.invoiceNumber} possui dados divergentes entre linhas.`,
      );
    }
  }
}

async function ensureInvoice(
  transaction: Prisma.TransactionClient,
  row: ParsedCsvRow,
  totalValue: number,
) {
  if (!row.invoiceNumber) {
    return null;
  }

  const existingInvoice = await transaction.invoice.findFirst({
    where: {
      cnpj: row.cnpj,
      number: row.invoiceNumber,
    },
    include: {
      movements: {
        select: { id: true },
      },
    },
  });

  if (existingInvoice?.movements.length) {
    throw new AppError(
      409,
      `A nota ${row.invoiceNumber} ja possui movimentacoes importadas.`,
    );
  }

  const data = {
    cnpj: row.cnpj,
    companyName: row.companyName,
    issueDate: row.issueDate ?? new Date(),
    number: row.invoiceNumber,
    observation: "Importada por CSV.",
    totalValue: roundCurrency(totalValue),
  };

  return existingInvoice
    ? transaction.invoice.update({
        where: { id: existingInvoice.id },
        data,
      })
    : transaction.invoice.create({ data });
}

async function writeTransaction<T>(
  prisma: PrismaWriter,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
) {
  if ("$transaction" in prisma) {
    return prisma.$transaction(operation);
  }

  return operation(prisma);
}

export async function importWarehouseCsv(
  prisma: PrismaWriter,
  input: CsvImportInput,
) {
  const parsedRows = parseCsv(input.csv);
  const rowActions = new Map(
    (input.rows ?? []).map((row) => [row.rowIndex, row]),
  );
  const selectedRows = parsedRows
    .map((row, index) => ({
      action: rowActions.get(index) ?? {
        action: "IMPORT" as const,
        rowIndex: index,
      },
      index,
      row,
    }))
    .filter((item) => item.action.action !== "SKIP");

  for (const { row } of selectedRows) {
    const { errors } = validateRow(row);

    if (errors.length) {
      throw new AppError(
        400,
        `Linha ${row.rowNumber}: ${errors.join(" ")}`,
      );
    }
  }

  assertInvoiceConsistency(selectedRows.map((item) => item.row));

  return writeTransaction(prisma, async (transaction) => {
    await transaction.warehouse.findUniqueOrThrow({
      where: { id: input.warehouseId },
    });

    const invoiceTotals = new Map<string, number>();
    const invoiceRows = new Map<string, ParsedCsvRow>();

    for (const { row } of selectedRows) {
      if (!row.invoiceNumber) {
        continue;
      }

      const key = invoiceKeyFor(row);

      invoiceRows.set(key, row);
      invoiceTotals.set(
        key,
        roundCurrency((invoiceTotals.get(key) ?? 0) + row.totalValue),
      );
    }

    const invoices = new Map<string, { id: string }>();

    for (const [key, row] of invoiceRows.entries()) {
      const invoice = await ensureInvoice(
        transaction,
        row,
        invoiceTotals.get(key) ?? 0,
      );

      if (invoice) {
        invoices.set(key, invoice);
      }
    }

    let importedRows = 0;

    for (const { action, row } of selectedRows) {
      const product = await resolveProduct(
        transaction,
        row,
        action,
        input.categoryId,
      );
      const invoice = row.invoiceNumber
        ? invoices.get(invoiceKeyFor(row)) ?? null
        : null;

      await createEntry(transaction, {
        invoiceId: invoice?.id ?? null,
        minimumQuantity: input.minimumQuantity ?? 0,
        movementDate: row.issueDate ?? new Date(),
        observation: row.observation,
        productId: product.id,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        userId: input.userId,
        warehouseId: input.warehouseId,
      });
      importedRows += 1;
    }

    return {
      importedRows,
      invoiceCount: invoices.size,
      skippedRows: parsedRows.length - importedRows,
    };
  });
}
