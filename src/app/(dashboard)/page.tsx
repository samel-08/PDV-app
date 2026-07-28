"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { formatBRL, formatDateTime, formatQty } from "@/lib/format";
import type { DashboardChartsData } from "./dashboard-charts";

type DashboardData = DashboardChartsData & {
  totalMes: number;
  qtdMes: number;
  ticketMedioMes: number;
  ticketMedioGeral: number;
  lucroMes: number;
  produtoMaisVendido: { nome: string; qtd: number } | null;
  produtosMaisVendidos: { nome: string; quantidade: number; totalVendido: number }[];
  produtosParados: { nome: string; estoqueAtual: number; ultimaVendaEm: string | null }[];
};

const DashboardCharts = dynamic(
  () => import("./dashboard-charts").then((m) => m.DashboardCharts),
  {
    ssr: false,
    loading: () => (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-72 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-80 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800 lg:col-span-2" />
        <div className="h-72 animate-pulse rounded-2xl bg-zinc-200 dark:bg-zinc-800 lg:col-span-2" />
      </div>
    ),
  }
);

function Card({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-xs font-medium text-zinc-500">{title}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {hint ? <div className="mt-1 text-xs text-zinc-500">{hint}</div> : null}
    </div>
  );
}

function DashboardListCard({
  title,
  subtitle,
  emptyMessage,
  isEmpty,
  children,
}: {
  title: string;
  subtitle?: string;
  emptyMessage: string;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-sm font-semibold">{title}</div>
      {subtitle ? <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{subtitle}</p> : null}
      {isEmpty ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{emptyMessage}</p>
      ) : (
        <div className="mt-3">{children}</div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, isError, error } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const r = await fetch("/api/dashboard");
      if (!r.ok) throw new Error("Não foi possível carregar o dashboard.");
      return r.json();
    },
    refetchInterval: 60_000,
    staleTime: 45_000,
  });

  const estoqueBaixo = useQuery({
    queryKey: ["estoque-baixo"],
    queryFn: async () => {
      const r = await fetch("/api/produtos/estoque-baixo");
      if (!r.ok) return { data: [], total: 0 };
      return r.json() as Promise<{ data: { id: string; codigo: string; nome: string; estoqueAtual: number; estoqueMinimo: number }[]; total: number }>;
    },
    refetchInterval: 120_000,
  });

  const chartSlice = useMemo((): DashboardChartsData | null => {
    if (!data) return null;
    return {
      vendasPorProduto: data.vendasPorProduto,
      pagamentoMes: data.pagamentoMes,
      vendasMensais: data.vendasMensais,
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-56 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data || !chartSlice) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
        {(error as Error)?.message ?? "Erro ao carregar dados."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Visão geral do mês atual. Atualiza após vendas e, em segundo plano, a cada 60 segundos.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card title="Total vendido no mês" value={formatBRL(data.totalMes)} />
        <Card title="Quantidade de vendas (mês)" value={String(data.qtdMes)} />
        <Card title="Ticket médio mensal" value={formatBRL(data.ticketMedioMes)} />
        <Card title="Ticket médio geral" value={formatBRL(data.ticketMedioGeral)} />
        <Card title="Lucro estimado (mês)" value={formatBRL(data.lucroMes)} hint="Com base nos custos atuais dos produtos." />
        <Card
          title="Produto mais vendido (mês)"
          value={data.produtoMaisVendido ? data.produtoMaisVendido.nome : "—"}
          hint={data.produtoMaisVendido ? `${formatQty(data.produtoMaisVendido.qtd)} (qtd.)` : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardListCard
          title="Produtos mais vendidos"
          subtitle="Ranking por quantidade vendida (todas as vendas concluídas)."
          emptyMessage="Nenhuma venda registrada ainda."
          isEmpty={data.produtosMaisVendidos.length === 0}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                  <th className="pb-2 pr-2">Produto</th>
                  <th className="pb-2 text-right">Qtd</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {data.produtosMaisVendidos.map((p, i) => (
                  <tr key={`${p.nome}-${i}`}>
                    <td className="py-2 pr-2">
                      <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                        {i + 1}
                      </span>
                      <span className="font-medium">{p.nome}</span>
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatQty(p.quantidade)}</td>
                    <td className="py-2 text-right font-semibold tabular-nums text-emerald-800 dark:text-emerald-200">
                      {formatBRL(p.totalVendido)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardListCard>

        <DashboardListCard
          title="Produtos parados"
          subtitle="Sem venda nos últimos 30 dias ou nunca vendidos (produtos ativos)."
          emptyMessage="Nenhum produto parado encontrado."
          isEmpty={data.produtosParados.length === 0}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                  <th className="pb-2 pr-2">Produto</th>
                  <th className="pb-2 text-right">Estoque</th>
                  <th className="pb-2 text-right">Última venda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {data.produtosParados.map((p, i) => (
                  <tr key={`${p.nome}-${i}`}>
                    <td className="py-2 pr-2 font-medium">{p.nome}</td>
                    <td className="py-2 text-right tabular-nums">{formatQty(p.estoqueAtual)}</td>
                    <td className="py-2 text-right text-xs text-zinc-600 dark:text-zinc-400">
                      {p.ultimaVendaEm ? formatDateTime(p.ultimaVendaEm) : "Nunca vendido"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardListCard>
      </div>

      <DashboardCharts data={chartSlice} />

      {/* Estoque baixo */}
      {(estoqueBaixo.data?.total ?? 0) > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4" />
            Produtos com estoque baixo ({estoqueBaixo.data!.total})
          </div>
          <div className="mt-2 space-y-1">
            {estoqueBaixo.data!.data.slice(0, 8).map((p) => (
              <div key={p.id} className="flex justify-between text-xs text-amber-800 dark:text-amber-200">
                <span>{p.nome}</span>
                <span className="font-semibold tabular-nums">{p.estoqueAtual} / mín: {p.estoqueMinimo}</span>
              </div>
            ))}
            {estoqueBaixo.data!.total > 8 && (
              <Link href="/produtos" className="mt-1 block text-xs font-semibold text-amber-700 underline dark:text-amber-300">
                Ver todos ({estoqueBaixo.data!.total})
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
