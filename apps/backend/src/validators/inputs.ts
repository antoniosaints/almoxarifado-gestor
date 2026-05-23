import { MovementType, UserRole } from "@prisma/client";
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
  issueDate: z.coerce.date(),
  number: z.string().trim().min(1, "Informe o numero da nota."),
  observation: optionalText,
});

export const loginInput = z.object({
  email: z.string().trim().email("Informe um email valido.").transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Informe a senha."),
});

export const userCreateInput = z.object({
  active: z.boolean().default(true),
  email: z.string().trim().email("Informe um email valido.").transform((value) => value.toLowerCase()),
  name: z.string().trim().min(2, "Informe o nome do usuario."),
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
  minimumQuantity: z.coerce.number().int().min(0, "O estoque minimo nao pode ser negativo."),
});

export const stockBulkAdminInput = z.object({
  password: z.string().min(1, "Informe sua senha para confirmar."),
  stockIds: z.array(z.string().min(1)).min(1, "Selecione ao menos um estoque."),
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
    .min(0, "O estoque minimo nao pode ser negativo.")
    .optional(),
  unitPrice: z.coerce
    .number()
    .min(0, "O valor unitario nao pode ser negativo.")
    .optional()
    .nullable(),
  warehouseId: z.string().min(1, "Escolha um almoxarifado."),
});

export const entryRequestInput = movementBase.extend({
  warehouseId: z.string().min(1, "Escolha um almoxarifado."),
});

export const entryRequestApprovalInput = z.object({
  invoiceId: z.string().min(1).optional().nullable(),
});

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
