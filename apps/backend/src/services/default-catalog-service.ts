import { Prisma, type PrismaClient } from "@prisma/client";

type CatalogWriter = PrismaClient | Prisma.TransactionClient;

export const defaultWarehouseCategories = [
  {
    color: "#0f766e",
    description: "Estoque central da prefeitura",
    icon: "warehouse",
    name: "Geral",
  },
  {
    color: "#dc2626",
    description: "Materiais das unidades de saúde",
    icon: "heart-pulse",
    name: "Saúde",
  },
  {
    color: "#2563eb",
    description: "Materiais da rede de ensino",
    icon: "book-open",
    name: "Educação",
  },
  {
    color: "#d97706",
    description: "Materiais de manutenção e obras",
    icon: "hard-hat",
    name: "Obras",
  },
] as const;

export const defaultProductCategories = [
  ["Material de expediente", "Itens usados em rotinas administrativas"],
  ["Material de limpeza", "Itens de higienização"],
  ["Medicamentos", "Produtos de saúde controlados no estoque"],
  ["Merenda escolar", "Itens para alimentação escolar"],
  ["Alimentos", "Produtos alimentícios em geral"],
  ["Insumos", "Itens usados em rotinas administrativas"],
  ["Bebidas", "Itens líquidos para consumo"],
  ["Informática", "Equipamentos e acessórios de tecnologia"],
  ["Eletrônicos", "Dispositivos e equipamentos eletrônicos"],
  ["Móveis", "Mobília e itens para ambientes"],
  ["Ferramentas", "Ferramentas manuais e elétricas"],
  ["EPI", "Equipamentos de proteção individual"],
  ["Material escolar", "Itens utilizados em atividades escolares"],
  ["Papelaria", "Produtos de papelaria e escritório"],
  ["Construção", "Materiais utilizados em obras e manutenção"],
  ["Hidráulica", "Produtos e peças hidráulicas"],
  ["Elétrica", "Materiais e componentes elétricos"],
  ["Vestuário", "Roupas e uniformes"],
  ["Calçados", "Sapatos, botas e similares"],
  ["Higiene pessoal", "Produtos de higiene e cuidados pessoais"],
  ["Copa e cozinha", "Utensílios e materiais para cozinha"],
  ["Perecíveis", "Produtos com prazo de validade reduzido"],
  ["Patrimônio", "Bens permanentes e patrimoniais"],
  ["Combustíveis", "Gasolina, diesel e derivados"],
  ["Peças automotivas", "Componentes e acessórios para veículos"],
  ["Serviços", "Itens cadastrados para controle de serviços"],
  ["Outros", "Itens não categorizados"],
] as const;

export const defaultUnits = [
  ["Unidade", "UN"],
  ["Caixa", "CX"],
  ["Pacote", "PCT"],
  ["Litro", "L"],
  ["Quilograma", "KG"],
  ["Mililitro", "ML"],
  ["Gramas", "G"],
  ["Metro", "M"],
  ["Centímetro", "CM"],
  ["Milímetro", "MM"],
  ["Fardo", "FD"],
  ["Saco", "SC"],
  ["Rolo", "RL"],
  ["Galão", "GL"],
  ["Lata", "LT"],
  ["Frasco", "FR"],
  ["Ampola", "AMP"],
  ["Bisnaga", "BNG"],
  ["Envelope", "ENV"],
  ["Par", "PAR"],
  ["Dúzia", "DZ"],
  ["Cartela", "CRT"],
  ["Bloco", "BLC"],
  ["Folha", "FL"],
  ["Barrica", "BR"],
  ["Tambor", "TB"],
  ["Balde", "BD"],
  ["Resma", "RSM"],
  ["Pallet", "PLT"],
  ["Tonelada", "TON"],
  ["Sachê", "SCH"],
  ["Kit", "KIT"],
  ["Jogo", "JG"],
  ["Tubo", "TBO"],
  ["Peça", "PC"],
  ["Metragem quadrada", "M2"],
  ["Metragem cúbica", "M3"],
] as const;

export function restoreDefaultWarehouseCategories(prisma: CatalogWriter) {
  return Promise.all(
    defaultWarehouseCategories.map((category) =>
      prisma.warehouseCategory.upsert({
        where: { name: category.name },
        update: {
          color: category.color,
          description: category.description,
          icon: category.icon,
        },
        create: category,
      }),
    ),
  );
}

export function restoreDefaultProductCategories(prisma: CatalogWriter) {
  return Promise.all(
    defaultProductCategories.map(([name, description]) =>
      prisma.productCategory.upsert({
        where: { name },
        update: { description },
        create: { description, name },
      }),
    ),
  );
}

export function restoreDefaultUnits(prisma: CatalogWriter) {
  return Promise.all(
    defaultUnits.map(([name, abbreviation]) =>
      prisma.unitOfMeasure.upsert({
        where: { abbreviation },
        update: { name },
        create: { abbreviation, name },
      }),
    ),
  );
}
