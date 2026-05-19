import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { parseProdutosCsv } from "@/lib/csv-produtos-import";
import { importProdutosFromRows } from "@/lib/run-produtos-csv-import";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") ?? "";
    let text: string;
    let origem: string;

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("arquivo");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Envie um arquivo no campo \"arquivo\"." }, { status: 400 });
      }
      if (file.size === 0) {
        return NextResponse.json({ error: "Arquivo vazio." }, { status: 400 });
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ error: "Arquivo muito grande (máximo 4 MB)." }, { status: 400 });
      }
      text = await file.text();
      origem = file.name || "upload";
    } else {
      const body = (await req.json().catch(() => null)) as { fonte?: string; source?: string } | null;
      const fonte = body?.fonte ?? body?.source;
      if (fonte !== "raiz" && fonte !== "root") {
        return NextResponse.json(
          {
            error:
              'Envie JSON { "fonte": "raiz" } para ler produtos.csv na raiz do projeto, ou use multipart/form-data com o campo "arquivo".',
          },
          { status: 400 }
        );
      }
      const csvPath =
        process.env.PRODUTOS_CSV_PATH?.trim() || path.join(process.cwd(), "produtos.csv");
      try {
        const buf = await fs.readFile(csvPath);
        text = buf.toString("utf8");
        origem = csvPath;
      } catch {
        return NextResponse.json(
          { error: `Não foi possível ler o arquivo: ${csvPath}. Coloque produtos.csv na raiz do projeto ou defina PRODUTOS_CSV_PATH no .env.` },
          { status: 404 }
        );
      }
    }

    const { rows, logs: parseLogs } = parseProdutosCsv(text);
    const result = await importProdutosFromRows(rows, parseLogs);

    result.logs.unshift({
      level: "info",
      line: 0,
      message: `Origem: ${origem} — ${rows.length} linha(s) válida(s) após o filtro do CSV.`,
    });
    result.logs.push({
      level: "info",
      line: 0,
      message: `Concluído: ${result.imported} importado(s), ${result.skipped} ignorado(s), ${result.errors} erro(s).`,
    });

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro na importação.";
    return NextResponse.json({ error: msg, imported: 0, skipped: 0, errors: 1, logs: [] }, { status: 500 });
  }
}
