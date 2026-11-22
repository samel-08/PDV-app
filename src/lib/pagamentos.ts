/** Compara pagamentos em centavos, sem tolerância de um centavo. */
export function calcularPagamentos(
  total: number,
  pagamentos: { formaPagamento: string; valor: number }[],
) {
  const centavos = (valor: number) => Math.round((valor + Number.EPSILON) * 100);
  const totalCentavos = centavos(total);
  const pagoCentavos = pagamentos.reduce((soma, p) => soma + centavos(p.valor), 0);
  const dinheiroCentavos = pagamentos.reduce(
    (soma, p) => soma + (p.formaPagamento === "DINHEIRO" ? centavos(p.valor) : 0), 0,
  );
  const excedenteCentavos = Math.max(0, pagoCentavos - totalCentavos);
  const excedenteValido = excedenteCentavos <= dinheiroCentavos;
  return {
    totalPago: pagoCentavos / 100,
    valorDinheiro: dinheiroCentavos / 100,
    restante: Math.max(0, totalCentavos - pagoCentavos) / 100,
    excedente: excedenteCentavos / 100,
    suficiente: pagoCentavos >= totalCentavos,
    excedenteValido,
    troco: excedenteValido ? excedenteCentavos / 100 : 0,
  };
}
