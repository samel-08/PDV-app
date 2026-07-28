import { NextResponse } from "next/server";
import { parseFileBuffer, autoDetectMapping } from "@/lib/importar-produtos-flexivel";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * POST: Recebe arquivo e retorna headers + preview + mapeamento sugerido.
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("arquivo");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Envie um arquivo no campo 'arquivo'." }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "Arquivo vazio." }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Arquivo muito grande (maximo 10 MB)." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const parsed = parseFileBuffer(buffer, file.name);
    const suggestedMapping = autoDetectMapping(parsed.headers);

    // Return only preview rows (max 20)
    const previewRows = parsed.rows.slice(0, 20);

    return NextResponse.json({
      headers: parsed.headers,
      previewRows,
      totalRows: parsed.totalRows,
      fileName: parsed.fileName,
      suggestedMapping,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao processar arquivo.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
