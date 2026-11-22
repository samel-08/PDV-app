/** Ensaio descartável. Não recebe URL, arquivo de origem ou banco do usuário. */
import { PrismaClient, type Prisma } from "@prisma/client";
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const labRoot = join(root, "work", "tenant-lab");
const migrationRoot = join(root, "prisma", "tenant-lab", "migrations");
export const operationalTables = [
  "Categoria", "Produto", "ConfigBalanca", "ConfigSistema", "CaixaSessao",
  "Venda", "ItensVenda", "PagamentoVenda", "MovimentacaoCaixa", "MovimentacaoEstoque",
] as const;

type Db = Prisma.TransactionClient;
type Snapshot = { table: string; columns: string[]; rows: unknown[] }[];
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function fixturePassword() {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(randomBytes(24), salt, 64).toString("hex")}`;
}
async function readMigration(name: string) {
  return readFile(join(migrationRoot, name), "utf8");
}
async function executeSql(db: Db, source: string) {
  // Apenas SQL versionado deste laboratório, sem triggers nem ';' em literais.
  const statements = source.replace(/^\s*--.*$/gm, "").split(";").map(s => s.trim()).filter(Boolean);
  for (const statement of statements) {
    if (/^PRAGMA\b/i.test(statement)) continue; // Gerenciados explicitamente pelo ensaio.
    await db.$executeRawUnsafe(statement);
  }
}
async function snapshot(db: Db, previous?: Snapshot): Promise<Snapshot> {
  const result: Snapshot = [];
  for (const table of operationalTables) {
    const columns = previous?.find(t => t.table === table)?.columns ??
      (await db.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("${table}")`)).map(c => c.name);
    result.push({ table, columns, rows: await db.$queryRawUnsafe(
      `SELECT ${columns.map(c => `"${c}"`).join(",")} FROM "${table}" ORDER BY "id"`,
    ) });
  }
  return result;
}

export class TenantLab {
  private migrated = false;
  private constructor(readonly db: PrismaClient, private readonly directory: string) {}

  static async create() {
    await mkdir(labRoot, { recursive: true });
    const directory = await mkdtemp(join(labRoot, "run-"));
    const database = join(directory, "fixture.db");
    await writeFile(database, "", { flag: "wx", mode: 0o600 });
    // Sobrescreve qualquer DATABASE_URL do ambiente ou de .env.
    const db = new PrismaClient({ datasources: { db: { url: `file:${database.replaceAll("\\", "/")}` } } });
    const lab = new TenantLab(db, directory);
    try {
      await lab.verifyManifest();
      await db.$executeRawUnsafe("PRAGMA foreign_keys = ON");
      await db.$transaction(async tx => executeSql(tx, await readMigration("000_legacy.sql")), { timeout: 30000 });
      return lab;
    } catch (error) { await lab.close(); throw error; }
  }

  private async verifyManifest() {
    const manifest = JSON.parse(await readFile(join(root, "prisma/tenant-lab/manifest.json"), "utf8")) as {
      legacySchemaSha256: string; targetSchemaSha256: string; migrations: Record<string, string>;
    };
    if (hash(await readFile(join(root, "prisma/schema.prisma"), "utf8")) !== manifest.legacySchemaSha256 ||
        hash(await readFile(join(root, "prisma/tenant-lab/schema.prisma"), "utf8")) !== manifest.targetSchemaSha256) {
      throw new Error("Os schemas mudaram: revise e regenere o ensaio antes de continuar.");
    }
    for (const [name, checksum] of Object.entries(manifest.migrations)) {
      if (hash(await readMigration(name)) !== checksum) throw new Error(`Checksum inválido: ${name}`);
    }
  }

