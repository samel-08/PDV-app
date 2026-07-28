"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CreditCard,
  Lock,
  Minus,
  Plus,
  PlusCircle,
  Printer,
  Repeat2,
  Search,
  ShoppingBag,
  Tag,
  Trash2,
  Unlock,
  Wallet,
  X,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Modal } from "@/components/modal";
import { useToast } from "@/contexts/toast-context";
import type { ConfigBalancaDTO } from "@/lib/balanca-types";
import { formatBRL, formatDateTime, formatQty, labelUnidadeMedida } from "@/lib/format";
import { openVendaPrint } from "@/lib/print-venda";

type Produto = {
  id: string;
  codigo: string;
  nome: string;
  precoVenda: number;
  unidadeMedida?: string;
  ativo: boolean;
  estoqueAtual?: number;
};

type CartLine = {
  produtoId: string;
  codigo: string;
  nome: string;
  precoVenda: number;
  unidadeMedida: string;
  quantidade: number;
};

type VendaFull = {
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
  pagamentos?: { formaPagamento: string; valor: number }[];
};

type Forma = "DINHEIRO" | "PIX" | "CREDITO" | "DEBITO" | "OUTROS";
type PagamentoLine = { formaPagamento: Forma; valor: number };
type SearchFlash = "ok" | "err" | null;
type CodigoScanResult = { tipo: "produto" | "balanca"; produto: Produto; quantidade: number };

function useDebounced<T>(value: T, delay: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return v;
}

function labelPagamento(p: string) {
  if (p === "DINHEIRO") return "Dinheiro";
  if (p === "PIX") return "Pix";
  if (p === "CREDITO") return "Crédito";
  if (p === "DEBITO") return "Débito";
  if (p === "OUTROS") return "Outros";
  if (p === "MULTIPLO") return "Múltiplo";
  if (p === "CARTAO") return "Cartão (legado)";
  return p;
}

