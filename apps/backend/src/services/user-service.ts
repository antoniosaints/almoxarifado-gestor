import { UserRole, type Prisma, type PrismaClient } from "@prisma/client";
import type { SessionUser } from "../lib/auth.js";
import { AppError } from "../lib/errors.js";
import { permissionsFromProfile } from "../lib/permissions.js";
import { hashPassword } from "./auth-service.js";
import {
  assertPermissionProfileAssignable,
  resolveOperatorPermissionProfileId,
} from "./permission-profile-service.js";

const userInclude = {
  permissionProfile: {
    include: {
      permissions: {
        orderBy: { key: "asc" },
      },
    },
  },
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
  permissionProfileId?: string | null;
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

  return {
    ...safe,
    permissions: permissionsFromProfile(user.role, user.permissionProfile),
  };
}

export async function listUsers(prisma: PrismaClient) {
  const users = await prisma.user.findMany({
    include: userInclude,
    orderBy: { name: "asc" },
  });

  return users.map(safeUser);
}

function assertOperatorUserManagementAllowed(
  actingUser: SessionUser,
  input: UserInput,
  target?: Pick<UserWithAssignments, "id" | "isDefaultAdmin" | "role">,
) {
  if (actingUser.role === UserRole.ADMIN) {
    return;
  }

  if (target?.id === actingUser.id) {
    throw new AppError(403, "Voce nao pode alterar seu proprio usuario.");
  }

  if (target?.isDefaultAdmin || target?.role === UserRole.ADMIN) {
    throw new AppError(403, "Operadores nao podem gerenciar usuarios Admin.");
  }

  if (input.role === UserRole.ADMIN) {
    throw new AppError(403, "Operadores nao podem criar ou promover usuarios Admin.");
  }
}

export async function createUser(
  prisma: PrismaClient,
  input: UserInput,
  actingUser: SessionUser,
) {
  assertOperatorUserManagementAllowed(actingUser, input);
  await assertPermissionProfileAssignable(prisma, actingUser, input.permissionProfileId);

  const permissionProfileId =
    input.role === UserRole.OPERATOR
      ? await resolveOperatorPermissionProfileId(prisma, input.permissionProfileId)
      : null;

  const user = await prisma.user.create({
    data: {
      active: input.active,
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password ?? ""),
      permissionProfileId,
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
  actingUser: SessionUser,
) {
  const target = await prisma.user.findUniqueOrThrow({
    select: {
      id: true,
      isDefaultAdmin: true,
      role: true,
    },
    where: { id },
  });

  assertOperatorUserManagementAllowed(actingUser, input, target);

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
  actingUser: SessionUser,
) {
  await assertUpdateAllowed(prisma, id, input, actingUser);
  await assertPermissionProfileAssignable(prisma, actingUser, input.permissionProfileId);

  const permissionProfileId =
    input.role === UserRole.OPERATOR
      ? await resolveOperatorPermissionProfileId(prisma, input.permissionProfileId)
      : null;

  const user = await prisma.user.update({
    where: { id },
    data: {
      active: input.active,
      email: input.email,
      name: input.name,
      passwordHash: input.password ? await hashPassword(input.password) : undefined,
      permissionProfileId,
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
  actingUser: SessionUser,
) {
  const target = await prisma.user.findUniqueOrThrow({
    select: {
      id: true,
      isDefaultAdmin: true,
      role: true,
    },
    where: { id },
  });

  if (target.isDefaultAdmin) {
    throw new AppError(403, "O usuário admin default não pode ser excluído.");
  }

  if (target.id === actingUser.id) {
    throw new AppError(403, "Você não pode excluir seu próprio usuário.");
  }

  if (actingUser.role !== UserRole.ADMIN && target.role === UserRole.ADMIN) {
    throw new AppError(403, "Operadores nao podem gerenciar usuarios Admin.");
  }

  await prisma.$transaction([
    prisma.userWarehouse.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);
}
