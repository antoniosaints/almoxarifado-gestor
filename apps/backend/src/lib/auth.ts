import { createHmac, timingSafeEqual } from "node:crypto";
import { UserRole } from "@prisma/client";
import type { AppPermission } from "./permissions.js";
import { AppError } from "./errors.js";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: AppPermission[];
  permissionProfile: {
    id: string;
    name: string;
  } | null;
};

type TokenPayload = SessionUser & {
  exp: number;
};

const tokenTtlSeconds = 60 * 60 * 12;
const authSecret =
  process.env.AUTH_SECRET ?? "almoxarifado-local-dev-secret-change-me";

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function sign(value: string) {
  return createHmac("sha256", authSecret).update(value).digest("base64url");
}

type AccessTokenUser = Omit<SessionUser, "permissions" | "permissionProfile"> &
  Partial<Pick<SessionUser, "permissions" | "permissionProfile">>;

export function createAccessToken(user: AccessTokenUser) {
  const header = encode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encode(
    JSON.stringify({
      permissions: [],
      permissionProfile: null,
      ...user,
      exp: Math.floor(Date.now() / 1000) + tokenTtlSeconds,
    } satisfies TokenPayload),
  );
  const unsignedToken = `${header}.${payload}`;

  return `${unsignedToken}.${sign(unsignedToken)}`;
}

export function verifyAccessToken(token: string): SessionUser {
  const [header, payload, signature] = token.split(".");

  if (!header || !payload || !signature) {
    throw new AppError(401, "Sessão inválida.");
  }

  const expectedSignature = sign(`${header}.${payload}`);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new AppError(401, "Sessão inválida.");
  }

  const parsedPayload = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8"),
  ) as TokenPayload;

  if (
    !parsedPayload.id ||
    !parsedPayload.email ||
    !parsedPayload.name ||
    !Object.values(UserRole).includes(parsedPayload.role) ||
    parsedPayload.exp <= Math.floor(Date.now() / 1000)
  ) {
    throw new AppError(401, "Sessão expirada. Entre novamente.");
  }

  return {
    id: parsedPayload.id,
    name: parsedPayload.name,
    email: parsedPayload.email,
    role: parsedPayload.role,
    permissions: Array.isArray(parsedPayload.permissions)
      ? parsedPayload.permissions.filter(
          (permission): permission is AppPermission => typeof permission === "string",
        )
      : [],
    permissionProfile: parsedPayload.permissionProfile ?? null,
  };
}
