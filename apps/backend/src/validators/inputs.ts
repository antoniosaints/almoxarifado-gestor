import {
  ManagerBillingPaymentMethod,
  ManagerBillingStatus,
  ManagerGatewayProvider,
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

const optionalUrl = optionalText.refine(
  (value) => !value || /^https?:\/\//i.test(value) || value.startsWith("/uploads/"),
  "Informe uma URL válida.",
);

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

export const unitConversionInput = z.object({
  active: z.boolean().default(true),
  factorToBase: z.coerce
    .number()
    .positive("Informe um fator de conversão maior que zero."),
  fromUnitId: z.string().min(1, "Escolha a unidade convertida."),
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
  "almoxarifado_nome",
  "ano_oficio",
  "cnpj_empresa",
  "data_atual",
  "data_nota",
  "data_solicitacao",
  "itens_solicitados_html",
  "itens_solicitados_tabela",
  "itens_solicitados_texto",
  "motivo_solicitacao",
  "nome_empresa",
  "nome_fantasia_empresa",
  "numero_oficio",
  "numero_nota",
  "oficio_numero_ano",
  "produto_nome",
  "quantidade_solicitada",
  "secretaria_nome",
  "solicitante_nome",
  "unidade_solicitada",
  "usuario_logado",
  "valor_nota",
] as const;

export const officeFontFamilies = [
  "Arial",
  "Times New Roman",
  "Calibri",
  "Georgia",
  "Verdana",
  "Courier New",
] as const;

const officeMargin = z.coerce.number().int().min(0).max(60);
const officeFontFamily = z.enum(officeFontFamilies).default("Arial");
const officeFontSize = z.coerce.number().int().min(8).max(24).default(12);

export const officeTemplateInput = z.object({
  active: z.boolean().default(true),
  contentHtml: z.string().trim().min(3, "Informe o conteudo do oficio."),
  description: optionalText,
  footerText: optionalText,
  fontFamily: officeFontFamily,
  fontSize: officeFontSize,
  headerAlignment: z.enum(["LEFT", "CENTER", "RIGHT"]).default("LEFT"),
  headerImageUrl: optionalUrl,
  headerText: optionalText,
  marginTop: officeMargin.default(25),
  marginRight: officeMargin.default(20),
  marginBottom: officeMargin.default(20),
  marginLeft: officeMargin.default(20),
  name: z.string().trim().min(2, "Informe o nome do modelo."),
  subject: z.string().trim().min(2, "Informe o assunto do oficio."),
});

export const officeTemplatePreviewInput = z.object({
  contentHtml: z.string().default(""),
  footerText: optionalText,
  fontFamily: officeFontFamily,
  fontSize: officeFontSize,
  marginTop: officeMargin.default(25),
  marginRight: officeMargin.default(20),
  marginBottom: officeMargin.default(20),
  marginLeft: officeMargin.default(20),
  subject: optionalText,
});

export function extractOfficeTemplateVariables(...contents: Array<string | null | undefined>) {
  const variables = new Set<string>();
  const allowed = new Set<string>(allowedOfficeVariables);

  for (const match of contents
    .filter((content): content is string => Boolean(content))
    .join("\n")
    .matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)) {
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

export const systemSettingsInput = z.object({
  faviconUrl: optionalUrl,
  loginBackgroundUrl: optionalUrl,
  loginImageUrl: optionalUrl,
  loginSubtitle: z.string().trim().min(2, "Informe o subtítulo do login."),
  loginTitle: z.string().trim().min(2, "Informe o título do login."),
  logoUrl: optionalUrl,
  officeLogoUrl: optionalUrl,
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
  permissionProfileId: z.string().min(1).optional().nullable(),
  role: z.nativeEnum(UserRole),
  warehouseIds: z.array(z.string().min(1)).default([]),
});

export const userUpdateInput = userCreateInput
  .omit({ password: true })
  .extend({
    password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres.").optional(),
  });

export const permissionProfileInput = z.object({
  active: z.boolean().default(true),
  description: optionalText,
  name: z.string().trim().min(2, "Informe o nome do perfil."),
  permissions: z.array(z.string().min(1)).default([]),
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
  quantity: z.coerce.number().positive("Informe uma quantidade maior que zero."),
  unitId: z.string().min(1).optional().nullable(),
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

const entryRequestItemInput = z.object({
  productId: z.string().min(1, "Escolha um produto."),
  quantity: z.coerce.number().positive("Informe uma quantidade maior que zero."),
  unitId: z.string().min(1).optional().nullable(),
});

export const entryRequestInput = z
  .object({
    items: z.array(entryRequestItemInput).optional(),
    movementDate: z.coerce.date(),
    observation: optionalText,
    reason: optionalText,
    productId: z.string().min(1, "Escolha um produto.").optional(),
    quantity: z.coerce
      .number()
      .positive("Informe uma quantidade maior que zero.")
      .optional(),
    unitId: z.string().min(1).optional().nullable(),
    warehouseId: z.string().min(1, "Escolha um almoxarifado."),
  })
  .superRefine((value, context) => {
    if (value.items?.length) {
      return;
    }

    if (!value.productId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Escolha ao menos um produto.",
        path: ["productId"],
      });
    }

    if (value.quantity === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe uma quantidade maior que zero.",
        path: ["quantity"],
      });
    }
  })
  .transform((value) => {
    const items =
      value.items?.length
        ? value.items
        : [
            {
              productId: value.productId ?? "",
              quantity: value.quantity ?? 0,
              unitId: value.unitId ?? null,
            },
          ];
    const primaryItem = items[0];

    return {
      ...value,
      items,
      productId: value.productId ?? primaryItem?.productId ?? "",
      quantity: value.quantity ?? primaryItem?.quantity ?? 0,
    };
  });

const entryRequestApprovalItemInput = z
  .object({
    id: z.string().min(1).optional(),
    productId: z.string().min(1).optional(),
    quantity: z.coerce
      .number()
      .int()
      .positive("Informe uma quantidade maior que zero."),
  })
  .refine((item) => item.id || item.productId, {
    message: "Informe o item aprovado.",
  });

export const entryRequestApprovalInput = z.object({
  invoiceId: z.string().min(1).optional().nullable(),
  items: z.array(entryRequestApprovalItemInput).optional(),
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

export const managerBillingInvoiceInput = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("MANUAL"),
    paidAt: z.coerce.date().optional().nullable(),
  }),
  z.object({
    gatewayProvider: z
      .nativeEnum(ManagerGatewayProvider)
      .default(ManagerGatewayProvider.MERCADO_PAGO),
    method: z.nativeEnum(ManagerBillingPaymentMethod),
    mode: z.literal("GATEWAY"),
  }),
]);

export const managerGatewayConfigInput = z.object({
  accessToken: optionalText,
  active: z.boolean().default(false),
  clientId: optionalText,
  clientSecret: optionalText,
  publicKey: optionalText,
  webhookSecret: optionalText,
});

export const licenseValidationInput = z.object({
  instanceDomain: optionalText,
  licenseKey: z.string().trim().min(1, "Informe a chave da licença."),
});
