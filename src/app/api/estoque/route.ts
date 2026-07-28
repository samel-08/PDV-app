import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ajusteEstoqueSchema } from "@/lib/validators";
import { getConfigSistema } from "@/lib/vendas-service";

export async function POST(req: Request) {
  try {
    const body = ajusteEstoqueSchema.parse(await req.json());
    const { produtoId, tipo, quantidade, motivo } = body;

    const produto = await prisma.produto.findUnique({ where: { id: produtoId } });
    if (!produto) {
      return NextResponse.json({ error: "Produto nao encontrado." }, { status: 404 });
    }

    let novoEstoque: number;
    if (tipo === "ENTRADA") {
      novoEstoque = Math.round((produto.estoqueAtual + quantidade) * 1000) / 1000;
    } else if (tipo === "SAIDA") {
      novoEstoque = Math.round((produto.estoqueAtual - quantidade) * 1000) / 1000;
    } else {
      novoEstoque = quantidade;
    }

    const config = await getConfigSistema();
    if (!config.permitirEstoqueNegativo && novoEstoque < 0) {
      return NextResponse.json(
        { error: "Estoque insuficiente. A configuracao atual nao permite estoque negativo." },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.produto.update({
        where: { id: produtoId },
        data: { estoqueAtual: novoEstoque },
      });
      await tx.movimentacaoEstoque.create({
        data: {
          produtoId,
          tipo,
          quantidade,
          motivo,
        },
      });
    });

    return NextResponse.json({ ok: true, estoqueAtual: novoEstoque });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro no ajuste de estoque.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const produtoId = searchParams.get("produtoId");
  const q = (searchParams.get("q") ?? "").trim();
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("pageSize") ?? "20") || 20));

  const where: Prisma.MovimentacaoEstoqueWhereInput = {};
  if (produtoId) where.produtoId = produtoId;
  if (q) {
    where.produto = {
      OR: [{ nome: { contains: q } }, { codigo: { contains: q } }],
    };
  }

  const [total, movimentacoes] = await Promise.all([
    prisma.movimentacaoEstoque.count({ where }),
    prisma.movimentacaoEstoque.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { produto: { select: { nome: true, codigo: true, unidadeMedida: true } } },
    }),
  ]);

  return NextResponse.json({
    data: movimentacoes,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
}
