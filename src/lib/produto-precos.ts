/** Markup % sobre o preço de custo: (venda/custo - 1) * 100 */
export function markupFromPrecos(precoCusto: number, precoVenda: number): number {
  if (precoCusto <= 0) return 0;
  if (!Number.isFinite(precoVenda) || precoVenda < 0) return 0;
  return Math.round((precoVenda / precoCusto - 1) * 10000) / 100;
}
