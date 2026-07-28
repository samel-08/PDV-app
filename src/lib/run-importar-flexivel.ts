/**
 * Executa a importacao flexivel de produtos no banco.
 * Suporta modos: ignorar existentes / atualizar existentes.
 */
import { prisma } from "@/lib/db";
import { markupFromPrecos } from "@/lib/produto-precos";
import type { NormalizedImportRow, ImportResult, ImportResultRow, ImportMode } from "@/lib/importar-produtos-flexivel";

const BATCH_SIZE = 25;

function isPrismaUnique(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002";
}

function generateCodigo(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `AUTO-${ts}-${rand}`.toUpperCase();
}

export async function importarProdutosFlexivel(
  rows: NormalizedImportRow[],
  mode: ImportMode
): Promise<ImportResult> {
  let criados = 0;
  let atualizados = 0;
  let ignorados = 0;
  let erros = 0;
  const detalhes: ImportResultRow[] = [];

  // Pre-fetch existing codes and barcodes
  const existingProducts = await prisma.produto.findMany({
    select: { id: true, codigo: true },
  });
  const codeToId = new Map(existingProducts.map((p) => [p.codigo, p.id]));
  const seenInFile = new Set<string>();

  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);
    await prisma.$transaction(
      async (tx) => {
        for (const row of batch) {
          try {
            // Generate code if empty
            const codigo = row.codigo || generateCodigo();

            // Check duplicates in file
            const uniqueKey = codigo.toLowerCase();
            if (seenInFile.has(uniqueKey)) {
              ignorados += 1;
              detalhes.push({ line: row.line, status: "ignorado", message: `Codigo "${codigo}" repetido no arquivo.` });
              continue;
            }
            seenInFile.add(uniqueKey);

            // Check if product exists
            const existingId = codeToId.get(codigo);
            if (existingId) {
              if (mode === "ignorar") {
                ignorados += 1;
                detalhes.push({ line: row.line, status: "ignorado", message: `Codigo "${codigo}" ja existe.` });
                continue;
              }

              // mode === "atualizar"
              let categoriaId: string | null = null;
              if (row.categoria && row.categoria !== "Sem categoria") {
                const cat = await tx.categoria.upsert({
                  where: { nome: row.categoria },
                  create: { nome: row.categoria },
                  update: {},
                });
                categoriaId = cat.id;
              }

              const markupPercent = markupFromPrecos(row.precoCusto, row.precoVenda);
              await tx.produto.update({
                where: { id: existingId },
                data: {
                  nome: row.nome,
                  precoCusto: row.precoCusto,
                  precoVenda: row.precoVenda,
                  markupPercent,
                  unidadeMedida: row.unidadeMedida,
                  ...(row.estoqueAtualMapped ? { estoqueAtual: row.estoqueAtual } : {}),
                  ...(row.estoqueMinimoMapped ? { estoqueMinimo: row.estoqueMinimo } : {}),
                  ...(categoriaId ? { categoriaId } : {}),
                  ativo: row.ativo,
                },
              });
              atualizados += 1;
              detalhes.push({ line: row.line, status: "atualizado", message: `"${codigo}" atualizado.` });
              continue;
            }

            // Create new product
            let categoriaId: string | null = null;
            if (row.categoria && row.categoria !== "Sem categoria") {
              const cat = await tx.categoria.upsert({
                where: { nome: row.categoria },
                create: { nome: row.categoria },
                update: {},
              });
              categoriaId = cat.id;
            }

            const markupPercent = markupFromPrecos(row.precoCusto, row.precoVenda);
            await tx.produto.create({
              data: {
                codigo,
                nome: row.nome,
                precoCusto: row.precoCusto,
                precoVenda: row.precoVenda,
                markupPercent,
                unidadeMedida: row.unidadeMedida,
                estoqueAtual: row.estoqueAtual,
                estoqueMinimo: row.estoqueMinimo,
                categoriaId,
                ativo: row.ativo,
              },
            });
            codeToId.set(codigo, "new");
            criados += 1;
            detalhes.push({ line: row.line, status: "criado", message: `"${codigo}" — ${row.nome}` });
          } catch (e) {
            if (isPrismaUnique(e)) {
              ignorados += 1;
              detalhes.push({ line: row.line, status: "ignorado", message: `Codigo duplicado (concorrencia).` });
            } else {
              erros += 1;
              detalhes.push({
                line: row.line,
                status: "erro",
                message: e instanceof Error ? e.message : "Erro ao gravar.",
              });
            }
          }
        }
      },
      { maxWait: 30_000, timeout: 120_000 }
    );
  }

  return {
    totalLinhas: rows.length,
    criados,
    atualizados,
    ignorados,
    erros,
    detalhes,
  };
}
