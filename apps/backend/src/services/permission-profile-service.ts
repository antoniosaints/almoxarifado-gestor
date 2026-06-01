import { UserRole, type Prisma, type PrismaClient } from "@prisma/client";
import type { SessionUser } from "../lib/auth.js";
import { AppError } from "../lib/errors.js";
import {
  appPermissionDefinitions,
  assertPermissionSubset,
  defaultOperatorPermissionKeys,
  normalizePermissionKeys,
  type AppPermission,
} from "../lib/permissions.js";

export const permissionProfileInclude = {
  _count: {
    select: {
      users: true,
    },
  },
  permissions: {
    orderBy: { key: "asc" },
  },
} satisfies Prisma.PermissionProfileInclude;

export type PermissionProfileWithPermissions = Prisma.PermissionProfileGetPayload<{
  include: typeof permissionProfileInclude;
}>;

export type PermissionProfileInput = {
  active: boolean;
  description?: string | null;
  name: string;
  permissions: string[];
};

export function safePermissionProfile(profile: PermissionProfileWithPermissions) {
  return {
    ...profile,
    permissions: profile.permissions.map((permission) => ({
      key: permission.key,
    })),
    userCount: profile._count.users,
  };
}

export function listAvailablePermissions() {
  return appPermissionDefinitions;
}

function parsePermissionInput(input: PermissionProfileInput) {
  const permissions = normalizePermissionKeys(input.permissions);

  if (permissions.length !== new Set(input.permissions).size) {
    const invalid = input.permissions.find(
      (permission) => !permissions.includes(permission as AppPermission),
    );

    if (invalid) {
      throw new AppError(400, `Permissao invalida: ${invalid}.`);
    }
  }

  return permissions;
}

export async function listPermissionProfiles(prisma: PrismaClient) {
  const profiles = await prisma.permissionProfile.findMany({
    include: permissionProfileInclude,
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return profiles.map(safePermissionProfile);
}

export async function ensureDefaultOperatorPermissionProfile(prisma: PrismaClient) {
  return prisma.permissionProfile.upsert({
    where: { id: "default_operator_profile" },
    update: {},
    create: {
      id: "default_operator_profile",
      name: "Operador padrao",
      description:
        "Perfil criado automaticamente para preservar os acessos operacionais existentes dos operadores.",
      permissions: {
        create: defaultOperatorPermissionKeys.map((key) => ({ key })),
      },
    },
  });
}

export async function resolveOperatorPermissionProfileId(
  prisma: PrismaClient,
  permissionProfileId?: string | null,
) {
  if (permissionProfileId) {
    const profile = await prisma.permissionProfile.findUnique({
      select: {
        active: true,
        id: true,
      },
      where: { id: permissionProfileId },
    });

    if (!profile?.active) {
      throw new AppError(400, "Escolha um perfil de permissao ativo.");
    }

    return profile.id;
  }

  return (await ensureDefaultOperatorPermissionProfile(prisma)).id;
}

async function assertProfilePermissionSubset(
  prisma: PrismaClient,
  actingUser: SessionUser,
  permissionProfileId?: string | null,
) {
  if (!permissionProfileId || actingUser.role === UserRole.ADMIN) {
    return;
  }

  const profile = await prisma.permissionProfile.findUniqueOrThrow({
    select: {
      permissions: {
        select: { key: true },
      },
    },
    where: { id: permissionProfileId },
  });

  assertPermissionSubset(
    actingUser,
    normalizePermissionKeys(profile.permissions.map((permission) => permission.key)),
  );
}

export async function assertPermissionProfileAssignable(
  prisma: PrismaClient,
  actingUser: SessionUser,
  permissionProfileId?: string | null,
) {
  await assertProfilePermissionSubset(prisma, actingUser, permissionProfileId);
}

export async function createPermissionProfile(
  prisma: PrismaClient,
  input: PermissionProfileInput,
  actingUser: SessionUser,
) {
  const permissions = parsePermissionInput(input);
  assertPermissionSubset(actingUser, permissions);

  const profile = await prisma.permissionProfile.create({
    data: {
      active: input.active,
      description: input.description,
      name: input.name,
      permissions: {
        create: permissions.map((key) => ({ key })),
      },
    },
    include: permissionProfileInclude,
  });

  return safePermissionProfile(profile);
}

export async function updatePermissionProfile(
  prisma: PrismaClient,
  id: string,
  input: PermissionProfileInput,
  actingUser: SessionUser,
) {
  const permissions = parsePermissionInput(input);
  const existingProfile = await prisma.permissionProfile.findUniqueOrThrow({
    select: {
      permissions: {
        select: { key: true },
      },
    },
    where: { id },
  });

  assertPermissionSubset(
    actingUser,
    normalizePermissionKeys(
      existingProfile.permissions.map((permission) => permission.key),
    ),
  );
  assertPermissionSubset(actingUser, permissions);

  const profile = await prisma.permissionProfile.update({
    where: { id },
    data: {
      active: input.active,
      description: input.description,
      name: input.name,
      permissions: {
        deleteMany: {},
        create: permissions.map((key) => ({ key })),
      },
    },
    include: permissionProfileInclude,
  });

  return safePermissionProfile(profile);
}

export async function deletePermissionProfile(
  prisma: PrismaClient,
  id: string,
  actingUser: SessionUser,
) {
  const profile = await prisma.permissionProfile.findUniqueOrThrow({
    include: permissionProfileInclude,
    where: { id },
  });

  assertPermissionSubset(
    actingUser,
    normalizePermissionKeys(profile.permissions.map((permission) => permission.key)),
  );

  if (profile._count.users > 0) {
    throw new AppError(
      409,
      "Este perfil esta vinculado a usuarios. Reatribua os usuarios antes de remover.",
    );
  }

  await prisma.permissionProfile.delete({ where: { id } });
}
