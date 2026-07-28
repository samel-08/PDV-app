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

  const vendaIds = rows
    .map((row) => row.referenciaVendaId)
    .filter((id): id is string => Boolean(id));

  const numerosVenda = rows
    .filter((row) => row.tipo === "VENDA" && row.descricao)
    .map((row) => {
      const match = row.descricao!.match(/Venda\s*#(\d+)/i);
      return match ? Number(match[1]) : null;
    })
    .filter((n): n is number => n !== null && Number.isFinite(n));

  const vendas =
    vendaIds.length || numerosVenda.length
      ? await prisma.venda.findMany({
          where: {
            OR: [
              ...(vendaIds.length ? [{ id: { in: vendaIds } }] : []),
              ...(numerosVenda.length ? [{ numero: { in: numerosVenda } }] : []),
            ],
          },
          select: { id: true, numero: true, total: true },
        })
      : [];

  const totalPorVendaId = new Map(vendas.map((venda) => [venda.id, venda.total]));
  const totalPorVendaNumero = new Map(vendas.map((venda) => [venda.numero, venda.total]));

  function valorExibicaoMov(row: (typeof rows)[number]): number {
    if (row.tipo !== "VENDA") return row.valor;
    if (row.referenciaVendaId) {
      const total = totalPorVendaId.get(row.referenciaVendaId);
      if (total != null) return total;
    }
    const match = row.descricao?.match(/Venda\s*#(\d+)/i);
    if (match) {
      const total = totalPorVendaNumero.get(Number(match[1]));
      if (total != null) return total;
    }
    return row.valor;
  }

  return NextResponse.json({
    data: rows.map((row) => ({
      ...row,
      valorExibicao: valorExibicaoMov(row),
    })),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
}
