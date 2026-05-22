import { execFileSync } from "node:child_process";
import { closeSync, existsSync, openSync } from "node:fs";
import path from "node:path";

const backendRoot = process.cwd();
const databaseFile = path.join(backendRoot, "prisma", "test.db");
const prismaBinary = path.join(backendRoot, "node_modules", ".bin", "prisma.CMD");

process.env.DATABASE_URL = "file:./test.db";

if (!existsSync(databaseFile)) {
  closeSync(openSync(databaseFile, "w"));
}

execFileSync(prismaBinary, ["db", "push", "--skip-generate"], {
  cwd: backendRoot,
  env: {
    ...process.env,
    DATABASE_URL: "file:./test.db",
  },
  shell: true,
  stdio: "pipe",
});
