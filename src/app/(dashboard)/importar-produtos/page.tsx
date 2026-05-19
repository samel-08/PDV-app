"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { FileUp, Loader2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useToast } from "@/contexts/toast-context";
import type { CsvImportLogEntry, CsvImportResult } from "@/lib/csv-produtos-import";

function formatLogLine(e: CsvImportLogEntry): string {
  const prefix = e.line > 0 ? `[L${e.line}] ` : "";
  return `${prefix}${e.message}`;
}

export default function ImportarProdutosPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idFile = useId();
  const [lastResult, setLastResult] = useState<CsvImportResult | null>(null);

  const importar = useMutation({
    mutationFn: async (body: RequestInit) => {
      const r = await fetch("/api/produtos/importar-csv", body);
      const j = (await r.json().catch(() => ({}))) as CsvImportResult & { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Falha na importação.");
      return j as CsvImportResult;
    },
    onSuccess: async (data) => {
      setLastResult(data);
      toast.push(
        "success",
        `Importação concluída: ${data.imported} novo(s), ${data.skipped} ignorado(s), ${data.errors} erro(s).`
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

  async function importarDaRaiz() {
    importar.mutate({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fonte: "raiz" }),
    });
  }

  async function importarArquivoSelecionado() {
    const input = fileInputRef.current;
    const file = input?.files?.[0];
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
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Importar produtos (CSV)</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            Colunas esperadas: <span className="font-medium">Código</span>, <span className="font-medium">Nome</span>,{" "}
            <span className="font-medium">Categoria</span>, <span className="font-medium">Custo</span>,{" "}
            <span className="font-medium">Preço de venda</span>, <span className="font-medium">Unidade de medida</span>{" "}
            (KG, UN, CX, G). Categorias novas são criadas automaticamente. Códigos já existentes são ignorados — nada é
            apagado.
          </p>
        </div>
        <Link
          href="/produtos"
          className="shrink-0 text-sm font-semibold text-emerald-700 underline dark:text-emerald-300"
        >
          Voltar para produtos
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FileUp className="h-4 w-4" />
            Arquivo na raiz do projeto
          </div>
          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
            Lê <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">produtos.csv</code> em{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">process.cwd()</code> (pasta do projeto ao subir
            o Next). Opcional: variável <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">PRODUTOS_CSV_PATH</code>{" "}
            no .env.
          </p>
          <button
            type="button"
            disabled={importar.isPending}
            onClick={() => void importarDaRaiz()}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            {importar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Importar produtos.csv da raiz
          </button>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-sm font-semibold">Upload manual</div>
          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
            Envie um CSV UTF-8 com o mesmo cabeçalho. Tamanho máximo 4 MB.
          </p>
          <label htmlFor={idFile} className="mt-3 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Arquivo .csv
          </label>
          <input
            id={idFile}
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="mt-1 block w-full text-sm"
          />
          <button
            type="button"
            disabled={importar.isPending}
            onClick={() => void importarArquivoSelecionado()}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 px-4 py-3 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            {importar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Importar arquivo selecionado
          </button>
        </div>
      </div>

      {lastResult ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">Importados</div>
            <div className="mt-1 text-2xl font-bold text-emerald-900 dark:text-emerald-100">{lastResult.imported}</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Ignorados</div>
            <div className="mt-1 text-2xl font-bold text-zinc-900 dark:text-zinc-100">{lastResult.skipped}</div>
          </div>
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
            <div className="text-xs font-semibold text-red-800 dark:text-red-200">Erros</div>
            <div className="mt-1 text-2xl font-bold text-red-900 dark:text-red-100">{lastResult.errors}</div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-sm font-semibold">Log da importação</div>
        <textarea
          readOnly
          value={logText || "Nenhuma importação nesta sessão ainda."}
          rows={18}
          className="mt-2 w-full resize-y rounded-xl border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs leading-relaxed text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>
    </div>
  );
}
