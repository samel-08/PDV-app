"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronRight, Scale } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/contexts/toast-context";

type EmpresaConfig = {
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  inscricaoEstadual: string;
  telefoneWhatsApp: string;
  enderecoCompleto: string;
  cidade: string;
  estado: string;
  cep: string;
  mensagemRodapeCupom: string;
  observacaoCupom: string;
};

type ConfigSistema = {
  id: string;
  permitirEstoqueNegativo: boolean;
} & Record<keyof EmpresaConfig, string | null>;

const empresaVazia: EmpresaConfig = {
  nomeFantasia: "",
  razaoSocial: "",
  cnpj: "",
  inscricaoEstadual: "",
  telefoneWhatsApp: "",
  enderecoCompleto: "",
  cidade: "",
  estado: "",
  cep: "",
  mensagemRodapeCupom: "",
  observacaoCupom: "",
};

const inputClass =
  "mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-950";
const labelClass = "text-xs font-medium text-zinc-600 dark:text-zinc-400";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCnpj(value: string) {
  const digits = onlyDigits(value).slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function formatCep(value: string) {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatTelefone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;

  const ddd = digits.slice(0, 2);
  const numero = digits.slice(2);
  if (digits.length <= 10) {
    if (numero.length <= 4) return `(${ddd}) ${numero}`;
    return `(${ddd}) ${numero.slice(0, 4)}-${numero.slice(4)}`;
  }

  if (numero.length <= 5) return `(${ddd}) ${numero}`;
  return `(${ddd}) ${numero.slice(0, 5)}-${numero.slice(5)}`;
}

function normalizarEmpresa(data: ConfigSistema): EmpresaConfig {
  return {
    nomeFantasia: data.nomeFantasia ?? "",
    razaoSocial: data.razaoSocial ?? "",
    cnpj: data.cnpj ? formatCnpj(data.cnpj) : "",
    inscricaoEstadual: data.inscricaoEstadual ?? "",
    telefoneWhatsApp: data.telefoneWhatsApp ? formatTelefone(data.telefoneWhatsApp) : "",
    enderecoCompleto: data.enderecoCompleto ?? "",
    cidade: data.cidade ?? "",
    estado: (data.estado ?? "").toUpperCase().slice(0, 2),
    cep: data.cep ? formatCep(data.cep) : "",
    mensagemRodapeCupom: data.mensagemRodapeCupom ?? "",
    observacaoCupom: data.observacaoCupom ?? "",
  };
}

export default function ConfiguracoesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [permitirEstoqueNegativo, setPermitirEstoqueNegativo] = useState(false);
  const [empresa, setEmpresa] = useState<EmpresaConfig>(empresaVazia);

  const setEmpresaCampo = (campo: keyof EmpresaConfig, valor: string) => {
    let proximo = valor;
    if (campo === "cnpj") proximo = formatCnpj(valor);
    if (campo === "cep") proximo = formatCep(valor);
    if (campo === "telefoneWhatsApp") proximo = formatTelefone(valor);
    if (campo === "estado") proximo = valor.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
    setEmpresa((atual) => ({ ...atual, [campo]: proximo }));
  };

  const query = useQuery({
    queryKey: ["config-sistema"],
    queryFn: async () => {
      const r = await fetch("/api/config/sistema");
      if (!r.ok) throw new Error("Falha ao carregar configurações.");
      const data = (await r.json()) as ConfigSistema;
      setPermitirEstoqueNegativo(data.permitirEstoqueNegativo);
      setEmpresa(normalizarEmpresa(data));
      return data;
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/config/sistema", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permitirEstoqueNegativo, ...empresa }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? "Erro ao salvar configuração.");
      return data as ConfigSistema;
    },
    onSuccess: async (data) => {
      setEmpresa(normalizarEmpresa(data));
      setPermitirEstoqueNegativo(data.permitirEstoqueNegativo);
      toast.push("success", "Configuração salva.");
      await qc.invalidateQueries({ queryKey: ["config-sistema"] });
    },
    onError: (e: Error) => toast.push("error", e.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Ajustes gerais do sistema e do PDV.</p>
      </div>

      <Link
        href="/configuracoes/balanca"
        className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/30 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
          <Scale className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Balança e código de barras</div>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
            Tamanho do código, posições do produto e interpretação de peso/valor no PDV.
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-zinc-400" />
      </Link>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-sm font-semibold">Dados da empresa</div>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          Essas informações aparecem automaticamente no cupom de venda.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label className={labelClass}>Nome fantasia</label>
            <input
              value={empresa.nomeFantasia}
              onChange={(e) => setEmpresaCampo("nomeFantasia", e.target.value)}
              className={inputClass}
              maxLength={120}
            />
          </div>
          <div>
            <label className={labelClass}>Razão social</label>
            <input
              value={empresa.razaoSocial}
              onChange={(e) => setEmpresaCampo("razaoSocial", e.target.value)}
              className={inputClass}
              maxLength={160}
            />
          </div>
          <div>
            <label className={labelClass}>CNPJ</label>
            <input
              value={empresa.cnpj}
              onChange={(e) => setEmpresaCampo("cnpj", e.target.value)}
              className={inputClass}
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
            />
          </div>
          <div>
            <label className={labelClass}>Inscrição estadual</label>
            <input
              value={empresa.inscricaoEstadual}
              onChange={(e) => setEmpresaCampo("inscricaoEstadual", e.target.value)}
              className={inputClass}
              maxLength={40}
            />
          </div>
          <div>
            <label className={labelClass}>Telefone/WhatsApp</label>
            <input
              value={empresa.telefoneWhatsApp}
              onChange={(e) => setEmpresaCampo("telefoneWhatsApp", e.target.value)}
              className={inputClass}
              inputMode="tel"
              placeholder="(00) 00000-0000"
            />
          </div>
          <div>
            <label className={labelClass}>CEP</label>
            <input
              value={empresa.cep}
              onChange={(e) => setEmpresaCampo("cep", e.target.value)}
              className={inputClass}
              inputMode="numeric"
              placeholder="00000-000"
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Endereço completo</label>
            <textarea
              value={empresa.enderecoCompleto}
              onChange={(e) => setEmpresaCampo("enderecoCompleto", e.target.value)}
              className={inputClass}
              rows={2}
              maxLength={240}
            />
          </div>
          <div>
            <label className={labelClass}>Cidade</label>
            <input
              value={empresa.cidade}
              onChange={(e) => setEmpresaCampo("cidade", e.target.value)}
              className={inputClass}
              maxLength={80}
            />
          </div>
          <div>
            <label className={labelClass}>Estado</label>
            <input
              value={empresa.estado}
              onChange={(e) => setEmpresaCampo("estado", e.target.value)}
              className={inputClass}
              maxLength={2}
              placeholder="UF"
            />
          </div>
          <div>
            <label className={labelClass}>Mensagem de rodapé do cupom</label>
            <input
              value={empresa.mensagemRodapeCupom}
              onChange={(e) => setEmpresaCampo("mensagemRodapeCupom", e.target.value)}
              className={inputClass}
              maxLength={180}
              placeholder="Obrigado pela preferência!"
            />
          </div>
          <div>
            <label className={labelClass}>Observação opcional</label>
            <input
              value={empresa.observacaoCupom}
              onChange={(e) => setEmpresaCampo("observacaoCupom", e.target.value)}
              className={inputClass}
              maxLength={180}
              placeholder="Volte sempre"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-sm font-semibold">Estoque</div>
        <label className="mt-4 flex items-start gap-3 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          <input
            type="checkbox"
            checked={permitirEstoqueNegativo}
            onChange={(e) => setPermitirEstoqueNegativo(e.target.checked)}
            className="mt-1 accent-emerald-600"
          />
          <span>
            <span className="block font-medium">Permitir estoque negativo</span>
            <span className="mt-1 block text-xs text-zinc-600 dark:text-zinc-400">
              Desligado por padrão. Quando desligado, vendas e saídas manuais sem saldo suficiente são bloqueadas.
            </span>
          </span>
        </label>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={query.isLoading || salvar.isPending}
          onClick={() => salvar.mutate()}
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {salvar.isPending ? "Salvando..." : "Salvar configuração"}
        </button>
      </div>
    </div>
  );
}
