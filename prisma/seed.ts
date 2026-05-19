import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.categoria.createMany({
    data: [{ nome: "Bebidas" }, { nome: "Padaria" }, { nome: "Mercearia" }],
  });

  const catBeb = await prisma.categoria.findUnique({ where: { nome: "Bebidas" } });
  const catPad = await prisma.categoria.findUnique({ where: { nome: "Padaria" } });

  await prisma.produto.createMany({
    data: [
      {
        codigo: "001",
        nome: "Água mineral 500ml",
        precoCusto: 1.2,
        precoVenda: 2.5,
        markupPercent: Math.round((2.5 / 1.2 - 1) * 10000) / 100,
        unidadeMedida: "UN",
        categoriaId: catBeb?.id,
        ativo: true,
      },
      {
        codigo: "002",
        nome: "Refrigerante lata",
        precoCusto: 2.5,
        precoVenda: 5.0,
        markupPercent: Math.round((5 / 2.5 - 1) * 10000) / 100,
        unidadeMedida: "UN",
        categoriaId: catBeb?.id,
        ativo: true,
      },
      {
        codigo: "003",
        nome: "Pão francês (un)",
        precoCusto: 0.5,
        precoVenda: 1.0,
        markupPercent: Math.round((1 / 0.5 - 1) * 10000) / 100,
        unidadeMedida: "UN",
        categoriaId: catPad?.id,
        ativo: true,
      },
    ],
  });

  await prisma.configBalanca.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      tamanhoCodigoBarras: 13,
      prefixoIdentificacao: "",
      codigoProdutoInicio: 1,
      codigoProdutoFim: 6,
      pesoValorInicio: 7,
      pesoValorFim: 12,
      contemTipo: "PESO",
      casasDecimais: 3,
    },
    update: {},
  });

  await prisma.venda.updateMany({
    where: { formaPagamento: "CARTAO" },
    data: { formaPagamento: "CREDITO" },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
