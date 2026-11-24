/** Executa Playwright e limpa as fixtures após o encerramento do servidor de testes. */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { resolve, dirname, basename, relative } from "node:path";
const runId = randomUUID();
const child = spawn(
  process.execPath,
  [
    resolve("node_modules/@playwright/test/cli.js"),
    "test",
    ...process.argv.slice(2),
  ],
  {
    stdio: "inherit",
    env: { ...process.env, PDV_E2E_RUN_ID: runId },
  },
);
const stop = () => child.kill("SIGTERM");
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
try {
  await new Promise((done, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      process.exitCode = code ?? 1;
      done();
    });
  });
} finally {
  const metadataPath = resolve("work/e2e-current.json");
  const metadata = JSON.parse(
    await readFile(metadataPath, "utf8").catch(() => "{}"),
  );
  if (metadata.runId === runId && typeof metadata.file === "string") {
    const directory = dirname(resolve(metadata.file));
    const path = relative(resolve("work/e2e"), directory);
    if (!path.startsWith("..") && basename(directory).startsWith("run-")) {
      await rm(directory, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 100,
      });
      await rm(metadataPath, { force: true });
    }
  }
  process.off("SIGINT", stop);
  process.off("SIGTERM", stop);
}
