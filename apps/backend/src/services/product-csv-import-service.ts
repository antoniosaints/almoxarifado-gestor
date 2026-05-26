import { Prisma, type PrismaClient } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { nextProductCode } from "./product-code.js";

type PrismaWriter = PrismaClient | Prisma.TransactionClient;

type CsvInput = {
  csv: string;
};

type ParsedProductCsvRow = {
  categoryName: string;
  code: string | null;
  index: number;
  minimumQuantity: number;
  productName: string;
  rowNumber: number;
  unit: string;
};

type ExistingProductSummary = {
  code: string;
  id: string;
  name: string;
};

const headerMap = {
  categoryName: "categoria",
  code: "id",
  minimumQuantity: "minimo",
  productName: "nome",
  unit: "unidade",
} as const;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function normalizeProductName(value: string) {
  return value.normalize("NFC").toLocaleLowerCase("pt-BR").trim();
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

function normalizeCode(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return /^\d{1,7}$/.test(trimmed) ? trimmed.padStart(7, "0") : trimmed;
}

function parseMinimumQuantity(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return 0;
  }

  return Number.parseInt(trimmed, 10);
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
      throw new AppError(400, `CSV sem coluna obrigatória: ${expectedHeader}.`);
    }
  }

  return lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line, delimiter);
    const value = (header: string) => cells[headerIndex.get(header) ?? -1] ?? "";

    return {
      categoryName: value(headerMap.categoryName).trim().normalize("NFC"),
      code: normalizeCode(value(headerMap.code)),
      index,
      minimumQuantity: parseMinimumQuantity(value(headerMap.minimumQuantity)),
      productName: value(headerMap.productName).trim().normalize("NFC"),
      rowNumber: index + 2,
      unit: value(headerMap.unit)
        .trim()
        .normalize("NFC")
        .toLocaleUpperCase("pt-BR")
        .slice(0, 10),
    } satisfies ParsedProductCsvRow;
  });
}

function summarizeProduct(product?: ExistingProductSummary | null) {
  return product
    ? {
        code: product.code,
        id: product.id,
        name: product.name,
      }
    : null;
}

function validateRows(
  rows: ParsedProductCsvRow[],
  existingProducts: ExistingProductSummary[],
) {
  const existingCodes = new Map(
    existingProducts.map((product) => [product.code, product]),
  );
  const existingNames = new Map(
    existingProducts.map((product) => [
      normalizeProductName(product.name),
      product,
    ]),
  );
  const csvCodes = new Map<string, number>();
  const csvNames = new Map<string, number>();

  return rows.map((row) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const normalizedName = normalizeProductName(row.productName);

    if (row.code && !/^\d{7}$/.test(row.code)) {
      errors.push("Informe o id com até 7 dígitos numéricos.");
    }

    if (!row.productName || row.productName.length < 2) {
      errors.push("Informe o nome do produto.");
    }

    const existingByCode = row.code ? existingCodes.get(row.code) : null;
    const existingByName = normalizedName ? existingNames.get(normalizedName) : null;
    let existingProduct = existingByCode ?? existingByName;

    if (existingByCode && existingByName && existingByCode.id !== existingByName.id) {
      errors.push(
        `O id ${row.code} pertence ao produto ${existingByCode.name}, mas o nome informado pertence ao produto ${existingByName.name}.`,
      );
      existingProduct = null;
    }

    if (
      existingByCode &&
      normalizedName &&
      normalizeProductName(existingByCode.name) !== normalizedName &&
      !existingByName
    ) {
      errors.push(
        `O id ${row.code} já está cadastrado para o produto ${existingByCode.name}.`,
      );
      existingProduct = null;
    }

    if (
      existingByName &&
      row.code &&
      existingByName.code !== row.code &&
      !existingByCode
    ) {
      errors.push(
        `O produto ${existingByName.name} já está cadastrado com o id ${existingByName.code}.`,
      );
      existingProduct = null;
    }

    const shouldImport = !existingProduct;

    if (shouldImport && !row.unit) {
      errors.push("Informe a unidade de medida.");
    }

    if (
      shouldImport &&
      (!Number.isInteger(row.minimumQuantity) || row.minimumQuantity < 0)
    ) {
      errors.push("Informe o mínimo como número inteiro maior ou igual a zero.");
    }

    if (shouldImport && (!row.categoryName || row.categoryName.length < 2)) {
      errors.push("Informe a categoria.");
    }

    if (shouldImport && row.code) {
      const firstRow = csvCodes.get(row.code);

      if (firstRow !== undefined) {
        errors.push(`O id ${row.code} já foi usado na linha ${firstRow}.`);
      } else {
        csvCodes.set(row.code, row.rowNumber);
      }
    }

    if (shouldImport && normalizedName) {
      const firstRow = csvNames.get(normalizedName);

      if (firstRow !== undefined) {
        errors.push(`O produto já foi informado na linha ${firstRow}.`);
      } else {
        csvNames.set(normalizedName, row.rowNumber);
      }
    }

    const canImport = errors.length === 0;
    const willImport = canImport && shouldImport;

    if (canImport && existingProduct) {
      warnings.push("Produto já cadastrado; esta linha será ignorada.");
    }

    return {
      ...row,
      canImport,
      errors,
      existingProduct: summarizeProduct(existingProduct),
      warnings,
      willImport,
    };
  });
}

