import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { TenantLab, operationalTables } from "../../scripts/tenant-lab/lab";

async function constraint(action: () => Promise<unknown>, pattern: RegExp) {
  await assert.rejects(action, error => {
    assert.match(String(error), pattern);
    return true;
  });
}

test("ensaio A/B: migração preserva dados e impõe relações por empresa", async t => {
  const lab = await TenantLab.create();
  try {
    await lab.seedLegacy();
    const before = await lab.legacySnapshot();
    await t.test("dono dos dados antigos é explícito; erro não altera o banco", async () => {
      await assert.rejects(lab.migrate(""), /explicitamente/);
      await assert.rejects(lab.migrate("empresa_inexistente"), /explicitamente/);
      assert.deepEqual(await lab.legacySnapshot(), before);
    });
    const result = await lab.migrate("empresa_a");
    await t.test("reconcilia todas as colunas e linhas das dez tabelas", async () => {
      assert.equal(result.tables, 10);
      assert.equal(result.rows, 11);
      const after = await lab.legacySnapshot();
      for (const old of before) {
        const current = after.find(row => row.table === old.table)!;
        assert.equal(current.rows.length, old.rows.length);
        for (const [index, row] of current.rows.entries()) {
          const values = row as Record<string, unknown>;
          assert.equal(values.empresaId, "empresa_a");
          for (const col of old.columns) assert.deepEqual(values[col], (old.rows[index] as Record<string, unknown>)[col]);
        }
      }
      await assert.rejects(lab.migrate("empresa_a"), /já foi migrado/);
    });
    await lab.seedCompanyB();
    await t.test("duas empresas têm usuários, código 001, categoria Bebidas e venda 1", async () => {
      const products = await lab.db.$queryRaw<{ empresaId: string; codigo: string }[]>`SELECT empresaId, codigo FROM Produto ORDER BY empresaId`;
      assert.deepEqual(products, [{ empresaId: "empresa_a", codigo: "001" }, { empresaId: "empresa_b", codigo: "001" }]);
      const sales = await lab.db.$queryRaw<{ numero: number }[]>`SELECT numero FROM Venda ORDER BY empresaId`;
      assert.deepEqual(sales.map(row => Number(row.numero)), [1, 1]);
      assert.equal(await lab.db.usuarioEmpresa.count(), 2);
      for (const table of operationalTables) {
        const columns = await lab.db.$queryRawUnsafe<{ name: string; notnull: bigint }[]>(`PRAGMA table_info("${table}")`);
        assert.equal(Number(columns.find(c => c.name === "empresaId")?.notnull), 1, table);
      }
    });
    await t.test("helper do laboratório exige vínculo e não retorna produto da outra loja", async () => {
      assert.equal((await lab.productForUser("usuario_a", "empresa_a", "produto_a")).length, 1);
      assert.deepEqual(await lab.productForUser("usuario_a", "empresa_a", "produto_b"), []);
      assert.deepEqual(await lab.productForUser("usuario_b", "empresa_b", "produto_a"), []);
      await assert.rejects(lab.productForUser("usuario_a", "empresa_b", "produto_b"), /não autorizado/);
      await lab.db.usuarioEmpresa.update({ where: { usuarioId_empresaId: { usuarioId: "usuario_a", empresaId: "empresa_a" } }, data: { ativo: false } });
      await assert.rejects(lab.productForUser("usuario_a", "empresa_a", "produto_a"), /não autorizado/);
      await lab.db.usuarioEmpresa.update({ where: { usuarioId_empresaId: { usuarioId: "usuario_a", empresaId: "empresa_a" } }, data: { ativo: true } });
    });
    const links = [
      ["Produto", "categoriaId", "produto", "categoria"],
      ["Venda", "caixaSessaoId", "venda", "caixa"],
      ["ItensVenda", "produtoId", "item", "produto"],
      ["ItensVenda", "vendaId", "item", "venda"],
      ["PagamentoVenda", "vendaId", "pagamento", "venda"],
      ["MovimentacaoCaixa", "caixaSessaoId", "mov_caixa", "caixa"],
      ["MovimentacaoCaixa", "referenciaVendaId", "mov_caixa", "venda"],
      ["MovimentacaoEstoque", "produtoId", "mov_estoque", "produto"],
    ];
    for (const [table, column, entity, target] of links) {
      await t.test(`${table}.${column}: vínculos A→B e B→A são rejeitados sem alterar dados`, async () => {
        const snapshot = await lab.legacySnapshot();
        for (const [from, to] of [["a", "b"], ["b", "a"]]) {
          await constraint(() => lab.db.$executeRawUnsafe(
            `UPDATE "${table}" SET "${column}" = ? WHERE id = ?`, `${target}_${to}`, `${entity}_${from}`,
          ), /FOREIGN KEY/i);
        }
        assert.deepEqual(await lab.legacySnapshot(), snapshot);
      });
    }
    await t.test("código, categoria, número e configuração continuam únicos dentro da loja", async () => {
      const now = new Date();
      await constraint(() => lab.db.$executeRaw`INSERT INTO Produto (id, empresaId, codigo, nome, precoCusto, precoVenda, updatedAt)
        VALUES ('duplicado', 'empresa_a', '001', 'Duplicado', 1, 2, ${now})`, /UNIQUE/i);
      await constraint(() => lab.db.$executeRaw`INSERT INTO Categoria (id, empresaId, nome) VALUES ('duplicada', 'empresa_a', 'Bebidas')`, /UNIQUE/i);
      await constraint(() => lab.db.$executeRaw`INSERT INTO Venda (id, empresaId, numero, total, formaPagamento, valorRecebido, troco, caixaSessaoId)
        VALUES ('duplicada', 'empresa_a', 1, 10, 'PIX', 10, 0, 'caixa_a')`, /UNIQUE/i);
      await constraint(() => lab.db.$executeRaw`INSERT INTO ConfigSistema (id, empresaId) VALUES ('duplicada', 'empresa_a')`, /UNIQUE/i);
      await constraint(() => lab.db.$executeRaw`INSERT INTO Categoria (id, nome) VALUES ('sem_empresa', 'Sem empresa')`, /NOT NULL/i);
      await constraint(() => lab.db.$executeRaw`INSERT INTO Categoria (id, empresaId, nome) VALUES ('inexistente', 'empresa_inexistente', 'X')`, /FOREIGN KEY/i);
    });
    await t.test("somente um caixa aberto por empresa; caixas fechados são preservados", async () => {
      await constraint(() => lab.db.$executeRaw`INSERT INTO CaixaSessao (id, empresaId, valorInicial)
        VALUES ('segundo_caixa_a', 'empresa_a', 0)`, /UNIQUE/i);
      await lab.db.$executeRaw`INSERT INTO CaixaSessao (id, empresaId, valorInicial, status)
        VALUES ('caixa_fechado_a', 'empresa_a', 0, 'FECHADO')`;
      const boxes = await lab.db.$queryRaw<{ empresaId: string }[]>`SELECT empresaId FROM CaixaSessao WHERE status = 'ABERTO' ORDER BY empresaId`;
      assert.deepEqual(boxes.map(row => row.empresaId), ['empresa_a', 'empresa_b']);
    });
    await t.test("configurações são independentes e integridade referencial continua ativa", async () => {
      await lab.db.$executeRaw`UPDATE ConfigSistema SET nomeFantasia = 'Loja A alterada' WHERE empresaId = 'empresa_a'`;
      const config = await lab.db.$queryRaw<{ nomeFantasia: string }[]>`SELECT nomeFantasia FROM ConfigSistema WHERE empresaId = 'empresa_b'`;
      assert.equal(config[0].nomeFantasia, "Loja B");
      const balance = await lab.db.$queryRaw<{ prefixoIdentificacao: string }[]>`SELECT prefixoIdentificacao FROM ConfigBalanca ORDER BY empresaId`;
      assert.deepEqual(balance.map(row => row.prefixoIdentificacao), ["2", "9"]);
      assert.deepEqual(await lab.db.$queryRawUnsafe("PRAGMA foreign_key_check"), []);
      const fk = await lab.db.$queryRawUnsafe<{ foreign_keys: bigint }[]>("PRAGMA foreign_keys");
      assert.equal(Number(fk[0].foreign_keys), 1);
      assert.deepEqual(await lab.db.$queryRawUnsafe("PRAGMA integrity_check"), [{ integrity_check: "ok" }]);
    });
  } finally { await lab.close(); }
});

