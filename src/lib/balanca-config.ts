import { prisma } from "@/lib/db";
import type { ConfigBalancaDTO } from "@/lib/balanca-types";

const DEFAULT: Omit<ConfigBalancaDTO, "id"> = {
  tamanhoCodigoBarras: 13,
  prefixoIdentificacao: "",
  codigoProdutoInicio: 1,
  codigoProdutoFim: 6,
  pesoValorInicio: 7,
  pesoValorFim: 12,
  contemTipo: "PESO",
  casasDecimais: 3,
};

function toDto(row: {
  id: string;
  tamanhoCodigoBarras: number;
  prefixoIdentificacao: string;
  codigoProdutoInicio: number;
  codigoProdutoFim: number;
  pesoValorInicio: number;
  pesoValorFim: number;
  contemTipo: string;
  casasDecimais: number;
}): ConfigBalancaDTO {
  return {
    id: row.id,
    tamanhoCodigoBarras: row.tamanhoCodigoBarras,
    prefixoIdentificacao: row.prefixoIdentificacao,
    codigoProdutoInicio: row.codigoProdutoInicio,
    codigoProdutoFim: row.codigoProdutoFim,
    pesoValorInicio: row.pesoValorInicio,
    pesoValorFim: row.pesoValorFim,
    contemTipo: row.contemTipo === "VALOR" ? "VALOR" : "PESO",
    casasDecimais: row.casasDecimais,
  };
}

export async function getConfigBalanca(): Promise<ConfigBalancaDTO> {
  const row = await prisma.configBalanca.findUnique({ where: { id: "singleton" } });
  if (!row) {
    const created = await prisma.configBalanca.create({
      data: {
        id: "singleton",
        tamanhoCodigoBarras: DEFAULT.tamanhoCodigoBarras,
        prefixoIdentificacao: DEFAULT.prefixoIdentificacao,
        codigoProdutoInicio: DEFAULT.codigoProdutoInicio,
        codigoProdutoFim: DEFAULT.codigoProdutoFim,
        pesoValorInicio: DEFAULT.pesoValorInicio,
        pesoValorFim: DEFAULT.pesoValorFim,
        contemTipo: DEFAULT.contemTipo,
        casasDecimais: DEFAULT.casasDecimais,
      },
    });
    return toDto(created);
  }
  return toDto(row);
}

export async function updateConfigBalanca(data: {
  tamanhoCodigoBarras: number;
  prefixoIdentificacao: string;
  codigoProdutoInicio: number;
  codigoProdutoFim: number;
  pesoValorInicio: number;
  pesoValorFim: number;
  contemTipo: "PESO" | "VALOR";
  casasDecimais: number;
}) {
  await prisma.configBalanca.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });
}
