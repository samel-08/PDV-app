import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MOV_TIPO, getCaixaAberto } from "@/lib/caixa-service";
import { caixaAbrirSchema } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    const body = caixaAbrirSchema.parse(await req.json());
    const existente = await getCaixaAberto();
    if (existente) {
      return NextResponse.json({ error: "Já existe um caixa aberto." }, { status: 400 });
    }
    const sessao = await prisma.$transaction(async (tx) => {
      const s = await tx.caixaSessao.create({
        data: {
          valorInicial: body.valorInicial,
          status: "ABERTO",
        },
      });
      await tx.movimentacaoCaixa.create({
        data: {
          caixaSessaoId: s.id,
          tipo: MOV_TIPO.ABERTURA,
          valor: body.valorInicial,
          descricao: "Abertura de caixa",
        },
      });
      return s;
    });
    return NextResponse.json(sessao, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao abrir caixa.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
