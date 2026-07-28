"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { formatBRL, formatDateTime, formatQty } from "@/lib/format";

type VendaPrint = {
  id: string;
  numero: number;
  total: number;
  formaPagamento: string;
  valorRecebido: number;
  troco: number;
  createdAt: string;
  pagamentos: { formaPagamento: string; valor: number }[];
  itens: {
    quantidade: number;
    precoUnitario: number;
    subtotal: number;
    produto: { nome: string; codigo: string };
  }[];
};

type ConfigEmpresa = {
  nomeFantasia: string | null;
  razaoSocial: string | null;
  cnpj: string | null;
  inscricaoEstadual: string | null;
  telefoneWhatsApp: string | null;
  enderecoCompleto: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  mensagemRodapeCupom: string | null;
  observacaoCupom: string | null;
};

function labelPagamento(p: string) {
  if (p === "DINHEIRO") return "Dinheiro";
  if (p === "PIX") return "Pix";
  if (p === "OUTROS") return "Outros";
  if (p === "MULTIPLO") return "Multiplo";
  if (p === "CREDITO") return "Crédito";
  if (p === "DEBITO") return "Débito";
  if (p === "CARTAO") return "Cartão (legado)";
  return p;
}

function texto(value: string | null | undefined) {
  const limpo = value?.trim();
  return limpo || null;
}

function montarCidadeUfCep(config: ConfigEmpresa | null) {
  const cidade = texto(config?.cidade);
  const estado = texto(config?.estado);
  const cep = texto(config?.cep);
  const cidadeUf = [cidade, estado].filter(Boolean).join(" - ");
  return [cidadeUf, cep].filter(Boolean).join(" / ") || null;
}

export default function PrintVendaPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const [data, setData] = useState<VendaPrint | null>(null);
  const [config, setConfig] = useState<ConfigEmpresa | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/config/sistema", { credentials: "include" });
        if (r.ok) {
          const j = await r.json().catch(() => null);
          if (!cancelled) setConfig(j as ConfigEmpresa | null);
        }
      } finally {
        if (!cancelled) setConfigLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/vendas/${id}`, { credentials: "include" });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          if (!cancelled) setErr(j.error ?? "Não foi possível carregar a venda.");
          return;
        }
        if (!cancelled) setData(j as VendaPrint);
      } catch {
        if (!cancelled) setErr("Erro de rede ao carregar a venda.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const ready = useMemo(() => !!data && configLoaded && !err, [data, configLoaded, err]);

  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => {
      window.focus();
      window.print();
    }, 350);
    return () => window.clearTimeout(t);
  }, [ready]);

  if (err) {
    return (
      <div className="no-print p-6 font-sans text-sm text-red-700">
        {err}
        <p className="mt-2 text-zinc-600">Feche esta aba e tente novamente.</p>
      </div>
    );
  }

  if (!data || !configLoaded) {
    return (
      <div className="no-print p-6 font-sans text-sm text-zinc-700">
        Carregando comprovante...
      </div>
    );
  }

  const nomeFantasia = texto(config?.nomeFantasia);
  const razaoSocial = texto(config?.razaoSocial);
  const cnpj = texto(config?.cnpj);
  const inscricaoEstadual = texto(config?.inscricaoEstadual);
  const telefoneWhatsApp = texto(config?.telefoneWhatsApp);
  const enderecoCompleto = texto(config?.enderecoCompleto);
  const cidadeUfCep = montarCidadeUfCep(config);
  const mensagemRodapeCupom = texto(config?.mensagemRodapeCupom);
  const observacaoCupom = texto(config?.observacaoCupom);
  const temDadosEmpresa =
    nomeFantasia || razaoSocial || cnpj || inscricaoEstadual || enderecoCompleto || cidadeUfCep || telefoneWhatsApp;
  const temRodape = mensagemRodapeCupom || observacaoCupom;

  const pagamentoLinha =
    data.pagamentos.length > 0
      ? data.pagamentos.map((p) => `${labelPagamento(p.formaPagamento)} ${formatBRL(p.valor)}`).join(" + ")
      : labelPagamento(data.formaPagamento);

  return (
    <>
      <div className="no-print mx-auto mb-4 max-w-[80mm] rounded border border-zinc-300 bg-zinc-100 px-3 py-2 text-center text-xs text-zinc-600">
        A impressão abre automaticamente. Se não abrir, use Ctrl+P nesta aba.
      </div>

      <div id="cupom-impressao" className="cupom-thermal">
        {nomeFantasia ? <p className="cupom-loja">{nomeFantasia}</p> : null}
        {razaoSocial ? <p className="cupom-meta">{razaoSocial}</p> : null}
        {cnpj ? <p className="cupom-meta">CNPJ: {cnpj}</p> : null}
        {inscricaoEstadual ? <p className="cupom-meta">IE: {inscricaoEstadual}</p> : null}
        {enderecoCompleto ? <p className="cupom-meta">{enderecoCompleto}</p> : null}
        {cidadeUfCep ? <p className="cupom-meta">{cidadeUfCep}</p> : null}
        {telefoneWhatsApp ? <p className="cupom-meta">Tel/WhatsApp: {telefoneWhatsApp}</p> : null}

        {temDadosEmpresa ? <div className="cupom-linha" /> : null}

        <p className="cupom-titulo">COMPROVANTE DE VENDA</p>
        <p className="cupom-meta">
          Nº {data.numero} · {formatDateTime(data.createdAt)}
        </p>
        <p className="cupom-meta">Pagamento: {pagamentoLinha}</p>

        <div className="cupom-linha" />

        <table>
          <thead>
            <tr>
              <th style={{ textAlign: "left", width: "42%" }}>Item</th>
              <th style={{ textAlign: "right", width: "14%" }}>Qtd</th>
              <th style={{ textAlign: "right", width: "22%" }}>Unit.</th>
              <th style={{ textAlign: "right", width: "22%" }}>Subt.</th>
            </tr>
          </thead>
          <tbody>
            {data.itens.map((it, idx) => (
              <tr key={idx}>
                <td>
                  <div>{it.produto.nome}</div>
                  <div style={{ fontSize: "9px", color: "#555" }}>Cód. {it.produto.codigo}</div>
                </td>
                <td style={{ textAlign: "right" }}>{formatQty(it.quantidade)}</td>
                <td style={{ textAlign: "right" }}>{formatBRL(it.precoUnitario)}</td>
                <td style={{ textAlign: "right" }}>{formatBRL(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="cupom-linha" />

        <div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>TOTAL</span>
            <span className="cupom-total">{formatBRL(data.total)}</span>
          </div>
          {data.pagamentos.length > 0 ? (
            data.pagamentos.map((p, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
                <span>{labelPagamento(p.formaPagamento)}</span>
                <span>{formatBRL(p.valor)}</span>
              </div>
            ))
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
              <span>Pagamento</span>
              <span>{labelPagamento(data.formaPagamento)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
            <span>Recebido</span>
            <span>{formatBRL(data.valorRecebido)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px" }}>
            <span>Troco</span>
            <span>{formatBRL(data.troco)}</span>
          </div>
        </div>

        {temRodape ? <div className="cupom-linha" /> : null}
        {mensagemRodapeCupom ? <p className="cupom-rodape">{mensagemRodapeCupom}</p> : null}
        {observacaoCupom ? <p className="cupom-rodape">{observacaoCupom}</p> : null}
      </div>
    </>
  );
}
