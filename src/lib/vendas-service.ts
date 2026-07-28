import { prisma } from "@/lib/db";
import { MOV_TIPO, getCaixaAberto } from "@/lib/caixa-service";
import type { FormaPagamento } from "@/lib/validators";

export type ItemInput = { produtoId: string; quantidade: number };
export type PagamentoInput = { formaPagamento: FormaPagamento; valor: number };

export async function getConfigSistema() {
  let config = await prisma.configSistema.findUnique({ where: { id: "singleton" } });
  if (!config) {
    config = await prisma.configSistema.create({
      data: { id: "singleton", permitirEstoqueNegativo: false },
    });
  }
  return config;
}

export async function finalizarVenda(input: {
  itens: ItemInput[];
  pagamentos: PagamentoInput[];
}) {
  const { itens, pagamentos } = input;

  if (!itens.length) throw new Error("A venda precisa ter ao menos um item.");
  if (!pagamentos.length) throw new Error("Informe pelo menos uma forma de pagamento.");

  const caixa = await getCaixaAberto();
  if (!caixa) throw new Error("Não há caixa aberto. Abra o caixa antes de vender.");

  const config = await getConfigSistema();

  return prisma.$transaction(async (tx) => {
    const produtoIds = [...new Set(itens.map((i) => i.produtoId))];
    const produtos = await tx.produto.findMany({
      where: { id: { in: produtoIds } },
    });

    // Validate all products exist
    if (produtos.length !== produtoIds.length) {
      throw new Error("Um ou mais produtos não existem.");
    }

    // Check inactive products
    const inativos = produtos.filter((p) => !p.ativo);
    if (inativos.length > 0) {
      throw new Error(`Produto inativo: ${inativos[0]!.nome}. Não é possível vender.`);
    }

    const map = new Map(produtos.map((p) => [p.id, p]));

    // Aggregate quantities per product for stock check
    const qtdPorProduto = new Map<string, number>();
    for (const it of itens) {
      const current = qtdPorProduto.get(it.produtoId) ?? 0;
      qtdPorProduto.set(it.produtoId, current + it.quantidade);
    }

    // Check stock
    if (!config.permitirEstoqueNegativo) {
      for (const [produtoId, qtdTotal] of qtdPorProduto) {
        const p = map.get(produtoId)!;
        if (p.estoqueAtual < qtdTotal) {
          throw new Error(
            `Estoque insuficiente para "${p.nome}". Disponível: ${p.estoqueAtual}, Solicitado: ${qtdTotal}.`
          );
        }
      }
    }

    let total = 0;
    const linhas: {
      produtoId: string;
      quantidade: number;
      precoUnitario: number;
      precoCustoSnapshot: number;
      subtotal: number;
    }[] = [];

    for (const it of itens) {
      const p = map.get(it.produtoId);
      if (!p) throw new Error("Produto inválido.");
      if (!Number.isFinite(it.quantidade) || it.quantidade < 0.0005) {
        throw new Error("Quantidade inválida.");
      }
      const subtotal = Math.round(p.precoVenda * it.quantidade * 100) / 100;
      total = Math.round((total + subtotal) * 100) / 100;
      linhas.push({
        produtoId: p.id,
        quantidade: it.quantidade,
        precoUnitario: p.precoVenda,
        precoCustoSnapshot: p.precoCusto,
        subtotal,
      });
    }

    // Validate payments
    const totalPago = Math.round(pagamentos.reduce((a, p) => a + p.valor, 0) * 100) / 100;
    const valorDinheiro = Math.round(
      pagamentos
        .filter((p) => p.formaPagamento === "DINHEIRO")
        .reduce((a, p) => a + p.valor, 0) * 100
    ) / 100;

    if (totalPago + 0.01 < total) {
      throw new Error(
        `Pagamento insuficiente. Total: R$ ${total.toFixed(2)}, Pago: R$ ${totalPago.toFixed(2)}.`
      );
    }

    let troco = 0;
    if (totalPago > total + 0.01) {
      const excedente = Math.round((totalPago - total) * 100) / 100;
      if (valorDinheiro + 0.01 < excedente) {
        throw new Error("Pagamento excede o total e não há dinheiro para calcular troco.");
      }
      troco = excedente;
    }

    const last = await tx.venda.findFirst({
      orderBy: { numero: "desc" },
      select: { numero: true },
    });
    const numero = (last?.numero ?? 0) + 1;

    // Determine formaPagamento label
    let formaPagamento: string;
    if (pagamentos.length === 1) {
      formaPagamento = pagamentos[0]!.formaPagamento;
    } else {
      formaPagamento = "MULTIPLO";
    }

    const venda = await tx.venda.create({
      data: {
        numero,
        total,
        formaPagamento,
        valorRecebido: totalPago,
        troco,
        status: "CONCLUIDA",
        caixaSessaoId: caixa.id,
        itens: {
          create: linhas.map((l) => ({
            ...l,
            quantidade: l.quantidade,
          })),
        },
        pagamentos: {
          create: pagamentos.map((p) => ({
            formaPagamento: p.formaPagamento,
            valor: p.valor,
          })),
        },
      },
    });

    // Decrease stock and create stock movements
    for (const [produtoId, qtdTotal] of qtdPorProduto) {
      const p = map.get(produtoId)!;
      await tx.produto.update({
        where: { id: produtoId },
        data: { estoqueAtual: Math.round((p.estoqueAtual - qtdTotal) * 1000) / 1000 },
      });
      await tx.movimentacaoEstoque.create({
        data: {
          produtoId,
          tipo: "VENDA",
          quantidade: qtdTotal,
          motivo: `Venda #${numero}`,
        },
      });
    }

    // Create cash movement (only the cash portion minus change affects the register)
    const valorCaixaEfetivo = Math.round((valorDinheiro - troco) * 100) / 100;

    // For cash register, only cash amounts stay in the drawer
    // Non-cash payments are recorded but don't add to physical cash
    await tx.movimentacaoCaixa.create({
      data: {
        caixaSessaoId: caixa.id,
        tipo: MOV_TIPO.VENDA,
        valor: valorCaixaEfetivo,
        descricao: `Venda #${numero} (${formaPagamento === "MULTIPLO" ? "múltiplo" : formaPagamento.toLowerCase()})`,
        referenciaVendaId: venda.id,
      },
    });

    return venda;
  });
}

export async function getCaixaAbertoOrNull() {
  return getCaixaAberto();
}
