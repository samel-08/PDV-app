import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { empresaId, AccessError } from "@/lib/tenant-context";
import { tenantRoute, MANAGERS } from "@/lib/tenant-route";
import { caixaValorSchema } from "@/lib/validators";
export async function POST(req: Request) {
  return tenantRoute(req, MANAGERS, async () => {
    const body = caixaValorSchema.parse(await req.json());
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.caixaSessao.findFirst({
        where: { status: "ABERTO" },
      });
      if (!session) throw new AccessError("Não há caixa aberto.", 400);
      return tx.movimentacaoCaixa.create({
        data: {
          empresaId: empresaId(),
          caixaSessaoId: session.id,
          tipo: "SANGRIA",
          valor: -Math.abs(body.valor),
          descricao: body.descricao ?? "SANGRIA",
        },
      });
    });
    return NextResponse.json(result, { status: 201 });
  });
}
export const runtime = "nodejs";
