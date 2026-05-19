import { prisma } from "@/lib/db";
import { markupFromPrecos } from "@/lib/produto-precos";
import type { CsvImportLogEntry, CsvImportResult, NormalizedProdutoRow } from "@/lib/csv-produtos-import";

const BATCH_SIZE = 25;

function isPrismaUnique(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002";
}

/** Importa linhas já normalizadas: categorias upsert, produtos novos apenas (código único). */
export async function importProdutosFromRows(
  rows: NormalizedProdutoRow[],
  initialLogs: CsvImportLogEntry[] = []
): Promise<CsvImportResult> {
  const logs: CsvImportLogEntry[] = [...initialLogs];
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  const existing = await prisma.produto.findMany({ select: { codigo: true } });
  const existingCodes = new Set(existing.map((p) => p.codigo));
  const seenInFile = new Set<string>();

  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);
    await prisma.$transaction(
      async (tx) => {
        for (const row of batch) {
          try {
            if (seenInFile.has(row.codigo)) {
              skipped += 1;
              logs.push({
                level: "warn",
                line: row.line,
                message: `Ignorado: código "${row.codigo}" repetido no arquivo.`,
              });
              continue;
            }
            seenInFile.add(row.codigo);

            if (existingCodes.has(row.codigo)) {
              skipped += 1;
              logs.push({
                level: "info",
                line: row.line,
                message: `Ignorado: código "${row.codigo}" já existe no cadastro.`,
              });
              continue;
            }

            let categoriaId: string | null = null;
            const catNome = row.categoriaNome.trim();
            if (catNome) {
              const nomeCat = catNome.slice(0, 80);
              const cat = await tx.categoria.upsert({
                where: { nome: nomeCat },
                create: { nome: nomeCat },
                update: {},
              });
              categoriaId = cat.id;
            }

            const markupPercent = markupFromPrecos(row.precoCusto, row.precoVenda);
            await tx.produto.create({
              data: {
                codigo: row.codigo,
                nome: row.nome.slice(0, 500),
                precoCusto: row.precoCusto,
                precoVenda: row.precoVenda,
                markupPercent,
                unidadeMedida: row.unidadeMedida,
                categoriaId,
                ativo: true,
              },
            });
            existingCodes.add(row.codigo);
            imported += 1;
            logs.push({
              level: "info",
              line: row.line,
              message: `Importado: ${row.codigo} — ${row.nome}`,
            });
          } catch (e) {
            if (isPrismaUnique(e)) {
              skipped += 1;
              existingCodes.add(row.codigo);
              logs.push({
                level: "info",
                line: row.line,
                message: `Ignorado: código "${row.codigo}" já cadastrado (concorrência).`,
              });
            } else {
              errors += 1;
              logs.push({
                level: "error",
                line: row.line,
                message: e instanceof Error ? e.message : "Erro ao gravar linha.",
              });
            }
          }
        }
      },
      { maxWait: 30_000, timeout: 120_000 }
    );
  }

  return { imported, skipped, errors, logs };
}
