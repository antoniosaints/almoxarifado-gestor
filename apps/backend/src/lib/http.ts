import type {
  ErrorRequestHandler,
  RequestHandler,
  Response,
} from "express";
import { Prisma, UserRole } from "@prisma/client";
import { ZodError } from "zod";
import { verifyAccessToken, type SessionUser } from "./auth.js";
import { AppError } from "./errors.js";
import { prisma } from "./prisma.js";

export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export const authenticate = asyncHandler(async (request, response, next) => {
  const [scheme, token] = request.headers.authorization?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    throw new AppError(401, "Entre para continuar.");
  }

  const tokenUser = verifyAccessToken(token);
  const user = await prisma.user.findUnique({
    where: { id: tokenUser.id },
    select: {
      active: true,
      email: true,
      id: true,
      name: true,
      role: true,
    },
  });

  if (!user?.active) {
    throw new AppError(401, "Sessao invalida.");
  }

  response.locals.user = {
    email: user.email,
    id: user.id,
    name: user.name,
    role: user.role,
  } satisfies SessionUser;

  next();
});

export function currentUser(response: Response): SessionUser {
  const user = response.locals.user as SessionUser | undefined;

  if (!user) {
    throw new AppError(401, "Entre para continuar.");
  }

  return user;
}

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (_request, response, next) => {
    if (!roles.includes(currentUser(response).role)) {
      next(new AppError(403, "Voce nao tem permissao para esta acao."));
      return;
    }

    next();
  };
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof AppError) {
    response.status(error.status).json({ message: error.message });
    return;
  }

  if (isPayloadTooLargeError(error)) {
    response.status(413).json({ message: "Arquivo muito grande para envio." });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      message: error.issues[0]?.message ?? "Revise os dados informados.",
      issues: error.issues,
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      response.status(409).json({ message: "Ja existe um cadastro com estes dados." });
      return;
    }

    if (error.code === "P2003") {
      response.status(409).json({
        message: "Este cadastro possui vinculos e nao pode ser removido agora.",
      });
      return;
    }

    if (error.code === "P2025") {
      response.status(404).json({ message: "Registro nao encontrado." });
      return;
    }
  }

  console.error(error);
  response.status(500).json({ message: "Ocorreu um erro inesperado." });
};

function isPayloadTooLargeError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.too.large"
  );
}
