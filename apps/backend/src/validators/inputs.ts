import {
  ManagerBillingStatus,
  ManagerLicenseType,
  MovementType,
  UserRole,
} from "@prisma/client";
import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => value || null);

export const idParam = z.object({
  id: z.string().min(1),
});

export const warehouseIdParam = z.object({
  warehouseId: z.string().min(1),
});

export const warehouseInput = z.object({
  active: z.boolean().default(true),
  categoryId: z.string().min(1, "Escolha uma categoria."),
  description: optionalText,
  isGeneral: z.boolean().default(false),
  name: z.string().trim().min(2, "Informe o nome do almoxarifado."),
});

export const warehouseCategoryInput = z.object({
  color: optionalText,
  description: optionalText,
  icon: optionalText,
  name: z.string().trim().min(2, "Informe o nome da categoria."),
});

export const productCategoryInput = z.object({
  description: optionalText,
  name: z.string().trim().min(2, "Informe o nome da categoria."),
});

export const productInput = z.object({
  active: z.boolean().default(true),
  categoryId: z.string().min(1, "Escolha uma categoria."),
  description: optionalText,
  minimumQuantity: z.coerce
    .number()
    .int()
    .min(0, "O estoque mínimo não pode ser negativo.")
    .default(0),
  name: z.string().trim().min(2, "Informe o nome do produto."),
  unitId: z.string().min(1, "Escolha uma unidade de medida."),
});

export const unitInput = z.object({
  abbreviation: z.string().trim().min(1, "Informe a sigla.").max(10),
  name: z.string().trim().min(2, "Informe o nome da unidade."),
});

export const invoiceInput = z.object({
  cnpj: z.string().trim().min(11, "Informe o CNPJ da empresa."),
  companyName: z.string().trim().min(2, "Informe a empresa."),
  companyTradeName: optionalText,
  companyAddress: optionalText,
  companyCity: optionalText,
  companyPhone: optionalText,
  companyState: optionalText,
  companyZipCode: optionalText,
  invoiceKey: optionalText,
  issueDate: z.coerce.date(),
  municipalRegistration: optionalText,
  number: z.string().trim().min(1, "Informe o número da nota."),
  observation: optionalText,
  series: optionalText,
  stateRegistration: optionalText,
  totalValue: z.coerce.number().min(0).optional(),
});

export const supplierBackedInvoiceInput = z.object({
  invoiceKey: optionalText,
  issueDate: z.coerce.date(),
  number: z.string().trim().min(1, "Informe o numero da nota."),
  observation: optionalText,
  series: optionalText,
  supplierId: z
    .string({ required_error: "Escolha um fornecedor." })
    .min(1, "Escolha um fornecedor."),
  totalValue: z.coerce.number().min(0).optional(),
});

export const supplierInput = z.object({
  active: z.boolean().default(true),
  address: optionalText,
  city: optionalText,
  cnpj: z
    .string()
    .trim()
    .min(11, "Informe o CNPJ do fornecedor.")
    .transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length >= 11, "Informe o CNPJ do fornecedor."),
  email: optionalText.refine(
    (value) => !value || z.string().email().safeParse(value).success,
    "Informe um email valido.",
  ),
  municipalRegistration: optionalText,
  name: z.string().trim().min(2, "Informe o nome do fornecedor."),
  notes: optionalText,
  phone: optionalText,
  state: optionalText,
  stateRegistration: optionalText,
  tradeName: optionalText,
  zipCode: optionalText,
});

const allowedOfficeVariables = [
  "cnpj_empresa",
  "data_atual",
  "data_nota",
  "nome_empresa",
  "nome_fantasia_empresa",
  "numero_nota",
  "usuario_logado",
  "valor_nota",
] as const;

export const officeTemplateInput = z.object({
  active: z.boolean().default(true),
  contentHtml: z.string().trim().min(3, "Informe o conteudo do oficio."),
  description: optionalText,
  name: z.string().trim().min(2, "Informe o nome do modelo."),
  subject: z.string().trim().min(2, "Informe o assunto do oficio."),
});