  async seedLegacy() {
    await this.db.$transaction(async tx => {
      await tx.empresa.create({ data: { id: "empresa_a", nome: "Loja A — fictícia" } });
      await tx.usuario.create({ data: { id: "usuario_a", nome: "Administrador A", email: "a@example.invalid", senhaHash: fixturePassword() } });
      await tx.usuarioEmpresa.create({ data: { usuarioId: "usuario_a", empresaId: "empresa_a", cargo: "ADMINISTRADOR" } });
      await tx.categoria.create({ data: { id: "categoria_a", nome: "Bebidas" } });
      await tx.produto.create({ data: { id: "produto_a", codigo: "001", nome: "Produto A", precoCusto: 4.2, precoVenda: 10, estoqueAtual: 19, categoriaId: "categoria_a" } });
      await tx.configSistema.create({ data: { id: "singleton", nomeFantasia: "Loja A", cidade: "Curitiba", estado: "PR" } });
      await tx.configBalanca.create({ data: { id: "singleton", prefixoIdentificacao: "2" } });
      await tx.caixaSessao.create({ data: { id: "caixa_a", valorInicial: 100 } });
      await tx.venda.create({ data: { id: "venda_a", numero: 1, total: 10, formaPagamento: "DINHEIRO", valorRecebido: 10, troco: 0, caixaSessaoId: "caixa_a",
        itens: { create: { id: "item_a", produtoId: "produto_a", quantidade: 1, precoUnitario: 10, precoCustoSnapshot: 4.2, subtotal: 10 } },
        pagamentos: { create: { id: "pagamento_a", formaPagamento: "DINHEIRO", valor: 10 } },
      } });
      await tx.movimentacaoCaixa.createMany({ data: [
        { id: "abertura_a", tipo: "ABERTURA", valor: 100, caixaSessaoId: "caixa_a" },
        { id: "mov_caixa_a", tipo: "VENDA", valor: 10, caixaSessaoId: "caixa_a", referenciaVendaId: "venda_a" },
      ] });
      await tx.movimentacaoEstoque.create({ data: { id: "mov_estoque_a", produtoId: "produto_a", quantidade: 1, tipo: "VENDA", motivo: "Venda fictícia #1" } });
    });
  }

  async legacySnapshot() { return snapshot(this.db); }

  async migrate(ownerId: string) {
    if (this.migrated) throw new Error("Este ensaio já foi migrado.");
    if (!ownerId.trim() || !(await this.db.empresa.findUnique({ where: { id: ownerId } }))) {
      throw new Error("Informe explicitamente uma empresa existente para os dados legados.");
    }
    const before = await snapshot(this.db);
    await this.db.$executeRawUnsafe("PRAGMA foreign_keys = OFF");
    try {
      await this.db.$transaction(async tx => {
        await executeSql(tx, await readMigration("001_expand.sql"));
        for (const table of operationalTables) {
          await tx.$executeRawUnsafe(`UPDATE "${table}" SET "empresaId" = ? WHERE "empresaId" IS NULL`, ownerId);
        }
        await executeSql(tx, await readMigration("002_constraints.sql"));
        for (const table of operationalTables) {
          const wrong = await tx.$queryRawUnsafe<{ n: bigint }[]>(
            `SELECT count(*) AS n FROM "${table}" WHERE "empresaId" IS NULL OR "empresaId" <> ?`, ownerId,
          );
          if (Number(wrong[0].n) !== 0) throw new Error(`Empresa incorreta: ${table}`);
        }
        const violations = await tx.$queryRawUnsafe<unknown[]>("PRAGMA foreign_key_check");
        if (violations.length) throw new Error("A migração criou referências inválidas.");
        const after = await snapshot(tx, before);
        // Compara cada coluna antiga, incluindo totais, estoque, datas e IDs.
        const { isDeepStrictEqual } = await import("node:util");
        if (!isDeepStrictEqual(before, after)) throw new Error("Reconciliação dos dados antigos falhou.");
      }, { timeout: 30000 });
      this.migrated = true;
    } finally {
      await this.db.$executeRawUnsafe("PRAGMA foreign_keys = ON");
    }
    return { tables: before.length, rows: before.reduce((sum, t) => sum + t.rows.length, 0) };
  }

