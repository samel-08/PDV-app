import { prisma } from "@/lib/db";
import { MOV_TIPO, getCaixaAberto } from "@/lib/caixa-service";

export type FormaPagamento = "DINHEIRO" | "PIX" | "CREDITO" | "DEBITO";

export type ItemInput = { produtoId: string; quantidade: number };

export async function finalizarVenda(input: {
  itens: ItemInput[];
  formaPagamento: FormaPagamento;
  valorRecebido: number;
}) {
  const { itens, formaPagamento, valorRecebido } = input;

  if (!itens.length) throw new Error("A venda precisa ter ao menos um item.");

  const caixa = await getCaixaAberto();
  if (!caixa) throw new Error("Não há caixa aberto. Abra o caixa antes de vender.");

  return prisma.$transaction(async (tx) => {
    const produtoIds = [...new Set(itens.map((i) => i.produtoId))];
    const produtos = await tx.produto.findMany({
      where: { id: { in: produtoIds }, ativo: true },
    });
    if (produtos.length !== produtoIds.length) {
      throw new Error("Um ou mais produtos estão inativos ou não existem.");
    }

    const map = new Map(produtos.map((p) => [p.id, p]));
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

    const last = await tx.venda.findFirst({
      orderBy: { numero: "desc" },
      select: { numero: true },
    });
    const numero = (last?.numero ?? 0) + 1;

    let troco = 0;
    if (formaPagamento === "DINHEIRO") {
      if (valorRecebido + 1e-9 < total) {
        throw new Error("Valor recebido é menor que o total.");
      }
      troco = Math.round((valorRecebido - total) * 100) / 100;
    } else {
      if (Math.abs(valorRecebido - total) > 0.02) {
        throw new Error("Para Pix, crédito ou débito, o valor recebido deve ser igual ao total.");
      }
    }

    const venda = await tx.venda.create({
      data: {
        numero,
        total,
        formaPagamento,
        valorRecebido,
        troco,
        caixaSessaoId: caixa.id,
        itens: {
          create: linhas.map((l) => ({
            ...l,
            quantidade: l.quantidade,
          })),
        },
      },
    });

    await tx.movimentacaoCaixa.create({
      data: {
        caixaSessaoId: caixa.id,
        tipo: MOV_TIPO.VENDA,
        valor: total,
        descricao: `Venda #${numero}`,
        referenciaVendaId: venda.id,
      },
    });

    return venda;
  });
}

export async function getCaixaAbertoOrNull() {
  return getCaixaAberto();
}
