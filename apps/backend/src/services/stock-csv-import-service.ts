import { MovementType, Prisma, type PrismaClient } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { createEntry } from "./movement-service.js";
import { nextProductCode } from "./product-code.js";
import {
  invoiceSnapshotFromDocument,
  resolveSupplierByDocument,
} from "./supplier-service.js";
import {
  convertKnownProductQuantity,
  productConversionsInclude,
} from "./unit-conversion-service.js";

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
  productName: string;
  quantity: number;
  rowNumber: number;
  totalValue: number;
  unit: string;
  unitPrice: number;
};

type ParsedCsvRowWithoutTotal = Omit<ParsedCsvRow, "totalValue">;

type SelectedCsvRow = {
  action: CsvRowAction;
  index: number;
  row: ParsedCsvRow;
};

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: {
    category: true;
    unit: true;
    unitConversions: {
      include: {
        fromUnit: true;
      };
    };
  };
}>;

type CsvInvoiceMovement = {
  productId: string;
  quantity: number;
  type: MovementType;
  unitPrice: Prisma.Decimal | number | null;
  warehouseId: string;
};

type CsvInvoiceContext = {
  invoice: {
    id: string;
    movements: CsvInvoiceMovement[];
  };
  incrementTotal: boolean;
};

const headerMap = {
  observation: "observacao",
  productName: "nome_produto",
  quantity: "quantidade",
  unit: "unidade",
  unitPrice: "valor_unitario",
  invoiceNumber: "numero_nota",
  cnpj: "cnpj_empresa",
  companyName: "nome_empresa",
  issueDate: "data_nota",
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

  const brDate = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );

  if (brDate) {
    const [, day, month, year, hour = "0", minute = "0", second = "0"] = brDate;
    const parsed = new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
      ),
    );

    if (
      parsed.getUTCFullYear() !== Number(year) ||
      parsed.getUTCMonth() !== Number(month) - 1 ||
      parsed.getUTCDate() !== Number(day)
    ) {
      return null;
    }

    return parsed;
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
    throw new AppError(400, "CSV deve conter cabeçalho e ao menos uma linha.");
  }

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = parseCsvLine(lines[0], delimiter).map(normalize);
  const headerIndex = new Map(headers.map((header, index) => [header, index]));

  for (const expectedHeader of Object.values(headerMap)) {
    if (!headerIndex.has(expectedHeader)) {
      throw new AppError(400, `CSV sem coluna obrigatoria: ${expectedHeader}.`);
    }
  }

  return lines
    .slice(1)
    .map((line, index) => {
      const cells = parseCsvLine(line, delimiter);
      const value = (header: string) =>
        cells[headerIndex.get(header) ?? -1] ?? "";

      return {
        cnpj: onlyDigits(value(headerMap.cnpj)),
        companyName: value(headerMap.companyName).trim(),
        invoiceNumber: value(headerMap.invoiceNumber).trim(),
        issueDate: parseDate(value(headerMap.issueDate)),
        observation: optionalText(value(headerMap.observation)),
        productName: value(headerMap.productName).trim(),
        quantity: parseCurrency(value(headerMap.quantity)),
        rowNumber: index + 2,
        unit: value(headerMap.unit)
          .trim()
          .toLocaleUpperCase("pt-BR")
          .slice(0, 10),
        unitPrice: parseCurrency(value(headerMap.unitPrice)),
      } satisfies ParsedCsvRowWithoutTotal;
    })
    .map(
      (row): ParsedCsvRow => ({
        ...row,
        totalValue:
          Number.isFinite(row.quantity) && Number.isFinite(row.unitPrice)
            ? roundCurrency(row.quantity * row.unitPrice)
            : Number.NaN,
      }),
    );
}

