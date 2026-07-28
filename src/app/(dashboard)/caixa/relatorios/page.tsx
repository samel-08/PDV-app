"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, Printer } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/modal";
import { formatBRL, formatDateTime } from "@/lib/format";
import Link from "next/link";

type SessaoResumida = {
  id: string;
  abertoEm: string;
  fechadoEm: string | null;
  valorInicial: number;
  saldoFinalEsperado: number | null;
  saldoFinalInformado: number | null;
  diferenca: number | null;
};

type RelatorioData = {
  sessaoId: string;
  abertoEm: string;
  fechadoEm: string;
  valorInicial: number;
  totalVendido: number;
  totalSangrias: number;
  totalReforcos: number;
  saldoEsperado: number;
  saldoInformado: number | null;
  diferenca: number | null;
  totaisPorForma: Record<string, number>;
};

function labelForma(f: string) {
  if (f === "DINHEIRO") return "Dinheiro";
  if (f === "PIX") return "Pix";
  if (f === "CREDITO") return "Crédito";
  if (f === "DEBITO") return "Débito";
  if (f === "OUTROS") return "Outros";
  return f;
}

export default function RelatoriosCaixaPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sessoes = useQuery({
    queryKey: ["caixa-relatorios-lista"],
    queryFn: async () => {
      const r = await fetch("/api/caixa/relatorio");
      if (!r.ok) throw new Error("Falha ao carregar");
      const j = await r.json();
      return j.data as SessaoResumida[];
    },
  });

  const relatorio = useQuery({
    queryKey: ["caixa-relatorio", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const r = await fetch(`/api/caixa/relatorio?sessaoId=${selectedId}`);
      if (!r.ok) throw new Error("Falha ao carregar relatório");
      return r.json() as Promise<RelatorioData>;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Relatórios de caixa</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Consulte relatórios de sessões de caixa já fechadas.
          </p>
        </div>
        <Link href="/caixa" className="text-sm font-semibold text-emerald-700 underline dark:text-emerald-300">
          Voltar para caixa
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs font-semibold uppercase text-zinc-500 dark:border-zinc-800">
            <tr>
              <th className="py-2 pr-3">Abertura</th>
              <th className="py-2 pr-3">Fechamento</th>
              <th className="py-2 pr-3 text-right">Saldo esperado</th>
              <th className="py-2 pr-3 text-right">Informado</th>
              <th className="py-2 pr-3 text-right">Diferença</th>
              <th className="py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {sessoes.isLoading ? (
              <tr><td colSpan={6} className="py-6 text-zinc-500">Carregando...</td></tr>
            ) : (sessoes.data?.length ?? 0) === 0 ? (
              <tr><td colSpan={6} className="py-6 text-zinc-500">Nenhum caixa fechado encontrado.</td></tr>
            ) : (
              sessoes.data?.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                  <td className="py-3 pr-3 text-xs">{formatDateTime(s.abertoEm)}</td>
                  <td className="py-3 pr-3 text-xs">{s.fechadoEm ? formatDateTime(s.fechadoEm) : "—"}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{s.saldoFinalEsperado != null ? formatBRL(s.saldoFinalEsperado) : "—"}</td>
                  <td className="py-3 pr-3 text-right tabular-nums">{s.saldoFinalInformado != null ? formatBRL(s.saldoFinalInformado) : "—"}</td>
                  <td className={`py-3 pr-3 text-right tabular-nums font-semibold ${(s.diferenca ?? 0) < 0 ? "text-red-600" : ""}`}>
                    {s.diferenca != null ? `${s.diferenca >= 0 ? "+" : ""}${formatBRL(s.diferenca)}` : "—"}
                  </td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedId(s.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      <FileText className="h-3 w-3" />
                      Ver
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!selectedId && !!relatorio.data}
        title="Relatório de fechamento"
        onClose={() => setSelectedId(null)}
        footer={
          <>
            <button type="button" onClick={() => setSelectedId(null)} className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 sm:w-auto">
              Fechar
            </button>
            <button type="button" onClick={() => window.print()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white sm:w-auto">
              <Printer className="h-4 w-4" />
              Imprimir
            </button>
          </>
        }
      >
        {relatorio.data && <RelatorioContent relatorio={relatorio.data} />}
      </Modal>
    </div>
  );
}

function RelatorioContent({ relatorio }: { relatorio: RelatorioData }) {
  return (
    <div className="space-y-4 text-sm print:text-xs">
      <div className="grid grid-cols-2 gap-2">
        <div><span className="text-xs text-zinc-500">Abertura:</span><br/><span className="font-medium">{formatDateTime(relatorio.abertoEm)}</span></div>
        <div><span className="text-xs text-zinc-500">Fechamento:</span><br/><span className="font-medium">{formatDateTime(relatorio.fechadoEm)}</span></div>
      </div>

      <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
        <div className="text-xs font-semibold uppercase text-zinc-500">Resumo financeiro</div>
        <div className="mt-2 space-y-1">
          <Row label="Saldo inicial" value={formatBRL(relatorio.valorInicial)} />
          <Row label="Total de vendas" value={formatBRL(relatorio.totalVendido)} bold />
          <Row label="Total de sangrias" value={`-${formatBRL(relatorio.totalSangrias)}`} red />
          <Row label="Total de reforços" value={formatBRL(relatorio.totalReforcos)} />
          <hr className="border-zinc-200 dark:border-zinc-700" />
          <Row label="Saldo esperado" value={formatBRL(relatorio.saldoEsperado)} bold />
          {relatorio.saldoInformado !== null && (
            <>
              <Row label="Valor contado" value={formatBRL(relatorio.saldoInformado)} />
              <Row
                label="Diferença"
                value={`${relatorio.diferenca! >= 0 ? "+" : ""}${formatBRL(relatorio.diferenca!)}`}
                bold
                color={relatorio.diferenca! >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}
              />
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
        <div className="text-xs font-semibold uppercase text-zinc-500">Por forma de pagamento</div>
        <div className="mt-2 space-y-1">
          {Object.entries(relatorio.totaisPorForma).map(([forma, valor]) => (
            <Row key={forma} label={labelForma(forma)} value={formatBRL(valor)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, red, color }: { label: string; value: string; bold?: boolean; red?: boolean; color?: string }) {
  const cls = color ?? (red ? "text-red-700 dark:text-red-300" : "");
  return (
    <div className="flex justify-between">
      <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
      <span className={`tabular-nums ${bold ? "font-semibold" : ""} ${cls}`}>{value}</span>
    </div>
  );
}
