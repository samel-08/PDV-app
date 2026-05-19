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
  itens: {
    quantidade: number;
    precoUnitario: number;
    subtotal: number;
    produto: { nome: string; codigo: string };
  }[];
};

function labelPagamento(p: string) {
  if (p === "DINHEIRO") return "Dinheiro";
  if (p === "PIX") return "Pix";
  if (p === "CREDITO") return "Crédito";
  if (p === "DEBITO") return "Débito";
  if (p === "CARTAO") return "Cartão (legado)";
  return p;
}

export default function PrintVendaPage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const [data, setData] = useState<VendaPrint | null>(null);
  const [err, setErr] = useState("");

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

  const ready = useMemo(() => !!data && !err, [data, err]);

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
      <div className="p-6 font-sans text-sm text-red-700">
        {err}
        <p className="mt-2 text-zinc-600">Feche esta aba e tente novamente.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 font-sans text-sm text-zinc-700">
        Carregando comprovante…
      </div>
    );
  }

  return (
    <div className="print-root min-h-dvh bg-white p-6 text-zinc-900">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-root { padding: 0; }
        }
      `}</style>

      <div className="no-print mb-4 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
        A impressão deve abrir automaticamente. Se não abrir, use Ctrl+P nesta aba.
      </div>

      <h1 className="text-base font-semibold">Comprovante de venda</h1>
      <div className="mt-1 text-xs text-zinc-600">
        Nº {data.numero} · {formatDateTime(data.createdAt)}
      </div>
      <div className="mt-1 text-xs text-zinc-600">Pagamento: {labelPagamento(data.formaPagamento)}</div>

      <table className="mt-4 w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-[11px] text-zinc-500">
            <th className="py-2 pr-2">Item</th>
            <th className="py-2 pr-2 text-right">Qtd</th>
            <th className="py-2 pr-2 text-right">Unit.</th>
            <th className="py-2 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {data.itens.map((it, idx) => (
            <tr key={idx} className="border-b border-zinc-100">
              <td className="py-2 pr-2">
                <div className="font-medium">{it.produto.nome}</div>
                <div className="text-[11px] text-zinc-500">Cód. {it.produto.codigo}</div>
              </td>
              <td className="py-2 pr-2 text-right">{formatQty(it.quantidade)}</td>
              <td className="py-2 pr-2 text-right">{formatBRL(it.precoUnitario)}</td>
              <td className="py-2 text-right font-medium">{formatBRL(it.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-600">Total</span>
          <span className="font-semibold">{formatBRL(data.total)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-zinc-600">Recebido</span>
          <span>{formatBRL(data.valorRecebido)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-zinc-600">Troco</span>
          <span>{formatBRL(data.troco)}</span>
        </div>
      </div>

      <p className="mt-6 text-xs text-zinc-500">Obrigado pela preferência.</p>
    </div>
  );
}
