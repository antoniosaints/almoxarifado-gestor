import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  assertDatabaseUrlMatchesProvider,
  assertMigrationProviderMatchesGeneratedProvider,
  backendRoot,
  generatedSchemaPath,
  loadBackendEnv,
  migrationSafetyBaselinePath,
  migrationsDir,
  prismaDir,
  readMigrationLockProvider,
  resolveDatabaseProvider,
} from "./prisma-env.mjs";

const args = new Set(process.argv.slice(2));
const writeBaseline = args.has("--write-baseline");
const skipDrift = args.has("--skip-drift");
const skipSafety = args.has("--skip-safety");

loadBackendEnv();

const failures = [];
const warnings = [];

try {
  await main();
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
}

if (warnings.length) {
  for (const warning of warnings) {
    console.warn(`[db:validate] aviso: ${warning}`);
  }
}

if (failures.length) {
  console.error("\n[db:validate] falhou:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("[db:validate] migrations Prisma validadas com sucesso.");

async function main() {
  const provider = resolveDatabaseProvider();
  assertDatabaseUrlMatchesProvider(provider, process.env.DATABASE_URL, {
    requireUrl: true,
  });
  await assertMigrationProviderMatchesGeneratedProvider(provider);

  const migrations = await readMigrations();
  const lockProvider = await readMigrationLockProvider();

  if (writeBaseline) {
    await writeSafetyBaseline(lockProvider, migrations);
    return;
  }

  if (!existsSync(generatedSchemaPath)) {
    throw new Error(
      "prisma/schema.generated.prisma nao existe. Rode pnpm db:prepare antes de validar.",
    );
  }

  if (!skipSafety) {
    await validateSafetyBaseline(lockProvider, migrations);
  }

  await runPrisma(["validate", "--schema", relativeToBackend(generatedSchemaPath)], {
    label: "prisma validate",
  });

  if (!skipDrift) {
    await validateMigrationDrift();
  }
}

async function readMigrations() {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (!directories.length) {
    throw new Error("Nenhuma migration encontrada em prisma/migrations.");
  }

  const seenTimestamps = new Map();
  const migrations = [];

  for (const directory of directories) {
    const timestamp = directory.split("_")[0];

    if (!/^\d{14}$/.test(timestamp)) {
      failures.push(
        `Migration ${directory} deve iniciar com timestamp no formato YYYYMMDDHHMMSS_nome.`,
      );
    }

    const previous = seenTimestamps.get(timestamp);
    if (previous) {
      failures.push(
        `Timestamp duplicado em migrations: ${previous} e ${directory}.`,
      );
    }
    seenTimestamps.set(timestamp, directory);

    const sqlPath = path.join(migrationsDir, directory, "migration.sql");

    if (!existsSync(sqlPath)) {
      failures.push(`Migration ${directory} nao possui migration.sql.`);
      continue;
    }

    const sql = await readFile(sqlPath, "utf8");

    if (!sql.trim()) {
      failures.push(`Migration ${directory}/migration.sql esta vazia.`);
    }

    migrations.push({
      id: directory,
      path: sqlPath,
      risks: detectSqlRisks(sql),
      sha256: sha256(sql),
      sql,
    });
  }

  if (failures.length) {
    throw new Error("Corrija a estrutura das migrations antes de continuar.");
  }

  return migrations;
}

async function validateSafetyBaseline(provider, migrations) {
  if (!existsSync(migrationSafetyBaselinePath)) {
    throw new Error(
      "Baseline de seguranca das migrations ausente. Rode uma revisao e gere prisma/migration-safety-baseline.json.",
    );
  }

  const baseline = JSON.parse(await readFile(migrationSafetyBaselinePath, "utf8"));

  if (baseline.provider !== provider) {
    throw new Error(
      `Baseline de migrations e para ${baseline.provider}, mas migration_lock.toml esta em ${provider}.`,
    );
  }

  const trusted = baseline.trustedMigrations ?? {};

  for (const migration of migrations) {
    const trustedMigration = trusted[migration.id];

    if (trustedMigration) {
      if (trustedMigration.sha256 !== migration.sha256) {
        failures.push(
          `Migration historica ${migration.id} foi alterada depois da revisao. ` +
            "Crie uma nova migration em vez de editar uma ja versionada.",
        );
      }
      continue;
    }

    if (migration.risks.length) {
      failures.push(
        `Migration nova ${migration.id} contem operacoes arriscadas (${migration.risks.join(", ")}). ` +
          "Revise manualmente e atualize o baseline somente se a alteracao for intencional.",
      );
    }
  }

  if (failures.length) {
    throw new Error("Falha na validacao de seguranca das migrations.");
  }
}

async function writeSafetyBaseline(provider, migrations) {
  const baseline = {
    generatedAt: new Date().toISOString(),
    provider,
    trustedMigrations: Object.fromEntries(
      migrations.map((migration) => [
        migration.id,
        {
          risks: migration.risks,
          sha256: migration.sha256,
        },
      ]),
    ),
    version: 1,
  };

  await writeFile(
    migrationSafetyBaselinePath,
    `${JSON.stringify(baseline, null, 2)}\n`,
  );
  console.log("[db:validate] baseline de seguranca atualizado.");
}

async function validateMigrationDrift() {
  const shadowDirectory = path.join(
    os.tmpdir(),
    `almoxarifado-prisma-shadow-${randomUUID()}`,
  );
  await mkdir(shadowDirectory, { recursive: true });
  const shadowDatabasePath = path
    .join(shadowDirectory, "shadow.db")
    .replace(/\\/g, "/");

  try {
    const result = await runPrisma(
      [
        "migrate",
        "diff",
        "--from-migrations",
        relativeToBackend(migrationsDir),
        "--to-schema-datamodel",
        relativeToBackend(generatedSchemaPath),
        "--shadow-database-url",
        `file:${shadowDatabasePath}`,
        "--exit-code",
      ],
      {
        allowExitCodes: [0, 2],
        label: "prisma migrate diff",
      },
    );

    if (result.code === 2) {
      throw new Error(
        "Schema Prisma e migrations versionadas estao divergentes. " +
          "Crie uma migration revisada antes de deployar.",
      );
    }
  } finally {
    await rm(shadowDirectory, { force: true, recursive: true });
  }
}

function detectSqlRisks(sql) {
  const checks = [
    ["drop-table", /\bDROP\s+TABLE\b/i],
    ["drop-column", /\bDROP\s+COLUMN\b/i],
    ["truncate", /\bTRUNCATE\b/i],
    ["delete", /\bDELETE\s+FROM\b/i],
    ["foreign-keys-off", /PRAGMA\s+foreign_keys\s*=\s*OFF/i],
    ["redefine-tables", /--\s*RedefineTables|CREATE\s+TABLE\s+["`]?new_/i],
  ];

  return checks
    .filter(([, pattern]) => pattern.test(sql))
    .map(([risk]) => risk);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function relativeToBackend(filePath) {
  return path.relative(backendRoot, filePath).replace(/\\/g, "/");
}

function prismaBinary() {
  return path.join(
    backendRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "prisma.CMD" : "prisma",
  );
}

function runPrisma(args, { allowExitCodes = [0], label }) {
  return new Promise((resolve, reject) => {
    const child = spawn(prismaBinary(), args, {
      cwd: backendRoot,
      env: process.env,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const exitCode = code ?? 1;
      if (stdout.trim()) {
        console.log(stdout.trim());
      }
      if (stderr.trim()) {
        console.error(stderr.trim());
      }

      if (!allowExitCodes.includes(exitCode)) {
        reject(
          new Error(
            `${label} falhou com codigo ${exitCode}. ` +
              "Veja a saida acima para detalhes.",
          ),
        );
        return;
      }

      resolve({ code: exitCode, stderr, stdout });
    });
  });
}
