import { NextResponse } from "next/server";
import { tenantRoute, MANAGERS } from "@/lib/tenant-route";
import { prisma } from "@/lib/db";
import { agregarHorarios, periodoHorarios } from "@/lib/horarios-pico";

export async function GET(req: Request) {
  return tenantRoute(req, MANAGERS, async () => {
    const params = new URL(req.url).searchParams;
    const inicio = params.get("inicio") ?? "";
    const fim = params.get("fim") ?? "";
    let periodo;
    try {
      periodo = periodoHorarios(inicio, fim);
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 400 });
    }
    const vendas = await prisma.venda.findMany({
      where: { status: "CONCLUIDA", createdAt: periodo },
      select: { createdAt: true, total: true },
    });
    return NextResponse.json(agregarHorarios(vendas, inicio, fim));
  });
}

export const runtime = "nodejs";
