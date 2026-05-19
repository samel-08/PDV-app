import { NextResponse } from "next/server";
import {
  calcularSaldoSessao,
  getCaixaAberto,
  totaisMovimentacao,
} from "@/lib/caixa-service";

export async function GET() {
  const sessao = await getCaixaAberto();
  if (!sessao) {
    return NextResponse.json({ aberto: false, sessao: null });
  }
  const saldo = await calcularSaldoSessao(sessao.id);
  const { entradas, saidas } = await totaisMovimentacao(sessao.id);
  return NextResponse.json({
    aberto: true,
    sessao: {
      ...sessao,
      saldo: Math.round(saldo * 100) / 100,
      totalEntradas: Math.round(entradas * 100) / 100,
      totalSaidas: Math.round(saidas * 100) / 100,
    },
  });
}
