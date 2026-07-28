import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MOV_TIPO, getCaixaAberto, calcularSaldoSessao } from "@/lib/caixa-service";
import { calcularRelatorioCaixa } from "@/lib/caixa-relatorio";
import { caixaFecharSchema } from "@/lib/validators";

export async function POST(req: Request) {
  const sessao = await getCaixaAberto();
  if (!sessao) {
    return NextResponse.json({ error: "Nao ha caixa aberto." }, { status: 400 });
  }

  let saldoInformado: number | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = caixaFecharSchema.parse(body);
    saldoInformado = parsed.saldoInformado ?? null;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Dados invalidos para fechar caixa.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const saldoEsperado = Math.round((await calcularSaldoSessao(sessao.id)) * 100) / 100;
  const diferenca =
    saldoInformado !== null ? Math.round((saldoInformado - saldoEsperado) * 100) / 100 : null;
  const fechadoEm = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.movimentacaoCaixa.create({
      data: {
        caixaSessaoId: sessao.id,
        tipo: MOV_TIPO.FECHAMENTO,
        valor: 0,
        descricao: "Fechamento de caixa",
      },
    });
    await tx.caixaSessao.update({
      where: { id: sessao.id },
      data: {
        status: "FECHADO",
        fechadoEm,
        saldoFinalEsperado: saldoEsperado,
        saldoFinalInformado: saldoInformado,
        diferenca,
      },
    });
  });

  const relatorio = await calcularRelatorioCaixa(sessao.id);
  if (!relatorio) {
    return NextResponse.json({ error: "Nao foi possivel gerar o relatorio." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, relatorio });
}
