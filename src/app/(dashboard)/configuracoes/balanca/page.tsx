"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ConfigBalancaDTO } from "@/lib/balanca-types";
import { useToast } from "@/contexts/toast-context";

export default function ConfigBalancaPage() {
  const qc = useQueryClient();
  const toast = useToast();

  const q = useQuery({
    queryKey: ["config-balanca"],
    queryFn: async () => {
      const r = await fetch("/api/config/balanca");
      if (!r.ok) throw new Error("Falha ao carregar configurações");
      return r.json() as Promise<ConfigBalancaDTO>;
    },
  });

  const [form, setForm] = useState<ConfigBalancaDTO | null>(null);

  useEffect(() => {
    if (q.data) setForm(q.data);
  }, [q.data]);

  const maxCasas = useMemo(() => (form?.contemTipo === "VALOR" ? 2 : 3), [form?.contemTipo]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const r = await fetch("/api/config/balanca", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tamanhoCodigoBarras: form.tamanhoCodigoBarras,
          prefixoIdentificacao: form.prefixoIdentificacao,
          codigoProdutoInicio: form.codigoProdutoInicio,
          codigoProdutoFim: form.codigoProdutoFim,
          pesoValorInicio: form.pesoValorInicio,
          pesoValorFim: form.pesoValorFim,
          contemTipo: form.contemTipo,
          casasDecimais: Math.min(form.casasDecimais, maxCasas),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Erro ao salvar");
      return j as ConfigBalancaDTO;
    },
    onSuccess: async (cfg) => {
      toast.push("success", "Configurações da balança salvas.");
      if (cfg) setForm(cfg);
      await qc.invalidateQueries({ queryKey: ["config-balanca"] });
    },
    onError: (e: Error) => toast.push("error", e.message),
  });

  if (q.isLoading || !form) {
    return <div className="text-sm text-zinc-600 dark:text-zinc-400">Carregando…</div>;
  }

  return (
    <div className="space-y-4">
      <Link
        href="/configuracoes"
        className="inline-block text-sm font-semibold text-emerald-700 underline dark:text-emerald-300"
      >
        ← Voltar para configurações
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Balança e código de barras</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Configure como o PDV interpreta o código numérico impresso pela balança. As posições são contadas a partir do{" "}
          <span className="font-semibold">1º dígito</span> (inclusive).
        </p>
      </div>

      <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 lg:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Tamanho total do código de barras</label>
          <input
            type="number"
            min={4}
            max={64}
            value={form.tamanhoCodigoBarras}
            onChange={(e) => setForm({ ...form, tamanhoCodigoBarras: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Número / prefixo inicial (identifica etiqueta da balança)
          </label>
          <input
            value={form.prefixoIdentificacao}
            onChange={(e) => setForm({ ...form, prefixoIdentificacao: e.target.value.replace(/\D/g, "") })}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            placeholder="Ex.: 2 (deixe vazio para não validar)"
          />
          <p className="mt-1 text-xs text-zinc-500">Somente dígitos. Se preenchido, o código precisa começar com esse prefixo.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Código do produto — início</label>
            <input
              type="number"
              min={1}
              value={form.codigoProdutoInicio}
              onChange={(e) => setForm({ ...form, codigoProdutoInicio: Number(e.target.value) })}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Código do produto — fim</label>
            <input
              type="number"
              min={1}
              value={form.codigoProdutoFim}
              onChange={(e) => setForm({ ...form, codigoProdutoFim: Number(e.target.value) })}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Peso ou valor — início</label>
            <input
              type="number"
              min={1}
              value={form.pesoValorInicio}
              onChange={(e) => setForm({ ...form, pesoValorInicio: Number(e.target.value) })}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Peso ou valor — fim</label>
            <input
              type="number"
              min={1}
              value={form.pesoValorFim}
              onChange={(e) => setForm({ ...form, pesoValorFim: Number(e.target.value) })}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="text-sm font-semibold">O código de barras contém o peso ou valor do produto?</div>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="tipo"
                checked={form.contemTipo === "PESO"}
                onChange={() => setForm({ ...form, contemTipo: "PESO", casasDecimais: Math.min(form.casasDecimais, 3) })}
              />
              Peso (até 3 casas decimais)
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="tipo"
                checked={form.contemTipo === "VALOR"}
                onChange={() => setForm({ ...form, contemTipo: "VALOR", casasDecimais: Math.min(form.casasDecimais, 2) })}
              />
              Valor em R$ (até 2 casas decimais)
            </label>
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            <span className="font-semibold">Peso:</span> a quantidade na venda será o peso (ex.: kg).{" "}
            <span className="font-semibold">Valor:</span> a quantidade será calculada como valor lido ÷ preço de venda do produto.
          </p>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Casas decimais do trecho peso/valor</label>
          <select
            value={Math.min(form.casasDecimais, maxCasas)}
            onChange={(e) => setForm({ ...form, casasDecimais: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            {(form.contemTipo === "VALOR" ? [0, 1, 2] : [0, 1, 2, 3]).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        disabled={save.isPending}
        onClick={() => save.mutate()}
        className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {save.isPending ? "Salvando..." : "Salvar configurações"}
      </button>
    </div>
  );
}
