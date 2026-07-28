"use client";

import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileUp, Loader2, CheckCircle2, AlertTriangle, XCircle, Download } from "lucide-react";
import Link from "next/link";
import { CsvImportRapido } from "@/components/csv-import-rapido";
import type { ColumnMapping, SystemField, ImportResult, ImportResultRow } from "@/lib/importar-produtos-flexivel";
import { SYSTEM_FIELDS } from "@/lib/importar-produtos-flexivel";

type Step = "upload" | "preview" | "mapping" | "confirm" | "result";

type ParseResponse = {
  headers: string[];
  previewRows: string[][];
  totalRows: number;
  fileName: string;
  suggestedMapping: ColumnMapping;
};

export default function ImportarTabelaPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  // Parse response
  const [parseData, setParseData] = useState<ParseResponse | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [mode, setMode] = useState<"ignorar" | "atualizar">("ignorar");

  // Result
  const [result, setResult] = useState<ImportResult | null>(null);

  // Step 1: Upload file
  async function handleFileSelect() {
    const input = fileInputRef.current;
    const f = input?.files?.[0];
    if (!f) {
      setError("Selecione um arquivo .csv, .xlsx ou .xls");
      return;
    }

    const ext = f.name.toLowerCase().split(".").pop();
    if (!["csv", "xlsx", "xls"].includes(ext ?? "")) {
      setError("Formato invalido. Use .csv, .xlsx ou .xls");
      return;
    }

    setError(null);
    setLoading(true);
    setFile(f);

    try {
      const fd = new FormData();
      fd.set("arquivo", f);
      const res = await fetch("/api/produtos/importar-flexivel", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao processar arquivo.");

      setParseData(json as ParseResponse);
      setMapping(json.suggestedMapping);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  // Step 4: Execute import
  async function handleImport() {
    if (!file || !mapping) return;
    setLoading(true);
    setError(null);

    try {
      const fd = new FormData();
      fd.set("arquivo", file);
      fd.set("mapping", JSON.stringify(mapping));
      fd.set("mode", mode);

      const res = await fetch("/api/produtos/importar-flexivel/executar", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro na importacao.");

      setResult(json as ImportResult);
      setStep("result");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["produtos"] }),
        qc.invalidateQueries({ queryKey: ["categorias"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  // Validation
  function getMappingValidation() {
    if (!mapping) return { valid: false, errors: ["Mapeamento nao definido."], warnings: [] };
    const errors: string[] = [];
    const warnings: string[] = [];
    if (mapping.nome === null) errors.push("Campo obrigatorio 'Nome/Descricao' nao mapeado.");
    if (mapping.precoVenda === null) errors.push("Campo obrigatorio 'Preco de venda' nao mapeado.");
    if (mapping.codigo === null) warnings.push("Codigo sera gerado automaticamente.");
    if (mapping.precoCusto === null) warnings.push("Custo sera 0.");
    if (mapping.categoria === null) warnings.push("Categoria sera 'Sem categoria'.");
    return { valid: errors.length === 0, errors, warnings };
  }

  function downloadErrorReport() {
    if (!result) return;
    const errorLines = result.detalhes
      .filter((d) => d.status === "erro")
      .map((d) => `Linha ${d.line}: ${d.message}`)
      .join("\n");
    const blob = new Blob([errorLines || "Nenhum erro."], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio-erros-importacao.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setStep("upload");
    setFile(null);
    setParseData(null);
    setMapping(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Importar tabela de produtos</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Importe produtos a partir de CSV (padrão fixo ou <span className="font-mono">produtos.csv</span> na raiz),
            XLSX ou XLS com mapeamento flexível de colunas.
          </p>
        </div>
        <Link href="/produtos" className="shrink-0 text-sm font-semibold text-emerald-700 underline dark:text-emerald-300">
          Voltar para produtos
        </Link>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-xs font-medium">
        {(["upload", "preview", "mapping", "confirm", "result"] as Step[]).map((s, i) => {
          const labels = ["Arquivo", "Preview", "Mapeamento", "Confirmar", "Resultado"];
          const active = step === s;
          const done = (["upload", "preview", "mapping", "confirm", "result"] as Step[]).indexOf(step) > i;
          return (
            <div key={s} className="flex items-center gap-1">
              {i > 0 && <div className="mx-1 h-px w-4 bg-zinc-300 dark:bg-zinc-700" />}
              <span
                className={`rounded-full px-2 py-0.5 ${
                  active
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                    : done
                    ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    : "text-zinc-400 dark:text-zinc-600"
                }`}
              >
                {labels[i]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      {step === "upload" && <CsvImportRapido />}

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FileUp className="h-4 w-4" />
            Selecionar arquivo
          </div>
          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
            Formatos aceitos: .csv, .xlsx, .xls (maximo 10 MB)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="mt-4 block w-full text-sm"
          />
          <button
            type="button"
            disabled={loading}
            onClick={handleFileSelect}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Carregar e analisar
          </button>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === "preview" && parseData && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">
                Preview: {parseData.fileName} ({parseData.totalRows} linhas)
              </div>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="px-2 py-1 text-left font-semibold text-zinc-500">#</th>
                    {parseData.headers.map((h, i) => (
                      <th key={i} className="px-2 py-1 text-left font-semibold">{h || `Col ${i + 1}`}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parseData.previewRows.slice(0, 10).map((row, ri) => (
                    <tr key={ri} className="border-b border-zinc-100 dark:border-zinc-900">
                      <td className="px-2 py-1 text-zinc-400">{ri + 1}</td>
                      {parseData.headers.map((_, ci) => (
                        <td key={ci} className="max-w-[150px] truncate px-2 py-1">{row[ci] ?? ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={reset} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
              Voltar
            </button>
            <button type="button" onClick={() => setStep("mapping")} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              Mapear colunas
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Column Mapping */}
      {step === "mapping" && parseData && mapping && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-sm font-semibold">Mapeamento de colunas</div>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Associe cada campo do sistema a uma coluna do arquivo. Campos com * sao obrigatorios.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {SYSTEM_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center gap-2">
                  <label className="w-44 shrink-0 text-xs font-medium">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    value={mapping[field.key] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value === "" ? null : Number(e.target.value);
                      setMapping({ ...mapping, [field.key]: val });
                    }}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    <option value="">-- Nao mapear --</option>
                    {parseData.headers.map((h, i) => (
                      <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Validation messages */}
            {(() => {
              const v = getMappingValidation();
              return (
                <div className="mt-4 space-y-2">
                  {v.errors.map((e, i) => (
                    <div key={i} className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                      <XCircle className="h-3 w-3" /> {e}
                    </div>
                  ))}
                  {v.warnings.map((w, i) => (
                    <div key={i} className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3 w-3" /> {w}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep("preview")} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
              Voltar
            </button>
            <button
              type="button"
              disabled={!getMappingValidation().valid}
              onClick={() => setStep("confirm")}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirm */}
      {step === "confirm" && parseData && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-sm font-semibold">Confirmar importacao</div>
            <div className="mt-3 space-y-3">
              <div className="text-xs text-zinc-600 dark:text-zinc-400">
                <strong>{parseData.totalRows}</strong> linhas serao processadas do arquivo <strong>{parseData.fileName}</strong>.
              </div>

              <div className="space-y-2">
                <div className="text-xs font-medium">Quando o produto ja existir:</div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === "ignorar"}
                    onChange={() => setMode("ignorar")}
                    className="accent-emerald-600"
                  />
                  Ignorar (manter dados atuais)
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === "atualizar"}
                    onChange={() => setMode("atualizar")}
                    className="accent-emerald-600"
                  />
                  Atualizar com os dados da tabela
                </label>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep("mapping")} className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
              Voltar
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleImport}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Importar agora
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Result */}
      {step === "result" && result && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-5">
            <StatCard label="Total de linhas" value={result.totalLinhas} color="zinc" />
            <StatCard label="Criados" value={result.criados} color="emerald" />
            <StatCard label="Atualizados" value={result.atualizados} color="blue" />
            <StatCard label="Ignorados" value={result.ignorados} color="zinc" />
            <StatCard label="Erros" value={result.erros} color="red" />
          </div>

          {result.erros > 0 && (
            <button
              type="button"
              onClick={downloadErrorReport}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              <Download className="h-3 w-3" />
              Baixar relatorio de erros
            </button>
          )}

          {/* Detail log */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-sm font-semibold">Detalhes da importacao</div>
            <div className="mt-2 max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                    <th className="px-2 py-1">Linha</th>
                    <th className="px-2 py-1">Status</th>
                    <th className="px-2 py-1">Mensagem</th>
                  </tr>
                </thead>
                <tbody>
                  {result.detalhes.slice(0, 100).map((d, i) => (
                    <tr key={i} className="border-b border-zinc-100 dark:border-zinc-900">
                      <td className="px-2 py-1 text-zinc-500">{d.line}</td>
                      <td className="px-2 py-1">
                        <StatusBadge status={d.status} />
                      </td>
                      <td className="px-2 py-1 text-zinc-600 dark:text-zinc-400">{d.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.detalhes.length > 100 && (
                <p className="mt-2 text-xs text-zinc-500">
                  Mostrando 100 de {result.detalhes.length} registros. Baixe o relatorio completo acima.
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Nova importacao
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    emerald: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30",
    blue: "border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/30",
    red: "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30",
    zinc: "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40",
  };
  const textColors: Record<string, string> = {
    emerald: "text-emerald-800 dark:text-emerald-200",
    blue: "text-blue-800 dark:text-blue-200",
    red: "text-red-800 dark:text-red-200",
    zinc: "text-zinc-600 dark:text-zinc-400",
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 ${colors[color]}`}>
      <div className={`text-xs font-semibold ${textColors[color]}`}>{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: ImportResultRow["status"] }) {
  const map: Record<string, { icon: typeof CheckCircle2; cls: string }> = {
    criado: { icon: CheckCircle2, cls: "text-emerald-600" },
    atualizado: { icon: CheckCircle2, cls: "text-blue-600" },
    ignorado: { icon: AlertTriangle, cls: "text-zinc-500" },
    erro: { icon: XCircle, cls: "text-red-600" },
  };
  const { icon: Icon, cls } = map[status] ?? map.erro!;
  return (
    <span className={`inline-flex items-center gap-1 ${cls}`}>
      <Icon className="h-3 w-3" />
      {status}
    </span>
  );
}
