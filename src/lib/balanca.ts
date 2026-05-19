import type { ConfigBalancaDTO } from "@/lib/balanca-types";

export type { ConfigBalancaDTO } from "@/lib/balanca-types";

function sliceDigits(all: string, start1: number, end1: number): string {
  if (start1 < 1 || end1 < start1) return "";
  return all.slice(start1 - 1, end1);
}

export function extrairDigitosBalanca(cfg: ConfigBalancaDTO, codigoBarrasRaw: string): string | null {
  const digits = codigoBarrasRaw.replace(/\D/g, "");
  if (digits.length !== cfg.tamanhoCodigoBarras) return null;
  if (cfg.prefixoIdentificacao && !digits.startsWith(cfg.prefixoIdentificacao)) return null;
  return digits;
}

/** Códigos possíveis para bater com `Produto.codigo` (com e sem zeros à esquerda). */
export function candidatosCodigoProduto(cfg: ConfigBalancaDTO, digits: string): string[] {
  const raw = sliceDigits(digits, cfg.codigoProdutoInicio, cfg.codigoProdutoFim);
  const trimmed = raw.replace(/^0+/, "") || "0";
  return [...new Set([raw, trimmed])];
}

export function quantidadeDoSegmento(cfg: ConfigBalancaDTO, digits: string, precoVenda: number): number | null {
  const pesoValorRaw = sliceDigits(digits, cfg.pesoValorInicio, cfg.pesoValorFim);
  if (!/^\d+$/.test(pesoValorRaw)) return null;
  const intPart = parseInt(pesoValorRaw, 10);
  if (!Number.isFinite(intPart)) return null;
  const div = 10 ** cfg.casasDecimais;
  const valorInterpretado = intPart / div;

  if (cfg.contemTipo === "PESO") {
    if (valorInterpretado <= 0) return null;
    return Math.round(valorInterpretado * 1000) / 1000;
  }

  if (valorInterpretado <= 0 || precoVenda <= 0) return null;
  const q = valorInterpretado / precoVenda;
  if (!Number.isFinite(q) || q <= 0) return null;
  return Math.round(q * 1000) / 1000;
}
