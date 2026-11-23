"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { diaNoFuso, type RelatorioHorarios } from "@/lib/horarios-pico";
import { formatBRL } from "@/lib/format";

export function HorariosPico() {
  const [periodo, setPeriodo] = useState(() => {
    const hoje = diaNoFuso(new Date());
    return { inicio: `${hoje.slice(0, 7)}-01`, fim: hoje };
  });
  const [inicio, setInicio] = useState(periodo.inicio);
  const [fim, setFim] = useState(periodo.fim);
  const consulta = useQuery<RelatorioHorarios>({
    queryKey: ["dashboard", "horarios", periodo.inicio, periodo.fim],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/horarios?${new URLSearchParams(periodo)}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar os horários.");
      return body;
    },
    refetchInterval: 60_000,
    retry: false,
  });
  const dados = consulta.data;
  const maior = Math.max(1, ...(dados?.horarios.map(h => h.quantidade) ?? []));
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950" aria-labelledby="horarios-titulo">
      <h2 id="horarios-titulo" className="text-sm font-semibold">Horários de pico</h2>
      <p className="mt-1 text-xs text-zinc-500">Vendas concluídas por hora · fuso de São Paulo · até 93 dias por consulta.</p>
      <form className="my-4 flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); setPeriodo({ inicio, fim }); }}>
        <label className="text-xs">De<input required type="date" value={inicio} onChange={e => setInicio(e.target.value)} className="mt-1 block rounded-lg border border-zinc-300 bg-transparent p-2 dark:border-zinc-700" /></label>
        <label className="text-xs">Até<input required type="date" value={fim} min={inicio} onChange={e => setFim(e.target.value)} className="mt-1 block rounded-lg border border-zinc-300 bg-transparent p-2 dark:border-zinc-700" /></label>
        <button type="submit" disabled={consulta.isFetching} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50">Consultar</button>
      </form>
      {consulta.isPending && <p role="status" className="text-sm">Carregando horários…</p>}
      {consulta.isError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{consulta.error.message}</p>}
      {!consulta.isError && dados && (
        <>
          <p className="mb-3 text-sm" role="status">
            {dados.totalVendas === 0 ? "Nenhuma venda concluída no período." : `${dados.totalVendas} vendas · ${formatBRL(dados.totalVendido)} · Pico por quantidade: ${dados.picos.map(h => `${String(h).padStart(2, "0")}h`).join(", ")}`}
          </p>
          {dados.totalVendas > 0 && <div className="max-h-80 overflow-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Vendas por hora de {dados.inicio} até {dados.fim}, horário de São Paulo</caption>
              <thead><tr className="text-xs text-zinc-500"><th scope="col" className="py-2">Horário</th><th scope="col" className="p-2">Vendas</th><th scope="col" className="py-2 text-right">Valor</th></tr></thead>
              <tbody>{dados.horarios.map(h => <tr key={h.hora} className="border-t border-zinc-100 dark:border-zinc-800">
                <th scope="row" className="whitespace-nowrap py-2 pr-2 font-normal">{h.faixa}{dados.picos.includes(h.hora) ? " ★" : ""}</th>
                <td className="p-2"><div className="flex items-center gap-2"><span className="min-w-6 tabular-nums">{h.quantidade}</span><span aria-hidden="true" className="h-2 flex-1 rounded bg-zinc-100 dark:bg-zinc-800"><span className="block h-2 rounded bg-emerald-600" style={{ width: `${h.quantidade / maior * 100}%` }} /></span></div></td>
                <td className="whitespace-nowrap py-2 text-right tabular-nums">{formatBRL(h.total)}</td>
              </tr>)}</tbody>
            </table>
          </div>}
        </>
      )}
    </section>
  );
}
