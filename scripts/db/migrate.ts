import type { PrismaClient, Prisma } from "@prisma/client";
import { readFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
const folder = resolve("prisma/operational-migrations");
const tables = [
  "Categoria",
  "Produto",
  "ConfigBalanca",
  "ConfigSistema",
  "CaixaSessao",
  "Venda",
  "ItensVenda",
  "PagamentoVenda",
  "MovimentacaoCaixa",
  "MovimentacaoEstoque",
];
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
type Db = Prisma.TransactionClient;
async function sql(name: string) {
  return readFile(join(folder, name), "utf8");
}
async function execute(db: Db, source: string) {
  for (const statement of source
    .replace(/^\s*--.*$/gm, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (!/^PRAGMA\b/i.test(statement)) await db.$executeRawUnsafe(statement);
  }
}
async function checksum() {
  const files = JSON.parse(
    await readFile(join(folder, "manifest.json"), "utf8"),
  ) as { schema: string; files: Record<string, string> };
  if (
    digest(await readFile(resolve("prisma/schema.prisma"), "utf8")) !==
    files.schema
  )
    throw new Error("Schema alterado sem revisão da migração.");
  for (const [name, hash] of Object.entries(files.files))
    if (digest(await sql(name)) !== hash)
      throw new Error(`SQL alterado sem revisão: ${name}`);
  return digest(JSON.stringify(files));
}
async function snapshot(db: Db) {
  const rows: { table: string; columns: string[]; data: unknown[] }[] = [];
  for (const table of tables) {
    const columns = (
      await db.$queryRawUnsafe<{ name: string }[]>(
        `PRAGMA table_info("${table}")`,
      )
    ).map((c) => c.name);
    if (!columns.length)
      throw new Error(
        `A origem não contém a tabela ${table}. Ensaie uma atualização específica.`,
      );
    rows.push({
      table,
      columns,
      data: await db.$queryRawUnsafe(
        `SELECT ${columns.map((c) => `"${c}"`).join(",")} FROM "${table}" ORDER BY id`,
      ),
    });
  }
  return rows;
}

/** Somente CLI/testes. Nunca é chamado pela inicialização do servidor web. */
export async function prepareDatabase(
  db: PrismaClient,
  owner?: { id: string; nome?: string },
) {
  const hash = await checksum();
  await db.$executeRawUnsafe("PRAGMA foreign_keys = ON");
  const existing = await db.$queryRaw<
    { name: string }[]
  >`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`;
  if (existing.some((t) => t.name === "_PdvSchema")) {
    const version = await db.$queryRawUnsafe<
      { versao: number; checksum: string }[]
    >("SELECT versao, checksum FROM _PdvSchema WHERE id = 1");
    if (Number(version[0]?.versao) !== 2 || version[0]?.checksum !== hash)
      throw new Error("Versão do banco não corresponde a esta aplicação.");
    return { mode: "current" as const, backup: null };
  }
  const fresh = existing.length === 0;
  let backup: string | null = null;
  const before = fresh ? [] : await snapshot(db);
  if (!fresh) {
    if (!owner?.id.trim())
      throw new Error(
        "Banco legado: informe explicitamente a empresa de origem em MIGRATION_EMPRESA_ID.",
      );
    if (before.some((t) => t.columns.includes("empresaId")))
      throw new Error(
        "Origem intermediária não reconhecida; nenhuma alteração aplicada.",
      );
    const info = await db.$queryRawUnsafe<{ name: string; file: string }[]>(
      "PRAGMA database_list",
    );
    const file = info.find((d) => d.name === "main")?.file;
    if (!file)
      throw new Error("O banco de origem precisa ser um arquivo SQLite.");
    const backupDirectory = join(dirname(file), "backups");
    await mkdir(backupDirectory, { recursive: true });
    backup = join(
      backupDirectory,
      `antes-multiempresa-${Date.now()}-${randomUUID()}.db`,
    );
    await db.$executeRawUnsafe("VACUUM INTO ?", backup);
  }
  await db.$executeRawUnsafe("PRAGMA foreign_keys = OFF");
  try {
    await db.$transaction(
      async (tx) => {
        if (fresh) await execute(tx, await sql("000_fresh.sql"));
        else {
          await execute(tx, await sql("000_foundation.sql"));
          if (!(await tx.empresa.findUnique({ where: { id: owner!.id } }))) {
            if (!owner!.nome?.trim())
              throw new Error(
                "A empresa de origem não existe. Informe também MIGRATION_EMPRESA_NOME.",
              );
            await tx.empresa.create({
              data: { id: owner!.id, nome: owner!.nome! },
            });
          }
          await execute(tx, await sql("001_expand.sql"));
          for (const table of tables)
            await tx.$executeRawUnsafe(
              `UPDATE "${table}" SET empresaId = ? WHERE empresaId IS NULL`,
              owner!.id,
            );
          await execute(tx, await sql("002_constraints.sql"));
          await execute(tx, await sql("003_identity.sql"));
          // Os usuários SaaS antigos nunca eram usados pelo login por .env e podem ter senha de seed.
          // Preserva os registros, mas exige ativação explícita com senha nova para usá-los.
          await tx.usuario.updateMany({ data: { status: "BLOQUEADO" } });
          for (const old of before) {
            const after = await tx.$queryRawUnsafe(
              `SELECT ${old.columns.map((c) => `"${c}"`).join(",")} FROM "${old.table}" ORDER BY id`,
            );
            if (!isDeepStrictEqual(old.data, after))
              throw new Error(`Reconciliação falhou: ${old.table}`);
          }
          const numbers = await tx.$queryRaw<
            { empresaId: string; ultimo: number }[]
          >`SELECT empresaId, MAX(numero) AS ultimo FROM Venda GROUP BY empresaId`;
          for (const row of numbers)
            await tx.sequenciaVenda.create({
              data: {
                empresaId: row.empresaId,
                ultimoNumero: Number(row.ultimo),
              },
            });
        }
        if (
          (await tx.$queryRawUnsafe<unknown[]>("PRAGMA foreign_key_check"))
            .length
        )
          throw new Error("Referências inválidas: migração revertida.");
        await tx.$executeRawUnsafe(
          "CREATE TABLE _PdvSchema (id INTEGER PRIMARY KEY, versao INTEGER NOT NULL, checksum TEXT NOT NULL)",
        );
        await tx.$executeRawUnsafe(
          "INSERT INTO _PdvSchema (id, versao, checksum) VALUES (1, 2, ?)",
          hash,
        );
      },
      { timeout: 60000 },
    );
  } catch (error) {
    throw new Error(
      `A atualização foi revertida. Backup: ${backup ?? "origem vazia"}. ${error instanceof Error ? error.message : "Falha"}`,
    );
  } finally {
    await db.$executeRawUnsafe("PRAGMA foreign_keys = ON");
  }
  return { mode: fresh ? ("fresh" as const) : ("migrated" as const), backup };
}
