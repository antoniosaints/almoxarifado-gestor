import { config as loadEnv } from "dotenv";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const prismaDir = path.join(backendRoot, "prisma");
export const sourceSchemaPath = path.join(prismaDir, "schema.prisma");
export const generatedSchemaPath = path.join(prismaDir, "schema.generated.prisma");
export const migrationsDir = path.join(prismaDir, "migrations");
export const migrationLockPath = path.join(migrationsDir, "migration_lock.toml");
export const migrationSafetyBaselinePath = path.join(
  prismaDir,
  "migration-safety-baseline.json",
);

export function loadBackendEnv() {
  loadEnv({ path: path.join(backendRoot, ".env") });
}

export function normalizeDatabaseProvider(value) {
  const normalized = value?.trim().toLowerCase();

  if (normalized === "postgres" || normalized === "postgresql") {
    return "postgresql";
  }

  if (normalized === "mysql" || normalized === "sqlite") {
    return normalized;
  }

  throw new Error("DATABASE_PROVIDER invalido. Use sqlite, postgresql ou mysql.");
}

export function inferDatabaseProviderFromUrl(databaseUrl = "") {
  const normalizedUrl = databaseUrl.trim().toLowerCase();

  if (normalizedUrl.startsWith("postgresql:") || normalizedUrl.startsWith("postgres:")) {
    return "postgresql";
  }

  if (normalizedUrl.startsWith("mysql:")) {
    return "mysql";
  }

  if (normalizedUrl.startsWith("file:")) {
    return "sqlite";
  }

  return null;
}

export function resolveDatabaseProvider(env = process.env) {
  const configured = env.DATABASE_PROVIDER?.trim();

  if (configured) {
    return normalizeDatabaseProvider(configured);
  }

  return inferDatabaseProviderFromUrl(env.DATABASE_URL ?? "") ?? "sqlite";
}

export function assertDatabaseUrlMatchesProvider(
  provider,
  databaseUrl = process.env.DATABASE_URL,
  { requireUrl = true } = {},
) {
  const trimmedUrl = databaseUrl?.trim();

  if (!trimmedUrl) {
    if (requireUrl) {
      throw new Error("DATABASE_URL precisa estar definida para executar comandos de banco.");
    }
    return;
  }

  const urlProvider = inferDatabaseProviderFromUrl(trimmedUrl);

  if (!urlProvider) {
    throw new Error(
      "DATABASE_URL nao parece ser sqlite, postgresql ou mysql. Confira o prefixo da URL.",
    );
  }

  if (urlProvider !== provider) {
    throw new Error(
      `DATABASE_PROVIDER=${provider} nao combina com DATABASE_URL (${urlProvider}). ` +
        "Ajuste antes de criar ou aplicar migrations.",
    );
  }
}

export async function readMigrationLockProvider() {
  const lock = await readFile(migrationLockPath, "utf8");
  const match = lock.match(/provider\s*=\s*"([^"]+)"/);

  if (!match) {
    throw new Error("Nao foi possivel ler o provider em prisma/migrations/migration_lock.toml.");
  }

  return normalizeDatabaseProvider(match[1]);
}

export async function assertMigrationProviderMatchesGeneratedProvider(provider) {
  const lockProvider = await readMigrationLockProvider();

  if (lockProvider !== provider) {
    throw new Error(
      `Historico de migrations versionado para ${lockProvider}, mas schema gerado para ${provider}. ` +
        "Bloqueado para evitar corrupcao ou deploy em provider incorreto. " +
        "Crie um historico de migrations especifico para esse provider antes de deployar; nao use db:push em producao.",
    );
  }
}

export function isProductionLike(env = process.env) {
  const values = [
    env.NODE_ENV,
    env.APP_ENV,
    env.VERCEL_ENV,
    env.RAILWAY_ENVIRONMENT,
    env.RAILWAY_ENVIRONMENT_NAME,
  ];

  return values.some((value) => value?.toLowerCase() === "production");
}

export function assertNotProduction(commandLabel, env = process.env) {
  if (!isProductionLike(env)) {
    return;
  }

  throw new Error(
    `${commandLabel} bloqueado em ambiente de producao. ` +
      "Use somente db:deploy com migrations versionadas.",
  );
}
