import { MovementType, PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../src/services/auth-service.js";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: "admin@prefeitura.local" },
    update: {
      name: "Administrador",
      passwordHash: await hashPassword("admin123"),
      role: UserRole.ADMIN,
      active: true,
      isDefaultAdmin: true,
    },
    create: {
      email: "admin@prefeitura.local",
      name: "Administrador",
      passwordHash: await hashPassword("admin123"),
      role: UserRole.ADMIN,
      active: true,
      isDefaultAdmin: true,
    },
  });

  const categories = await Promise.all(
    [
      ["Geral", "Estoque central da prefeitura", "#0f766e", "warehouse"],
      ["Saúde", "Materiais das unidades de saude", "#dc2626", "heart-pulse"],
      ["Educação", "Materiais da rede de ensino", "#2563eb", "book-open"],
      ["Obras", "Materiais de manutencao e obras", "#d97706", "hard-hat"],
    ].map(([name, description, color, icon]) =>
      prisma.warehouseCategory.upsert({
        where: { name },
        update: { description, color, icon },
        create: { name, description, color, icon },
      }),
    ),
  );

  const [generalCategory, healthCategory, educationCategory, worksCategory] =
    categories;

  const central = await prisma.warehouse.upsert({
    where: { name: "Almoxarifado Central" },
    update: {
      description: "Almoxarifado geral da prefeitura",
      categoryId: generalCategory.id,
      isGeneral: true,
      active: true,
    },
    create: {
      name: "Almoxarifado Central",
      description: "Almoxarifado geral da prefeitura",
      categoryId: generalCategory.id,
      isGeneral: true,
      active: true,
    },
  });

  const [, healthWarehouse] =
    await Promise.all([
      Promise.resolve(central),
      prisma.warehouse.upsert({
        where: { name: "Almoxarifado da Saude" },
        update: { categoryId: healthCategory.id, active: true },
        create: {
          name: "Almoxarifado da Saude",
          description: "Apoio a saude municipal",
          categoryId: healthCategory.id,
        },
      }),
      prisma.warehouse.upsert({
        where: { name: "Almoxarifado da Educacao" },
        update: { categoryId: educationCategory.id, active: true },
        create: {
          name: "Almoxarifado da Educacao",
          description: "Apoio as escolas municipais",
          categoryId: educationCategory.id,
        },
      }),
      prisma.warehouse.upsert({
        where: { name: "Almoxarifado de Obras" },
        update: { categoryId: worksCategory.id, active: true },
        create: {
          name: "Almoxarifado de Obras",
          description: "Materiais para manutencao urbana",
          categoryId: worksCategory.id,
        },
      }),
    ]);

  const operator = await prisma.user.upsert({
    where: { email: "operador.saude@prefeitura.local" },
    update: {
      name: "Operador da Saude",
      passwordHash: await hashPassword("operador123"),
      role: UserRole.OPERATOR,
      active: true,
    },
    create: {
      email: "operador.saude@prefeitura.local",
      name: "Operador da Saude",
      passwordHash: await hashPassword("operador123"),
      role: UserRole.OPERATOR,
    },
  });

  await prisma.userWarehouse.upsert({
    where: {
      userId_warehouseId: {
        userId: operator.id,
        warehouseId: healthWarehouse.id,
      },
    },
    update: {},
    create: {
      userId: operator.id,
      warehouseId: healthWarehouse.id,
    },
  });

  const productCategories = await Promise.all(
    [
      ["Material de expediente", "Itens usados em rotinas administrativas"],
      ["Material de limpeza", "Itens de higienizacao"],
      ["Medicamentos", "Produtos de saude controlados no estoque"],
      ["Merenda escolar", "Itens para alimentacao escolar"],
      ["Alimentos", "Produtos alimenticios em geral"],
      ["Insumos", "Itens usados em rotinas administrativas"],
      ["Bebidas", "Itens liquidos para consumo"],
      ["Informatica", "Equipamentos e acessorios de tecnologia"],
      ["Eletronicos", "Dispositivos e equipamentos eletronicos"],
      ["Moveis", "Mobilia e itens para ambientes"],
      ["Ferramentas", "Ferramentas manuais e eletricas"],
      ["EPI", "Equipamentos de protecao individual"],
      ["Material escolar", "Itens utilizados em atividades escolares"],
      ["Papelaria", "Produtos de papelaria e escritorio"],
      ["Construcao", "Materiais utilizados em obras e manutencao"],
      ["Hidraulica", "Produtos e pecas hidraulicas"],
      ["Eletrica", "Materiais e componentes eletricos"],
      ["Vestuário", "Roupas e uniformes"],
      ["Calcados", "Sapatos, botas e similares"],
      ["Higiene pessoal", "Produtos de higiene e cuidados pessoais"],
      ["Copa e cozinha", "Utensilios e materiais para cozinha"],
      ["Pereciveis", "Produtos com prazo de validade reduzido"],
      ["Patrimonio", "Bens permanentes e patrimoniais"],
      ["Combustiveis", "Gasolina, diesel e derivados"],
      ["Pecas automotivas", "Componentes e acessorios para veiculos"],
      ["Servicos", "Itens cadastrados para controle de servicos"],
      ["Outros", "Itens nao categorizados"],
    ].map(([name, description]) =>
      prisma.productCategory.upsert({
        where: { name },
        update: { description },
        create: { name, description },
      }),
    ),
  );

  const units = await Promise.all(
    [
      ["Unidade", "UN"],
      ["Caixa", "CX"],
      ["Pacote", "PCT"],
      ["Litro", "L"],
      ["Quilograma", "KG"],
      ["Mililitro", "ML"],
      ["Gramas", "G"],
      ["Metro", "M"],
      ["Centimetro", "CM"],
      ["Milimetro", "MM"],
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
      ["Duzia", "DZ"],
      ["Cartela", "CRT"],
      ["Bloco", "BLC"],
      ["Folha", "FL"],
      ["Barrica", "BR"],
      ["Tambor", "TB"],
      ["Balde", "BD"],
      ["Resma", "RSM"],
      ["Pallet", "PLT"],
      ["Tonelada", "TON"],
      ["Sache", "SCH"],
      ["Kit", "KIT"],
      ["Jogo", "JG"],
      ["Tubo", "TBO"],
      ["Peça", "PC"],
      ["Metragem quadrada", "M2"],
      ["Metragem cubica", "M3"],
    ].map(([name, abbreviation]) =>
      prisma.unitOfMeasure.upsert({
        where: { abbreviation },
        update: { name },
        create: { name, abbreviation },
      }),
    ),
  );

  const [office, cleaning, medicine, food] = productCategories;
  const [unit, box, pack, liter, kilogram] = units;

  await Promise.all([
    prisma.product.upsert({
      where: { code: "0000001" },
      update: { name: "Papel A4", categoryId: office.id, unitId: pack.id },
      create: {
        code: "0000001",
        name: "Papel A4",
        description: "Pacote com folhas brancas",
        categoryId: office.id,
        unitId: pack.id,
      },
    }),
    prisma.product.upsert({
      where: { code: "0000002" },
      update: { name: "Caneta azul", categoryId: office.id, unitId: box.id },
      create: {
        code: "0000002",
        name: "Caneta azul",
        description: "Caixa com canetas esferograficas",
        categoryId: office.id,
        unitId: box.id,
      },
    }),
    prisma.product.upsert({
      where: { code: "0000003" },
      update: {
        name: "Agua sanitaria",
        categoryId: cleaning.id,
        unitId: liter.id,
      },
      create: {
        code: "0000003",
        name: "Agua sanitaria",
        description: "Reposicao para limpeza institucional",
        categoryId: cleaning.id,
        unitId: liter.id,
      },
    }),
    prisma.product.upsert({
      where: { code: "0000004" },
      update: {
        name: "Soro fisiologico",
        categoryId: medicine.id,
        unitId: unit.id,
      },
      create: {
        code: "0000004",
        name: "Soro fisiologico",
        description: "Frasco para unidades de saude",
        categoryId: medicine.id,
        unitId: unit.id,
      },
    }),
    prisma.product.upsert({
      where: { code: "0000005" },
      update: { name: "Arroz", categoryId: food.id, unitId: kilogram.id },
      create: {
        code: "0000005",
        name: "Arroz",
        description: "Item basico de merenda escolar",
        categoryId: food.id,
        unitId: kilogram.id,
      },
    }),
  ]);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
