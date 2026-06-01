import { readFile, writeFile } from "node:fs/promises";
import {
  assertDatabaseUrlMatchesProvider,
  generatedSchemaPath,
  loadBackendEnv,
  resolveDatabaseProvider,
  sourceSchemaPath,
} from "./prisma-env.mjs";

loadBackendEnv();

const provider = resolveDatabaseProvider();
assertDatabaseUrlMatchesProvider(provider, process.env.DATABASE_URL, {
  requireUrl: false,
});
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
