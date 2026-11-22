import { PrismaClient } from "@prisma/client";
import { resolve } from "node:path";

const expected = `file:${resolve("prisma/demo.db").replaceAll("\\", "/")}`;
if (process.env.DATABASE_URL !== expected) {
  throw new Error("Use npm run demo:setup. Este seed só pode acessar prisma/demo.db.");
}
const prisma = new PrismaClient();
async function main() {
  await prisma.$transaction(async (tx) => {
    for (const nome of ["Bebidas", "Naturais", "Vestuário"]) {
      await tx.categoria.upsert({ where: { nome }, create: { nome }, update: {} });
    }
    const produtos = [
      { codigo: "001", nome: "Água mineral 500 ml", precoCusto: 1.2, precoVenda: 2.5, unidadeMedida: "UN", estoqueAtual: 40, categoria: "Bebidas" },
      { codigo: "002", nome: "Suco de uva 1 L", precoCusto: 8, precoVenda: 12, unidadeMedida: "UN", estoqueAtual: 20, categoria: "Bebidas" },
      { codigo: "10001", nome: "Granola a granel", precoCusto: 18, precoVenda: 32, unidadeMedida: "KG", estoqueAtual: 15, categoria: "Naturais" },
      { codigo: "10002", nome: "Castanha-de-caju a granel", precoCusto: 40, precoVenda: 60, unidadeMedida: "KG", estoqueAtual: 8, categoria: "Naturais" },
      { codigo: "CAM-M-AZ", nome: "Camiseta azul M", precoCusto: 20, precoVenda: 39.9, unidadeMedida: "UN", estoqueAtual: 12, categoria: "Vestuário" },
      { codigo: "CAL-40", nome: "Calça jeans 40", precoCusto: 50, precoVenda: 99.9, unidadeMedida: "UN", estoqueAtual: 6, categoria: "Vestuário" },
    ];
    for (const { categoria: nome, ...produto } of produtos) {
      const categoria = await tx.categoria.findUniqueOrThrow({ where: { nome } });
      await tx.produto.upsert({
        where: { codigo: produto.codigo },
        create: { ...produto, categoriaId: categoria.id, estoqueMinimo: 2,
          markupPercent: Math.round((produto.precoVenda / produto.precoCusto - 1) * 10000) / 100 },
        update: {},
      });
    }
    await tx.configSistema.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", nomeFantasia: "Comércio Demonstração", cidade: "Curitiba", estado: "PR",
        permitirEstoqueNegativo: false, mensagemRodapeCupom: "Obrigado pela visita!",
        observacaoCupom: "Demonstração com dados fictícios." },
      update: {},
    });
    await tx.configBalanca.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", tamanhoCodigoBarras: 13, prefixoIdentificacao: "2",
        codigoProdutoInicio: 2, codigoProdutoFim: 6, pesoValorInicio: 7, pesoValorFim: 12,
        contemTipo: "PESO", casasDecimais: 3 },
      update: {},
    });
  });
}
main().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
