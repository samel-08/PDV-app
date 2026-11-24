import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { empresaId, tenantContext, AccessError } from "@/lib/tenant-context";
import { MANAGERS, tenantRoute } from "@/lib/tenant-route";
import { caixaFecharSchema } from "@/lib/validators";
import { calcularRelatorioCaixa } from "@/lib/caixa-relatorio";
export async function POST(req: Request) {
  return tenantRoute(req, MANAGERS, async () => {
    const parsed = caixaFecharSchema.parse(await req.json());
    const id = await prisma.$transaction(async (tx) => {
      const session = await tx.caixaSessao.findFirst({
        where: { status: "ABERTO" },
      });
      if (!session) throw new AccessError("Não há caixa aberto.", 400);
      const sum = await tx.movimentacaoCaixa.aggregate({
        where: { caixaSessaoId: session.id },
        _sum: { valor: true },
      });
      const expected = Math.round((sum._sum.valor ?? 0) * 100) / 100;
      const informed = parsed.saldoInformado ?? null;
      await tx.movimentacaoCaixa.create({
        data: {
          empresaId: empresaId(),
          operadorId: tenantContext().usuarioId,
          caixaSessaoId: session.id,
          tipo: "FECHAMENTO",
          valor: 0,
          descricao: "Fechamento de caixa",
        },
      });
      await tx.caixaSessao.update({
        where: { id: session.id },
        data: {
          status: "FECHADO",
          fechadoEm: new Date(),
          saldoFinalEsperado: expected,
          saldoFinalInformado: informed,
          diferenca:
            informed === null
              ? null
              : Math.round((informed - expected) * 100) / 100,
        },
      });
      return session.id;
    });
    return NextResponse.json({
      ok: true,
      relatorio: await calcularRelatorioCaixa(id),
    });
  });
}
export const runtime = "nodejs";
