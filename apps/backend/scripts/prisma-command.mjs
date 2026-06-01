import { spawn } from "node:child_process";
import path from "node:path";
import {
  assertDatabaseUrlMatchesProvider,
  assertMigrationProviderMatchesGeneratedProvider,
  assertNotProduction,
  backendRoot,
  generatedSchemaPath,
  loadBackendEnv,
  resolveDatabaseProvider,
} from "./prisma-env.mjs";

loadBackendEnv();

const [command, ...commandArgs] = process.argv.slice(2);

try {
  await main(command, commandArgs);
} catch (error) {
  console.error(
    `[db:${command ?? "command"}] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}

async function main(selectedCommand, args) {
  switch (selectedCommand) {
    case "deploy":
      await deploy();
      return;
    case "status":
      await prepareAndAssertProvider();
      await runPrisma(["migrate", "status", "--schema", relativeToBackend(generatedSchemaPath)]);
      return;
    case "create":
      await createMigration(args);
      return;
    case "push":
      await push(args);
      return;
    default:
      throw new Error(
        "Comando desconhecido. Use deploy, status, create ou push.",
      );
  }
}

async function deploy() {
  await runNodeScript("prepare-prisma-schema.mjs");
  await runNodeScript("validate-prisma-migrations.mjs");
  await runPrisma(["migrate", "deploy", "--schema", relativeToBackend(generatedSchemaPath)]);
  await runPrisma(["migrate", "status", "--schema", relativeToBackend(generatedSchemaPath)]);
}

async function createMigration(args) {
  assertNotProduction("db:migration:create");
  const name = migrationNameFromArgs(args);

  await runNodeScript("prepare-prisma-schema.mjs");
  await assertProviderForDatabaseCommand();
  await runNodeScript("validate-prisma-migrations.mjs", ["--skip-drift"]);
  await runPrisma([
    "migrate",
    "dev",
    "--create-only",
    "--name",
    name,
    "--schema",
    relativeToBackend(generatedSchemaPath),
  ]);
  await runNodeScript("validate-prisma-migrations.mjs");
}

async function push(args) {
  assertNotProduction("db:push");

  if (process.env.CI === "true" && process.env.ALLOW_DB_PUSH !== "1") {
    throw new Error(
      "db:push bloqueado em CI. Use db:deploy ou defina ALLOW_DB_PUSH=1 apenas para prototipagem descartavel.",
    );
  }

  await prepareAndAssertProvider();
  await runPrisma([
    "db",
    "push",
    "--schema",
    relativeToBackend(generatedSchemaPath),
    ...args,
  ]);
}

async function prepareAndAssertProvider() {
  await runNodeScript("prepare-prisma-schema.mjs");
  await assertProviderForDatabaseCommand();
}

async function assertProviderForDatabaseCommand() {
  const provider = resolveDatabaseProvider();
  assertDatabaseUrlMatchesProvider(provider, process.env.DATABASE_URL, {
    requireUrl: true,
  });
  await assertMigrationProviderMatchesGeneratedProvider(provider);
}

function migrationNameFromArgs(args) {
  const nameFlagIndex = args.indexOf("--name");
  const rawName =
    nameFlagIndex >= 0 ? args[nameFlagIndex + 1] : args.find((arg) => !arg.startsWith("-"));

  if (!rawName) {
    throw new Error(
      "Informe o nome da migration: pnpm db:migration:create -- --name nome_da_migration",
    );
  }

  const name = rawName.trim().toLowerCase().replace(/-/g, "_");

  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new Error("Nome de migration deve usar apenas letras, numeros e underscore.");
  }

  return name;
}

function runNodeScript(scriptName, args = []) {
  return run(process.execPath, [path.join("scripts", scriptName), ...args], {
    label: `node ${scriptName}`,
    shell: false,
  });
}

function runPrisma(args) {
  return run(prismaBinary(), args, {
    label: `prisma ${args.join(" ")}`,
    shell: process.platform === "win32",
  });
}

function run(executable, args, { label, shell }) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: backendRoot,
      env: process.env,
      shell,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${label} falhou com codigo ${code ?? 1}.`));
    });
  });
}

function prismaBinary() {
  return path.join(
    backendRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "prisma.CMD" : "prisma",
  );
}

function relativeToBackend(filePath) {
  return path.relative(backendRoot, filePath).replace(/\\/g, "/");
}
