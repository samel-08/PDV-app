import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { produtoUpdateSchema } from "@/lib/validators";
import { markupFromPrecos } from "@/lib/produto-precos";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const parsed = produtoUpdateSchema.parse(await req.json());
    if (parsed.categoriaId) {
      const cat = await prisma.categoria.findUnique({ where: { id: parsed.categoriaId } });
      if (!cat) return NextResponse.json({ error: "Categoria não encontrada." }, { status: 400 });
    }
    const cur = await prisma.produto.findUnique({ where: { id } });
    if (!cur) return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });

    const custo = parsed.precoCusto ?? cur.precoCusto;
    const venda = parsed.precoVenda ?? cur.precoVenda;
    const markupPercent = markupFromPrecos(custo, venda);

    const { markupPercent: _m, ...rest } = parsed;
    const p = await prisma.produto.update({
      where: { id },
      data: {
        ...rest,
        markupPercent,
      },
    });
    const full = await prisma.produto.findUnique({
      where: { id: p.id },
      include: { categoria: { select: { id: true, nome: true } } },
    });
    return NextResponse.json(full);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao atualizar.";
    if (typeof e === "object" && e && "code" in e && (e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Já existe um produto com este código." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    await prisma.produto.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const code = typeof e === "object" && e && "code" in e ? (e as { code?: string }).code : undefined;
    if (code === "P2003") {
      return NextResponse.json(
        { error: "Não é possível excluir: produto vinculado a vendas." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Não foi possível excluir o produto." }, { status: 400 });
  }
}
