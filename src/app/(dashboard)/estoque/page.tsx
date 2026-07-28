"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDateTime, formatQty, labelUnidadeMedida } from "@/lib/format";

type MovEstoque = {
  id: string;
  tipo: string;
  quantidade: number;
  motivo: string;
  createdAt: string;
  produto: { nome: string; codigo: string; unidadeMedida: string };
};

type ListResponse = {
  data: MovEstoque[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function labelTipo(tipo: string) {
  if (tipo === "ENTRADA") return "Entrada";
  if (tipo === "SAIDA") return "Saida";
  if (tipo === "AJUSTE") return "Ajuste";
  if (tipo === "VENDA") return "Venda";
  if (tipo === "CANCELAMENTO") return "Cancelamento";
  return tipo;
}

export default function EstoquePage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [q]);

  const query = useQuery({
    queryKey: ["estoque-movimentacoes", { q, page }],
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set("page", String(page));
      sp.set("pageSize", "20");
      if (q.trim()) sp.set("q", q.trim());
      const r = await fetch(`/api/estoque?${sp.toString()}`);
      if (!r.ok) throw new Error("Falha ao carregar movimentacoes.");
      return r.json() as Promise<ListResponse>;
    },
  });

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Historico de estoque</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Entradas, saidas, ajustes e baixas por venda.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Pesquisar produto</label>
        <div className="relative mt-1 max-w-lg">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome ou codigo"
            className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 text-right">Quantidade</th>
                <th className="px-4 py-3">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {query.isError ? (
                <tr><td className="px-4 py-6 text-red-700 dark:text-red-300" colSpan={5}>Nao foi possivel carregar o historico.</td></tr>
              ) : rows.length === 0 ? (
                <tr><td className="px-4 py-10 text-zinc-600 dark:text-zinc-400" colSpan={5}>Nenhuma movimentacao encontrada.</td></tr>
              ) : (
                rows.map((m) => (
                  <tr key={m.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                    <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">{formatDateTime(m.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{m.produto.nome}</div>
                      <div className="font-mono text-xs text-zinc-500">{m.produto.codigo}</div>
                    </td>
                    <td className="px-4 py-3">{labelTipo(m.tipo)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {formatQty(m.quantidade)} {labelUnidadeMedida(m.produto.unidadeMedida)}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">{m.motivo}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-zinc-200 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
          <div className="text-zinc-600 dark:text-zinc-400">
            Pagina <span className="font-semibold text-zinc-900 dark:text-zinc-100">{page}</span> de{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{totalPages}</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:hover:bg-zinc-900">
              Anterior
            </button>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:hover:bg-zinc-900">
              Proxima
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
