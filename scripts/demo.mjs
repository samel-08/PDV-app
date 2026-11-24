import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const configPath = join(root, ".env.demo");
const command = process.argv[2];
if (!["setup", "dev", "build", "start"].includes(command)) {
  console.error("Use npm run demo:setup, demo:dev, demo:build ou demo:start.");
  process.exit(1);
}
if (!existsSync(configPath)) {
  if (command !== "setup") {
    console.error("Prepare a demonstração primeiro: npm run demo:setup");
    process.exit(1);
  }
  writeFileSync(
    configPath,
    [
      "# Credenciais locais geradas para a demonstração. Não versione este arquivo.",
      "PDV_LOGIN_USER=demo",
      `PDV_LOGIN_PASSWORD=${randomBytes(8).toString("hex")}`,
      `PDV_SESSION_SECRET=${randomBytes(32).toString("hex")}`,
      "",
    ].join("\n"),
    { flag: "wx", mode: 0o600 },
  );
}
const settings = Object.fromEntries(
  readFileSync(configPath, "utf8")
    .split(/\r?\n/)
    .filter((line) =>
      /^PDV_(LOGIN_USER|LOGIN_PASSWORD|SESSION_SECRET)=/.test(line),
    )
    .map((line) => [
      line.slice(0, line.indexOf("=")),
      line.slice(line.indexOf("=") + 1).trim(),
    ]),
);
if (
  !settings.PDV_LOGIN_USER ||
  (settings.PDV_LOGIN_PASSWORD?.length ?? 0) < 12 ||
  (settings.PDV_SESSION_SECRET?.length ?? 0) < 32
) {
  console.error(
    "Confira usuário, senha (mín. 12 caracteres) e segredo (mín. 32) em .env.demo.",
  );
  process.exit(1);
}
// Caminho fixo: nenhum comando demo usa DATABASE_URL do .env ou do terminal.
const databaseUrl = `file:${join(root, "prisma", "demo.db").replaceAll("\\", "/")}`;
const env = {
  ...process.env,
  ...settings,
  DATABASE_URL: databaseUrl,
  PDV_COOKIE_SECURE: "false",
  MIGRATION_EMPRESA_ID: "demo_empresa",
  MIGRATION_EMPRESA_NOME: "Comércio Demonstração",
};
function run(script, args = []) {
  const result = spawnSync(
    process.execPath,
    [join(root, "node_modules", script), ...args],
    {
      cwd: root,
      env,
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
if (command === "setup") {
  // Cria somente um arquivo novo; nunca trunca um banco existente.
  if (!existsSync(join(root, "prisma", "demo.db"))) {
    writeFileSync(join(root, "prisma", "demo.db"), "", {
      flag: "wx",
      mode: 0o600,
    });
  }
  run("tsx/dist/cli.mjs", ["scripts/database.ts", "migrate"]);
  run("tsx/dist/cli.mjs", ["prisma/demo-seed.ts"]);
  console.log(
    `\nDemonstração preparada em prisma/demo.db.\nUsuário: ${settings.PDV_LOGIN_USER}\nSenha: ${settings.PDV_LOGIN_PASSWORD}\nCredenciais salvas apenas em .env.demo.\nInicie com npm run demo:dev`,
  );
} else {
  if (!existsSync(join(root, "prisma", "demo.db"))) {
    console.error(
      "Banco de demonstração não encontrado. Execute npm run demo:setup.",
    );
    process.exit(1);
  }
  run(
    "next/dist/bin/next",
    command === "build"
      ? ["build"]
      : [command, "-H", "127.0.0.1", "-p", "3000"],
  );
}
