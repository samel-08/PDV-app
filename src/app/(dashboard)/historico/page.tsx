"use client";

import { useQuery } from "@tanstack/react-query";
import { Printer, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import { formatBRL, formatDateInput, formatDateTime, formatQty } from "@/lib/format";
import { openVendaPrint } from "@/lib/print-venda";

type VendaListItem = {
  id: string;
  numero: number;
  total: number;
  formaPagamento: string;
  valorRecebido: number;
  troco: number;
  createdAt: string;
  itens: {
    quantidade: number;
    precoUnitario: number;
    subtotal: number;
    produto: { nome: string; codigo: string };
  }[];
  pagamentos: { formaPagamento: string; valor: number }[];
};

type ListResponse = {
  data: VendaListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function labelPagamento(p: string) {
  if (p === "DINHEIRO") return "Dinheiro";
  if (p === "PIX") return "Pix";
  if (p === "OUTROS") return "Outros";
  if (p === "MULTIPLO") return "Multiplo";
  if (p === "CREDITO") return "Crédito";
  if (p === "DEBITO") return "Débito";
  if (p === "CARTAO") return "Cartão (legado)";
  return p;
}

function pagamentosResumo(v: VendaListItem): string {
  if (!v.pagamentos.length) return labelPagamento(v.formaPagamento);
  return v.pagamentos.map((p) => `${labelPagamento(p.formaPagamento)} ${formatBRL(p.valor)}`).join(" + ");
}

export default function HistoricoPage() {
  const [numero, setNumero] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const [detalhe, setDetalhe] = useState<VendaListItem | null>(null);

  useEffect(() => {
    setPage(1);
  }, [numero, from, to]);

  const query = useQuery({
    queryKey: ["vendas", { numero, from, to, page }],
    queryFn: async () => {
      const sp = new URLSearchParams();
      sp.set("page", String(page));
      sp.set("pageSize", "10");
      if (numero.trim()) sp.set("numero", numero.trim());
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
      const r = await fetch(`/api/vendas?${sp.toString()}`);
      if (!r.ok) throw new Error("Falha ao listar vendas");
      return r.json() as Promise<ListResponse>;
    },
  });

  const presets = useMemo(() => {
    const today = new Date();
    const startWeek = new Date(today);
    startWeek.setDate(today.getDate() - 6);
    return {
      hoje: { from: formatDateInput(today), to: formatDateInput(today) },
      semana: { from: formatDateInput(startWeek), to: formatDateInput(today) },
    };
  }, []);

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Histórico de vendas</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Consulta por número, data ou período. Ordenação: mais recentes primeiro.
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-4">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Número da venda</label>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={numero}
              onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))}
              placeholder="Ex.: 12"
              className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              inputMode="numeric"
            />
          </div>
        </div>
        <div className="lg:col-span-2">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">De</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
        </div>
        <div className="lg:col-span-2">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Até</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950" />
        </div>
        <div className="flex flex-wrap gap-2 lg:col-span-4 lg:justify-end">
          <button
            type="button"
            onClick={() => {
              setFrom(presets.hoje.from);
              setTo(presets.hoje.to);
            }}
            className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => {
              setFrom(presets.semana.from);
              setTo(presets.semana.to);
            }}
            className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            Últimos 7 dias
          </button>
          <button
            type="button"
            onClick={() => {
              setNumero("");
              setFrom("");
              setTo("");
            }}
            className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Nº</th>
                <th className="px-4 py-3">Data e hora</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Pagamento</th>
                <th className="px-4 py-3">Itens</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {query.isError ? (
                <tr>
                  <td className="px-4 py-6 text-red-700 dark:text-red-300" colSpan={6}>
                    Não foi possível carregar o histórico.
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-zinc-600 dark:text-zinc-400" colSpan={6}>
                    Nenhuma venda encontrada.
                  </td>
                </tr>
              ) : (
                rows.map((v) => (
                  <tr key={v.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">#{v.numero}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">{formatDateTime(v.createdAt)}</td>
                    <td className="px-4 py-3 font-semibold">{formatBRL(v.total)}</td>
                    <td className="px-4 py-3 text-xs">{pagamentosResumo(v)}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                      {v.itens.length} {v.itens.length === 1 ? "item" : "itens"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openVendaPrint(v.id)}
                          className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Reimprimir nota
                        </button>
                        <button
                          type="button"
                          onClick={() => setDetalhe(v)}
                          className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                        >
                          Detalhes
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-zinc-200 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
          <div className="text-zinc-600 dark:text-zinc-400">
            Página <span className="font-semibold text-zinc-900 dark:text-zinc-100">{page}</span> de{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{totalPages}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={!!detalhe}
        title={detalhe ? `Venda #${detalhe.numero}` : "Detalhes"}
        onClose={() => setDetalhe(null)}
        footer={
          detalhe ? (
            <button
              type="button"
              onClick={() => openVendaPrint(detalhe.id)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white sm:w-auto"
            >
              <Printer className="h-4 w-4" />
              Reimprimir nota
            </button>
          ) : undefined
        }
      >
        {detalhe ? (
          <div className="space-y-3 text-sm">
            <div className="grid gap-2 rounded-xl border border-zinc-200 p-3 text-xs dark:border-zinc-800">
              <div className="flex justify-between gap-3">
                <span className="text-zinc-600 dark:text-zinc-400">Data</span>
                <span className="font-medium">{formatDateTime(detalhe.createdAt)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-zinc-600 dark:text-zinc-400">Pagamento</span>
                <span className="font-medium">{pagamentosResumo(detalhe)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-zinc-600 dark:text-zinc-400">Total</span>
                <span className="font-semibold">{formatBRL(detalhe.total)}</span>
              </div>
              {detalhe.pagamentos.length > 0 ? (
                <>
                  {detalhe.pagamentos.map((p, idx) => (
                    <div key={idx} className="flex justify-between gap-3">
                      <span className="text-zinc-600 dark:text-zinc-400">{labelPagamento(p.formaPagamento)}</span>
                      <span className="font-medium">{formatBRL(p.valor)}</span>
                    </div>
                  ))}
                  {detalhe.troco > 0 ? (
                    <div className="flex justify-between gap-3">
                      <span className="text-zinc-600 dark:text-zinc-400">Troco</span>
                      <span className="font-medium">{formatBRL(detalhe.troco)}</span>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Itens</div>
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs text-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
                  <tr>
                    <th className="px-3 py-2">Produto</th>
                    <th className="px-3 py-2 text-right">Qtd</th>
                    <th className="px-3 py-2 text-right">Unit.</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {detalhe.itens.map((it, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{it.produto.nome}</div>
                        <div className="text-xs text-zinc-500">Cód. {it.produto.codigo}</div>
                      </td>
                      <td className="px-3 py-2 text-right">{formatQty(it.quantidade)}</td>
                      <td className="px-3 py-2 text-right">{formatBRL(it.precoUnitario)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{formatBRL(it.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
