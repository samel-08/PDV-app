"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Tag, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import { useToast } from "@/contexts/toast-context";
import { formatBRL, labelUnidadeMedida } from "@/lib/format";
import type { UnidadeMedida } from "@/lib/validators";

type Categoria = { id: string; nome: string };

type Produto = {
  id: string;
  codigo: string;
  nome: string;
  precoCusto: number;
  precoVenda: number;
  markupPercent: number;
  unidadeMedida: string;
  categoriaId: string | null;
  categoria: Categoria | null;
  ativo: boolean;
  lucroEstimado?: number;
};

type ListResponse = {
  data: Produto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

function useDebounced<T>(value: T, delay: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return v;
}

function parseBR(raw: string): number {
  const n = Number(String(raw).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatPct(n: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(n);
}

export default function ProdutosPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 300);
  const [ativo, setAtivo] = useState<"todos" | "ativo" | "inativo">("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [page, setPage] = useState(1);

  const categoriasQ = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => {
      const r = await fetch("/api/categorias");
      if (!r.ok) throw new Error("Falha ao listar categorias");
      const j = await r.json();
      return j.data as Categoria[];
    },
  });

  const query = useQuery({
    queryKey: ["produtos", { q: dq, ativo, page, filtroCategoria }],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (dq) sp.set("q", dq);
      if (ativo !== "todos") sp.set("ativo", ativo);
      if (filtroCategoria) sp.set("categoriaId", filtroCategoria);
      sp.set("page", String(page));
      sp.set("pageSize", "10");
      const r = await fetch(`/api/produtos?${sp.toString()}`);
      if (!r.ok) throw new Error("Falha ao listar produtos");
      return r.json() as Promise<ListResponse>;
    },
  });

  useEffect(() => {
    setPage(1);
  }, [dq, ativo, filtroCategoria]);

  const [formOpen, setFormOpen] = useState(false);
  const [tab, setTab] = useState<"geral" | "precos">("geral");
  const [editing, setEditing] = useState<Produto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Produto | null>(null);

  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [unidadeMedida, setUnidadeMedida] = useState<UnidadeMedida>("UN");
  const [categoriaId, setCategoriaId] = useState("");
  const [precoCusto, setPrecoCusto] = useState("0");
  const [precoVenda, setPrecoVenda] = useState("0");
  const [markupStr, setMarkupStr] = useState("0");
  const [ativoForm, setAtivoForm] = useState(true);

  const [novaCatOpen, setNovaCatOpen] = useState(false);
  const [novaCatNome, setNovaCatNome] = useState("");

  const createCategoria = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: novaCatNome }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Erro ao criar categoria");
      return j as Categoria;
    },
    onSuccess: async (c) => {
      toast.push("success", "Categoria criada.");
      setCategoriaId(c.id);
      setNovaCatOpen(false);
      setNovaCatNome("");
      await qc.invalidateQueries({ queryKey: ["categorias"] });
    },
    onError: (e: Error) => toast.push("error", e.message),
  });

  function atualizarMarkupAPartirDaVenda(vendaStr: string) {
    const c = parseBR(precoCusto);
    const ve = parseBR(vendaStr);
    if (c > 0 && ve >= 0) {
      const mk = (ve / c - 1) * 100;
      setMarkupStr(String(roundMoney(mk)).replace(".", ","));
    }
  }

  const openCreate = () => {
    setEditing(null);
    setTab("geral");
    setNome("");
    setCodigo("");
    setUnidadeMedida("UN");
    setCategoriaId("");
    setPrecoCusto("0");
    setPrecoVenda("0");
    setMarkupStr("0");
    setAtivoForm(true);
    setFormOpen(true);
  };

  const openEdit = (p: Produto) => {
    setEditing(p);
    setTab("geral");
    setNome(p.nome);
    setCodigo(p.codigo);
    setUnidadeMedida((p.unidadeMedida as UnidadeMedida) || "UN");
    setCategoriaId(p.categoriaId ?? "");
    setPrecoCusto(String(p.precoCusto).replace(".", ","));
    setPrecoVenda(String(p.precoVenda).replace(".", ","));
    setMarkupStr(String(p.markupPercent ?? 0).replace(".", ","));
    setAtivoForm(p.ativo);
    setFormOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        nome,
        codigo,
        precoCusto: parseBR(precoCusto),
        precoVenda: parseBR(precoVenda),
        markupPercent: parseBR(markupStr),
        unidadeMedida,
        categoriaId: categoriaId ? categoriaId : null,
        ativo: ativoForm,
      };
      if (editing) {
        const r = await fetch(`/api/produtos/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "Erro ao atualizar");
        return j;
      }
      const r = await fetch("/api/produtos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Erro ao cadastrar");
      return j;
    },
    onSuccess: async () => {
      toast.push("success", editing ? "Produto atualizado." : "Produto cadastrado.");
      setFormOpen(false);
      await qc.invalidateQueries({ queryKey: ["produtos"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.push("error", e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/produtos/${id}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Erro ao excluir");
    },
    onSuccess: async () => {
      toast.push("success", "Produto excluído.");
      setDeleteTarget(null);
      await qc.invalidateQueries({ queryKey: ["produtos"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.push("error", e.message),
  });

  const rows = query.data?.data ?? [];
  const totalPages = query.data?.totalPages ?? 1;
  const categorias = categoriasQ.data ?? [];

  const filters = useMemo(
    () => (
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full lg:max-w-md">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Pesquisar</label>
          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nome, código ou categoria..."
              className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none ring-emerald-600/30 focus:ring-4 dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Categoria</label>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="mt-1 min-w-[10rem] rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="">Todas</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Situação</label>
            <select
              value={ativo}
              onChange={(e) => setAtivo(e.target.value as typeof ativo)}
              className="mt-1 w-44 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <option value="todos">Todos</option>
              <option value="ativo">Ativos</option>
              <option value="inativo">Inativos</option>
            </select>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Novo produto
          </button>
        </div>
      </div>
    ),
    [q, ativo, filtroCategoria, categorias]
  );

  const colSpan = 10;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Unidade de medida, categoria, markup e preços — categorias ficam salvas para reutilizar.
          </p>
        </div>
      </div>

      {filters}

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-3">Código</th>
                <th className="px-3 py-3">Nome</th>
                <th className="px-3 py-3">Categoria</th>
                <th className="px-3 py-3">Un.</th>
                <th className="px-3 py-3">Custo</th>
                <th className="px-3 py-3">Venda</th>
                <th className="px-3 py-3">Markup</th>
                <th className="px-3 py-3">Lucro est.</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {query.isError ? (
                <tr>
                  <td className="px-4 py-6 text-red-700 dark:text-red-300" colSpan={colSpan}>
                    Não foi possível carregar a lista.
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-zinc-600 dark:text-zinc-400" colSpan={colSpan}>
                    Nenhum produto encontrado.
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                    <td className="px-3 py-3 font-mono text-xs">{p.codigo}</td>
                    <td className="px-3 py-3 font-medium">{p.nome}</td>
                    <td className="px-3 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                      {p.categoria?.nome ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-xs">{labelUnidadeMedida(p.unidadeMedida)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatBRL(p.precoCusto)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatBRL(p.precoVenda)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatPct(p.markupPercent)}%</td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {formatBRL(p.lucroEstimado ?? (p.precoVenda - p.precoCusto))}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={
                          p.ativo
                            ? "rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                            : "rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                        }
                      >
                        {p.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(p)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30"
                          aria-label="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
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
        open={formOpen}
        title={editing ? "Editar produto" : "Novo produto"}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 sm:w-auto"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
            >
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </button>
          </>
        }
      >
        <div className="flex gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setTab("geral")}
            className={
              tab === "geral"
                ? "rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                : "rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }
          >
            Dados gerais
          </button>
          <button
            type="button"
            onClick={() => setTab("precos")}
            className={
              tab === "precos"
                ? "rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                : "rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }
          >
            Preços e markup
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          {tab === "geral" ? (
            <>
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Nome</label>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Código</label>
                <input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  disabled={!!editing}
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950"
                />
                {editing ? (
                  <p className="mt-1 text-xs text-zinc-500">O código não pode ser alterado.</p>
                ) : null}
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Unidade de medida</label>
                <select
                  value={unidadeMedida}
                  onChange={(e) => setUnidadeMedida(e.target.value as UnidadeMedida)}
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <option value="KG">Kg</option>
                  <option value="UN">Un (unidade)</option>
                  <option value="CX">Cx (caixa)</option>
                  <option value="G">g (grama)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Categoria</label>
                <div className="mt-1 flex gap-2">
                  <select
                    value={categoriaId}
                    onChange={(e) => setCategoriaId(e.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <option value="">Sem categoria</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setNovaCatOpen(true)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  >
                    <Tag className="h-3.5 w-3.5" />
                    Nova
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={ativoForm} onChange={(e) => setAtivoForm(e.target.checked)} />
                Produto ativo
              </label>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Preço de custo (R$)</label>
                <input
                  value={precoCusto}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPrecoCusto(v);
                    const c = parseBR(v);
                    const m = parseBR(markupStr);
                    if (c > 0 && Number.isFinite(m)) {
                      setPrecoVenda(String(roundMoney(c * (1 + m / 100))).replace(".", ","));
                    }
                  }}
                  inputMode="decimal"
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Markup sobre o custo (%)</label>
                <input
                  value={markupStr}
                  onChange={(e) => {
                    setMarkupStr(e.target.value);
                    const c = parseBR(precoCusto);
                    const m = parseBR(e.target.value);
                    if (c > 0 && Number.isFinite(m)) {
                      setPrecoVenda(String(roundMoney(c * (1 + m / 100))).replace(".", ","));
                    }
                  }}
                  inputMode="decimal"
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                />
                <p className="mt-1 text-xs text-zinc-500">
                  Altere o markup para recalcular o preço de venda a partir do custo, ou ajuste o preço de venda abaixo
                  para atualizar o markup.
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Preço de venda (R$)</label>
                <input
                  value={precoVenda}
                  onChange={(e) => {
                    setPrecoVenda(e.target.value);
                    atualizarMarkupAPartirDaVenda(e.target.value);
                  }}
                  inputMode="decimal"
                  className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                />
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300">
                Lucro estimado por unidade:{" "}
                <span className="font-semibold">
                  {formatBRL(Math.max(0, roundMoney(parseBR(precoVenda) - parseBR(precoCusto))))}
                </span>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        open={novaCatOpen}
        title="Nova categoria"
        onClose={() => setNovaCatOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setNovaCatOpen(false)}
              className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 sm:w-auto"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!novaCatNome.trim() || createCategoria.isPending}
              onClick={() => createCategoria.mutate()}
              className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 sm:w-auto"
            >
              {createCategoria.isPending ? "Salvando..." : "Criar"}
            </button>
          </>
        }
      >
        <div>
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Nome da categoria</label>
          <input
            value={novaCatNome}
            onChange={(e) => setNovaCatNome(e.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            placeholder="Ex.: Mercearia"
          />
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        title="Excluir produto?"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="w-full rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 sm:w-auto"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="w-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 sm:w-auto"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </button>
          </>
        }
      >
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Tem certeza que deseja excluir <span className="font-semibold">{deleteTarget?.nome}</span>? Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </div>
  );
}
