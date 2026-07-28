"use client";

import { memo, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBRL } from "@/lib/format";

export type DashboardChartsData = {
  vendasPorProduto: { name: string; value: number }[];
  pagamentoMes: { name: string; value: number }[];
  vendasMensais: { key: string; label: string; total: number; qtd: number }[];
};

const COLORS = ["#059669", "#0ea5e9", "#a855f7", "#f97316", "#eab308", "#64748b"];
const PRODUTOS_CHART_LIMIT = 10;

function compactProdutosChart(rows: { name: string; value: number }[]) {
  const sorted = rows
    .filter((row) => row.value > 0)
    .slice()
    .sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, PRODUTOS_CHART_LIMIT);
  const outros = sorted.slice(PRODUTOS_CHART_LIMIT).reduce((sum, row) => sum + row.value, 0);
  return outros > 0 ? [...top, { name: "Outros", value: Math.round(outros * 100) / 100 }] : top;
}

function DashboardChartsInner({ data }: { data: DashboardChartsData }) {
  const produtosRank = useMemo(() => compactProdutosChart(data.vendasPorProduto), [data.vendasPorProduto]);
  const maiorProduto = produtosRank.reduce((max, row) => Math.max(max, row.value), 0);

  const piePay = useMemo(
    () =>
      data.pagamentoMes.length ? data.pagamentoMes : [{ name: "Sem dados", value: 1 }],
    [data.pagamentoMes]
  );

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">Vendas por produto (mês)</div>
            <div className="text-[11px] font-medium text-zinc-500">Top 10 + Outros</div>
          </div>
          <div className="h-72 overflow-y-auto pr-1">
            {produtosRank.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-zinc-500">Sem vendas no mês.</div>
            ) : (
              <div className="space-y-2.5">
                {produtosRank.map((p, i) => {
                  const pct = maiorProduto > 0 ? Math.max(5, (p.value / maiorProduto) * 100) : 0;
                  return (
                    <div key={`${p.name}-${i}`} title={`${p.name}: ${formatBRL(p.value)}`}>
                      <div className="mb-1 flex items-center gap-2 text-xs">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                          {formatBRL(p.value)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-2 text-sm font-semibold">Formas de pagamento (mês)</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie dataKey="value" data={piePay} innerRadius={55} outerRadius={90} paddingAngle={2} isAnimationActive={false}>
                  {piePay.map((_, i) => (
                    <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-2 text-sm font-semibold">Vendas mensais (últimos 6 meses)</div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.vendasMensais}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => formatBRL(v)} />
              <Legend />
              <Bar dataKey="total" name="Total (R$)" fill="#059669" radius={[8, 8, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-2 text-sm font-semibold">Quantidade de vendas por mês</div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.vendasMensais}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="qtd"
                name="Vendas"
                stroke="#0ea5e9"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

/** Gráficos isolados + memo: menos re-renders quando o pai atualiza texto/estado. */
export const DashboardCharts = memo(DashboardChartsInner);
