import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MOV_TIPO, getCaixaAberto } from "@/lib/caixa-service";
import { caixaValorSchema } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    const body = caixaValorSchema.parse(await req.json());
    const sessao = await getCaixaAberto();
    if (!sessao) {
      return NextResponse.json({ error: "Não há caixa aberto." }, { status: 400 });
    }
    const mov = await prisma.movimentacaoCaixa.create({
      data: {
        caixaSessaoId: sessao.id,
        tipo: MOV_TIPO.REFORCO,
        valor: Math.abs(body.valor),
        descricao: body.descricao ?? "Reforço de caixa",
      },
    });
    return NextResponse.json(mov, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao registrar reforço.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
