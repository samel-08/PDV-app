import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await prisma.categoria.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const code = typeof e === "object" && e && "code" in e ? (e as { code?: string }).code : undefined;
    if (code === "P2003") {
      return NextResponse.json({ error: "Não foi possível excluir a categoria." }, { status: 400 });
    }
    return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 });
  }
}
