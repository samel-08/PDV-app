import { AccessError } from "@/lib/tenant-context";
import { empresaId } from "@/lib/tenant-context";
import { tenantRoute, MANAGERS } from "@/lib/tenant-route";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ajusteEstoqueSchema } from "@/lib/validators";

export async function POST(req: Request) {
  return tenantRoute(req, MANAGERS, async () => {
    try {
      const body = ajusteEstoqueSchema.parse(await req.json());
      const { produtoId, tipo, quantidade, motivo } = body;

      const novoEstoque = await prisma.$transaction(async (tx) => {
        const produto = await tx.produto.findUnique({
          where: { id: produtoId },
        });
        if (!produto) throw new AccessError("Produto não encontrado.", 404);
        const config = await tx.configSistema.findUniqueOrThrow({
          where: { empresaId: empresaId() },
        });
        const target =
          tipo === "AJUSTE"
            ? quantidade
            : Math.round(
                (produto.estoqueAtual +
                  (tipo === "ENTRADA" ? quantidade : -quantidade)) *
                  1000,
              ) / 1000;
        if (!config.permitirEstoqueNegativo && target < 0)
          throw new AccessError("Estoque insuficiente.", 409);
        await tx.produto.update({
          where: { id: produtoId },
          data: { estoqueAtual: target },
        });
        await tx.movimentacaoEstoque.create({
          data: { empresaId: empresaId(), produtoId, tipo, quantidade, motivo },
        });
        return target;
      });

      return NextResponse.json({ ok: true, estoqueAtual: novoEstoque });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro no ajuste de estoque.";
      return NextResponse.json(
        { error: msg },
        { status: e instanceof AccessError ? e.status : 400 },
      );
    }
  });
}

export async function GET(req: Request) {
  return tenantRoute(req, MANAGERS, async () => {
    const { searchParams } = new URL(req.url);
    const produtoId = searchParams.get("produtoId");
    const q = (searchParams.get("q") ?? "").trim();
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.min(
      100,
      Math.max(10, Number(searchParams.get("pageSize") ?? "20") || 20),
    );

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
        include: {
          produto: {
            select: { nome: true, codigo: true, unidadeMedida: true },
          },
        },
      }),
    ]);

    return NextResponse.json({
      data: movimentacoes,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
    });
  });
}

export const runtime = "nodejs";
