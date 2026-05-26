import type { Prisma, PrismaClient } from "@prisma/client";
import { AppError } from "../lib/errors.js";

type PrismaWriter = PrismaClient | Prisma.TransactionClient;

export type SupplierDocumentInput = {
  address?: string | null;
  city?: string | null;
  cnpj: string;
  municipalRegistration?: string | null;
  name: string;
  phone?: string | null;
  state?: string | null;
  stateRegistration?: string | null;
  tradeName?: string | null;
  zipCode?: string | null;
};

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function cleanText(value: string | null | undefined) {
  return value?.trim() || null;
}

function supplierCreateData(input: SupplierDocumentInput) {
  return {
    address: cleanText(input.address),
    city: cleanText(input.city),
    cnpj: onlyDigits(input.cnpj),
    municipalRegistration: cleanText(input.municipalRegistration),
    name: input.name.trim(),
    phone: cleanText(input.phone),
    state: cleanText(input.state),
    stateRegistration: cleanText(input.stateRegistration),
    tradeName: cleanText(input.tradeName),
    zipCode: cleanText(input.zipCode),
  };
}

export function invoiceSnapshotFromSupplier(
  supplier: {
    address?: string | null;
    city?: string | null;
    cnpj: string;
    municipalRegistration?: string | null;
    name: string;
    phone?: string | null;
    state?: string | null;
    stateRegistration?: string | null;
    tradeName?: string | null;
    zipCode?: string | null;
  },
) {
  return {
    cnpj: supplier.cnpj,
    companyAddress: supplier.address ?? null,
    companyCity: supplier.city ?? null,
    companyName: supplier.name,
    companyPhone: supplier.phone ?? null,
    companyState: supplier.state ?? null,
    companyTradeName: supplier.tradeName ?? null,
    companyZipCode: supplier.zipCode ?? null,
    municipalRegistration: supplier.municipalRegistration ?? null,
    stateRegistration: supplier.stateRegistration ?? null,
  };
}

export function invoiceSnapshotFromDocument(document: SupplierDocumentInput) {
  const data = supplierCreateData(document);

  return {
    cnpj: data.cnpj,
    companyAddress: data.address,
    companyCity: data.city,
    companyName: data.name,
    companyPhone: data.phone,
    companyState: data.state,
    companyTradeName: data.tradeName,
    companyZipCode: data.zipCode,
    municipalRegistration: data.municipalRegistration,
    stateRegistration: data.stateRegistration,
  };
}

export async function getActiveSupplierOrThrow(
  prisma: PrismaWriter,
  supplierId: string,
) {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
  });

  if (!supplier || !supplier.active) {
    throw new AppError(404, "Fornecedor nao encontrado ou inativo.");
  }

  return supplier;
}

export async function resolveSupplierByDocument(
  prisma: PrismaWriter,
  input: SupplierDocumentInput,
) {
  const data = supplierCreateData(input);

  if (!data.cnpj || data.cnpj.length < 11 || !data.name) {
    throw new AppError(400, "Dados do fornecedor incompletos.");
  }

  const existing = await prisma.supplier.findUnique({
    where: { cnpj: data.cnpj },
  });

  if (existing) {
    return existing;
  }

  return prisma.supplier.create({
    data,
  });
}