async function loadExistingProducts(prisma: PrismaClient | Prisma.TransactionClient) {
  return prisma.product.findMany({
    orderBy: { code: "asc" },
    select: {
      code: true,
      id: true,
      name: true,
    },
  });
}

export async function previewProductsCsvImport(
  prisma: PrismaClient,
  input: CsvInput,
) {
  const rows = parseCsv(input.csv);
  const existingProducts = await loadExistingProducts(prisma);

  return {
    rows: validateRows(rows, existingProducts),
  };
}

async function ensureCategory(
  transaction: Prisma.TransactionClient,
  name: string,
) {
  const categories = await transaction.productCategory.findMany();
  const existing = categories.find(
    (category) => normalize(category.name) === normalize(name),
  );

  if (existing) {
    return existing;
  }

  return transaction.productCategory.create({
    data: {
      name,
    },
  });
}

async function ensureUnit(transaction: Prisma.TransactionClient, abbreviation: string) {
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

function nextAvailableCode(currentCode: string | undefined, usedCodes: Set<string>) {
  let nextCode = nextProductCode(currentCode);

  while (usedCodes.has(nextCode)) {
    nextCode = nextProductCode(nextCode);
  }

  return nextCode;
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

export async function importProductsCsv(prisma: PrismaWriter, input: CsvInput) {
  const rows = parseCsv(input.csv);

  return writeTransaction(prisma, async (transaction) => {
    const existingProducts = await loadExistingProducts(transaction);
    const previewRows = validateRows(rows, existingProducts);
    const invalidRow = previewRows.find((row) => row.errors.length);
    const rowsToImport = previewRows.filter((row) => row.willImport);

    if (invalidRow) {
      throw new AppError(
        400,
        `Linha ${invalidRow.rowNumber}: ${invalidRow.errors.join(" ")}`,
      );
    }

    const lastProduct = await transaction.product.findFirst({
      orderBy: { code: "desc" },
      select: { code: true },
    });
    const usedCodes = new Set([
      ...existingProducts.map((product) => product.code),
      ...rowsToImport.flatMap((row) => (row.code ? [row.code] : [])),
    ]);
    let generatedCursor = lastProduct?.code;
    let importedRows = 0;

    for (const row of rowsToImport) {
      const category = await ensureCategory(transaction, row.categoryName);
      const unit = await ensureUnit(transaction, row.unit);
      const code = row.code ?? nextAvailableCode(generatedCursor, usedCodes);

      if (!row.code) {
        generatedCursor = code;
      }

      usedCodes.add(code);

      await transaction.product.create({
        data: {
          active: true,
          categoryId: category.id,
          code,
          description: "Importado por CSV.",
          minimumQuantity: row.minimumQuantity,
          name: row.productName,
          unitId: unit.id,
        },
      });
      importedRows += 1;
    }

    return {
      importedRows,
      skippedRows: rows.length - importedRows,
    };
  });
}
