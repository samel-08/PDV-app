import { tenantRoute } from "@/lib/tenant-route";
import { CARGOS } from "@/lib/tenant-context";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  return tenantRoute(_req, CARGOS, async () => {
    const { id } = await ctx.params;
    const v = await prisma.venda.findUnique({
      where: { id },
      include: {
        itens: { include: { produto: true } },
        pagamentos: true,
        caixaSessao: { select: { id: true, abertoEm: true } },
      },
    });
    if (!v)
      return NextResponse.json(
        { error: "Venda não encontrada." },
        { status: 404 },
      );
    return NextResponse.json(v);
  });
}

export const runtime = "nodejs";
