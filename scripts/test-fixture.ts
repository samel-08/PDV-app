/** Inicializador filho dos testes; o processo supervisor não carrega Prisma. */
import { PrismaClient } from "@prisma/client";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prepareDatabase } from "./db/migrate";
import { provision } from "./provision";
async function main() {
  const file = process.env.PDV_E2E_DATABASE_FILE;
  if (
    !file ||
    (!resolve(file).startsWith(resolve("work/e2e") + "/") &&
      !resolve(file).startsWith(resolve("work/e2e") + "\\"))
  )
    throw new Error("Banco descartável dos testes obrigatório.");
  const db = new PrismaClient({
    datasources: { db: { url: `file:${file.replaceAll("\\", "/")}` } },
  });
  try {
    await prepareDatabase(db);
    const users: Record<string, string> = {};
    for (const id of ["a", "b"]) {
      const prepared = await provision(db, {
        empresaId: `test_empresa_${id}`,
        empresaNome: `Empresa fictícia ${id.toUpperCase()}`,
        nome: `Administrador ${id}`,
        email: `admin.${id}@example.invalid`,
        password: "Somente-teste-123!A",
      });
      users[id] = prepared.usuarioId;
      const empresaId = prepared.empresaId;
      await db.categoria.create({
        data: {
          id: `cat_${id}`,
          empresaId,
          nome: "Categoria compartilhada apenas no nome",
        },
      });
      await db.produto.create({
        data: {
          id: `test_produto_${id}`,
          empresaId,
          codigo: "001",
          nome: `Produto exclusivo ${id.toUpperCase()}`,
          precoCusto: 1.2,
          precoVenda: id === "a" ? 2.5 : 7.5,
          estoqueAtual: 40,
          categoriaId: `cat_${id}`,
        },
      });
      await db.produto.create({
        data: {
          id: `peso_${id}`,
          empresaId,
          codigo: "10001",
          nome: `Granola exclusiva ${id.toUpperCase()}`,
          precoCusto: 18,
          precoVenda: 32,
          unidadeMedida: "KG",
          estoqueAtual: 15,
          categoriaId: `cat_${id}`,
        },
      });
      await db.configBalanca.update({
        where: { empresaId },
        data: {
          prefixoIdentificacao: id === "a" ? "2" : "9",
          codigoProdutoInicio: 2,
          codigoProdutoFim: 6,
          pesoValorInicio: 7,
          pesoValorFim: 12,
          casasDecimais: 3,
        },
      });
    }
    for (const cargo of ["CAIXA", "GERENTE"] as const) {
      const account = await provision(db, {
        empresaId: "test_empresa_a",
        nome: cargo,
        email: `${cargo.toLowerCase()}@example.invalid`,
        password: "Somente-teste-123!A",
        cargo,
      });
      users[cargo] = account.usuarioId;
    }
    await writeFile(
      resolve("work/e2e-current.json"),
      JSON.stringify({ file, users, runId: process.env.PDV_E2E_RUN_ID }),
      { mode: 0o600 },
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
