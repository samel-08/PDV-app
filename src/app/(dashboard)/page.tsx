"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";
import { formatBRL, formatQty } from "@/lib/format";
import type { DashboardChartsData } from "./dashboard-charts";

type DashboardData = DashboardChartsData & {
  totalMes: number;
  qtdMes: number;
  ticketMedioMes: number;
  ticketMedioGeral: number;
  lucroMes: number;
  produtoMaisVendido: { nome: string; qtd: number } | null;
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

export default function DashboardPage() {
  const { data, isLoading, isError, error } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const r = await fetch("/api/dashboard");
      if (!r.ok) throw new Error("Não foi possível carregar o dashboard.");
      return r.json();
    },
    /** Menos CPU/rede que 20s; dados ainda invalidam após vendas (mutations). */
    refetchInterval: 60_000,
    staleTime: 45_000,
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

      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold">Importação em lote</div>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            Cadastre vários produtos a partir do arquivo <span className="font-mono">produtos.csv</span> ou de um CSV
            enviado pela tela.
          </p>
        </div>
        <Link
          href="/importar-produtos"
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          Importar produtos (CSV)
        </Link>
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

      <DashboardCharts data={chartSlice} />
    </div>
  );
}
