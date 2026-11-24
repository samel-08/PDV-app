import { createHash } from "node:crypto";
import { calcularPagamentos } from "@/lib/pagamentos";
import { prisma } from "@/lib/db";
import { empresaId, tenantContext, AccessError } from "@/lib/tenant-context";
import type { FormaPagamento } from "@/lib/validators";
import { getCaixaAberto } from "@/lib/caixa-service";
export type ItemInput = { produtoId: string; quantidade: number };
export type PagamentoInput = { formaPagamento: FormaPagamento; valor: number };
export async function getConfigSistema() {
  return prisma.configSistema.findUniqueOrThrow({
    where: { empresaId: empresaId() },
  });
}
export async function finalizarVenda(input: {
  itens: ItemInput[];
  pagamentos: PagamentoInput[];
  chaveIdempotencia: string;
}) {
  const { itens, pagamentos, chaveIdempotencia } = input;
  if (!itens.length || !pagamentos.length)
    throw new AccessError("Informe itens e pagamentos.", 400);
  const requisicaoHash = createHash("sha256")
    .update(JSON.stringify({ itens, pagamentos }))
    .digest("hex");
  return prisma.$transaction(
    async (tx) => {
      const old = await tx.venda.findUnique({
        where: {
          empresaId_chaveIdempotencia: {
            empresaId: empresaId(),
            chaveIdempotencia,
          },
        },
      });
      if (old) {
        if (old.requisicaoHash !== requisicaoHash)
          throw new AccessError(
            "Esta finalização já foi usada com outros dados.",
            409,
          );
        return old;
      }
      const caixa = await tx.caixaSessao.findFirst({
        where: { status: "ABERTO" },
      });
      if (!caixa)
        throw new AccessError(
          "Não há caixa aberto. Abra o caixa antes de vender.",
          400,
        );
      const config = await tx.configSistema.findUniqueOrThrow({
        where: { empresaId: empresaId() },
      });
      const ids = [...new Set(itens.map((item) => item.produtoId))];
      const produtos = await tx.produto.findMany({
        where: { id: { in: ids }, ativo: true },
      });
      if (produtos.length !== ids.length)
        throw new AccessError("Produto não encontrado ou indisponível.", 404);
      const products = new Map(produtos.map((p) => [p.id, p]));
      let total = 0;
      const quantities = new Map<string, number>();
      const linhas = itens.map((item) => {
        const product = products.get(item.produtoId)!;
        const subtotal =
          Math.round(product.precoVenda * item.quantidade * 100) / 100;
        total = Math.round((total + subtotal) * 100) / 100;
        quantities.set(
          product.id,
          Math.round(
            ((quantities.get(product.id) ?? 0) + item.quantidade) * 1000,
          ) / 1000,
        );
        return {
          produtoId: product.id,
          quantidade: item.quantidade,
          precoUnitario: product.precoVenda,
          precoCustoSnapshot: product.precoCusto,
          subtotal,
        };
      });
      const { totalPago, valorDinheiro, troco, suficiente, excedenteValido } =
        calcularPagamentos(total, pagamentos);
      if (!suficiente) throw new AccessError("Pagamento insuficiente.", 400);
      if (!excedenteValido)
        throw new AccessError(
          "O excedente precisa ser coberto por dinheiro para dar troco.",
          400,
        );
      const sequence = await tx.sequenciaVenda.upsert({
        where: { empresaId: empresaId() },
        create: { empresaId: empresaId(), ultimoNumero: 1 },
        update: { ultimoNumero: { increment: 1 } },
      });
      for (const [id, quantity] of quantities) {
        const changed = await tx.produto.updateMany({
          where: {
            id,
            ...(config.permitirEstoqueNegativo
              ? {}
              : { estoqueAtual: { gte: quantity } }),
          },
          data: { estoqueAtual: { decrement: quantity } },
        });
        if (changed.count !== 1)
          throw new AccessError(
            "Estoque insuficiente para concluir a venda.",
            409,
          );
      }
      const formaPagamento =
        pagamentos.length === 1 ? pagamentos[0].formaPagamento : "MULTIPLO";
      const sale = await tx.venda.create({
        data: {
          empresaId: empresaId(),
          operadorId: tenantContext().usuarioId,
          chaveIdempotencia,
          requisicaoHash,
          numero: sequence.ultimoNumero,
          total,
          formaPagamento,
          valorRecebido: totalPago,
          troco,
          caixaSessaoId: caixa.id,
          itens: { create: linhas },
          pagamentos: {
            create: pagamentos.map((p) => ({
              formaPagamento: p.formaPagamento,
              valor: p.valor,
            })),
          },
        },
      });
      for (const [produtoId, quantidade] of quantities)
        await tx.movimentacaoEstoque.create({
          data: {
            empresaId: empresaId(),
            operadorId: tenantContext().usuarioId,
            produtoId,
            quantidade,
            tipo: "VENDA",
            motivo: `Venda #${sale.numero}`,
          },
        });
      await tx.movimentacaoCaixa.create({
        data: {
          empresaId: empresaId(),
          operadorId: tenantContext().usuarioId,
          caixaSessaoId: caixa.id,
          referenciaVendaId: sale.id,
          tipo: "VENDA",
          valor: Math.round((valorDinheiro - troco) * 100) / 100,
          descricao: `Venda #${sale.numero} (${formaPagamento})`,
        },
      });
      return sale;
    },
    { maxWait: 10000, timeout: 20000 },
  );
}
export async function getCaixaAbertoOrNull() {
  return getCaixaAberto();
}