function findMatchingProduct(
  products: ProductWithRelations[],
  row: ParsedCsvRow,
) {
  return products.find(
    (product) =>
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

function findMatchingUnit(
  units: Array<{ abbreviation: string; id: string; name: string }>,
  unitLabel: string,
) {
  return (
    units.find(
      (unit) =>
        normalize(unit.abbreviation) === normalize(unitLabel) ||
        normalize(unit.name) === normalize(unitLabel),
    ) ?? null
  );
}

function importConversionMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Não foi possível converter a unidade.";

  if (message === "Configure a conversão desta unidade no produto antes de movimentar.") {
    return "Configure a conversão desta unidade no produto antes de importar.";
  }

  return message;
}

function convertedPreview(
  product: ProductWithRelations | null | undefined,
  unit: { id: string } | null,
  row: ParsedCsvRow,
  errors: string[],
) {
  if (!product) {
    return {
      convertedQuantity: null,
      convertedUnitPrice: null,
    };
  }

  if (!unit) {
    errors.push("Cadastre a unidade de medida antes de importar.");

    return {
      convertedQuantity: null,
      convertedUnitPrice: null,
    };
  }

  try {
    const converted = convertKnownProductQuantity(product, {
      quantity: row.quantity,
      unitId: unit.id,
      unitPrice: row.unitPrice,
    });

    return {
      convertedQuantity: converted.baseQuantity,
      convertedUnitPrice: converted.baseUnitPrice,
    };
  } catch (error) {
    errors.push(importConversionMessage(error));

    return {
      convertedQuantity: null,
      convertedUnitPrice: null,
    };
  }
}

function validateRow(row: ParsedCsvRow) {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (row.invoiceNumber) {
    if (!row.cnpj) {
      errors.push("Informe o CNPJ da empresa para linhas com número de nota.");
    }

    if (!row.companyName) {
      errors.push("Informe o nome da empresa para linhas com número de nota.");
    }

    if (!row.issueDate) {
      errors.push("Informe uma data válida para linhas com número de nota.");
    }
  }

  if (!row.productName) {
    errors.push("Informe o produto da linha.");
  }

  if (!row.unit) {
    errors.push("Informe a unidade de medida.");
  }

  if (!Number.isFinite(row.quantity) || row.quantity <= 0) {
    errors.push("Informe uma quantidade maior que zero.");
  }

  if (!Number.isFinite(row.unitPrice) || row.unitPrice < 0) {
    errors.push("Informe um valor unitário válido.");
  }

  if (!Number.isFinite(row.totalValue) || row.totalValue < 0) {
    errors.push("Não foi possível calcular o valor total da linha.");
  }

  return { errors, warnings };
}

async function loadPreviewContext(prisma: PrismaClient) {
  const [products, units] = await Promise.all([
    prisma.product.findMany({
      include: {
        category: true,
        unit: true,
        ...productConversionsInclude,
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
  const invoiceContexts = await loadInvoiceContexts(prisma, rows);

  return {
    rows: rows.map((row, index) => {
      const { errors, warnings } = validateRow(row);
      const suggestedProduct = findMatchingProduct(products, row);
      const suggestedUnit = findMatchingUnit(units, row.unit);
      const converted = convertedPreview(
        suggestedProduct,
        suggestedUnit,
        row,
        errors,
      );
      const invoiceContext = row.invoiceNumber
        ? invoiceContexts.get(invoiceKeyFor(row))
        : null;
      const alreadyImported = Boolean(
        suggestedProduct &&
          invoiceContext?.invoice.movements.some(
            (movement) =>
              movement.type === MovementType.ENTRADA &&
              movement.warehouseId === input.warehouseId &&
              movement.productId === suggestedProduct.id,
          ),
      );

      if (alreadyImported) {
        warnings.push("Linha já importada; será ignorada.");
      }

      return {
        alreadyImported,
        canImport: errors.length === 0,
        cnpj: row.cnpj,
        companyName: row.companyName,
        convertedQuantity: converted.convertedQuantity,
        convertedUnitPrice: converted.convertedUnitPrice,
        errors,
        index,
        invoiceNumber: row.invoiceNumber,
        issueDate: row.issueDate,
        observation: row.observation,
        productName: row.productName,
        quantity: row.quantity,
        rowNumber: row.rowNumber,
        suggestedProduct: summarizeProduct(suggestedProduct),
        suggestedUnit,
        totalValue: row.totalValue,
        unit: row.unit,
        unitPrice: row.unitPrice,
        willImport: errors.length === 0 && !alreadyImported,
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

async function ensureUnit(
  transaction: Prisma.TransactionClient,
  abbreviation: string,
) {
  const units = await transaction.unitOfMeasure.findMany();
  const normalizedUnit = normalize(abbreviation);
  const existing = units.find(
    (unit) =>
      normalize(unit.abbreviation) === normalizedUnit ||
      normalize(unit.name) === normalizedUnit,
  );

  if (existing) {
    return existing;
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
        ...productConversionsInclude,
      },
    });

    if (!product) {
      throw new AppError(404, "Produto mapeado não encontrado.");
    }

    return product;
  }

  const products = await transaction.product.findMany({
    include: {
      category: true,
      unit: true,
      ...productConversionsInclude,
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
      description: "Importado por CSV.",
      minimumQuantity: 0,
      name: row.productName,
      unitId: unit.id,
    },
    include: {
      category: true,
      unit: true,
      ...productConversionsInclude,
    },
  });
}

async function findUnitByLabel(
  transaction: Prisma.TransactionClient,
  label: string,
) {
  const units = await transaction.unitOfMeasure.findMany();
  const normalizedUnit = normalize(label);

  return (
    units.find(
      (unit) =>
        normalize(unit.abbreviation) === normalizedUnit ||
        normalize(unit.name) === normalizedUnit,
    ) ?? null
  );
}

function invoiceKeyFor(row: ParsedCsvRow) {
  return `${row.cnpj}:${row.invoiceNumber}`;
}

async function loadInvoiceContexts(
  prisma: PrismaWriter,
  rows: ParsedCsvRow[],
) {
  const filters = Array.from(
    new Map(
      rows
        .filter((row) => row.invoiceNumber && row.cnpj)
        .map((row) => [
          invoiceKeyFor(row),
          {
            cnpj: row.cnpj,
            number: row.invoiceNumber,
          },
        ]),
    ).values(),
  );

  if (!filters.length) {
    return new Map<string, CsvInvoiceContext>();
  }

  const invoices = await prisma.invoice.findMany({
    include: {
      movements: {
        select: {
          productId: true,
          quantity: true,
          type: true,
          unitPrice: true,
          warehouseId: true,
        },
      },
    },
    where: {
      OR: filters,
    },
  });

  return new Map(
    invoices.map((invoice) => [
      `${invoice.cnpj}:${invoice.number}`,
      {
        incrementTotal: invoice.movements.length > 0,
        invoice,
      },
    ]),
  );
}

function sameInvoiceData(left: ParsedCsvRow, right: ParsedCsvRow) {
  const sameCompany = left.companyName === right.companyName;
  const sameDate =
    left.issueDate?.toISOString().slice(0, 10) ===
    right.issueDate?.toISOString().slice(0, 10);

  return sameCompany && sameDate;
}

function filterImportableRows(rows: SelectedCsvRow[]) {
  const groupedRows = new Map<string, ParsedCsvRow>();
  const importableRows: SelectedCsvRow[] = [];

  for (const item of rows) {
    const { errors } = validateRow(item.row);

    if (errors.length) {
      continue;
    }

    if (!item.row.invoiceNumber) {
      importableRows.push(item);
      continue;
    }

    const key = invoiceKeyFor(item.row);
    const existing = groupedRows.get(key);

    if (!existing) {
      groupedRows.set(key, item.row);
      importableRows.push(item);
      continue;
    }

    if (sameInvoiceData(existing, item.row)) {
      importableRows.push(item);
    }
  }

  return importableRows;
}

async function ensureInvoice(
  transaction: Prisma.TransactionClient,
  row: ParsedCsvRow,
): Promise<CsvInvoiceContext | null> {
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
        select: {
          productId: true,
          quantity: true,
          type: true,
          unitPrice: true,
          warehouseId: true,
        },
      },
    },
  });

  const supplier = await resolveSupplierByDocument(transaction, {
    cnpj: row.cnpj,
    name: row.companyName,
  });
  const data = {
    issueDate: row.issueDate ?? new Date(),
    number: row.invoiceNumber,
    observation: "Importada por CSV.",
    supplierId: supplier.id,
    ...invoiceSnapshotFromDocument({
      cnpj: row.cnpj,
      name: row.companyName,
    }),
    totalValue: 0,
  };

  if (existingInvoice) {
    const invoice = existingInvoice.movements.length
      ? existingInvoice
      : await transaction.invoice.update({
          data,
          include: {
            movements: {
              select: {
                productId: true,
                quantity: true,
                type: true,
                unitPrice: true,
                warehouseId: true,
              },
            },
          },
          where: { id: existingInvoice.id },
        });

    return {
      incrementTotal: true,
      invoice,
    };
  }

  return {
    incrementTotal: true,
    invoice: await transaction.invoice.create({
      data,
      include: {
        movements: {
          select: {
            productId: true,
            quantity: true,
            type: true,
            unitPrice: true,
            warehouseId: true,
          },
        },
      },
    }),
  };
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

  const importableRows = filterImportableRows(selectedRows);

  return writeTransaction(prisma, async (transaction) => {
    await transaction.warehouse.findUniqueOrThrow({
      where: { id: input.warehouseId },
    });

    const invoiceRows = new Map<string, ParsedCsvRow>();

    for (const { row } of importableRows) {
      if (!row.invoiceNumber) {
        continue;
      }

      const key = invoiceKeyFor(row);

      invoiceRows.set(key, row);
    }

    const invoices = new Map<string, CsvInvoiceContext>();

    for (const [key, row] of invoiceRows.entries()) {
      const invoice = await ensureInvoice(transaction, row);

      if (invoice) {
        invoices.set(key, invoice);
      }
    }

    let importedRows = 0;
    const invoiceTotalIncrements = new Map<string, number>();

    for (const { action, row } of importableRows) {
      const product = await resolveProduct(
        transaction,
        row,
        action,
        input.categoryId,
      );
      const rowUnit = await findUnitByLabel(transaction, row.unit);
      const invoiceContext = row.invoiceNumber
        ? invoices.get(invoiceKeyFor(row)) ?? null
        : null;

      if (!rowUnit) {
        throw new AppError(400, "Cadastre a unidade de medida antes de importar.");
      }

      if (
        invoiceContext?.invoice.movements.some(
          (movement) =>
            movement.type === MovementType.ENTRADA &&
            movement.warehouseId === input.warehouseId &&
            movement.productId === product.id,
        )
      ) {
        continue;
      }

      await createEntry(transaction, {
        invoiceId: invoiceContext?.invoice.id ?? null,
        minimumQuantity: input.minimumQuantity ?? 0,
        movementDate: row.issueDate ?? new Date(),
        observation: row.observation,
        productId: product.id,
        quantity: row.quantity,
        unitId: rowUnit.id,
        unitPrice: row.unitPrice,
        userId: input.userId,
        warehouseId: input.warehouseId,
      });

      if (invoiceContext) {
        invoiceContext.invoice.movements.push({
          productId: product.id,
          quantity: row.quantity,
          type: MovementType.ENTRADA,
          unitPrice: row.unitPrice,
          warehouseId: input.warehouseId,
        });

        if (invoiceContext.incrementTotal) {
          invoiceTotalIncrements.set(
            invoiceContext.invoice.id,
            roundCurrency(
              (invoiceTotalIncrements.get(invoiceContext.invoice.id) ?? 0) +
                row.totalValue,
            ),
          );
        }
      }

      importedRows += 1;
    }

    for (const [invoiceId, totalValue] of invoiceTotalIncrements.entries()) {
      await transaction.invoice.update({
        data: {
          totalValue: {
            increment: totalValue,
          },
        },
        where: { id: invoiceId },
      });
    }

    return {
      importedRows,
      invoiceCount: invoices.size,
      skippedRows: parsedRows.length - importedRows,
    };
  });
}
