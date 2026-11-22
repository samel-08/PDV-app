import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import {
  mkdir,
  mkdtemp,
  writeFile,
  rm,
  readFile,
  readdir,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { prepareDatabase } from "../../scripts/db/migrate";
import { provision } from "../../scripts/provision";
import { runAsTenant, type TenantContext } from "../../src/lib/tenant-context";

async function files(directory: string): Promise<string[]> {
  return (
    await Promise.all(
      (await readdir(directory, { withFileTypes: true })).map((entry) =>
        entry.isDirectory()
          ? files(join(directory, entry.name))
          : [join(directory, entry.name).replaceAll("\\", "/")],
      ),
    )
  ).flat();
}
test("todas as APIs operacionais exigem o wrapper; acesso global é reservado", async () => {
  for (const file of (await files("src/app/api")).filter((f) =>
    f.endsWith("route.ts"),
  )) {
    if (file.includes("/auth/")) continue;
    const text = await readFile(file, "utf8");
    assert.match(text, /return tenantRoute\(/, file);
    assert.doesNotMatch(
      text,
      /db-core|PrismaClient|\$queryRaw|\$executeRaw/,
      file,
    );
  }
  for (const file of (await files("src/lib")).filter(
    (f) =>
      f.endsWith(".ts") &&
      !["db-core.ts", "db.ts", "tenant-route.ts"].some((name) =>
        f.endsWith("/" + name),
      ),
  )) {
    assert.doesNotMatch(
      await readFile(file, "utf8"),
      /db-core|new PrismaClient/,
      file,
    );
  }
});

test("cliente operacional é fail-closed, isolado também em transações e contextos concorrentes", async (t) => {
  const parent = resolve("work/operational-tests");
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(join(parent, "scope-"));
  const file = join(directory, "fixture.db");
  await writeFile(file, "");
  const url = `file:${file.replaceAll("\\", "/")}`;
  const admin = new PrismaClient({ datasources: { db: { url } } });
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = url;
  const { prisma } = await import("../../src/lib/db");
  const { coreDb } = await import("../../src/lib/db-core");
  try {
    await prepareDatabase(admin);
    const a = await provision(admin, {
      empresaId: "a",
      empresaNome: "Loja A",
      nome: "A",
      email: "a@example.invalid",
      password: "Senha-ficticia-A-123!",
    });
    const b = await provision(admin, {
      empresaId: "b",
      empresaNome: "Loja B",
      nome: "B",
      email: "b@example.invalid",
      password: "Senha-ficticia-B-123!",
    });
    for (const id of ["a", "b"]) {
      await admin.categoria.create({
        data: { id: `cat_${id}`, empresaId: id, nome: "Categoria igual" },
      });
      await admin.produto.create({
        data: {
          id: `prod_${id}`,
          empresaId: id,
          codigo: "001",
          nome: `Produto ${id}`,
          precoCusto: 1,
          precoVenda: id === "a" ? 10 : 20,
          estoqueAtual: 5,
          categoriaId: `cat_${id}`,
        },
      });
    }
    const context = (id: string): TenantContext => ({
      usuarioId: id === "a" ? a.usuarioId : b.usuarioId,
      empresaId: id,
      sessaoId: "somente-teste",
      cargo: "ADMINISTRADOR",
      nome: id,
      empresaNome: id,
    });
    await t.test(
      "sem empresa não há consulta; SQL e modelos globais são recusados",
      async () => {
        await assert.rejects(prisma.produto.findMany(), /Contexto de empresa/);
        await assert.rejects(
          runAsTenant(
            context("a"),
            async () => prisma.$queryRaw`SELECT * FROM Produto`,
          ),
          /SQL não disponível/,
        );
        await assert.rejects(
          runAsTenant(context("a"), async () => prisma.usuario.findMany()),
          /não disponível/,
        );
        await assert.rejects(
          runAsTenant(context("a"), async () =>
            prisma.$transaction(
              async (tx) => tx.$queryRaw`SELECT * FROM Produto`,
            ),
          ),
          /SQL não disponível/,
        );
      },
    );
    await t.test(
      "listas, agregações, filtros e IDs só retornam a própria empresa",
      async () => {
        await runAsTenant(context("a"), async () => {
          assert.deepEqual(
            (await prisma.produto.findMany({ where: { empresaId: "b" } })).map(
              (p) => p.id,
            ),
            ["prod_a"],
          );
          assert.equal(await prisma.produto.count(), 1);
          assert.equal(
            (await prisma.produto.aggregate({ _sum: { precoVenda: true } }))
              ._sum.precoVenda,
            10,
          );
          assert.equal(
            await prisma.produto.findUnique({ where: { id: "prod_b" } }),
            null,
          );
          assert.equal(
            (await prisma.produto.findMany({ include: { categoria: true } }))[0]
              .categoria?.empresaId,
            "a",
          );
          assert.deepEqual(
            (
              await prisma.$transaction(async (tx) => tx.produto.findMany())
            ).map((p) => p.id),
            ["prod_a"],
          );
        });
      },
    );
    await t.test(
      "alterações e exclusões de B são recusadas; a relação cruzada também",
      async () => {
        await runAsTenant(context("a"), async () => {
          await assert.rejects(
            prisma.produto.update({
              where: { id: "prod_b" },
              data: { nome: "Alterado" },
            }),
          );
          await assert.rejects(
            prisma.produto.delete({ where: { id: "prod_b" } }),
          );
          await assert.rejects(
            prisma.produto.create({
              data: {
                empresaId: "b",
                codigo: "x",
                nome: "x",
                precoCusto: 1,
                precoVenda: 1,
              },
            }),
            /Empresa inválida/,
          );
          await assert.rejects(
            prisma.produto.create({
              data: {
                empresaId: "a",
                codigo: "x",
                nome: "x",
                precoCusto: 1,
                precoVenda: 1,
                categoriaId: "cat_b",
              },
            }),
          );
        });
        assert.equal(
          (await admin.produto.findUniqueOrThrow({ where: { id: "prod_b" } }))
            .nome,
          "Produto b",
        );
        assert.equal(await admin.produto.count(), 2);
        await assert.rejects(
          admin.movimentacaoEstoque.create({
            data: {
              empresaId: "a",
              operadorId: b.usuarioId,
              produtoId: "prod_a",
              tipo: "AJUSTE",
              quantidade: 1,
              motivo: "Operador de outra empresa",
            },
          }),
        );
      },
    );
    await t.test(
      "dez contextos intercalados não compartilham empresa",
      async () => {
        await Promise.all(
          Array.from({ length: 10 }, (_, i) => {
            const id = i % 2 ? "a" : "b";
            return runAsTenant(context(id), async () => {
              await new Promise((resolve) => setTimeout(resolve, i % 3));
              assert.deepEqual(
                (await prisma.produto.findMany()).map((p) => p.empresaId),
                [id],
              );
            });
          }),
        );
      },
    );
    await t.test(
      "operações em lote mantêm o escopo e relações de identidade não são expostas",
      async () => {
        await runAsTenant(context("a"), async () => {
          const rows = await prisma.produto.updateManyAndReturn({
            where: { id: "prod_b" },
            data: { nome: "Não alterar B" },
          });
          assert.deepEqual(rows, []);
          const created = await prisma.produto.createManyAndReturn({
            data: [
              {
                empresaId: "a",
                codigo: "LOTE_A",
                nome: "Lote A",
                precoCusto: 1,
                precoVenda: 2,
              },
            ],
          });
          assert.equal(created.length, 1);
          assert.equal(created[0].empresaId, "a");
          await assert.rejects(
            prisma.produto.findMany({
              include: { empresa: { include: { usuarios: true } } },
            }),
            /identidade reservada/,
          );
        });
        assert.equal(
          (await admin.produto.findUniqueOrThrow({ where: { id: "prod_b" } }))
            .nome,
          "Produto b",
        );
      },
    );
    await t.test(
      "finalização herda empresa nos itens e pagamentos e repete sem nova baixa",
      async () => {
        const { finalizarVenda } = await import("../../src/lib/vendas-service");
        await runAsTenant(context("a"), async () => {
          await prisma.caixaSessao.create({
            data: { empresaId: "a", valorInicial: 0 },
          });
          const input = {
            itens: [{ produtoId: "prod_a", quantidade: 1 }],
            pagamentos: [{ formaPagamento: "PIX" as const, valor: 10 }],
            chaveIdempotencia: "finalizacao_teste_123456",
          };
          const sale = await finalizarVenda(input);
          const repeated = await finalizarVenda(input);
          assert.equal(sale.id, repeated.id);
          assert.equal(sale.numero, 1);
          assert.equal(
            (await admin.produto.findUniqueOrThrow({ where: { id: "prod_a" } }))
              .estoqueAtual,
            4,
          );
          assert.equal(
            (
              await admin.itensVenda.findFirstOrThrow({
                where: { vendaId: sale.id },
              })
            ).empresaId,
            "a",
          );
          assert.equal(
            (
              await admin.pagamentoVenda.findFirstOrThrow({
                where: { vendaId: sale.id },
              })
            ).empresaId,
            "a",
          );
          await assert.rejects(
            finalizarVenda({
              ...input,
              itens: [{ produtoId: "prod_b", quantidade: 1 }],
              chaveIdempotencia: "finalizacao_invalida_1234",
            }),
            /não encontrado/,
          );
        });
      },
    );
    await t.test(
      "ler configuração ou fazer upsert sem alterações não modifica o registro",
      async () => {
        const stamp = new Date("2020-01-01T00:00:00.000Z");
        await admin.configBalanca.update({
          where: { empresaId: "a" },
          data: { updatedAt: stamp },
        });
        const { getConfigBalanca } = await import(
          "../../src/lib/balanca-config"
        );
        await runAsTenant(context("a"), async () => {
          await getConfigBalanca();
          await prisma.configBalanca.upsert({
            where: { empresaId: "a" },
            create: { empresaId: "a" },
            update: {},
          });
        });
        assert.deepEqual(
          (
            await admin.configBalanca.findUniqueOrThrow({
              where: { empresaId: "a" },
            })
          ).updatedAt,
          stamp,
        );
      },
    );
  } finally {
    await coreDb.$disconnect();
    await admin.$disconnect();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
