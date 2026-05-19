import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCaixaAberto } from "@/lib/caixa-service";

export async function GET(req: Request) {
  const sessao = await getCaixaAberto();
  if (!sessao) {
    return NextResponse.json({ data: [], page: 1, total: 0, totalPages: 1 });
  }
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(5, Number(searchParams.get("pageSize") ?? "15") || 15));

  const where = { caixaSessaoId: sessao.id };

  const [total, rows] = await Promise.all([
    prisma.movimentacaoCaixa.count({ where }),
    prisma.movimentacaoCaixa.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
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
