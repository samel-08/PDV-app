import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { produtoCreateSchema } from "@/lib/validators";
import { markupFromPrecos } from "@/lib/produto-precos";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const ativo = searchParams.get("ativo") ?? "todos";
  const categoriaId = (searchParams.get("categoriaId") ?? "").trim();
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(5, Number(searchParams.get("pageSize") ?? "10") || 10));
  const where: Prisma.ProdutoWhereInput = {};

  if (q) {
    where.OR = [
      { nome: { contains: q } },
      { codigo: { contains: q } },
      { categoria: { nome: { contains: q } } },
    ];
  }
  if (ativo === "ativo") where.ativo = true;
  if (ativo === "inativo") where.ativo = false;
  if (categoriaId) where.categoriaId = categoriaId;

  const [total, rows] = await Promise.all([
    prisma.produto.count({ where }),
    prisma.produto.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { categoria: { select: { id: true, nome: true } } },
    }),
  ]);

  return NextResponse.json({
    data: rows.map((p) => ({
      ...p,
      lucroEstimado: Math.round((p.precoVenda - p.precoCusto) * 100) / 100,
    })),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
}

export async function POST(req: Request) {
  try {
    const parsed = produtoCreateSchema.parse(await req.json());
    if (parsed.categoriaId) {
      const cat = await prisma.categoria.findUnique({ where: { id: parsed.categoriaId } });
      if (!cat) return NextResponse.json({ error: "Categoria não encontrada." }, { status: 400 });
    }
    const markupPercent = markupFromPrecos(parsed.precoCusto, parsed.precoVenda);
    const { markupPercent: _drop, ...rest } = parsed;
    const p = await prisma.produto.create({
      data: {
        ...rest,
        markupPercent,
      },
    });
    const full = await prisma.produto.findUnique({
      where: { id: p.id },
      include: { categoria: { select: { id: true, nome: true } } },
    });
    return NextResponse.json(full, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao salvar.";
    if (typeof e === "object" && e && "code" in e && (e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Já existe um produto com este código." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