test("falha durante o ensaio reverte DDL/backfill e permite corrigir e tentar novamente", async () => {
  const lab = await TenantLab.create();
  try {
    await lab.seedLegacy();
    // Simula uma origem inconsistente; somente no arquivo descartável recém-criado.
    await lab.db.$executeRawUnsafe("PRAGMA foreign_keys = OFF");
    await lab.db.$executeRaw`UPDATE ItensVenda SET produtoId = 'produto_ausente' WHERE id = 'item_a'`;
    await lab.db.$executeRawUnsafe("PRAGMA foreign_keys = ON");
    const before = await lab.legacySnapshot();
    await assert.rejects(lab.migrate("empresa_a"), /referências inválidas/);
    assert.deepEqual(await lab.legacySnapshot(), before);
    const fk = await lab.db.$queryRawUnsafe<{ foreign_keys: bigint }[]>("PRAGMA foreign_keys");
    assert.equal(Number(fk[0].foreign_keys), 1);
    await lab.db.$executeRaw`UPDATE ItensVenda SET produtoId = 'produto_a' WHERE id = 'item_a'`;
    assert.equal((await lab.migrate("empresa_a")).tables, 10);
  } finally { await lab.close(); }
});

test("DATABASE_URL externo é ignorado e seu arquivo é preservado", async () => {
  const root = resolve("work/tenant-lab");
  await mkdir(root, { recursive: true });
  const directory = await mkdtemp(join(root, "sentinel-"));
  const sentinel = join(directory, "nao-usar.db");
  const content = Buffer.from("Este arquivo representa um banco externo e não deve ser aberto.");
  await writeFile(sentinel, content);
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = `file:${sentinel.replaceAll("\\", "/")}`;
  let lab: TenantLab | undefined;
  try {
    lab = await TenantLab.create();
    await lab.seedLegacy();
    await lab.migrate("empresa_a");
    assert.deepEqual(await readFile(sentinel), content);
  } finally {
    await lab?.close();
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
    await rm(directory, { recursive: true, force: true });
  }
});

test("origem com dois caixas abertos é recusada e permanece intacta", async () => {
  const lab = await TenantLab.create();
  try {
    await lab.seedLegacy();
    await lab.db.caixaSessao.create({ data: { id: "caixa_legado_extra", valorInicial: 30 } });
    const before = await lab.legacySnapshot();
    await assert.rejects(lab.migrate("empresa_a"), /UNIQUE/i);
    assert.deepEqual(await lab.legacySnapshot(), before);
    const fk = await lab.db.$queryRawUnsafe<{ foreign_keys: bigint }[]>("PRAGMA foreign_keys");
    assert.equal(Number(fk[0].foreign_keys), 1);
  } finally { await lab.close(); }
});
