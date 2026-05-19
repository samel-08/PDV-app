"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Printer, Search, ShoppingBag, Trash2 } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Modal } from "@/components/modal";
import { useToast } from "@/contexts/toast-context";
import type { ConfigBalancaDTO } from "@/lib/balanca-types";
import { formatBRL, formatDateTime, formatQty, labelUnidadeMedida } from "@/lib/format";

type Produto = {
  id: string;
  codigo: string;
  nome: string;
  precoVenda: number;
  unidadeMedida?: string;
  ativo: boolean;
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
};

type Forma = "DINHEIRO" | "PIX" | "CREDITO" | "DEBITO";
type SearchFlash = "ok" | "err" | null;

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
  if (p === "CARTAO") return "Cartão (legado)";
  return p;
}

function parseQtyInput(raw: string): number {
  const n = Number(String(raw).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function stepForQty(qty: number): number {
  return Math.abs(qty - Math.round(qty)) < 1e-6 ? 1 : 0.001;
}

function ShortcutKey({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100">
      {children}
    </kbd>
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
  const [forma, setForma] = useState<Forma>("DINHEIRO");
  const [valorRecebido, setValorRecebido] = useState("");

  const [receipt, setReceipt] = useState<VendaFull | null>(null);
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

  const interpretar = useMutation({
    mutationFn: async (codigoBarras: string) => {
      const r = await fetch("/api/pdv/interpretar-codigo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigoBarras }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Código inválido.");
      return j as { produto: Produto; quantidade: number };
    },
    onSuccess: (data, codigoBarras) => {
      lastInterpreted.current = codigoBarras;
      addToCartQty(data.produto, data.quantidade, false);
      setQ("");
      setLastAddedName(data.produto.nome);
      flashSearch("ok");
      focusSearch();
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
      interpretar.mutate(dq);
    }, 200);
    return () => window.clearTimeout(t);
  }, [dq, balancaCfg.data, caixa.data?.aberto]);

  const total = useMemo(
    () => Math.round(cart.reduce((a, l) => a + l.precoVenda * l.quantidade, 0) * 100) / 100,
    [cart]
  );

  useEffect(() => {
    if (forma === "DINHEIRO") return;
    setValorRecebido(total ? String(total).replace(".", ",") : "");
  }, [forma, total]);

  const troco = useMemo(() => {
    if (forma !== "DINHEIRO") return 0;
    const vr = Number(String(valorRecebido).replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(vr)) return 0;
    return Math.max(0, Math.round((vr - total) * 100) / 100);
  }, [forma, valorRecebido, total]);

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
    const clamped = Math.max(0.001, Math.round(qn * 1000) / 1000);
    setCart((prev) => prev.map((l) => (l.produtoId === produtoId ? { ...l, quantidade: clamped } : l)));
  }

  function inc(produtoId: string, deltaDir: 1 | -1) {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.produtoId !== produtoId) return l;
          const step = stepForQty(l.quantidade);
          const next = Math.round((l.quantidade + deltaDir * step) * 1000) / 1000;
          return { ...l, quantidade: Math.max(0.001, next) };
        })
        .filter((l) => l.quantidade > 0)
    );
  }

  const remove = useCallback((produtoId: string) => {
    setCart((prev) => prev.filter((l) => l.produtoId !== produtoId));
  }, []);

  const finalize = useMutation({
    mutationFn: async () => {
      const vr =
        forma === "DINHEIRO"
          ? Number(String(valorRecebido).replace(/\./g, "").replace(",", "."))
          : total;
      const r = await fetch("/api/vendas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itens: cart.map((l) => ({ produtoId: l.produtoId, quantidade: l.quantidade })),
          formaPagamento: forma,
          valorRecebido: vr,
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
      setValorRecebido("");
      setLastAddedName(null);
      setReceipt(venda);
      focusSearch();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
        qc.invalidateQueries({ queryKey: ["vendas"] }),
        qc.invalidateQueries({ queryKey: ["caixa-sessao"] }),
        qc.invalidateQueries({ queryKey: ["caixa-movs"] }),
      ]);
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
        const el = document.activeElement;
        const editingMoney =
          el instanceof HTMLInputElement && el.getAttribute("data-pdv-valor-recebido") != null;
        if (checkoutOpen) {
          if (editingMoney) return;
          if (total > 0 && !finalize.isPending) finalize.mutate();
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
          setLastAddedName(null);
          toast.push("success", "Venda cancelada (carrinho limpo).");
          focusSearch();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    caixaAberto,
    cart.length,
    checkoutOpen,
    receipt,
    total,
    finalize,
    toast,
    focusSearch,
    q,
  ]);

  function openPrint(vendaId: string) {
    const url = `${window.location.origin}/print/venda/${vendaId}`;
    window.open(url, "_blank", "noopener=yes,noreferrer=yes");
  }

  function closeCheckout() {
    setCheckoutOpen(false);
    focusSearch();
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
          Abra o caixa em <span className="font-semibold">Controle de caixa</span> antes de registrar vendas.
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
                placeholder="Nome, código ou código da balança…"
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
                  {interpretar.isPending
                    ? "Interpretando código da balança…"
                    : `Código numérico (${dq.length} dígitos). Aguarde o reconhecimento automático.`}
                </div>
              ) : busca.isLoading ? (
                <div className="text-sm text-zinc-600 dark:text-zinc-400">Buscando…</div>
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
                Carrinho vazio — busque um produto acima.
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
              onClick={() => setCheckoutOpen(true)}
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

      <Modal
        open={checkoutOpen}
        title="Finalizar venda"
        onClose={closeCheckout}
        footer={
          <>
            <button
              type="button"
              onClick={closeCheckout}
              className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 sm:w-auto"
            >
              Voltar <span className="text-zinc-400">(F9)</span>
            </button>
            <button
              type="button"
              disabled={finalize.isPending || total <= 0}
              onClick={() => finalize.mutate()}
              className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
            >
              {finalize.isPending ? "Processando…" : (
                <>
                  Confirmar <ShortcutKey>F6</ShortcutKey>
                </>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <div className="flex flex-col gap-1 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/30 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-900/70 dark:text-emerald-200/80">
              Total
            </span>
            <span className="text-2xl font-extrabold tabular-nums tracking-tight text-emerald-900 dark:text-emerald-100">
              {formatBRL(total)}
            </span>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Forma de pagamento</label>
            <select
              value={forma}
              onChange={(e) => setForma(e.target.value as Forma)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="DINHEIRO">Dinheiro</option>
              <option value="PIX">Pix</option>
              <option value="CREDITO">Crédito</option>
              <option value="DEBITO">Débito</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Valor recebido (R$)</label>
            <input
              data-pdv-valor-recebido
              value={valorRecebido}
              onChange={(e) => setValorRecebido(e.target.value)}
              disabled={forma !== "DINHEIRO"}
              inputMode="decimal"
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950"
            />
            {forma === "DINHEIRO" ? (
              <div className="mt-2 text-sm">
                Troco: <span className="font-semibold">{formatBRL(troco)}</span>
              </div>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">
                Para Pix, crédito ou débito, o valor recebido deve ser igual ao total.
              </p>
            )}
          </div>
        </div>
      </Modal>

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
              onClick={() => {
                if (receipt) openPrint(receipt.id);
              }}
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
              <div className="mt-2 flex justify-between text-xs">
                <span className="text-zinc-600 dark:text-zinc-400">Pagamento</span>
                <span>{labelPagamento(receipt.formaPagamento)}</span>
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              A impressão abre numa nova aba. Se o navegador bloquear pop-up, permita pop-ups para este site.
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
