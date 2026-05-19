import { z } from "zod";

export const UNIDADES = ["KG", "UN", "CX", "G"] as const;
export type UnidadeMedida = (typeof UNIDADES)[number];

const categoriaIdField = z
  .union([z.string(), z.null(), z.literal("")])
  .optional()
  .transform((v) => {
    if (v === "" || v === null || v === undefined) return null;
    return v;
  });

export const produtoCreateSchema = z.object({
  nome: z.string().min(1, "Informe o nome."),
  codigo: z.string().min(1, "Informe o código.").max(64),
  precoCusto: z.coerce.number().nonnegative(),
  precoVenda: z.coerce.number().nonnegative(),
  markupPercent: z.coerce.number().optional(),
  unidadeMedida: z.enum(UNIDADES).default("UN"),
  categoriaId: categoriaIdField,
  ativo: z.coerce.boolean().optional().default(true),
});

export const produtoUpdateSchema = produtoCreateSchema.partial();

export const categoriaCreateSchema = z.object({
  nome: z.string().min(1, "Informe o nome da categoria.").max(80),
});

export const vendaCreateSchema = z.object({
  itens: z
    .array(
      z.object({
        produtoId: z.string().min(1),
        quantidade: z.coerce
          .number()
          .refine((n) => Number.isFinite(n) && n >= 0.0005 && n <= 1_000_000, "Quantidade inválida."),
      })
    )
    .min(1),
  formaPagamento: z.enum(["DINHEIRO", "PIX", "CREDITO", "DEBITO"]),
  valorRecebido: z.coerce.number().nonnegative(),
});

export const caixaAbrirSchema = z.object({
  valorInicial: z.coerce.number().nonnegative(),
});

export const caixaValorSchema = z.object({
  valor: z.coerce.number().positive(),
  descricao: z.string().max(200).optional(),
});

export const configBalancaSchema = z
  .object({
    tamanhoCodigoBarras: z.coerce.number().int().min(4).max(64),
    prefixoIdentificacao: z.string().max(32).optional().default(""),
    codigoProdutoInicio: z.coerce.number().int().min(1),
    codigoProdutoFim: z.coerce.number().int().min(1),
    pesoValorInicio: z.coerce.number().int().min(1),
    pesoValorFim: z.coerce.number().int().min(1),
    contemTipo: z.enum(["PESO", "VALOR"]),
    casasDecimais: z.coerce.number().int().min(0).max(3),
  })
  .superRefine((d, ctx) => {
    if (d.codigoProdutoFim < d.codigoProdutoInicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Posição final do código do produto deve ser ≥ à inicial.",
        path: ["codigoProdutoFim"],
      });
    }
    if (d.pesoValorFim < d.pesoValorInicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Posição final do peso/valor deve ser ≥ à inicial.",
        path: ["pesoValorFim"],
      });
    }
    const rangesOverlap = !(
      d.codigoProdutoFim < d.pesoValorInicio || d.pesoValorFim < d.codigoProdutoInicio
    );
    if (rangesOverlap) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "As faixas do código do produto e do peso/valor não podem se sobrepor.",
        path: ["pesoValorInicio"],
      });
    }
    if (d.contemTipo === "VALOR" && d.casasDecimais > 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Para valor, no máximo 2 casas decimais.",
        path: ["casasDecimais"],
      });
    }
    if (d.contemTipo === "PESO" && d.casasDecimais > 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Para peso, no máximo 3 casas decimais.",
        path: ["casasDecimais"],
      });
    }
    if (d.tamanhoCodigoBarras < Math.max(d.codigoProdutoFim, d.pesoValorFim)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "O tamanho total do código deve cobrir todas as posições configuradas.",
        path: ["tamanhoCodigoBarras"],
      });
    }
  });