function parseQtyInput(raw: string): number {
  const n = Number(String(raw).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function formatValorInput(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBR(raw: string): number {
  const n = Number(String(raw).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

const MANUAL_QTY_MIN = 0.1;

function manualMinQtyForLine() {
  return MANUAL_QTY_MIN;
}

function manualStepForLine() {
  return MANUAL_QTY_MIN;
}

function ShortcutKey({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
      {children}
    </kbd>
  );
}

function CheckoutMetricCard({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: "neutral" | "warning" | "success";
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/55 dark:bg-amber-950/20 dark:text-amber-400"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/20 dark:text-emerald-300"
        : "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-700/90 dark:bg-zinc-950/60 dark:text-zinc-100";
  const iconClass =
    tone === "warning"
      ? "border-amber-300 bg-amber-100 text-amber-600 dark:border-amber-500/45 dark:bg-amber-500/10 dark:text-amber-400"
      : "border-emerald-300 bg-emerald-100 text-emerald-600 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-300";
  const valueClass =
    tone === "warning"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "success"
        ? "text-emerald-700 dark:text-emerald-200"
        : "text-zinc-950 dark:text-zinc-50";

  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-inner [@media(max-height:820px)]:rounded-xl [@media(max-height:820px)]:px-3 [@media(max-height:820px)]:py-2 ${toneClass}`}>
      <div className={`hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border sm:flex [@media(max-height:820px)]:hidden ${iconClass}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 sm:text-sm [@media(max-height:820px)]:text-xs">{label}</div>
        <div className={`mt-0.5 text-xl font-extrabold tabular-nums tracking-tight sm:text-2xl [@media(max-height:820px)]:text-lg ${valueClass}`}>{value}</div>
      </div>
    </div>
  );
}

function PixMark() {
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-600 ring-1 ring-cyan-300/70 dark:bg-cyan-400/15 dark:text-cyan-300 dark:ring-cyan-300/45 [@media(max-height:820px)]:h-9 [@media(max-height:820px)]:w-9 [@media(max-height:820px)]:rounded-xl">
      <svg
        viewBox="0 0 48 48"
        aria-hidden="true"
        className="h-9 w-9 drop-shadow-[0_0_10px_rgba(34,211,238,0.35)] [@media(max-height:820px)]:h-7 [@media(max-height:820px)]:w-7"
      >
        <path fill="currentColor" d="M24 7 34 17 24 27 14 17z" opacity="0.9" />
        <path fill="currentColor" d="M24 21 34 31 24 41 14 31z" opacity="0.75" />
        <path fill="currentColor" d="M7 24 17 14 27 24 17 34z" opacity="0.65" />
        <path fill="currentColor" d="M21 24 31 14 41 24 31 34z" opacity="0.65" />
      </svg>
    </span>
  );
}

function QuickPaymentCard({
  label,
  icon,
  colorClass,
  disabled,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  colorClass: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-[7rem] flex-col items-center justify-center gap-2 rounded-2xl border bg-white px-3 py-4 text-center text-xl font-bold text-zinc-900 shadow-inner transition hover:-translate-y-0.5 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-45 dark:bg-zinc-950/70 dark:text-zinc-50 dark:hover:bg-zinc-900 sm:text-2xl [@media(max-height:820px)]:min-h-[4.5rem] [@media(max-height:820px)]:gap-1.5 [@media(max-height:820px)]:rounded-xl [@media(max-height:820px)]:py-2 [@media(max-height:820px)]:text-base ${colorClass}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

const CartRow = memo(function CartRow({
  line,
  onInc,
  onSetQty,
  onRemove,
}: {
  line: CartLine;
  onInc: (id: string, dir: 1 | -1) => void;
  onSetQty: (id: string, raw: string) => void;
  onRemove: (id: string) => void;
}) {
  const subtotal = line.precoVenda * line.quantidade;
  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800/80">
      <td className="py-2.5 pr-2 align-middle">
        <div className="truncate text-sm font-semibold">{line.nome}</div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">{line.codigo}</div>
      </td>
      <td className="py-2.5 align-middle">
        <div className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-900"
            onClick={() => onInc(line.produtoId, -1)}
            aria-label="Diminuir quantidade"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <input
            className="h-8 w-14 border-x border-zinc-200 bg-transparent text-center text-xs tabular-nums outline-none dark:border-zinc-700"
            value={String(line.quantidade).replace(".", ",")}
            inputMode="decimal"
            onChange={(e) => onSetQty(line.produtoId, e.target.value)}
            aria-label="Quantidade"
          />
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-900"
            onClick={() => onInc(line.produtoId, 1)}
            aria-label="Aumentar quantidade"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
      <td className="hidden py-2.5 text-right align-middle tabular-nums text-sm text-zinc-700 dark:text-zinc-300 sm:table-cell">
        {formatBRL(line.precoVenda)}
      </td>
      <td className="py-2.5 text-right align-middle text-sm font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
        {formatBRL(subtotal)}
      </td>
      <td className="py-2.5 pl-1 text-right align-middle">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30"
          onClick={() => onRemove(line.produtoId)}
          aria-label="Remover item"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
});

export default function PdvPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 300);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [searchFlash, setSearchFlash] = useState<SearchFlash>(null);
  const [lastAddedName, setLastAddedName] = useState<string | null>(null);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  // Multi-payment state
  const [pagamentos, setPagamentos] = useState<PagamentoLine[]>([]);
  const [addForma, setAddForma] = useState<Forma>("DINHEIRO");
  const [addValor, setAddValor] = useState("");

  const [receipt, setReceipt] = useState<VendaFull | null>(null);
  const [caixaPanelOpen, setCaixaPanelOpen] = useState(false);
  const [abrirCaixaOpen, setAbrirCaixaOpen] = useState(false);
  const [fecharCaixaOpen, setFecharCaixaOpen] = useState(false);
  const [valorInicialCaixa, setValorInicialCaixa] = useState("0");
  const [saldoInformadoCaixa, setSaldoInformadoCaixa] = useState("");
  const lastInterpreted = useRef<string>("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const focusSearch = useCallback(() => {
    requestAnimationFrame(() => {
      const el = searchInputRef.current;
      if (!el) return;
      el.focus();
      el.select();
    });
  }, []);

  const flashSearch = useCallback((kind: "ok" | "err") => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setSearchFlash(kind);
    flashTimerRef.current = setTimeout(() => setSearchFlash(null), 700);
  }, []);

  useEffect(() => {
    focusSearch();
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [focusSearch]);

  const caixa = useQuery({
    queryKey: ["caixa-sessao"],
    queryFn: async () => {
      const r = await fetch("/api/caixa/sessao");
      if (!r.ok) throw new Error("Falha ao consultar caixa");
      return r.json() as Promise<{
        aberto: boolean;
        sugestaoAbertura: null | { saldo: number; fechadoEm: string | null };
        sessao: null | { id: string; saldo: number; valorInicial: number; abertoEm: string };
      }>;
    },
    refetchInterval: 90_000,
  });

  const balancaCfg = useQuery({
    queryKey: ["config-balanca"],
    queryFn: async () => {
      const r = await fetch("/api/config/balanca");
      if (!r.ok) throw new Error("Falha ao carregar config da balança");
      return r.json() as Promise<ConfigBalancaDTO>;
    },
  });

  const busca = useQuery({
    queryKey: ["pdv-busca", dq],
    enabled: dq.length >= 1 && !/^\d+$/.test(dq),
    queryFn: async () => {
      const r = await fetch(`/api/produtos/busca?q=${encodeURIComponent(dq)}`);
      if (!r.ok) throw new Error("Falha na busca");
      const j = await r.json();
      return j.data as Produto[];
    },
  });

  const processarCodigo = useMutation({
    mutationFn: async (codigoBarras: string) => {
      const codigo = codigoBarras.trim();
      const produtoResp = await fetch(`/api/produtos/busca?codigo=${encodeURIComponent(codigo)}`);
      if (produtoResp.ok) {
        const produtoJson = await produtoResp.json().catch(() => ({ data: [] }));
        const produto = (produtoJson.data as Produto[] | undefined)?.[0];
        if (produto) return { tipo: "produto", produto, quantidade: 1 } satisfies CodigoScanResult;
      }

      const r = await fetch("/api/pdv/interpretar-codigo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigoBarras: codigo }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error("Produto não encontrado para este código de barras");
      }
      if (!r.ok) throw new Error(j.error ?? "Código inválido.");
      return { tipo: "balanca", ...(j as { produto: Produto; quantidade: number }) } satisfies CodigoScanResult;
    },
    onSuccess: (data, codigoBarras) => {
      lastInterpreted.current = codigoBarras;
      addToCartQty(data.produto, data.quantidade, false);
      setQ("");
      setLastAddedName(data.produto.nome);
      flashSearch("ok");
      focusSearch();
      if (data.tipo === "produto") {
        toast.push("success", `${data.produto.nome} adicionado pelo codigo de barras.`);
        return;
      }
      toast.push("success", `${data.produto.nome} (${formatQty(data.quantidade)}) adicionado pela balança.`);
    },
    onError: (e: Error, codigoBarras) => {
      lastInterpreted.current = codigoBarras;
      flashSearch("err");
      toast.push("error", e.message);
    },
  });

  useEffect(() => {
    if (dq === "") lastInterpreted.current = "";
  }, [dq]);

  useEffect(() => {
    const cfg = balancaCfg.data;
    if (!cfg || !caixa.data?.aberto) return;
    if (!/^\d+$/.test(dq)) return;
    if (dq.length !== cfg.tamanhoCodigoBarras) return;
    if (lastInterpreted.current === dq) return;
    const t = window.setTimeout(() => {
      lastInterpreted.current = dq;
      processarCodigo.mutate(dq);
    }, 200);
    return () => window.clearTimeout(t);
  }, [dq, balancaCfg.data, caixa.data?.aberto, processarCodigo]);

  const total = useMemo(
    () => Math.round(cart.reduce((a, l) => a + l.precoVenda * l.quantidade, 0) * 100) / 100,
    [cart]
  );

  const totalPago = useMemo(
    () => Math.round(pagamentos.reduce((a, p) => a + p.valor, 0) * 100) / 100,
    [pagamentos]
  );

  const restante = useMemo(() => Math.max(0, Math.round((total - totalPago) * 100) / 100), [total, totalPago]);

  const valorDinheiro = useMemo(
    () =>
      Math.round(
        pagamentos
          .filter((p) => p.formaPagamento === "DINHEIRO")
          .reduce((a, p) => a + p.valor, 0) * 100
      ) / 100,
    [pagamentos]
  );

  const excedente = useMemo(() => Math.max(0, Math.round((totalPago - total) * 100) / 100), [totalPago, total]);
  const excedenteValido = excedente <= 0.01 || valorDinheiro + 0.01 >= excedente;

  const troco = useMemo(() => {
    if (!excedenteValido || excedente <= 0.01) return 0;
    return excedente;
  }, [excedente, excedenteValido]);

  const canFinalize = useMemo(() => {
    return total > 0 && pagamentos.length > 0 && totalPago + 0.01 >= total && excedenteValido;
  }, [total, pagamentos.length, totalPago, excedenteValido]);

  const showNotFound =
    dq.length >= 2 &&
    !/^\d+$/.test(dq) &&
    !busca.isLoading &&
    busca.isFetched &&
    (busca.data?.length ?? 0) === 0;

  useEffect(() => {
    if (showNotFound) flashSearch("err");
  }, [showNotFound, flashSearch]);

  function addToCartQty(p: Produto, qty: number, showToast = true) {
    if (!Number.isFinite(qty) || qty < 0.0005) return;
    const qRounded = Math.round(qty * 1000) / 1000;
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.produtoId === p.id);
      if (idx === -1) {
        return [
          ...prev,
          {
            produtoId: p.id,
            codigo: p.codigo,
            nome: p.nome,
            precoVenda: p.precoVenda,
            unidadeMedida: p.unidadeMedida ?? "UN",
            quantidade: qRounded,
          },
        ];
      }
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        quantidade: Math.round((copy[idx].quantidade + qRounded) * 1000) / 1000,
      };
      return copy;
    });
    setLastAddedName(p.nome);
    flashSearch("ok");
    focusSearch();
    if (showToast) toast.push("success", `${p.nome} adicionado.`);
  }

  function addToCart(p: Produto) {
    addToCartQty(p, 1, true);
    setQ("");
  }

  function setQty(produtoId: string, raw: string) {
    const qn = parseQtyInput(raw);
    if (!Number.isFinite(qn)) return;
    const clamped = Math.max(MANUAL_QTY_MIN, Math.round(qn * 1000) / 1000);
    setCart((prev) => prev.map((l) => (l.produtoId === produtoId ? { ...l, quantidade: clamped } : l)));
  }

  function inc(produtoId: string, deltaDir: 1 | -1) {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.produtoId !== produtoId) return l;
          const step = manualStepForLine();
          const minQty = manualMinQtyForLine();
          const currentQty = Math.max(minQty, l.quantidade);
          const next = Math.round((currentQty + deltaDir * step) * 1000) / 1000;
          return { ...l, quantidade: Math.max(minQty, next) };
        })
        .filter((l) => l.quantidade > 0)
    );
  }

  const remove = useCallback((produtoId: string) => {
    setCart((prev) => prev.filter((l) => l.produtoId !== produtoId));
  }, []);

  // Payment helpers
  function addPagamento() {
    const valor = parseBR(addValor);
    if (valor <= 0) {
      toast.push("error", "Informe um valor válido.");
      return;
    }
    setPagamentos((prev) => [...prev, { formaPagamento: addForma, valor }]);
    setAddValor("");
  }

  function addPagamentoRestante(forma: Forma) {
    if (restante <= 0) return;
    setPagamentos((prev) => [...prev, { formaPagamento: forma, valor: restante }]);
    setAddValor("");
  }

  function removePagamento(idx: number) {
    setPagamentos((prev) => prev.filter((_, i) => i !== idx));
  }

  const finalize = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/vendas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itens: cart.map((l) => ({ produtoId: l.produtoId, quantidade: l.quantidade })),
          pagamentos,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Erro ao finalizar venda");
      return j as VendaFull;
    },
    onSuccess: async (venda) => {
      toast.push("success", `Venda #${venda.numero} registrada.`);
      setCheckoutOpen(false);
      setCart([]);
      setPagamentos([]);
      setAddValor("");
      setLastAddedName(null);
      setReceipt(venda);
      focusSearch();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
        qc.invalidateQueries({ queryKey: ["vendas"] }),
        qc.invalidateQueries({ queryKey: ["caixa-sessao"] }),
        qc.invalidateQueries({ queryKey: ["caixa-movs"] }),
        qc.invalidateQueries({ queryKey: ["produtos"] }),
      ]);
    },
    onError: (e: Error) => toast.push("error", e.message),
  });

  const abrirCaixa = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/caixa/abrir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valorInicial: parseBR(valorInicialCaixa) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Erro ao abrir caixa");
      return j;
    },
    onSuccess: async () => {
      toast.push("success", "Caixa aberto.");
      setAbrirCaixaOpen(false);
      setCaixaPanelOpen(false);
      setValorInicialCaixa("0");
      await qc.invalidateQueries({ queryKey: ["caixa-sessao"] });
    },
    onError: (e: Error) => toast.push("error", e.message),
  });

  const fecharCaixa = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {};
      const si = parseBR(saldoInformadoCaixa);
      if (saldoInformadoCaixa.trim() && Number.isFinite(si)) {
        body.saldoInformado = si;
      }
      const r = await fetch("/api/caixa/fechar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Erro ao fechar caixa");
      return j;
    },
    onSuccess: async () => {
      toast.push("success", "Caixa fechado.");
      setFecharCaixaOpen(false);
      setCaixaPanelOpen(false);
      setSaldoInformadoCaixa("");
      await qc.invalidateQueries({ queryKey: ["caixa-sessao"] });
    },
    onError: (e: Error) => toast.push("error", e.message),
  });

  const caixaAberto = !!caixa.data?.aberto;
  const hasCartItems = cart.length > 0;

  const searchInputClass =
    searchFlash === "ok"
      ? "border-emerald-500 bg-emerald-50/80 ring-4 ring-emerald-500/25 dark:bg-emerald-950/30"
      : searchFlash === "err"
        ? "border-amber-500 bg-amber-50/80 ring-4 ring-amber-500/25 dark:bg-amber-950/20"
        : "border-emerald-400/80 bg-white ring-emerald-600/20 focus:border-emerald-600 focus:ring-4 dark:border-emerald-700 dark:bg-zinc-950";

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.altKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        focusSearch();
        return;
      }
      if (e.key === "Escape") {
        if (checkoutOpen) {
          e.preventDefault();
          setCheckoutOpen(false);
          focusSearch();
          return;
        }
        if (receipt) {
          e.preventDefault();
          setReceipt(null);
          focusSearch();
          return;
        }
        if (q.trim()) {
          e.preventDefault();
          setQ("");
          lastInterpreted.current = "";
          focusSearch();
        }
        return;
      }
      if (e.key === "F6") {
        e.preventDefault();
        if (!caixaAberto || cart.length === 0) return;
        if (checkoutOpen) {
          if (canFinalize && !finalize.isPending) finalize.mutate();
          return;
        }
        setCheckoutOpen(true);
        return;
      }
      if (e.key === "F9") {
        e.preventDefault();
        if (checkoutOpen) {
          setCheckoutOpen(false);
          focusSearch();
          return;
        }
        if (receipt) {
          setReceipt(null);
          focusSearch();
          return;
        }
        if (cart.length > 0) {
          setCart([]);
          setPagamentos([]);
          setLastAddedName(null);
          toast.push("success", "Venda cancelada (carrinho limpo).");
          focusSearch();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [caixaAberto, cart.length, checkoutOpen, receipt, canFinalize, finalize, toast, focusSearch, q]);

  function closeCheckout() {
    setCheckoutOpen(false);
    focusSearch();
  }

  function openCaixaAbertura() {
    setValorInicialCaixa(formatValorInput(caixa.data?.sugestaoAbertura?.saldo ?? 0));
    setAbrirCaixaOpen(true);
  }

  function closeReceipt() {
    setReceipt(null);
    focusSearch();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">PDV</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
            <span className="inline-flex items-center gap-1">
              <ShortcutKey>F6</ShortcutKey> finalizar
            </span>
            <span className="inline-flex items-center gap-1">
              <ShortcutKey>F9</ShortcutKey> cancelar
            </span>
            <span className="inline-flex items-center gap-1">
              <ShortcutKey>Esc</ShortcutKey> limpar busca
            </span>
            <span className="inline-flex items-center gap-1">
              <ShortcutKey>Alt+P</ShortcutKey> focar busca
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-xs font-semibold text-zinc-500">Caixa</div>
          <div className="mt-1 font-semibold">
            {caixaAberto ? (
              <span className="text-emerald-700 dark:text-emerald-300">Aberto</span>
            ) : (
              <span className="text-amber-700 dark:text-amber-300">Fechado</span>
            )}
          </div>
          {caixa.data?.sessao ? (
            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Saldo: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatBRL(caixa.data.sessao.saldo)}</span>
            </div>
          ) : null}
        </div>
      </div>

      {!caixaAberto ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          Abra o caixa pelo botão <span className="font-semibold">Caixa fechado</span> no canto inferior esquerdo antes de registrar vendas.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="rounded-2xl border-2 border-emerald-200/80 bg-gradient-to-b from-emerald-50/60 to-white p-4 shadow-sm dark:border-emerald-900/50 dark:from-emerald-950/20 dark:to-zinc-950">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="pdv-busca-produto" className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                Buscar produto
              </label>
              <Search className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            </div>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-600/70" />
              <input
                ref={searchInputRef}
                id="pdv-busca-produto"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const codigo = q.trim();
                  if (!codigo || !caixaAberto || processarCodigo.isPending) return;
                  lastInterpreted.current = codigo;
                  processarCodigo.mutate(codigo);
                }}
                placeholder="Nome, código ou código da balança..."
                autoComplete="off"
                className={`w-full rounded-xl border-2 py-3.5 pl-11 pr-3 text-base font-medium outline-none transition-[box-shadow,border-color,background-color] duration-150 dark:text-zinc-50 ${searchInputClass}`}
              />
            </div>

            {lastAddedName ? (
              <div
                className="mt-2 rounded-lg border border-emerald-300 bg-emerald-100/90 px-3 py-2 text-sm font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
                role="status"
              >
                Último adicionado: <span className="font-semibold">{lastAddedName}</span>
              </div>
            ) : null}

            {showNotFound ? (
              <div
                className="mt-2 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-sm font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                role="alert"
              >
                Nenhum produto encontrado para &quot;{dq}&quot;.
              </div>
            ) : null}

            <div className="mt-3 max-h-[380px] space-y-2 overflow-y-auto">
              {dq.length < 1 ? (
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  Digite ou escaneie para adicionar ao carrinho.
                </div>
              ) : /^\d+$/.test(dq) ? (
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  {processarCodigo.isPending
                    ? "Interpretando código da balança..."
                    : `Código numérico (${dq.length} dígitos). Aguarde o reconhecimento automático.`}
                </div>
              ) : busca.isLoading ? (
                <div className="text-sm text-zinc-600 dark:text-zinc-400">Buscando...</div>
              ) : showNotFound ? null : (
                busca.data?.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    disabled={!caixaAberto}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-200 px-3 py-2.5 text-left hover:border-emerald-300 hover:bg-emerald-50/50 disabled:opacity-50 dark:border-zinc-800 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{p.nome}</div>
                      <div className="mt-0.5 font-mono text-xs text-zinc-500">{p.codigo}</div>
                    </div>
                    <div className="shrink-0 rounded-lg bg-emerald-100 px-2.5 py-1.5 text-right dark:bg-emerald-950/50">
                      <div className="text-base font-bold tabular-nums text-emerald-800 dark:text-emerald-200">
                        {formatBRL(p.precoVenda)}
                      </div>
                      <div className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80">
                        /{labelUnidadeMedida(p.unidadeMedida ?? "UN")}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div
          className={`rounded-2xl border bg-white p-4 dark:bg-zinc-950 ${
            hasCartItems ? "border-emerald-300 shadow-md dark:border-emerald-800" : "border-zinc-200 dark:border-zinc-800"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Carrinho</div>
            <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
              <ShoppingBag className="h-4 w-4" />
              {cart.length} {cart.length === 1 ? "item" : "itens"}
            </div>
          </div>

          <div className="mt-3 overflow-x-auto">
            {cart.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                Carrinho vazio - busque um produto acima.
              </div>
            ) : (
              <table className="w-full min-w-[320px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-700">
                    <th className="pb-2 pr-2">Produto</th>
                    <th className="pb-2 text-center">Qtd</th>
                    <th className="hidden pb-2 text-right sm:table-cell">Unitário</th>
                    <th className="pb-2 text-right">Total</th>
                    <th className="pb-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((l) => (
                    <CartRow key={l.produtoId} line={l} onInc={inc} onSetQty={setQty} onRemove={remove} />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-4 space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <div className="flex flex-col gap-1 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white px-4 py-3 dark:border-emerald-900/50 dark:from-emerald-950/50 dark:to-zinc-950 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-800/80 dark:text-emerald-200/80">
                Total da venda
              </span>
              <span className="text-3xl font-extrabold tabular-nums tracking-tight text-emerald-800 dark:text-emerald-100">
                {formatBRL(total)}
              </span>
            </div>
            <button
              type="button"
              disabled={!caixaAberto || !hasCartItems}
              onClick={() => { setPagamentos([]); setAddValor(""); setCheckoutOpen(true); }}
              className={
                hasCartItems
                  ? "w-full rounded-2xl bg-emerald-600 px-4 py-4 text-lg font-bold text-white shadow-lg ring-2 ring-emerald-400/80 hover:bg-emerald-700 disabled:opacity-50"
                  : "w-full rounded-xl bg-emerald-600/40 px-4 py-3 text-sm font-semibold text-white/90 disabled:opacity-50"
              }
            >
              Finalizar venda
              {hasCartItems ? (
                <span className="ml-2 text-sm font-normal text-emerald-100">
                  <ShortcutKey>F6</ShortcutKey>
                </span>
              ) : null}
            </button>
            {hasCartItems ? (
              <p className="text-center text-[11px] text-zinc-500 dark:text-zinc-400">
                <ShortcutKey>F9</ShortcutKey> cancela · <ShortcutKey>Esc</ShortcutKey> limpa a busca
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Checkout Modal - Multi Payment */}
      <Modal
        open={checkoutOpen}
        title="Finalizar venda"
        onClose={closeCheckout}
        panelClassName="relative flex max-h-[calc(100dvh-0.75rem)] w-full max-w-[min(72rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-t-[1.75rem] border border-zinc-200 bg-white text-zinc-950 shadow-2xl dark:border-zinc-800 dark:bg-[#080a0d] dark:text-zinc-50 sm:max-h-[92dvh] sm:rounded-[1.75rem] [@media(max-height:820px)]:sm:max-h-[calc(100dvh-0.75rem)]"
        headerClassName="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800/70 sm:px-7 [@media(max-height:820px)]:px-5 [@media(max-height:820px)]:py-2.5"
        titleClassName="text-2xl font-extrabold tracking-tight sm:text-3xl [@media(min-height:850px)]:sm:text-4xl [@media(max-height:820px)]:text-2xl"
        closeButtonClassName="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-300 bg-zinc-100 text-3xl leading-none text-zinc-700 shadow-inner transition hover:border-zinc-400 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 sm:h-11 sm:w-11 [@media(max-height:820px)]:h-9 [@media(max-height:820px)]:w-9 [@media(max-height:820px)]:rounded-xl"
        bodyClassName="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-7 [@media(max-height:820px)]:px-5 [@media(max-height:820px)]:py-2.5"
        footerClassName="flex flex-col-reverse gap-3 border-t border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800/80 dark:bg-[#080a0d] sm:flex-row sm:justify-between sm:px-7 [@media(max-height:820px)]:gap-2 [@media(max-height:820px)]:px-5 [@media(max-height:820px)]:py-2.5"
        footer={
          <>
            <button
              type="button"
              onClick={closeCheckout}
              className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-base font-bold text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950/70 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-900 sm:w-72 [@media(max-height:820px)]:rounded-xl [@media(max-height:820px)]:py-2.5"
            >
              <ArrowLeft className="h-6 w-6 [@media(max-height:820px)]:h-5 [@media(max-height:820px)]:w-5" />
              Voltar <span className="text-zinc-500">(F9)</span>
            </button>
            <button
              type="button"
              disabled={finalize.isPending || !canFinalize}
              onClick={() => finalize.mutate()}
              className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-emerald-500/70 bg-emerald-600 px-5 py-3 text-lg font-extrabold text-white shadow-lg shadow-emerald-200/60 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-500 dark:border-emerald-400/70 dark:shadow-emerald-950/40 dark:disabled:border-zinc-700 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500 sm:w-[26rem] [@media(max-height:820px)]:rounded-xl [@media(max-height:820px)]:py-2.5 [@media(max-height:820px)]:text-base"
            >
              {finalize.isPending ? "Processando..." : (
                <>
                  <CheckCircle2 className="h-7 w-7 [@media(max-height:820px)]:h-5 [@media(max-height:820px)]:w-5" />
                  Confirmar
                  <span className="rounded-lg bg-emerald-700/20 px-3 py-1 text-base font-black text-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-100 [@media(max-height:820px)]:px-2.5 [@media(max-height:820px)]:py-0.5 [@media(max-height:820px)]:text-sm">F6</span>
                </>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-5 text-sm [@media(max-height:820px)]:space-y-2.5">
          {/* Total */}
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-4 shadow-inner shadow-emerald-100 dark:border-emerald-400/70 dark:bg-emerald-950/30 dark:shadow-emerald-950/60 [@media(max-height:820px)]:rounded-xl [@media(max-height:820px)]:py-2.5">
            <div className="flex items-center gap-4 [@media(max-height:820px)]:gap-3">
              <div className="hidden h-14 w-14 items-center justify-center rounded-full border border-emerald-300 bg-emerald-100 text-emerald-600 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-300 sm:flex [@media(max-height:820px)]:hidden">
                <Tag className="h-8 w-8" />
              </div>
              <span className="text-xl font-extrabold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 [@media(max-height:820px)]:text-lg">Total</span>
            </div>
            <span className="text-3xl font-black tabular-nums tracking-tight text-emerald-800 dark:text-emerald-100 sm:text-5xl [@media(max-height:820px)]:text-4xl">{formatBRL(total)}</span>
          </div>

          {/* Payments added */}
          {pagamentos.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/50">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Pagamentos adicionados</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {pagamentos.map((p, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
                    <span className="text-sm font-semibold">{labelPagamento(p.formaPagamento)}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-bold tabular-nums">{formatBRL(p.valor)}</span>
                      <button type="button" onClick={() => removePagamento(i)} className="text-red-400 transition hover:text-red-300" aria-label="Remover pagamento">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="grid gap-3 lg:grid-cols-3 [@media(max-height:820px)]:gap-2">
            <CheckoutMetricCard label="Pago" value={formatBRL(totalPago)} icon={<Wallet className="h-7 w-7" />} />
            <CheckoutMetricCard
              label="Falta"
              value={formatBRL(restante)}
              icon={<AlertCircle className="h-7 w-7" />}
              tone={restante > 0 ? "warning" : "success"}
            />
            <CheckoutMetricCard label="Troco" value={formatBRL(troco)} icon={<Repeat2 className="h-7 w-7" />} tone="success" />
          </div>

          {/* Add payment */}
          {restante > 0 || pagamentos.length === 0 ? (
            <div className="space-y-3 [@media(max-height:820px)]:space-y-2">
              <div className="flex items-center gap-3 text-lg font-extrabold sm:text-xl [@media(max-height:820px)]:text-base">
                <PlusCircle className="h-7 w-7 text-emerald-600 dark:text-emerald-300 [@media(max-height:820px)]:h-5 [@media(max-height:820px)]:w-5" />
                Adicionar pagamento
              </div>
              <div className="grid gap-3 lg:grid-cols-[minmax(13rem,20rem)_1fr_minmax(12rem,16rem)] [@media(max-height:820px)]:gap-2">
                <div className="relative">
                  <CreditCard className="pointer-events-none absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-zinc-500 dark:text-zinc-200 [@media(max-height:820px)]:h-5 [@media(max-height:820px)]:w-5" />
                <select
                  value={addForma}
                  onChange={(e) => setAddForma(e.target.value as Forma)}
                  className="h-14 w-full appearance-none rounded-2xl border border-zinc-300 bg-white px-12 text-base font-semibold text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 dark:border-zinc-700 dark:bg-zinc-950/80 dark:text-zinc-50 dark:focus:border-emerald-400 sm:text-lg [@media(max-height:820px)]:h-10 [@media(max-height:820px)]:rounded-xl [@media(max-height:820px)]:text-sm"
                >
                  <option value="DINHEIRO">Dinheiro</option>
                  <option value="PIX">Pix</option>
                    <option value="CREDITO">Crédito</option>
                    <option value="DEBITO">Débito</option>
                  <option value="OUTROS">Outros</option>
                </select>
                  <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-xl text-zinc-500 dark:text-zinc-300">v</span>
                </div>
                <input
                  value={addValor}
                  onChange={(e) => setAddValor(e.target.value)}
                  placeholder="Valor"
                  inputMode="decimal"
                  className="h-14 min-w-0 rounded-2xl border border-zinc-300 bg-white px-5 text-base font-semibold text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 dark:border-zinc-700 dark:bg-zinc-950/80 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-emerald-400 sm:text-lg [@media(max-height:820px)]:h-10 [@media(max-height:820px)]:rounded-xl [@media(max-height:820px)]:text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPagamento(); } }}
                />
                <button
                  type="button"
                  onClick={addPagamento}
                  className="inline-flex h-14 items-center justify-center gap-3 rounded-2xl border border-emerald-500/60 bg-emerald-600 px-5 text-lg font-extrabold text-white shadow-lg shadow-emerald-200/60 transition hover:bg-emerald-500 dark:border-emerald-400/60 dark:shadow-emerald-950/40 [@media(max-height:820px)]:h-10 [@media(max-height:820px)]:rounded-xl [@media(max-height:820px)]:text-base"
                >
                  <span>Adicionar</span>
                  <PlusCircle className="h-6 w-6 [@media(max-height:820px)]:h-5 [@media(max-height:820px)]:w-5" />
                </button>
              </div>

              {/* Quick buttons */}
              {restante > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 [@media(max-height:820px)]:gap-2">
                  <QuickPaymentCard
                    label="Dinheiro"
                    icon={<Banknote className="h-14 w-14 text-emerald-600 dark:text-emerald-300 [@media(max-height:820px)]:h-8 [@media(max-height:820px)]:w-8" />}
                    colorClass="border-emerald-500/80 shadow-emerald-950/50 hover:border-emerald-400"
                    disabled={restante <= 0}
                    onClick={() => addPagamentoRestante("DINHEIRO")}
                  />
                  <QuickPaymentCard
                    label="Pix"
                    icon={<PixMark />}
                    colorClass="border-cyan-500/80 shadow-cyan-950/50 hover:border-cyan-400"
                    disabled={restante <= 0}
                    onClick={() => addPagamentoRestante("PIX")}
                  />
                  <QuickPaymentCard
                    label="Débito"
                    icon={<CreditCard className="h-14 w-14 text-sky-600 dark:text-sky-300 [@media(max-height:820px)]:h-8 [@media(max-height:820px)]:w-8" />}
                    colorClass="border-sky-500/80 shadow-sky-950/50 hover:border-sky-400"
                    disabled={restante <= 0}
                    onClick={() => addPagamentoRestante("DEBITO")}
                  />
                  <QuickPaymentCard
                    label="Crédito"
                    icon={<CreditCard className="h-14 w-14 text-violet-600 dark:text-violet-300 [@media(max-height:820px)]:h-8 [@media(max-height:820px)]:w-8" />}
                    colorClass="border-violet-500/80 shadow-violet-950/50 hover:border-violet-400"
                    disabled={restante <= 0}
                    onClick={() => addPagamentoRestante("CREDITO")}
                  />
                </div>
              )}
            </div>
          ) : null}

          {/* Warning if overpaid without cash */}
          {totalPago > total + 0.01 && !excedenteValido && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              Pagamento excede o total mas não há dinheiro para troco. Ajuste os valores.
            </div>
          )}
        </div>
      </Modal>

      {/* Receipt Modal */}
      <Modal
        open={!!receipt}
        title="Comprovante"
        onClose={closeReceipt}
        footer={
          <>
            <button
              type="button"
              onClick={closeReceipt}
              className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 sm:w-auto"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={() => { if (receipt) openVendaPrint(receipt.id); }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white sm:w-auto"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </button>
          </>
        }
      >
        {receipt ? (
          <div className="space-y-2 text-sm">
            <div className="text-xs text-zinc-500">Venda #{receipt.numero}</div>
            <div className="text-xs text-zinc-500">{formatDateTime(receipt.createdAt)}</div>
            <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Total</span>
                <span className="font-semibold">{formatBRL(receipt.total)}</span>
              </div>
              {receipt.pagamentos && receipt.pagamentos.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {receipt.pagamentos.map((p, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-zinc-600 dark:text-zinc-400">{labelPagamento(p.formaPagamento)}</span>
                      <span>{formatBRL(p.valor)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 flex justify-between text-xs">
                  <span className="text-zinc-600 dark:text-zinc-400">Pagamento</span>
                  <span>{labelPagamento(receipt.formaPagamento)}</span>
                </div>
              )}
              {receipt.troco > 0 && (
                <div className="mt-2 flex justify-between text-xs font-semibold">
                  <span>Troco</span>
                  <span>{formatBRL(receipt.troco)}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-zinc-500">
              A impressão abre numa nova aba. Se o navegador bloquear pop-up, permita pop-ups para este site.
            </p>
          </div>
        ) : null}
      </Modal>

      {/* Atalho flutuante — abrir/fechar caixa */}
      <div className="fixed bottom-4 left-4 z-40">
        {caixaPanelOpen ? (
          <div className="mb-2 w-56 rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-950">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Caixa</div>
            <div className="mt-1 text-sm font-semibold">
              {caixaAberto ? (
                <span className="text-emerald-700 dark:text-emerald-300">Aberto</span>
              ) : (
                <span className="text-amber-700 dark:text-amber-300">Fechado</span>
              )}
            </div>
            {caixa.data?.sessao ? (
              <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                Saldo:{" "}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {formatBRL(caixa.data.sessao.saldo)}
                </span>
              </div>
            ) : null}
            <div className="mt-3 flex flex-col gap-2">
              {!caixaAberto ? (
                <button
                  type="button"
                  onClick={openCaixaAbertura}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <Unlock className="h-4 w-4" />
                  Abrir caixa
                </button>
              ) : (
                <button
                  type="button"
                  disabled={hasCartItems}
                  onClick={() => {
                    setSaldoInformadoCaixa("");
                    setFecharCaixaOpen(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                >
                  <Lock className="h-4 w-4" />
                  Fechar caixa
                </button>
              )}
              {hasCartItems && caixaAberto ? (
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  Finalize ou cancele a venda antes de fechar o caixa.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setCaixaPanelOpen((v) => !v)}
          className={`inline-flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold shadow-lg transition hover:-translate-y-0.5 ${
            caixaAberto
              ? "border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700 dark:border-emerald-700"
              : "border-amber-300 bg-amber-500 text-white hover:bg-amber-600 dark:border-amber-700"
          }`}
          aria-expanded={caixaPanelOpen}
          aria-label={caixaAberto ? "Opções do caixa aberto" : "Abrir caixa"}
        >
          {caixaAberto ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          <span className="hidden sm:inline">{caixaAberto ? "Caixa aberto" : "Caixa fechado"}</span>
        </button>
      </div>

      <Modal
        open={abrirCaixaOpen}
        title="Abrir caixa"
        onClose={() => setAbrirCaixaOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setAbrirCaixaOpen(false)}
              className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 sm:w-auto"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={abrirCaixa.isPending}
              onClick={() => abrirCaixa.mutate()}
              className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
            >
              {abrirCaixa.isPending ? "Abrindo..." : "Confirmar abertura"}
            </button>
          </>
        }
      >
        <div>
          {caixa.data?.sugestaoAbertura ? (
            <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
              Saldo sugerido do último fechamento:{" "}
              <span className="font-semibold">{formatBRL(caixa.data.sugestaoAbertura.saldo)}</span>
            </div>
          ) : null}
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Valor inicial no caixa (R$)</label>
          <input
            value={valorInicialCaixa}
            onChange={(e) => setValorInicialCaixa(e.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            inputMode="decimal"
          />
        </div>
      </Modal>

      <Modal
        open={fecharCaixaOpen}
        title="Fechar caixa"
        onClose={() => setFecharCaixaOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setFecharCaixaOpen(false)}
              className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 sm:w-auto"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={fecharCaixa.isPending}
              onClick={() => fecharCaixa.mutate()}
              className="w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white sm:w-auto"
            >
              {fecharCaixa.isPending ? "Fechando..." : "Confirmar fechamento"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Ao fechar, você não poderá registrar novas vendas até abrir uma nova sessão.
            {caixa.data?.sessao ? (
              <>
                {" "}
                Saldo esperado:{" "}
                <span className="font-semibold">{formatBRL(caixa.data.sessao.saldo)}</span>.
              </>
            ) : null}
          </p>
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Valor contado no caixa (R$) — opcional
            </label>
            <input
              value={saldoInformadoCaixa}
              onChange={(e) => setSaldoInformadoCaixa(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              inputMode="decimal"
              placeholder="Deixe vazio para pular"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
