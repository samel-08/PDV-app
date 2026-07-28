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
  if (p === "CREDITO") return "Credito";
  if (p === "DEBITO") return "Debito";
  if (p === "OUTROS") return "Outros";
  if (p === "CARTAO") return "Cartao (legado)";
  return p;
}

/** Agrega vendas por mes em memoria apos uma unica leitura (menos round-trips ao SQLite). */
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

export type ProdutoMaisVendidoRank = {
  nome: string;
  quantidade: number;
  totalVendido: number;
};

export type ProdutoParadoRank = {
  nome: string;
  estoqueAtual: number;
  /** ISO string ou null se nunca vendeu */
  ultimaVendaEm: string | null;
};

async function buildProdutosMaisVendidos(limit: number): Promise<ProdutoMaisVendidoRank[]> {
  const itens = await prisma.itensVenda.findMany({
    where: { venda: { status: "CONCLUIDA" } },
    select: {
      quantidade: true,
      subtotal: true,
      produtoId: true,
      produto: { select: { nome: true } },
    },
  });

  if (itens.length === 0) return [];

  const map = new Map<string, { nome: string; qtd: number; total: number }>();
  for (const it of itens) {
    const cur = map.get(it.produtoId) ?? { nome: it.produto.nome, qtd: 0, total: 0 };
    cur.qtd += it.quantidade;
    cur.total += it.subtotal;
    map.set(it.produtoId, cur);
  }

  return [...map.values()]
    .map((v) => ({
      nome: v.nome,
      quantidade: Math.round(v.qtd * 1000) / 1000,
      totalVendido: Math.round(v.total * 100) / 100,
    }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, limit);
}

async function buildProdutosParados(limit: number, now: Date): Promise<ProdutoParadoRank[]> {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 30);
  cutoff.setHours(0, 0, 0, 0);

  const [produtos, itens] = await Promise.all([
    prisma.produto.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, estoqueAtual: true },
      orderBy: { nome: "asc" },
    }),
    prisma.itensVenda.findMany({
      where: { venda: { status: "CONCLUIDA" } },
      select: {
        produtoId: true,
        venda: { select: { createdAt: true } },
      },
      orderBy: { venda: { createdAt: "desc" } },
    }),
  ]);

  const ultimaVendaPorProduto = new Map<string, Date>();
  for (const it of itens) {
    if (!ultimaVendaPorProduto.has(it.produtoId)) {
      ultimaVendaPorProduto.set(it.produtoId, it.venda.createdAt);
    }
  }

  const parados: ProdutoParadoRank[] = [];
  for (const p of produtos) {
    const ultima = ultimaVendaPorProduto.get(p.id);
    if (!ultima || ultima < cutoff) {
      parados.push({
        nome: p.nome,
        estoqueAtual: Math.round(p.estoqueAtual * 1000) / 1000,
        ultimaVendaEm: ultima ? ultima.toISOString() : null,
      });
    }
  }

  parados.sort((a, b) => {
    if (a.ultimaVendaEm === null && b.ultimaVendaEm === null) {
      return a.nome.localeCompare(b.nome, "pt-BR");
    }
    if (a.ultimaVendaEm === null) return -1;
    if (b.ultimaVendaEm === null) return 1;
    return new Date(a.ultimaVendaEm).getTime() - new Date(b.ultimaVendaEm).getTime();
  });

  return parados.slice(0, limit);
}

export async function getDashboardData(now = new Date()) {
  const from = startOfMonth(now);
  const to = endOfMonth(now);
  const windowStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 5, 1));

  const [vendasMes, vendasAgg, itensMes, vendasJanela6m, produtosMaisVendidos, produtosParados] =
    await Promise.all([
    prisma.venda.findMany({
      where: { createdAt: { gte: from, lte: to }, status: "CONCLUIDA" },
      select: {
        total: true,
        formaPagamento: true,
        troco: true,
        createdAt: true,
        pagamentos: { select: { formaPagamento: true, valor: true } },
      },
    }),
    prisma.venda.aggregate({
      where: { status: "CONCLUIDA" },
      _count: true,
      _sum: { total: true },
    }),
    prisma.itensVenda.findMany({
      where: { venda: { createdAt: { gte: from, lte: to }, status: "CONCLUIDA" } },
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
      where: { createdAt: { gte: windowStart, lte: to }, status: "CONCLUIDA" },
      select: { createdAt: true, total: true },
    }),
    buildProdutosMaisVendidos(5),
    buildProdutosParados(5, now),
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
  for (const venda of vendasMes) {
    if (venda.pagamentos.length > 0) {
      for (const pagamento of venda.pagamentos) {
        pagamentoMes[pagamento.formaPagamento] =
          (pagamentoMes[pagamento.formaPagamento] ?? 0) + pagamento.valor;
      }
      pagamentoMes.DINHEIRO = (pagamentoMes.DINHEIRO ?? 0) - venda.troco;
    } else {
      pagamentoMes[venda.formaPagamento] = (pagamentoMes[venda.formaPagamento] ?? 0) + venda.total;
    }
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
    produtosMaisVendidos,
    produtosParados,
  };
}
