export type ConfigBalancaDTO = {
  id: string;
  tamanhoCodigoBarras: number;
  prefixoIdentificacao: string;
  codigoProdutoInicio: number;
  codigoProdutoFim: number;
  pesoValorInicio: number;
  pesoValorFim: number;
  contemTipo: "PESO" | "VALOR";
  casasDecimais: number;
};