export function extractOfficeTemplateVariables(content: string, subject = "") {
  const variables = new Set<string>();
  const allowed = new Set<string>(allowedOfficeVariables);

  for (const match of `${subject}\n${content}`.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)) {
    const variable = match[1] ?? "";

    if (!allowed.has(variable)) {
      throw new Error(`Variavel de oficio nao permitida: {{${variable}}}.`);
    }

    variables.add(variable);
  }

  return Array.from(variables);
}

export const invoiceXmlImportInput = z.object({
  categoryId: z.string().min(1).optional().nullable(),
  minimumQuantity: z.coerce.number().int().min(0).default(0),
  productMappings: z
    .array(
      z.object({
        itemIndex: z.coerce.number().int().min(0),
        productId: z.string().min(1).optional().nullable(),
      }),
    )
    .default([]),
  warehouseId: z.string().min(1, "Escolha um almoxarifado."),
  xml: z.string().min(1, "Selecione o XML da nota."),
});

export const invoiceXmlPreviewInput = z.object({
  xml: z.string().min(1, "Selecione o XML da nota."),
});

const optionalUrl = optionalText.refine(
  (value) => !value || /^https?:\/\//i.test(value) || value.startsWith("/uploads/"),
  "Informe uma URL válida.",
);

export const systemSettingsInput = z.object({
  faviconUrl: optionalUrl,
  loginBackgroundUrl: optionalUrl,
  loginImageUrl: optionalUrl,
  loginSubtitle: z.string().trim().min(2, "Informe o subtítulo do login."),
  loginTitle: z.string().trim().min(2, "Informe o título do login."),
  logoUrl: optionalUrl,
  primaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Informe uma cor hexadecimal válida."),
  reportFooterText: z
    .string()
    .trim()
    .min(2, "Informe o rodapé do relatório.")
    .default("Documento gerado pelo sistema de almoxarifado municipal."),
  reportLogoUrl: optionalUrl,
  reportPrimaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Informe uma cor hexadecimal válida.")
    .default("#0f766e"),
  reportTitle: z
    .string()
    .trim()
    .min(2, "Informe o título do cabeçalho do relatório.")
    .default("GEMA - Gestão Municipal de Almoxarifado"),
  systemName: z.string().trim().min(2, "Informe o nome do sistema."),
});

export const loginInput = z.object({
  email: z.string().trim().email("Informe um email válido.").transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Informe a senha."),
});

export const userCreateInput = z.object({
  active: z.boolean().default(true),
  email: z.string().trim().email("Informe um email válido.").transform((value) => value.toLowerCase()),
  name: z.string().trim().min(2, "Informe o nome do usuário."),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
  role: z.nativeEnum(UserRole),
  warehouseIds: z.array(z.string().min(1)).default([]),
});

export const userUpdateInput = userCreateInput
  .omit({ password: true })
  .extend({
    password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres.").optional(),
  });

export const minimumStockInput = z.object({
  minimumQuantity: z.coerce.number().int().min(0, "O estoque mínimo não pode ser negativo."),
});

export const stockBulkAdminInput = z.object({
  password: z.string().min(1, "Informe sua senha para confirmar."),
  stockIds: z.array(z.string().min(1)).min(1, "Selecione ao menos um estoque."),
});

export const warehouseCsvPreviewInput = z.object({
  csv: z.string().min(1, "Selecione o CSV da compra."),
});

export const warehouseCsvImportInput = warehouseCsvPreviewInput.extend({
  categoryId: z.string().min(1).optional().nullable(),
  minimumQuantity: z.coerce
    .number()
    .int()
    .min(0, "O estoque mínimo não pode ser negativo.")
    .default(0),
  rows: z
    .array(
      z.object({
        action: z.enum(["IMPORT", "SKIP"]),
        createProduct: z.boolean().optional().default(false),
        productId: z.string().min(1).optional().nullable(),
        rowIndex: z.coerce.number().int().min(0),
      }),
    )
    .default([]),
});

