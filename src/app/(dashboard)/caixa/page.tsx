"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, PlusCircle, Unlock, FileText, Printer } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/modal";
import { useToast } from "@/contexts/toast-context";
import { formatBRL, formatDateTime } from "@/lib/format";
import Link from "next/link";

type SessaoResp = {
  aberto: boolean;
  sugestaoAbertura: null | {
    saldo: number;
    fechadoEm: string | null;
  };
  sessao: null | {
    id: string;
    abertoEm: string;
    valorInicial: number;
    saldo: number;
    totalEntradas: number;
    totalSaidas: number;
  };
};

type Mov = {
  id: string;
  tipo: string;
  valor: number;
  valorExibicao?: number;
  descricao: string | null;
  createdAt: string;
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

function labelTipo(t: string) {
  if (t === "ABERTURA") return "Abertura";
  if (t === "VENDA") return "Venda";
  if (t === "SANGRIA") return "Sangria";
  if (t === "REFORCO") return "Reforço";
  if (t === "FECHAMENTO") return "Fechamento";
  return t;
}

function formatValorInput(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CaixaPage() {
  const qc = useQueryClient();
  const toast = useToast();

  const sessao = useQuery({
    queryKey: ["caixa-sessao"],
    queryFn: async () => {
      const r = await fetch("/api/caixa/sessao");
      if (!r.ok) throw new Error("Falha ao carregar caixa");
      return r.json() as Promise<SessaoResp>;
    },
    refetchInterval: 90_000,
  });

  const movs = useQuery({
    queryKey: ["caixa-movs", sessao.data?.sessao?.id],
    enabled: !!sessao.data?.sessao?.id,
    queryFn: async () => {
      const r = await fetch("/api/caixa/movimentacoes?page=1&pageSize=50");
      if (!r.ok) throw new Error("Falha ao carregar movimentações");
      return r.json() as Promise<{ data: Mov[] }>;
    },
  });

  const [abrirOpen, setAbrirOpen] = useState(false);
  const [valorInicial, setValorInicial] = useState("0");

  const [sangriaOpen, setSangriaOpen] = useState(false);
  const [reforcoOpen, setReforcoOpen] = useState(false);
  const [valorMov, setValorMov] = useState("");
  const [descMov, setDescMov] = useState("");

  const [fecharOpen, setFecharOpen] = useState(false);
  const [saldoInformado, setSaldoInformado] = useState("");

  const [relatorioOpen, setRelatorioOpen] = useState(false);
  const [relatorio, setRelatorio] = useState<RelatorioData | null>(null);

  const parseBR = (raw: string) => Number(String(raw).replace(/\./g, "").replace(",", ".")) || 0;

  const abrir = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/caixa/abrir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valorInicial: parseBR(valorInicial) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Erro ao abrir caixa");
      return j;
    },
    onSuccess: async () => {
      toast.push("success", "Caixa aberto.");
      setAbrirOpen(false);
      setValorInicial("0");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["caixa-sessao"] }),
        qc.invalidateQueries({ queryKey: ["caixa-movs"] }),
      ]);
    },
    onError: (e: Error) => toast.push("error", e.message),
  });

  const fechar = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {};
      const si = parseBR(saldoInformado);
      if (saldoInformado.trim() && Number.isFinite(si)) {
        body.saldoInformado = si;
      }
      const r = await fetch("/api/caixa/fechar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Erro ao fechar caixa");
      return j as { ok: boolean; relatorio: RelatorioData };
    },
    onSuccess: async (data) => {
      toast.push("success", "Caixa fechado.");
      setFecharOpen(false);
      setSaldoInformado("");
      setRelatorio(data.relatorio);
      setRelatorioOpen(true);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["caixa-sessao"] }),
        qc.invalidateQueries({ queryKey: ["caixa-movs"] }),
      ]);
    },
    onError: (e: Error) => toast.push("error", e.message),
  });

  const sangria = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/caixa/sangria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor: parseBR(valorMov), descricao: descMov || undefined }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Erro ao registrar sangria");
      return j;
    },
    onSuccess: async () => {
      toast.push("success", "Sangria registrada.");
      setSangriaOpen(false);
      setValorMov("");
      setDescMov("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["caixa-sessao"] }),
        qc.invalidateQueries({ queryKey: ["caixa-movs"] }),
      ]);
    },
    onError: (e: Error) => toast.push("error", e.message),
  });

  const reforco = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/caixa/reforco", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor: parseBR(valorMov), descricao: descMov || undefined }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Erro ao registrar reforço");
      return j;
    },
    onSuccess: async () => {
      toast.push("success", "Reforço registrado.");
      setReforcoOpen(false);
      setValorMov("");
      setDescMov("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["caixa-sessao"] }),
        qc.invalidateQueries({ queryKey: ["caixa-movs"] }),
      ]);
    },
    onError: (e: Error) => toast.push("error", e.message),
  });

  const s = sessao.data?.sessao;
  const aberto = !!sessao.data?.aberto && !!s;
  const sugestaoAbertura = sessao.data?.sugestaoAbertura ?? null;

  function abrirModalAbertura() {
    setValorInicial(formatValorInput(sugestaoAbertura?.saldo ?? 0));
    setAbrirOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Controle de caixa</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Abertura, sangria, reforço, saldo e histórico da sessão atual.
          </p>
        </div>
        <Link
          href="/caixa/relatorios"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 underline dark:text-emerald-300"
        >
          <FileText className="h-4 w-4" />
          Relatórios anteriores
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-xs font-semibold text-zinc-500">Saldo disponível</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight">{formatBRL(s?.saldo ?? 0)}</div>
          <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
            Valor inicial: <span className="font-semibold">{formatBRL(s?.valorInicial ?? 0)}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-xs font-semibold text-zinc-500">Total de entradas (positivas)</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight">{formatBRL(s?.totalEntradas ?? 0)}</div>
          <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">Inclui abertura, vendas e reforços.</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-xs font-semibold text-zinc-500">Total de saídas (sangrias)</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight">{formatBRL(s?.totalSaidas ?? 0)}</div>
          <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">Saídas registradas na sessão.</div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {!aberto ? (
          <button
            type="button"
            onClick={abrirModalAbertura}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Unlock className="h-4 w-4" />
            Abrir caixa
          </button>
        ) : (
          <>
            <button type="button" onClick={() => { setValorMov(""); setDescMov(""); setSangriaOpen(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900">
              Registrar sangria
            </button>
            <button type="button" onClick={() => { setValorMov(""); setDescMov(""); setReforcoOpen(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900">
              <PlusCircle className="h-4 w-4" />
              Reforço de caixa
            </button>
            <button type="button" onClick={() => { setSaldoInformado(""); setFecharOpen(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white">
              <Lock className="h-4 w-4" />
              Fechar caixa
            </button>
          </>
        )}
      </div>

      {/* Movements table */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Histórico de movimentações</div>
            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Sessão atual {s ? `· aberto em ${formatDateTime(s.abertoEm)}` : "—"}
            </div>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="py-2 pr-4">Data</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">Descrição</th>
                <th className="py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {!aberto ? (
                <tr><td className="py-6 text-zinc-600 dark:text-zinc-400" colSpan={4}>Abra o caixa para ver movimentações.</td></tr>
              ) : movs.isLoading ? (
                <tr><td className="py-6 text-zinc-600 dark:text-zinc-400" colSpan={4}>Carregando...</td></tr>
              ) : (movs.data?.data.length ?? 0) === 0 ? (
                <tr><td className="py-6 text-zinc-600 dark:text-zinc-400" colSpan={4}>Sem movimentações.</td></tr>
              ) : (
                movs.data?.data.map((m) => (
                  <tr key={m.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                    <td className="py-3 pr-4 text-xs text-zinc-600 dark:text-zinc-400">{formatDateTime(m.createdAt)}</td>
                    <td className="py-3 pr-4 font-medium">{labelTipo(m.tipo)}</td>
                    <td className="py-3 pr-4 text-zinc-700 dark:text-zinc-300">{m.descricao ?? "—"}</td>
                    <td className={`py-3 text-right font-semibold ${(m.valorExibicao ?? m.valor) < 0 ? "text-red-700 dark:text-red-300" : ""}`}>{formatBRL(m.valorExibicao ?? m.valor)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Abrir modal */}
      <Modal open={abrirOpen} title="Abrir caixa" onClose={() => setAbrirOpen(false)} footer={<><button type="button" onClick={() => setAbrirOpen(false)} className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 sm:w-auto">Cancelar</button><button type="button" disabled={abrir.isPending} onClick={() => abrir.mutate()} className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 sm:w-auto">{abrir.isPending ? "Abrindo..." : "Confirmar abertura"}</button></>}>
        <div>
          {sugestaoAbertura ? (
            <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
              Saldo sugerido do ultimo fechamento:{" "}
              <span className="font-semibold">{formatBRL(sugestaoAbertura.saldo)}</span>
              {sugestaoAbertura.fechadoEm ? (
                <span className="block text-[11px] opacity-80">
                  Fechado em {formatDateTime(sugestaoAbertura.fechadoEm)}
                </span>
              ) : null}
            </div>
          ) : null}
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Valor inicial no caixa (R$)</label>
          <input value={valorInicial} onChange={(e) => setValorInicial(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950" inputMode="decimal" />
          <p className="mt-2 text-xs text-zinc-500">Esse valor entra como movimentação de abertura e compõe o saldo.</p>
        </div>
      </Modal>

      {/* Sangria modal */}
      <Modal open={sangriaOpen} title="Registrar sangria" onClose={() => setSangriaOpen(false)} footer={<><button type="button" onClick={() => setSangriaOpen(false)} className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 sm:w-auto">Cancelar</button><button type="button" disabled={sangria.isPending} onClick={() => sangria.mutate()} className="w-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 sm:w-auto">{sangria.isPending ? "Salvando..." : "Confirmar sangria"}</button></>}>
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Valor (R$)</label><input value={valorMov} onChange={(e) => setValorMov(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950" inputMode="decimal" /></div>
          <div><label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Descrição (opcional)</label><input value={descMov} onChange={(e) => setDescMov(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950" /></div>
        </div>
      </Modal>

      {/* Reforço modal */}
      <Modal open={reforcoOpen} title="Reforço de caixa" onClose={() => setReforcoOpen(false)} footer={<><button type="button" onClick={() => setReforcoOpen(false)} className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 sm:w-auto">Cancelar</button><button type="button" disabled={reforco.isPending} onClick={() => reforco.mutate()} className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 sm:w-auto">{reforco.isPending ? "Salvando..." : "Confirmar reforço"}</button></>}>
        <div className="space-y-3">
          <div><label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Valor (R$)</label><input value={valorMov} onChange={(e) => setValorMov(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950" inputMode="decimal" /></div>
          <div><label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Descrição (opcional)</label><input value={descMov} onChange={(e) => setDescMov(e.target.value)} className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950" /></div>
        </div>
      </Modal>

      {/* Fechar modal */}
      <Modal open={fecharOpen} title="Fechar caixa" onClose={() => setFecharOpen(false)} footer={<><button type="button" onClick={() => setFecharOpen(false)} className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 sm:w-auto">Cancelar</button><button type="button" disabled={fechar.isPending} onClick={() => fechar.mutate()} className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white sm:w-auto">{fechar.isPending ? "Fechando..." : "Confirmar fechamento"}</button></>}>
        <div className="space-y-3">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Ao fechar, você não poderá registrar novas vendas até abrir uma nova sessão. O saldo esperado é{" "}
            <span className="font-semibold">{formatBRL(s?.saldo ?? 0)}</span>.
          </p>
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Valor contado no caixa (R$) — opcional
            </label>
            <input
              value={saldoInformado}
              onChange={(e) => setSaldoInformado(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              inputMode="decimal"
              placeholder="Deixe vazio para pular"
            />
            <p className="mt-1 text-xs text-zinc-500">Informe o valor real contado para calcular a diferença.</p>
          </div>
        </div>
      </Modal>

      {/* Relatório modal */}
      <Modal
        open={relatorioOpen}
        title="Relatório de fechamento"
        onClose={() => setRelatorioOpen(false)}
        footer={
          <>
            <button type="button" onClick={() => setRelatorioOpen(false)} className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 sm:w-auto">
              Fechar
            </button>
            <button type="button" onClick={() => window.print()} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white sm:w-auto">
              <Printer className="h-4 w-4" />
              Imprimir
            </button>
          </>
        }
      >
        {relatorio && <RelatorioContent relatorio={relatorio} />}
      </Modal>
    </div>
  );
}

function RelatorioContent({ relatorio }: { relatorio: RelatorioData }) {
  return (
    <div className="space-y-4 text-sm print:text-xs" id="relatorio-caixa">
      {/* Período */}
      <div className="grid grid-cols-2 gap-2">
        <div><span className="text-xs text-zinc-500">Abertura:</span><br/><span className="font-medium">{formatDateTime(relatorio.abertoEm)}</span></div>
        <div><span className="text-xs text-zinc-500">Fechamento:</span><br/><span className="font-medium">{formatDateTime(relatorio.fechadoEm)}</span></div>
      </div>

      {/* Financeiro */}
      <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
        <div className="text-xs font-semibold uppercase text-zinc-500">Resumo financeiro</div>
        <div className="mt-2 space-y-1">
          <Row label="Saldo inicial" value={formatBRL(relatorio.valorInicial)} />
          <Row label="Total de vendas" value={formatBRL(relatorio.totalVendido)} bold />
          <Row label="Total de sangrias" value={`-${formatBRL(relatorio.totalSangrias)}`} red />
          <Row label="Total de reforços" value={formatBRL(relatorio.totalReforcos)} />
          <hr className="border-zinc-200 dark:border-zinc-700" />
          <Row label="Saldo esperado (dinheiro)" value={formatBRL(relatorio.saldoEsperado)} bold />
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

      {/* Por forma de pagamento */}
      <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
        <div className="text-xs font-semibold uppercase text-zinc-500">Vendas por forma de pagamento</div>
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

function labelForma(f: string) {
  if (f === "DINHEIRO") return "Dinheiro";
  if (f === "PIX") return "Pix";
  if (f === "CREDITO") return "Crédito";
  if (f === "DEBITO") return "Débito";
  if (f === "OUTROS") return "Outros";
  return f;
}
