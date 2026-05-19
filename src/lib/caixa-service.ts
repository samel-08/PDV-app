import { prisma } from "@/lib/db";

export const MOV_TIPO = {
  ABERTURA: "ABERTURA",
  VENDA: "VENDA",
  SANGRIA: "SANGRIA",
  REFORCO: "REFORCO",
  FECHAMENTO: "FECHAMENTO",
} as const;

export async function getCaixaAberto() {
  return prisma.caixaSessao.findFirst({
    where: { status: "ABERTO" },
    orderBy: { abertoEm: "desc" },
  });
}

export async function calcularSaldoSessao(caixaSessaoId: string): Promise<number> {
  const agg = await prisma.movimentacaoCaixa.aggregate({
    where: { caixaSessaoId },
    _sum: { valor: true },
  });
  return agg._sum.valor ?? 0;
}

export async function totaisMovimentacao(caixaSessaoId: string) {
  const rows = await prisma.movimentacaoCaixa.findMany({
    where: { caixaSessaoId },
    select: { valor: true },
  });
  let entradas = 0;
  let saidas = 0;
  for (const r of rows) {
    if (r.valor >= 0) entradas += r.valor;
    else saidas += -r.valor;
  }
  return { entradas, saidas };
}