export const systemResetInput = z.object({
  password: z.string().min(1, "Informe sua senha para confirmar."),
  productCategories: z.enum(["KEEP", "RESET_DEFAULTS"]).default("RESET_DEFAULTS"),
  units: z.enum(["KEEP", "RESET_DEFAULTS"]).default("RESET_DEFAULTS"),
  warehouseCategories: z.enum(["KEEP", "RESET_DEFAULTS"]).default("RESET_DEFAULTS"),
});

const movementBase = z.object({
  movementDate: z.coerce.date(),
  observation: optionalText,
  productId: z.string().min(1, "Escolha um produto."),
  quantity: z.coerce.number().int().positive("Informe uma quantidade maior que zero."),
});

export const entryInput = movementBase.extend({
  invoiceId: z.string().min(1).optional().nullable(),
  minimumQuantity: z.coerce
    .number()
    .int()
    .min(0, "O estoque mínimo não pode ser negativo.")
    .optional(),
  unitPrice: z.coerce
    .number()
    .min(0, "O valor unitário não pode ser negativo.")
    .optional()
    .nullable(),
  warehouseId: z.string().min(1, "Escolha um almoxarifado."),
});

export const entryRequestInput = movementBase.extend({
  warehouseId: z.string().min(1, "Escolha um almoxarifado."),
});

export const entryRequestApprovalInput = z.object({
  invoiceId: z.string().min(1).optional().nullable(),
  quantity: z.coerce
    .number()
    .int()
    .positive("Informe uma quantidade maior que zero.")
    .optional(),
});

export const productCsvPreviewInput = z.object({
  csv: z.string().min(1, "Selecione o CSV de produtos."),
});

export const productCsvImportInput = productCsvPreviewInput;

export const outputInput = movementBase.extend({
  destinationNote: optionalText,
  warehouseId: z.string().min(1, "Escolha um almoxarifado."),
});

export const transferInput = movementBase.extend({
  destinationWarehouseId: z.string().min(1, "Escolha o destino."),
  sourceWarehouseId: z.string().min(1, "Escolha a origem."),
});

export const movementQuery = z.object({
  from: z.coerce.date().optional(),
  productId: z.string().optional(),
  to: z.coerce.date().optional(),
  type: z.nativeEnum(MovementType).optional(),
  warehouseId: z.string().optional(),
});

export const managerSubscriberInput = z.object({
  active: z.boolean().default(true),
  city: optionalText,
  document: optionalText,
  email: z.string().trim().email("Informe um email vÃ¡lido.").transform((value) => value.toLowerCase()),
  name: z.string().trim().min(2, "Informe o nome do assinante."),
  notes: optionalText,
  phone: optionalText,
  state: optionalText,
});

export const managerLicenseInput = z.object({
  expiresAt: z.coerce.date().optional().nullable(),
  licenseKey: optionalText,
  monthlyValue: z.coerce.number().min(0, "O valor nÃ£o pode ser negativo.").default(0),
  seats: z.coerce.number().int().positive("Informe ao menos uma licenÃ§a.").default(1),
  startsAt: z.coerce.date().default(() => new Date()),
  subscriberId: z.string().min(1, "Escolha o assinante."),
  systemKey: z.string().trim().min(2, "Informe o sistema."),
  type: z.nativeEnum(ManagerLicenseType).default(ManagerLicenseType.MONTHLY),
});

export const managerBillingInput = z.object({
  amount: z.coerce.number().min(0, "O valor nÃ£o pode ser negativo."),
  description: optionalText,
  dueDate: z.coerce.date(),
  licenseId: z.string().min(1).optional().nullable(),
  paidAt: z.coerce.date().optional().nullable(),
  reference: z.string().trim().min(2, "Informe a referÃªncia."),
  status: z.nativeEnum(ManagerBillingStatus).default(ManagerBillingStatus.OPEN),
  subscriberId: z.string().min(1, "Escolha o assinante."),
  systemKey: z.string().trim().min(2, "Informe o sistema."),
});

export const managerLicenseCancelInput = z.object({
  reason: optionalText,
});
