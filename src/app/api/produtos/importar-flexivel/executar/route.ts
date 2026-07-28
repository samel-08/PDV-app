import { NextResponse } from "next/server";
import {
  parseFileBuffer,
  normalizeRows,
  validateMapping,
  type ColumnMapping,
  type ImportMode,
} from "@/lib/importar-produtos-flexivel";
import { importarProdutosFlexivel } from "@/lib/run-importar-flexivel";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * POST: Recebe arquivo + mapeamento + modo e executa a importacao.
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("arquivo");
    const mappingJson = form.get("mapping") as string | null;
    const mode = (form.get("mode") as string) || "ignorar";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Envie um arquivo no campo 'arquivo'." }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "Arquivo vazio." }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Arquivo muito grande (maximo 10 MB)." }, { status: 400 });
    }
    if (!mappingJson) {
      return NextResponse.json({ error: "Mapeamento de colunas nao fornecido." }, { status: 400 });
    }

    let mapping: ColumnMapping;
    try {
      mapping = JSON.parse(mappingJson) as ColumnMapping;
    } catch {
      return NextResponse.json({ error: "Mapeamento invalido." }, { status: 400 });
    }

    const validation = validateMapping(mapping);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join(" ") }, { status: 400 });
    }

    const importMode: ImportMode = mode === "atualizar" ? "atualizar" : "ignorar";

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const parsed = parseFileBuffer(buffer, file.name);
    const { normalized, errors } = normalizeRows(parsed.rows, mapping);

    const result = await importarProdutosFlexivel(normalized, importMode);

    // Merge parse errors into result
    result.erros += errors.length;
    result.totalLinhas = parsed.totalRows;
    result.detalhes = [...errors, ...result.detalhes];

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro na importacao.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
