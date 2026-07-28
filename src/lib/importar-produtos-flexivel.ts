/**
 * Importador flexível de produtos — suporte a CSV, XLSX, XLS
 * Com mapeamento manual de colunas e detecção automática inteligente.
 */
import * as XLSX from "xlsx";
import { parse as csvParse } from "csv-parse/sync";
import type { UnidadeMedida } from "@/lib/validators";
import { normalizeUnidadeMedida, parseDecimalValue } from "@/lib/csv-produtos-import";

// --------------- Tipos ---------------

export type SystemField =
  | "codigo"
  | "nome"
  | "categoria"
  | "precoCusto"
  | "precoVenda"
  | "unidadeMedida"
  | "estoqueAtual"
  | "estoqueMinimo"
  | "codigoBarras"
  | "status";

export const SYSTEM_FIELDS: { key: SystemField; label: string; required: boolean }[] = [
  { key: "codigo", label: "Codigo do produto", required: false },
  { key: "nome", label: "Nome/Descricao do produto", required: true },
  { key: "categoria", label: "Categoria", required: false },
  { key: "precoCusto", label: "Preco de custo", required: false },
  { key: "precoVenda", label: "Preco de venda", required: true },
  { key: "unidadeMedida", label: "Unidade de medida", required: false },
  { key: "estoqueAtual", label: "Estoque atual", required: false },
  { key: "estoqueMinimo", label: "Estoque minimo", required: false },
  { key: "codigoBarras", label: "Codigo de barras", required: false },
  { key: "status", label: "Status ativo/inativo", required: false },
];

export type ColumnMapping = Record<SystemField, number | null>; // index of source column or null

export type ParsedFile = {
  headers: string[];
  rows: string[][]; // all rows as string arrays
  totalRows: number;
  fileName: string;
};

export type ImportMode = "ignorar" | "atualizar";

export type ImportResultRow = {
  line: number;
  status: "criado" | "atualizado" | "ignorado" | "erro";
  message?: string;
};

export type ImportResult = {
  totalLinhas: number;
  criados: number;
  atualizados: number;
  ignorados: number;
  erros: number;
  detalhes: ImportResultRow[];
};

// --------------- Parsing de arquivo ---------------

export function parseFileBuffer(buffer: Buffer, fileName: string): ParsedFile {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";

  if (ext === "csv" || ext === "txt") {
    return parseCsvBuffer(buffer, fileName);
  }
  if (ext === "xlsx" || ext === "xls") {
    return parseExcelBuffer(buffer, fileName);
  }
  throw new Error(`Formato de arquivo nao suportado: .${ext}. Use .csv, .xlsx ou .xls.`);
}

function parseCsvBuffer(buffer: Buffer, fileName: string): ParsedFile {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");

  let records: string[][];
  try {
    records = csvParse(text, {
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
    }) as string[][];
  } catch {
    // Tentar com delimitador ;
    try {
      records = csvParse(text, {
        delimiter: ";",
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        bom: true,
      }) as string[][];
    } catch (e2) {
      throw new Error(
        `Falha ao interpretar CSV: ${e2 instanceof Error ? e2.message : "erro desconhecido"}`
      );
    }
  }

  if (records.length === 0) {
    throw new Error("Arquivo vazio ou sem dados.");
  }

  const headers = records[0]!.map((h) => h.trim());
  const rows = records.slice(1);

  return { headers, rows, totalRows: rows.length, fileName };
}

function parseExcelBuffer(buffer: Buffer, fileName: string): ParsedFile {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Arquivo Excel vazio (sem planilhas).");

  const sheet = workbook.Sheets[sheetName]!;
  const data: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
    rawNumbers: false,
  }) as string[][];

  if (data.length === 0) throw new Error("Planilha vazia.");

  const headers = data[0]!.map((h) => String(h ?? "").trim());
  const rows = data.slice(1).map((row) => row.map((cell) => String(cell ?? "").trim()));

  return { headers, rows, totalRows: rows.length, fileName };
}

// --------------- Auto-deteccao de mapeamento ---------------

const ALIASES: Record<SystemField, string[]> = {
  codigo: ["codigo", "código", "cod", "id", "cod produto", "codigo produto", "código produto", "sku"],
  nome: ["nome", "produto", "descricao", "descrição", "nome produto", "desc", "nome/descricao"],
  categoria: ["categoria", "grupo", "cat", "tipo", "familia", "família"],
  precoCusto: ["custo", "preco de custo", "preço de custo", "preco custo", "preço custo", "valor custo", "p.custo"],
  precoVenda: ["venda", "preco de venda", "preço de venda", "preco venda", "preço venda", "valor", "preco", "preço", "p.venda", "valor venda"],
  unidadeMedida: ["unidade", "unidade de medida", "un", "um", "medida"],
  estoqueAtual: ["estoque", "estoque atual", "quantidade", "qtd", "qtde", "saldo"],
  estoqueMinimo: ["estoque minimo", "estoque mínimo", "est min", "est. min", "minimo", "mínimo"],
  codigoBarras: ["ean", "gtin", "codigo de barras", "código de barras", "barras", "ean13", "cod barras"],
  status: ["ativo", "status", "situacao", "situação", "ativo/inativo"],
};

function normalizeForMatch(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9 /]/g, "")
    .replace(/\s+/g, " ");
}

