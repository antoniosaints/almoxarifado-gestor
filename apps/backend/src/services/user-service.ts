import { UserRole, type Prisma, type PrismaClient } from "@prisma/client";
import { AppError } from "../lib/errors.js";
import { hashPassword } from "./auth-service.js";

const userInclude = {
  warehouseAssignments: {
    include: {
      warehouse: {
        include: {
          category: true,
        },
      },
    },
    orderBy: {
      warehouse: {
        name: "asc",
      },
    },
  },
} satisfies Prisma.UserInclude;

type UserWithAssignments = Prisma.UserGetPayload<{
  include: typeof userInclude;
}>;

type UserInput = {
  active: boolean;
  email: string;
  name: string;
  password?: string;
  role: UserRole;
  warehouseIds: string[];
};

function assignmentCreates(input: UserInput) {
  if (input.role !== UserRole.OPERATOR) {
    return [];
  }

  return input.warehouseIds.map((warehouseId) => ({ warehouseId }));
}

export function safeUser(user: UserWithAssignments) {
  const { passwordHash: _passwordHash, ...safe } = user;

  return safe;
}

export async function listUsers(prisma: PrismaClient) {
  const users = await prisma.user.findMany({
    include: userInclude,
    orderBy: { name: "asc" },
  });

  return users.map(safeUser);
}

export async function createUser(prisma: PrismaClient, input: UserInput) {
  const user = await prisma.user.create({
    data: {
      active: input.active,
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password ?? ""),
      role: input.role,
      warehouseAssignments: {
        create: assignmentCreates(input),
      },
    },
    include: userInclude,
  });

  return safeUser(user);
}

async function assertUpdateAllowed(
  prisma: PrismaClient,
  id: string,
  input: UserInput,
) {
  const target = await prisma.user.findUniqueOrThrow({
    select: {
      isDefaultAdmin: true,
    },
    where: { id },
  });

  if (!target.isDefaultAdmin) {
    return;
  }

  if (input.role !== UserRole.ADMIN) {
    throw new AppError(403, "O usuário admin default deve permanecer como Admin.");
  }

  if (!input.active) {
    throw new AppError(403, "O usuário admin default deve permanecer ativo.");
  }
}

export async function updateUser(
  prisma: PrismaClient,
  id: string,
  input: UserInput,
) {
  await assertUpdateAllowed(prisma, id, input);

  const user = await prisma.user.update({
    where: { id },
    data: {
      active: input.active,
      email: input.email,
      name: input.name,
      passwordHash: input.password ? await hashPassword(input.password) : undefined,
      role: input.role,
      warehouseAssignments: {
        deleteMany: {},
        create: assignmentCreates(input),
      },
    },
    include: userInclude,
  });

  return safeUser(user);
}

export async function deleteUser(
  prisma: PrismaClient,
  id: string,
  actingUserId: string,
) {
  const target = await prisma.user.findUniqueOrThrow({
    select: {
      id: true,
      isDefaultAdmin: true,
    },
    where: { id },
  });

  if (target.isDefaultAdmin) {
    throw new AppError(403, "O usuário admin default não pode ser excluído.");
  }

  if (target.id === actingUserId) {
    throw new AppError(403, "Você não pode excluir seu próprio usuário.");
  }

  await prisma.$transaction([
    prisma.userWarehouse.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);
}
