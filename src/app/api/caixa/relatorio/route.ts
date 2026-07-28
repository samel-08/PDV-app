import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calcularRelatorioCaixa } from "@/lib/caixa-relatorio";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessaoId = searchParams.get("sessaoId");

  if (sessaoId) {
    const relatorio = await calcularRelatorioCaixa(sessaoId);
    if (!relatorio) {
      return NextResponse.json({ error: "Sessao nao encontrada." }, { status: 404 });
    }
    return NextResponse.json(relatorio);
  }

  const sessoes = await prisma.caixaSessao.findMany({
    where: { status: "FECHADO" },
    orderBy: { fechadoEm: "desc" },
    take: 20,
    select: {
      id: true,
      abertoEm: true,
      fechadoEm: true,
      valorInicial: true,
      saldoFinalEsperado: true,
      saldoFinalInformado: true,
      diferenca: true,
    },
  });

  return NextResponse.json({ data: sessoes });
}
