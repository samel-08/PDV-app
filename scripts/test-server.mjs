/** Supervisor sem Prisma: permite encerrar o servidor e limpar o banco em SIGTERM. */
import { mkdir, mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
async function main() {
  const parent = resolve("work/e2e");
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(join(parent, "run-"));
  const file = join(directory, "fixture.db");
  await writeFile(file, "");
  let child;
  const stop = () => child?.kill("SIGTERM");
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  try {
    const initialized = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/test-fixture.ts"],
      {
        cwd: process.cwd(),
        stdio: "inherit",
        env: { ...process.env, PDV_E2E_DATABASE_FILE: file },
      },
    );
    if (initialized.error) throw initialized.error;
    if (initialized.status !== 0)
      throw new Error("Falha na preparação das fixtures.");
    child = spawn(
      process.execPath,
      [
        resolve("node_modules/next/dist/bin/next"),
        "start",
        "-H",
        "127.0.0.1",
        "-p",
        "3137",
      ],
      {
        cwd: process.cwd(),
        stdio: "inherit",
        env: {
          ...process.env,
          DATABASE_URL: `file:${file.replaceAll("\\", "/")}`,
          APP_ORIGIN: "http://127.0.0.1:3137",
          PDV_SESSION_SECRET: randomBytes(32).toString("hex"),
          PDV_COOKIE_SECURE: "false",
        },
      },
    );
    await new Promise((done, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => {
        if (code && code !== 143) process.exitCode = code;
        done();
      });
    });
  } finally {
    await rm(directory, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
    const metadata = resolve("work/e2e-current.json");
    const current = JSON.parse(
      await readFile(metadata, "utf8").catch(() => "{}"),
    );
    if (current.file === file) await rm(metadata, { force: true });
    process.off("SIGTERM", stop);
    process.off("SIGINT", stop);
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
