import { prisma } from "@/lib/db";
import { calcularSaldoSessao } from "@/lib/caixa-service";

const FORMAS = ["DINHEIRO", "PIX", "DEBITO", "CREDITO", "OUTROS"] as const;

export type CaixaRelatorio = {
  sessaoId: string;
  abertoEm: Date;
  fechadoEm: Date | string | null;
  valorInicial: number;
  totalVendido: number;
  totalSangrias: number;
  totalReforcos: number;
  saldoEsperado: number;
  saldoInformado: number | null;
  diferenca: number | null;
  totaisPorForma: Record<string, number>;
  qtdVendas: number;
  ticketMedio: number;
  maiorVenda: number;
  menorVenda: number;
  produtosMaisVendidos: { nome: string; codigo: string; quantidade: number; total: number }[];
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function emptyTotaisPorForma(): Record<string, number> {
  return Object.fromEntries(FORMAS.map((f) => [f, 0]));
}

export async function calcularRelatorioCaixa(sessaoId: string): Promise<CaixaRelatorio | null> {
  const sessao = await prisma.caixaSessao.findUnique({
    where: { id: sessaoId },
    select: {
      id: true,
      abertoEm: true,
      fechadoEm: true,
      valorInicial: true,
      saldoFinalEsperado: true,
      saldoFinalInformado: true,
      diferenca: true,
    },
  });
  if (!sessao) return null;

  const [vendas, movimentacoes] = await Promise.all([
    prisma.venda.findMany({
      where: { caixaSessaoId: sessaoId, status: "CONCLUIDA" },
      orderBy: { createdAt: "asc" },
      select: {
        total: true,
        troco: true,
        formaPagamento: true,
        pagamentos: { select: { formaPagamento: true, valor: true } },
        itens: {
          select: {
            produtoId: true,
            quantidade: true,
            subtotal: true,
            produto: { select: { nome: true, codigo: true } },
          },
        },
      },
    }),
    prisma.movimentacaoCaixa.findMany({
      where: { caixaSessaoId: sessaoId },
      select: { tipo: true, valor: true },
    }),
  ]);

  const totaisPorForma = emptyTotaisPorForma();
  for (const venda of vendas) {
    if (venda.pagamentos.length > 0) {
      for (const p of venda.pagamentos) {
        totaisPorForma[p.formaPagamento] = (totaisPorForma[p.formaPagamento] ?? 0) + p.valor;
      }
      totaisPorForma.DINHEIRO = (totaisPorForma.DINHEIRO ?? 0) - venda.troco;
    } else {
      totaisPorForma[venda.formaPagamento] = (totaisPorForma[venda.formaPagamento] ?? 0) + venda.total;
    }
  }
  for (const forma of Object.keys(totaisPorForma)) {
    totaisPorForma[forma] = roundMoney(totaisPorForma[forma] ?? 0);
  }

  let totalSangrias = 0;
  let totalReforcos = 0;
  for (const m of movimentacoes) {
    if (m.tipo === "SANGRIA") totalSangrias += Math.abs(m.valor);
    if (m.tipo === "REFORCO") totalReforcos += m.valor;
  }

  const qtdVendas = vendas.length;
  const totalVendido = vendas.reduce((a, v) => a + v.total, 0);
  const ticketMedio = qtdVendas > 0 ? totalVendido / qtdVendas : 0;
  const maiorVenda = qtdVendas > 0 ? Math.max(...vendas.map((v) => v.total)) : 0;
  const menorVenda = qtdVendas > 0 ? Math.min(...vendas.map((v) => v.total)) : 0;

  const produtoMap = new Map<string, { nome: string; codigo: string; quantidade: number; total: number }>();
  for (const venda of vendas) {
    for (const item of venda.itens) {
      const current = produtoMap.get(item.produtoId) ?? {
        nome: item.produto.nome,
        codigo: item.produto.codigo,
        quantidade: 0,
        total: 0,
      };
      current.quantidade += item.quantidade;
      current.total += item.subtotal;
      produtoMap.set(item.produtoId, current);
    }
  }

  const saldoCalculado = await calcularSaldoSessao(sessaoId);

  return {
    sessaoId: sessao.id,
    abertoEm: sessao.abertoEm,
    fechadoEm: sessao.fechadoEm,
    valorInicial: sessao.valorInicial,
    totalVendido: roundMoney(totalVendido),
    totalSangrias: roundMoney(totalSangrias),
    totalReforcos: roundMoney(totalReforcos),
    saldoEsperado: roundMoney(sessao.saldoFinalEsperado ?? saldoCalculado),
    saldoInformado: sessao.saldoFinalInformado,
    diferenca: sessao.diferenca,
    totaisPorForma,
    qtdVendas,
    ticketMedio: roundMoney(ticketMedio),
    maiorVenda: roundMoney(maiorVenda),
    menorVenda: roundMoney(menorVenda),
    produtosMaisVendidos: [...produtoMap.values()]
      .map((p) => ({ ...p, quantidade: Math.round(p.quantidade * 1000) / 1000, total: roundMoney(p.total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10),
  };
}
