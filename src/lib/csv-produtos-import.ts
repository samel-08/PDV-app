import { parse } from "csv-parse/sync";
import type { UnidadeMedida } from "@/lib/validators";
import { UNIDADES } from "@/lib/validators";

export type CsvImportLogLevel = "info" | "warn" | "error";

export type CsvImportLogEntry = {
  level: CsvImportLogLevel;
  line: number;
  message: string;
};

export type CsvImportResult = {
  imported: number;
  skipped: number;
  errors: number;
  logs: CsvImportLogEntry[];
};

type ParsedRowKeys = {
  codigo: string;
  nome: string;
  categoria: string;
  custo: string;
  precoVenda: string;
  unidade: string;
};

const HEADER_ALIASES: Record<string, keyof ParsedRowKeys> = {
  codigo: "codigo",
  código: "codigo",
  "código": "codigo",
  ean: "codigo",
  "código de barras": "codigo",
  "codigo de barras": "codigo",
  sku: "codigo",
  nome: "nome",
  descrição: "nome",
  descricao: "nome",
  categoria: "categoria",
  custo: "custo",
  "preço de custo": "custo",
  "preco de custo": "custo",
  "preço de venda": "precoVenda",
  "preco de venda": "precoVenda",
  venda: "precoVenda",
  preço: "precoVenda",
  preco: "precoVenda",
  "unidade de medida": "unidade",
  unidade: "unidade",
  um: "unidade",
};

function normalizeHeaderKey(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function resolveField(record: Record<string, string>, field: keyof ParsedRowKeys): string {
  for (const [k, v] of Object.entries(record)) {
    const mapped = HEADER_ALIASES[normalizeHeaderKey(k)];
    if (mapped === field) return String(v ?? "").trim();
  }
  return "";
}

/** Número em pt-BR (1.234,56) ou simples (12.5). */
export function parseDecimalValue(raw: string): number {
  const t = String(raw ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/R\$/i, "");
  if (!t) return NaN;
  const hasComma = t.includes(",");
  const hasDot = t.includes(".");
  if (hasComma && hasDot) {
    return Number(t.replace(/\./g, "").replace(",", "."));
  }
  if (hasComma) return Number(t.replace(",", "."));
  return Number(t);
}

export function normalizeUnidadeMedida(raw: string): UnidadeMedida | null {
  const u = String(raw ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!u) return "UN";
  const map: Record<string, UnidadeMedida> = {
    UN: "UN",
    UNID: "UN",
    UNIDADE: "UN",
    PC: "UN",
    PÇ: "UN",
    PECA: "UN",
    PEÇA: "UN",
    KG: "KG",
    KILO: "KG",
    QUILO: "KG",
    G: "G",
    GR: "G",
    GRAMA: "G",
    CX: "CX",
    CAIXA: "CX",
  };
  const hit = map[u] ?? (UNIDADES.includes(u as UnidadeMedida) ? (u as UnidadeMedida) : null);
  return hit ?? null;
}

function isRowEmpty(record: Record<string, string>): boolean {
  const codigo = resolveField(record, "codigo");
  const nome = resolveField(record, "nome");
  return !codigo && !nome;
}

export type NormalizedProdutoRow = {
  line: number;
  codigo: string;
  nome: string;
  categoriaNome: string;
  precoCusto: number;
  precoVenda: number;
  unidadeMedida: UnidadeMedida;
};

export function parseProdutosCsv(text: string): {
  rows: NormalizedProdutoRow[];
  logs: CsvImportLogEntry[];
} {
  const logs: CsvImportLogEntry[] = [];
  const stripped = text.replace(/^\uFEFF/, "");
  let records: Record<string, string>[] = [];
  try {
    records = parse(stripped, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
    }) as Record<string, string>[];
  } catch (e) {
    logs.push({
      level: "error",
      line: 0,
      message: e instanceof Error ? e.message : "Falha ao interpretar o CSV.",
    });
    return { rows: [], logs };
  }

  if (!records.length) {
    logs.push({ level: "warn", line: 0, message: "Nenhuma linha de dados encontrada (após o cabeçalho)." });
    return { rows: [], logs };
  }

  const first = records[0]!;
  const hasCodigo = resolveField(first, "codigo") !== "" || Object.keys(first).some((h) => HEADER_ALIASES[normalizeHeaderKey(h)] === "codigo");
  const hasNome = resolveField(first, "nome") !== "" || Object.keys(first).some((h) => HEADER_ALIASES[normalizeHeaderKey(h)] === "nome");
  const hasCusto = Object.keys(first).some((h) => HEADER_ALIASES[normalizeHeaderKey(h)] === "custo");
  const hasVenda = Object.keys(first).some((h) => HEADER_ALIASES[normalizeHeaderKey(h)] === "precoVenda");
  if (!hasCodigo || !hasNome || !hasCusto || !hasVenda) {
    logs.push({
      level: "error",
      line: 1,
      message:
        "Cabeçalho do CSV não reconhecido. Use colunas: Código; Nome; Categoria; Custo; Preço de venda; Unidade de medida (nomes podem ter pequenas variações).",
    });
  }

  const rows: NormalizedProdutoRow[] = [];
  let line = 1;

  for (const record of records) {
    line += 1;

    if (isRowEmpty(record)) {
      logs.push({ level: "info", line, message: "Linha vazia ignorada." });
      continue;
    }

    const codigo = resolveField(record, "codigo");
    const nome = resolveField(record, "nome");
    if (!codigo || !nome) {
      logs.push({ level: "warn", line, message: "Linha ignorada: código ou nome ausente." });
      continue;
    }
    if (codigo.length > 64) {
      logs.push({ level: "warn", line, message: `Código muito longo (>64). Truncado: ${codigo.slice(0, 64)}` });
    }
    const codigoFinal = codigo.slice(0, 64);

    const precoCusto = parseDecimalValue(resolveField(record, "custo"));
    const precoVenda = parseDecimalValue(resolveField(record, "precoVenda"));
    if (!Number.isFinite(precoCusto) || precoCusto < 0) {
      logs.push({ level: "warn", line, message: `Custo inválido para "${codigoFinal}". Linha ignorada.` });
      continue;
    }
    if (!Number.isFinite(precoVenda) || precoVenda < 0) {
      logs.push({ level: "warn", line, message: `Preço de venda inválido para "${codigoFinal}". Linha ignorada.` });
      continue;
    }

    const unRaw = resolveField(record, "unidade") || "UN";
    const unidadeMedida = normalizeUnidadeMedida(unRaw);
    if (!unidadeMedida) {
      logs.push({
        level: "warn",
        line,
        message: `Unidade "${unRaw}" não reconhecida para "${codigoFinal}". Use KG, UN, CX ou G. Linha ignorada.`,
      });
      continue;
    }

    rows.push({
      line,
      codigo: codigoFinal,
      nome: nome.slice(0, 200),
      categoriaNome: resolveField(record, "categoria"),
      precoCusto: Math.round(precoCusto * 100) / 100,
      precoVenda: Math.round(precoVenda * 100) / 100,
      unidadeMedida,
    });
  }

  return { rows, logs };
}
