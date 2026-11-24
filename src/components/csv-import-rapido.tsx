"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { useToast } from "@/contexts/toast-context";
import type {
  CsvImportLogEntry,
  CsvImportResult,
} from "@/lib/csv-produtos-import";

function formatLogLine(e: CsvImportLogEntry): string {
  const prefix = e.line > 0 ? `[L${e.line}] ` : "";
  return `${prefix}${e.message}`;
}

/** Importação CSV com colunas fixas (upload de arquivo próprio). */
export function CsvImportRapido() {
  const toast = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idFile = useId();
  const [lastResult, setLastResult] = useState<CsvImportResult | null>(null);

  const importar = useMutation({
    mutationFn: async (body: RequestInit) => {
      const r = await fetch("/api/produtos/importar-csv", body);
      const j = (await r.json().catch(() => ({}))) as CsvImportResult & {
        error?: string;
      };
      if (!r.ok) throw new Error(j.error ?? "Falha na importação.");
      return j as CsvImportResult;
    },
    onSuccess: async (data) => {
      setLastResult(data);
      toast.push(
        "success",
        `CSV: ${data.imported} importado(s), ${data.skipped} ignorado(s), ${data.errors} erro(s).`,
      );
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["produtos"] }),
        qc.invalidateQueries({ queryKey: ["categorias"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: (e: Error) => {
      setLastResult(null);
      toast.push("error", e.message);
    },
  });

  async function importarArquivoSelecionado() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.push("error", "Selecione um arquivo .csv.");
      return;
    }
    const fd = new FormData();
    fd.set("arquivo", file);
    importar.mutate({ method: "POST", body: fd });
  }

  const logText = lastResult?.logs.map(formatLogLine).join("\n") ?? "";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="text-sm font-semibold">
        Importação rápida CSV (colunas padrão)
      </div>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        Colunas: Código, Nome, Categoria, Custo, Preço de venda, Unidade de
        medida. Códigos já cadastrados são ignorados.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor={idFile}
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Enviar arquivo .csv
          </label>
          <input
            id={idFile}
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="mt-1 block w-full text-xs"
          />
          <button
            type="button"
            disabled={importar.isPending}
            onClick={() => void importarArquivoSelecionado()}
            className="mt-2 w-full rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Importar CSV selecionado
          </button>
        </div>
      </div>
      {lastResult ? (
        <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
          Resultado:{" "}
          <span className="font-semibold text-emerald-700 dark:text-emerald-300">
            {lastResult.imported}
          </span>{" "}
          importados ·{" "}
          <span className="font-semibold">{lastResult.skipped}</span> ignorados
          ·{" "}
          <span className="font-semibold text-red-700 dark:text-red-300">
            {lastResult.errors}
          </span>{" "}
          erros
        </p>
      ) : null}
      {logText ? (
        <textarea
          readOnly
          value={logText}
          rows={6}
          className="mt-2 w-full resize-y rounded-lg border border-zinc-200 bg-white p-2 font-mono text-[11px] leading-relaxed dark:border-zinc-700 dark:bg-zinc-950"
        />
      ) : null}
    </div>
  );
}
