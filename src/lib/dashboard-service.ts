import { prisma } from "@/lib/db";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function labelPagamento(p: string) {
  if (p === "DINHEIRO") return "Dinheiro";
  if (p === "PIX") return "Pix";
  if (p === "CREDITO") return "Crédito";
  if (p === "DEBITO") return "Débito";
  if (p === "CARTAO") return "Cartão (legado)";
  return p;
}

/** Agrega vendas por mês em memória após uma única leitura (menos round-trips ao SQLite). */
function bucketVendasPorMes(
  vendas: { createdAt: Date; total: number }[],
  now: Date
): { key: string; label: string; total: number; qtd: number }[] {
  const meses: { key: string; label: string; total: number; qtd: number }[] = [];
  for (let offset = 0; offset <= 5; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - offset), 1);
    const f0 = startOfMonth(d);
    const f1 = endOfMonth(d);
    const t0 = f0.getTime();
    const t1 = f1.getTime();
    let total = 0;
    let qtd = 0;
    for (const v of vendas) {
      const t = new Date(v.createdAt).getTime();
      if (t >= t0 && t <= t1) {
        total += v.total;
        qtd += 1;
      }
    }
    meses.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(d),
      total: Math.round(total * 100) / 100,
      qtd,
    });
  }
  return meses;
}

export async function getDashboardData(now = new Date()) {
  const from = startOfMonth(now);
  const to = endOfMonth(now);
  const windowStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 5, 1));

  const [vendasMes, vendasAgg, itensMes, vendasJanela6m] = await Promise.all([
    prisma.venda.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { total: true, formaPagamento: true, createdAt: true },
    }),
    prisma.venda.aggregate({
      _count: true,
      _sum: { total: true },
    }),
    prisma.itensVenda.findMany({
      where: { venda: { createdAt: { gte: from, lte: to } } },
      select: {
        quantidade: true,
        precoUnitario: true,
        precoCustoSnapshot: true,
        produtoId: true,
        subtotal: true,
        produto: { select: { nome: true } },
      },
    }),
    prisma.venda.findMany({
      where: { createdAt: { gte: windowStart, lte: to } },
      select: { createdAt: true, total: true },
    }),
  ]);

  const totalMes = vendasMes.reduce((a, v) => a + v.total, 0);
  const qtdMes = vendasMes.length;
  const ticketMedioMes = qtdMes ? totalMes / qtdMes : 0;

  const totalGeral = vendasAgg._sum.total ?? 0;
  const qtdGeral = vendasAgg._count;
  const ticketMedioGeral = qtdGeral ? totalGeral / qtdGeral : 0;

  const lucroMes = itensMes.reduce(
    (acc, it) => acc + (it.precoUnitario - it.precoCustoSnapshot) * it.quantidade,
    0
  );

  const byProd = new Map<string, { nome: string; qtd: number; total: number }>();
  for (const it of itensMes) {
    const cur = byProd.get(it.produtoId) ?? {
      nome: it.produto.nome,
      qtd: 0,
      total: 0,
    };
    cur.qtd += it.quantidade;
    cur.total += it.subtotal;
    byProd.set(it.produtoId, cur);
  }
  let produtoMaisVendido: { nome: string; qtd: number } | null = null;
  for (const [, v] of byProd) {
    if (!produtoMaisVendido || v.qtd > produtoMaisVendido.qtd) {
      produtoMaisVendido = { nome: v.nome, qtd: v.qtd };
    }
  }

  const pagamentoMes: Record<string, number> = {};
  for (const v of vendasMes) {
    pagamentoMes[v.formaPagamento] = (pagamentoMes[v.formaPagamento] ?? 0) + v.total;
  }

  const meses = bucketVendasPorMes(vendasJanela6m, now);

  const vendasPorProduto = [...byProd.values()]
    .map((v) => ({ name: v.nome, value: Math.round(v.total * 100) / 100 }))
    .sort((a, b) => b.value - a.value);

  return {
    totalMes: Math.round(totalMes * 100) / 100,
    qtdMes,
    ticketMedioMes: Math.round(ticketMedioMes * 100) / 100,
    ticketMedioGeral: Math.round(ticketMedioGeral * 100) / 100,
    lucroMes: Math.round(lucroMes * 100) / 100,
    produtoMaisVendido,
    vendasPorProduto,
    vendasMensais: meses,
    pagamentoMes: Object.entries(pagamentoMes).map(([name, value]) => ({
      name: labelPagamento(name),
      value: Math.round(value * 100) / 100,
    })),
  };
}
