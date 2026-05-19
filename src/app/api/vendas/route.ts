import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { vendaCreateSchema } from "@/lib/validators";
import { finalizarVenda } from "@/lib/vendas-service";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const numero = searchParams.get("numero");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(50, Math.max(5, Number(searchParams.get("pageSize") ?? "10") || 10));

  const where: Prisma.VendaWhereInput = {};
  if (numero) {
    const n = Number(numero);
    if (Number.isFinite(n)) where.numero = n;
  }
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(`${from}T00:00:00`);
    if (to) where.createdAt.lte = new Date(`${to}T23:59:59.999`);
  }

  const [total, rows] = await Promise.all([
    prisma.venda.count({ where }),
    prisma.venda.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        itens: {
          include: { produto: { select: { nome: true, codigo: true } } },
        },
      },
    }),
  ]);

  return NextResponse.json({
    data: rows,
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
}

export async function POST(req: Request) {
  try {
    const parsed = vendaCreateSchema.parse(await req.json());
    const venda = await finalizarVenda(parsed);
    const full = await prisma.venda.findUnique({
      where: { id: venda.id },
      include: {
        itens: { include: { produto: true } },
      },
    });
    return NextResponse.json(full, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao finalizar venda.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
