import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { UserRole, type Prisma, type PrismaClient } from "@prisma/client";
import { createAccessToken, type SessionUser } from "../lib/auth.js";
import { AppError } from "../lib/errors.js";
import { permissionsFromProfile } from "../lib/permissions.js";

const sessionUserInclude = {
  permissionProfile: {
    include: {
      permissions: {
        orderBy: { key: "asc" },
      },
    },
  },
} satisfies Prisma.UserInclude;

type UserWithSessionProfile = Prisma.UserGetPayload<{
  include: typeof sessionUserInclude;
}>;

function sessionUser(user: UserWithSessionProfile): SessionUser {
  const permissionProfile =
    user.role === UserRole.OPERATOR && user.permissionProfile
      ? {
          id: user.permissionProfile.id,
          name: user.permissionProfile.name,
        }
      : null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    permissions: permissionsFromProfile(user.role, user.permissionProfile),
    permissionProfile,
    role: user.role,
  };
}

export async function hashPassword(password: string) {
  if (password.trim().length < 6) {
    throw new AppError(400, "A senha deve ter pelo menos 6 caracteres.");
  }

  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");

  return `${salt}:${hash}`;
}

export function passwordMatches(password: string, passwordHash: string) {
  const [salt, hash] = passwordHash.split(":");

  if (!salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function loginWithPassword(
  prisma: PrismaClient,
  email: string,
  password: string,
) {
  const user = await prisma.user.findUnique({
    include: sessionUserInclude,
    where: { email: email.trim().toLowerCase() },
  });

  if (!user || !user.active || !passwordMatches(password, user.passwordHash)) {
    throw new AppError(401, "Email ou senha inválidos.");
  }

  const safeUser = sessionUser(user);

  return {
    token: createAccessToken(safeUser),
    user: safeUser,
  };
}