export function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    codigo: null,
    nome: null,
    categoria: null,
    precoCusto: null,
    precoVenda: null,
    unidadeMedida: null,
    estoqueAtual: null,
    estoqueMinimo: null,
    codigoBarras: null,
    status: null,
  };

  const usedIndices = new Set<number>();

  // Priorizar campos com matches mais específicos primeiro
  const fieldOrder: SystemField[] = [
    "codigoBarras",
    "precoCusto",
    "precoVenda",
    "estoqueMinimo",
    "estoqueAtual",
    "unidadeMedida",
    "categoria",
    "nome",
    "codigo",
    "status",
  ];

  for (const field of fieldOrder) {
    const aliases = ALIASES[field];
    for (let i = 0; i < headers.length; i++) {
      if (usedIndices.has(i)) continue;
      const normalized = normalizeForMatch(headers[i]!);
      if (aliases.some((a) => normalizeForMatch(a) === normalized)) {
        mapping[field] = i;
        usedIndices.add(i);
        break;
      }
    }
  }

  return mapping;
}

// --------------- Validacao de mapeamento ---------------

export type MappingValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export function validateMapping(mapping: ColumnMapping): MappingValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (mapping.nome === null) {
    errors.push("Campo obrigatorio 'Nome/Descricao do produto' nao foi mapeado.");
  }
  if (mapping.precoVenda === null) {
    errors.push("Campo obrigatorio 'Preco de venda' nao foi mapeado.");
  }

  if (mapping.codigo === null) {
    warnings.push("Campo recomendado 'Codigo do produto' nao mapeado. Sera gerado automaticamente.");
  }
  if (mapping.categoria === null) {
    warnings.push("Campo 'Categoria' nao mapeado. Sera usada 'Sem categoria'.");
  }
  if (mapping.precoCusto === null) {
    warnings.push("Campo 'Preco de custo' nao mapeado. Sera usado 0.");
  }
  if (mapping.estoqueAtual === null) {
    warnings.push("Campo 'Estoque atual' nao mapeado. Sera usado 0.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

// --------------- Normalizacao de linhas ---------------

export type NormalizedImportRow = {
  line: number;
  codigo: string;
  nome: string;
  categoria: string;
  precoCusto: number;
  precoVenda: number;
  unidadeMedida: UnidadeMedida;
  estoqueAtual: number;
  estoqueMinimo: number;
  estoqueAtualMapped: boolean;
  estoqueMinimoMapped: boolean;
  codigoBarras: string;
  ativo: boolean;
};

function parseStatus(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  if (["inativo", "não", "nao", "false", "0", "n", "no"].includes(v)) return false;
  return true; // default ativo
}

function parseStock(raw: string): number {
  if (!raw.trim()) return 0;
  const n = parseDecimalValue(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

export function normalizeRows(
  rows: string[][],
  mapping: ColumnMapping
): { normalized: NormalizedImportRow[]; errors: ImportResultRow[] } {
  const normalized: NormalizedImportRow[] = [];
  const errors: ImportResultRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const line = i + 2; // +1 for header, +1 for 1-based

    const getValue = (field: SystemField): string => {
      const idx = mapping[field];
      if (idx === null || idx === undefined) return "";
      return (row[idx] ?? "").trim();
    };

    const nome = getValue("nome");
    if (!nome) {
      // Linha vazia - ignorar silenciosamente
      if (row.every((cell) => !cell.trim())) continue;
      errors.push({ line, status: "erro", message: "Nome do produto vazio." });
      continue;
    }

    const precoVendaRaw = getValue("precoVenda");
    const precoVenda = parseDecimalValue(precoVendaRaw);
    if (!Number.isFinite(precoVenda) || precoVenda < 0) {
      errors.push({ line, status: "erro", message: `Preco de venda invalido: "${precoVendaRaw}" para "${nome}".` });
      continue;
    }

    const precoCustoRaw = getValue("precoCusto");
    let precoCusto = 0;
    if (precoCustoRaw) {
      const parsed = parseDecimalValue(precoCustoRaw);
      precoCusto = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    }

    const unRaw = getValue("unidadeMedida") || "UN";
    const unidadeMedida = normalizeUnidadeMedida(unRaw) ?? "UN";

    const codigo = getValue("codigo").slice(0, 64);
    const categoria = getValue("categoria") || "Sem categoria";
    const estoqueAtual = parseStock(getValue("estoqueAtual"));
    const estoqueMinimo = parseStock(getValue("estoqueMinimo"));
    const estoqueAtualMapped = mapping.estoqueAtual !== null && mapping.estoqueAtual !== undefined;
    const estoqueMinimoMapped = mapping.estoqueMinimo !== null && mapping.estoqueMinimo !== undefined;
    const codigoBarras = getValue("codigoBarras").slice(0, 64);
    const ativo = getValue("status") ? parseStatus(getValue("status")) : true;

    normalized.push({
      line,
      codigo,
      nome: nome.slice(0, 500),
      categoria: categoria.slice(0, 80),
      precoCusto: Math.round(precoCusto * 100) / 100,
      precoVenda: Math.round(precoVenda * 100) / 100,
      unidadeMedida,
      estoqueAtual,
      estoqueMinimo,
      estoqueAtualMapped,
      estoqueMinimoMapped,
      codigoBarras,
      ativo,
    });
  }

  return { normalized, errors };
}
