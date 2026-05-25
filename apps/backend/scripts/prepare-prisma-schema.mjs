import { config as loadEnv } from "dotenv";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourceSchemaPath = path.join(backendRoot, "prisma", "schema.prisma");
const generatedSchemaPath = path.join(
  backendRoot,
  "prisma",
  "schema.generated.prisma",
);

loadEnv({ path: path.join(backendRoot, ".env") });

const provider = resolveDatabaseProvider();
const schema = await readFile(sourceSchemaPath, "utf8");
const generatedSchema = schema.replace(
  /provider\s*=\s*"(sqlite|postgresql|mysql)"/,
  `provider = "${provider}"`,
);

if (schema === generatedSchema && !schema.includes(`provider = "${provider}"`)) {
  throw new Error("Nao foi possivel localizar o provider do datasource Prisma.");
}

await writeFile(generatedSchemaPath, generatedSchema);
console.log(`Prisma schema preparado para ${provider}: prisma/schema.generated.prisma`);

function resolveDatabaseProvider() {
  const configured = process.env.DATABASE_PROVIDER?.trim().toLowerCase();

  if (configured) {
    return normalizeDatabaseProvider(configured);
  }

  const databaseUrl = process.env.DATABASE_URL?.trim().toLowerCase() ?? "";

  if (databaseUrl.startsWith("postgresql:") || databaseUrl.startsWith("postgres:")) {
    return "postgresql";
  }

  if (databaseUrl.startsWith("mysql:")) {
    return "mysql";
  }

  if (databaseUrl.startsWith("file:")) {
    return "sqlite";
  }

  return "sqlite";
}

function normalizeDatabaseProvider(value) {
  if (value === "postgres" || value === "postgresql") {
    return "postgresql";
  }

  if (value === "mysql" || value === "sqlite") {
    return value;
  }

  throw new Error(
    "DATABASE_PROVIDER invalido. Use sqlite, postgresql ou mysql.",
  );
}