  async seedCompanyB() {
    if (!this.migrated) throw new Error("Migre os dados de A antes de criar os de B.");
    await this.db.$transaction(async tx => {
      await tx.empresa.create({ data: { id: "empresa_b", nome: "Loja B — fictícia" } });
      await tx.usuario.create({ data: { id: "usuario_b", nome: "Administrador B", email: "b@example.invalid", senhaHash: fixturePassword() } });
      await tx.usuarioEmpresa.create({ data: { usuarioId: "usuario_b", empresaId: "empresa_b", cargo: "ADMINISTRADOR" } });
      const now = new Date();
      await tx.$executeRaw`INSERT INTO Categoria (id, empresaId, nome) VALUES ('categoria_b', 'empresa_b', 'Bebidas')`;
      await tx.$executeRaw`INSERT INTO Produto (id, empresaId, codigo, nome, precoCusto, precoVenda, estoqueAtual, categoriaId, updatedAt)
        VALUES ('produto_b', 'empresa_b', '001', 'Produto B', 8, 20, 49, 'categoria_b', ${now})`;
      await tx.$executeRaw`INSERT INTO ConfigSistema (id, empresaId, nomeFantasia) VALUES ('config_b', 'empresa_b', 'Loja B')`;
      await tx.$executeRaw`INSERT INTO ConfigBalanca (id, empresaId, prefixoIdentificacao, updatedAt) VALUES ('balanca_b', 'empresa_b', '9', ${now})`;
      await tx.$executeRaw`INSERT INTO CaixaSessao (id, empresaId, valorInicial) VALUES ('caixa_b', 'empresa_b', 200)`;
      await tx.$executeRaw`INSERT INTO Venda (id, empresaId, numero, total, formaPagamento, valorRecebido, troco, caixaSessaoId)
        VALUES ('venda_b', 'empresa_b', 1, 20, 'PIX', 20, 0, 'caixa_b')`;
      await tx.$executeRaw`INSERT INTO ItensVenda (id, empresaId, quantidade, precoUnitario, precoCustoSnapshot, subtotal, vendaId, produtoId)
        VALUES ('item_b', 'empresa_b', 1, 20, 8, 20, 'venda_b', 'produto_b')`;
      await tx.$executeRaw`INSERT INTO PagamentoVenda (id, empresaId, formaPagamento, valor, vendaId)
        VALUES ('pagamento_b', 'empresa_b', 'PIX', 20, 'venda_b')`;
      await tx.$executeRaw`INSERT INTO MovimentacaoCaixa (id, empresaId, tipo, valor, caixaSessaoId, referenciaVendaId)
        VALUES ('mov_caixa_b', 'empresa_b', 'VENDA', 0, 'caixa_b', 'venda_b')`;
      await tx.$executeRaw`INSERT INTO MovimentacaoEstoque (id, empresaId, tipo, quantidade, motivo, produtoId)
        VALUES ('mov_estoque_b', 'empresa_b', 'VENDA', 1, 'Venda fictícia #1', 'produto_b')`;
    });
  }

  /** Helper de teste, não é autenticação da aplicação nem proteção de rotas. */
  async productForUser(usuarioId: string, empresaId: string, produtoId: string) {
    const membership = await this.db.usuarioEmpresa.findUnique({ where: { usuarioId_empresaId: { usuarioId, empresaId } }, include: { usuario: true, empresa: true } });
    if (!membership?.ativo || membership.usuario.status !== "ATIVO" || membership.empresa.status !== "ATIVA") {
      throw new Error("Vínculo não autorizado no ensaio.");
    }
    return this.db.$queryRaw<{ id: string; empresaId: string; codigo: string; nome: string }[]>`
      SELECT id, empresaId, codigo, nome FROM Produto WHERE id = ${produtoId} AND empresaId = ${empresaId}`;
  }

  async close() {
    await this.db.$disconnect();
    // O diretório foi criado exclusivamente por mkdtemp nesta instância.
    await rm(this.directory, { recursive: true, force: true });
  }
}
