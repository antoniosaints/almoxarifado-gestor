import type { AppPermission, User } from "./types";

export const permissionDefinitions = [
  {
    key: "MANAGE_WAREHOUSES",
    label: "Gerenciar almoxarifados",
    description: "Criar, editar e remover almoxarifados.",
    group: "Cadastros",
  },
  {
    key: "MANAGE_UNITS",
    label: "Cadastrar unidades",
    description: "Criar, editar e remover unidades de medida.",
    group: "Cadastros",
  },
  {
    key: "MANAGE_CATEGORIES",
    label: "Cadastrar categorias",
    description: "Criar, editar e remover categorias de almoxarifados e produtos.",
    group: "Cadastros",
  },
  {
    key: "APPROVE_REQUESTS",
    label: "Aprovar/reprovar solicitacoes",
    description: "Aprovar ou rejeitar solicitacoes de entrada.",
    group: "Solicitacoes",
  },
  {
    key: "APPROVE_TRANSFERS",
    label: "Aprovar/reprovar transferencias",
    description: "Confirmar ou cancelar recebimentos de transferencias.",
    group: "Solicitacoes",
  },
  {
    key: "MANAGE_SETTINGS",
    label: "Gerenciar configuracoes",
    description: "Alterar identidade visual, documentos e configuracoes do sistema.",
    group: "Administracao",
  },
  {
    key: "VIEW_INSIGHTS",
    label: "Visualizar insights",
    description: "Acessar o painel de indicadores e analises.",
    group: "Administracao",
  },
  {
    key: "MANAGE_USERS",
    label: "Gerenciar usuarios",
    description: "Gerenciar usuarios operadores e perfis de permissao.",
    group: "Administracao",
  },
  {
    key: "ACCESS_PRODUCTS",
    label: "Acessar produtos",
    description: "Acessar a tela de catalogo de produtos.",
    group: "Produtos",
  },
  {
    key: "MANAGE_UNIT_CONVERSIONS",
    label: "Gerenciar conversoes de unidade",
    description: "Criar, editar e remover conversoes por produto.",
    group: "Produtos",
  },
  {
    key: "CREATE_PRODUCTS",
    label: "Cadastrar produtos",
    description: "Cadastrar produtos manualmente nos fluxos liberados.",
    group: "Produtos",
  },
  {
    key: "IMPORT_PRODUCTS_CSV",
    label: "Importar produtos via CSV",
    description: "Importar catalogo de produtos por arquivo CSV.",
    group: "Produtos",
  },
  {
    key: "ZERO_STOCKS",
    label: "Zerar estoques",
    description: "Zerar saldos de estoque em lote.",
    group: "Estoque",
  },
  {
    key: "DELETE_STOCKS",
    label: "Apagar estoques",
    description: "Apagar registros de estoque e suas movimentacoes vinculadas.",
    group: "Estoque",
  },
] satisfies Array<{
  description: string;
  group: string;
  key: AppPermission;
  label: string;
}>;

export function hasPermission(
  user: Pick<User, "permissions" | "role"> | null | undefined,
  permission: AppPermission,
) {
  return user?.role === "ADMIN" || Boolean(user?.permissions?.includes(permission));
}
