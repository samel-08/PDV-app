import { PrismaClient } from "@prisma/client";
import { prepareDatabase } from "./db/migrate";
const db = new PrismaClient();
async function main() {
  if (!process.env.DATABASE_URL?.startsWith("file:"))
    throw new Error(
      "Este instalador aceita apenas SQLite. PostgreSQL exige migração própria.",
    );
  const mode = process.argv[2];
  if (mode !== "init" && mode !== "migrate")
    throw new Error("Use db:init ou db:migrate:legacy.");
  const owner =
    mode === "migrate"
      ? {
          id: process.env.MIGRATION_EMPRESA_ID ?? "",
          nome: process.env.MIGRATION_EMPRESA_NOME,
        }
      : undefined;
  const result = await prepareDatabase(db, owner);
  console.log(`Banco: ${result.mode}.`);
  if (result.backup) console.log(`Backup anterior: ${result.backup}`);
}
main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Falha na preparação",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
