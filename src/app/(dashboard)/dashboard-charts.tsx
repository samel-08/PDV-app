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

function DashboardChartsInner({ data }: { data: DashboardChartsData }) {
  const pieProd = useMemo(
    () =>
      data.vendasPorProduto.length
        ? data.vendasPorProduto
        : [{ name: "Sem vendas", value: 1 }],
    [data.vendasPorProduto]
  );

  const piePay = useMemo(
    () =>
      data.pagamentoMes.length ? data.pagamentoMes : [{ name: "Sem dados", value: 1 }],
    [data.pagamentoMes]
  );

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-2 text-sm font-semibold">Vendas por produto (mês)</div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie dataKey="value" data={pieProd} innerRadius={55} outerRadius={90} paddingAngle={2} isAnimationActive={false}>
                  {pieProd.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
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
