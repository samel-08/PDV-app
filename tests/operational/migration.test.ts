import assert from "node:assert/strict";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { prepareDatabase } from "../../scripts/db/migrate";
import { TenantLab } from "../../scripts/tenant-lab/lab";
import { provision } from "../../scripts/provision";
import { verifyPassword } from "../../src/lib/password";

export async function freshDatabase() {
  const parent = resolve("work/operational-tests");
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(join(parent, "run-"));
  const file = join(directory, "fixture.db");
  await writeFile(file, "", { flag: "wx" });
  const db = new PrismaClient({
    datasources: { db: { url: `file:${file.replaceAll("\\", "/")}` } },
  });
  return {
    db,
    file,
    async close() {
      await db.$disconnect();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

test("instalação nova e repetida: sem dados ou usuários universais", async () => {
  const fixture = await freshDatabase();
  try {
    assert.equal((await prepareDatabase(fixture.db)).mode, "fresh");
    assert.equal((await prepareDatabase(fixture.db)).mode, "current");
    assert.equal(await fixture.db.usuario.count(), 0);
    assert.equal(await fixture.db.produto.count(), 0);
    const one = await provision(fixture.db, {
      empresaId: "a",
      empresaNome: "Loja A",
      nome: "Dono A",
      email: "a@example.invalid",
      password: "Senha-ficticia-A-123!",
    });
    const two = await provision(fixture.db, {
      empresaId: "b",
      empresaNome: "Loja B",
      nome: "Dono B",
      email: "b@example.invalid",
      password: "Senha-ficticia-B-123!",
    });
    assert.notEqual(one.usuarioId, two.usuarioId);
    assert.equal(await fixture.db.configSistema.count(), 2);
    await assert.rejects(
      provision(fixture.db, {
        empresaId: "b",
        nome: "A",
        email: "a@example.invalid",
        password: "Outra-senha-ficticia!",
      }),
      /outra empresa/,
    );
    const user = await fixture.db.usuario.findUniqueOrThrow({
      where: { email: "a@example.invalid" },
    });
    assert.equal(
      await verifyPassword("Senha-ficticia-A-123!", user.senhaHash),
      true,
    );
  } finally {
    await fixture.close();
  }
});

test("migração operacional exige dono, salva backup e preserva vendas, estoque, datas e IDs", async () => {
  const lab = await TenantLab.create();
  try {
    await lab.seedLegacy();
    const before = await lab.legacySnapshot();
    await assert.rejects(prepareDatabase(lab.db), /explicitamente/);
    assert.deepEqual(await lab.legacySnapshot(), before);
    const result = await prepareDatabase(lab.db, { id: "empresa_a" });
    assert.equal(result.mode, "migrated");
    assert.ok(result.backup);
    const after = await lab.legacySnapshot();
    for (const old of before) {
      const current = after.find((t) => t.table === old.table)!;
      assert.equal(current.rows.length, old.rows.length);
      for (let i = 0; i < old.rows.length; i++)
        for (const key of old.columns) {
          assert.deepEqual(
            (current.rows[i] as Record<string, unknown>)[key],
            (old.rows[i] as Record<string, unknown>)[key],
          );
        }
    }
    assert.equal(
      (
        await lab.db.sequenciaVenda.findUniqueOrThrow({
          where: { empresaId: "empresa_a" },
        })
      ).ultimoNumero,
      1,
    );
    const oldUser = await lab.db.usuario.findUniqueOrThrow({
      where: { id: "usuario_a" },
    });
    assert.equal(oldUser.status, "BLOQUEADO");
    await provision(lab.db, {
      empresaId: "empresa_a",
      nome: "Dono reativado",
      email: oldUser.email,
      password: "Nova-senha-ficticia-123!",
      resetExisting: true,
    });
    assert.equal(
      (await lab.db.usuario.findUniqueOrThrow({ where: { id: oldUser.id } }))
        .status,
      "ATIVO",
    );
    const backup = new PrismaClient({
      datasources: {
        db: { url: `file:${result.backup!.replaceAll("\\", "/")}` },
      },
    });
    try {
      const columns = await backup.$queryRawUnsafe<{ name: string }[]>(
        "PRAGMA table_info(Produto)",
      );
      assert.ok(!columns.some((c) => c.name === "empresaId"));
      assert.equal(
        (
          await backup.$queryRaw<
            { n: bigint }[]
          >`SELECT count(*) AS n FROM Venda`
        )[0].n,
        BigInt(1),
      );
    } finally {
      await backup.$disconnect();
    }
    assert.equal((await prepareDatabase(lab.db)).mode, "current");
  } finally {
    await lab.close();
  }
});

test("origem inconsistente reverte também identidade, empresa e marcador", async () => {
  const lab = await TenantLab.create();
  try {
    await lab.seedLegacy();
    await lab.db.$executeRawUnsafe("PRAGMA foreign_keys = OFF");
    await lab.db
      .$executeRaw`UPDATE ItensVenda SET produtoId = 'ausente' WHERE id = 'item_a'`;
    await lab.db.$executeRawUnsafe("PRAGMA foreign_keys = ON");
    const before = await lab.legacySnapshot();
    await assert.rejects(
      prepareDatabase(lab.db, { id: "empresa_a" }),
      /revertida/,
    );
    assert.deepEqual(await lab.legacySnapshot(), before);
    assert.equal(
      (await lab.db.usuario.findUniqueOrThrow({ where: { id: "usuario_a" } }))
        .status,
      "ATIVO",
    );
    const marker = await lab.db.$queryRaw<
      { name: string }[]
    >`SELECT name FROM sqlite_master WHERE name = '_PdvSchema'`;
    assert.deepEqual(marker, []);
  } finally {
    await lab.close();
  }
});

test("origem operacional sem fundação SaaS recebe empresa explícita sem usuários padrão", async () => {
  const lab = await TenantLab.create();
  try {
    await lab.db.$executeRawUnsafe("PRAGMA foreign_keys = OFF");
    for (const table of [
      "CobrancaLicenca",
      "AuditLog",
      "UsuarioEmpresa",
      "LicencaEmpresa",
      "Plano",
      "Usuario",
      "Empresa",
      "WebhookEvent",
    ])
      await lab.db.$executeRawUnsafe(`DROP TABLE "${table}"`);
    await lab.db.$executeRawUnsafe("PRAGMA foreign_keys = ON");
    await lab.db
      .$executeRaw`INSERT INTO Categoria (id, nome) VALUES ('categoria_antiga','Antiga')`;
    await lab.db
      .$executeRaw`INSERT INTO Produto (id, codigo, nome, precoCusto, precoVenda, estoqueAtual, categoriaId, updatedAt) VALUES ('antigo','001','Produto antigo',5,10,3,'categoria_antiga',${new Date()})`;
    const result = await prepareDatabase(lab.db, {
      id: "importada",
      nome: "Loja antiga",
    });
    assert.equal(result.mode, "migrated");
    const product = await lab.db.produto.findUniqueOrThrow({
      where: { id: "antigo" },
    });
    assert.equal(product.empresaId, "importada");
    assert.equal(product.estoqueAtual, 3);
    assert.equal(await lab.db.usuario.count(), 0);
  } finally {
    await lab.close();
  }
});
