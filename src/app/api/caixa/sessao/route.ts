import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  calcularSaldoSessao,
  getCaixaAberto,
  totaisMovimentacao,
} from "@/lib/caixa-service";

function roundMoney(v: number) {
  return Math.round(v * 100) / 100;
}

export async function GET() {
  const sessao = await getCaixaAberto();
  if (!sessao) {
    const ultimoFechado = await prisma.caixaSessao.findFirst({
      where: { status: "FECHADO" },
      orderBy: [{ fechadoEm: "desc" }, { abertoEm: "desc" }],
      select: {
        id: true,
        fechadoEm: true,
        saldoFinalEsperado: true,
        saldoFinalInformado: true,
      },
    });

    if (!ultimoFechado) {
      return NextResponse.json({ aberto: false, sessao: null, sugestaoAbertura: null });
    }

    const saldoBase =
      ultimoFechado.saldoFinalInformado ??
      ultimoFechado.saldoFinalEsperado ??
      (await calcularSaldoSessao(ultimoFechado.id));

    return NextResponse.json({
      aberto: false,
      sessao: null,
      sugestaoAbertura: {
        saldo: roundMoney(saldoBase),
        fechadoEm: ultimoFechado.fechadoEm,
      },
    });
  }
  const saldo = await calcularSaldoSessao(sessao.id);
  const { entradas, saidas } = await totaisMovimentacao(sessao.id);
  return NextResponse.json({
    aberto: true,
    sugestaoAbertura: null,
    sessao: {
      ...sessao,
      saldo: roundMoney(saldo),
      totalEntradas: roundMoney(entradas),
      totalSaidas: roundMoney(saidas),
    },
  });
}
