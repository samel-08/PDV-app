import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MOV_TIPO, getCaixaAberto } from "@/lib/caixa-service";

export async function POST() {
  const sessao = await getCaixaAberto();
  if (!sessao) {
    return NextResponse.json({ error: "Não há caixa aberto." }, { status: 400 });
  }
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
      data: { status: "FECHADO", fechadoEm: new Date() },
    });
  });
  return NextResponse.json({ ok: true });
}
