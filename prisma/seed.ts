import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL =
  process.env.SUPER_ADMIN_EMAIL?.trim() || "admin@localhost";
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || "admin123";

function calcularMarkup(precoVenda: number, precoCusto: number) {
  return Math.round((precoVenda / precoCusto - 1) * 10000) / 100;
}

function adicionarDias(data: Date, dias: number) {
  const novaData = new Date(data);
  novaData.setDate(novaData.getDate() + dias);
  return novaData;
}

function hashSenha(senha: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(senha, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

async function seedDadosAtuais() {
  const catBeb = await prisma.categoria.upsert({
    where: { nome: "Bebidas" },
    create: { nome: "Bebidas" },
    update: {},
  });

  const catPad = await prisma.categoria.upsert({
    where: { nome: "Padaria" },
    create: { nome: "Padaria" },
    update: {},
  });

  await prisma.categoria.upsert({
    where: { nome: "Mercearia" },
    create: { nome: "Mercearia" },
    update: {},
  });

  await prisma.produto.upsert({
    where: { codigo: "001" },
    create: {
      codigo: "001",
      nome: "Agua mineral 500ml",
      precoCusto: 1.2,
      precoVenda: 2.5,
      markupPercent: calcularMarkup(2.5, 1.2),
      unidadeMedida: "UN",
      categoriaId: catBeb.id,
      ativo: true,
    },
    update: {},
  });

  await prisma.produto.upsert({
    where: { codigo: "002" },
    create: {
      codigo: "002",
      nome: "Refrigerante lata",
      precoCusto: 2.5,
      precoVenda: 5.0,
      markupPercent: calcularMarkup(5.0, 2.5),
      unidadeMedida: "UN",
      categoriaId: catBeb.id,
      ativo: true,
    },
    update: {},
  });

  await prisma.produto.upsert({
    where: { codigo: "003" },
    create: {
      codigo: "003",
      nome: "Pao frances (un)",
      precoCusto: 0.5,
      precoVenda: 1.0,
      markupPercent: calcularMarkup(1.0, 0.5),
      unidadeMedida: "UN",
      categoriaId: catPad.id,
      ativo: true,
    },
    update: {},
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

async function seedFundacaoSaas() {
  const empresa = await prisma.empresa.upsert({
    where: { id: "empresa_padrao" },
    create: {
      id: "empresa_padrao",
      nome: "Empresa Padrao",
      status: "ATIVA",
    },
    update: {
      status: "ATIVA",
    },
  });

  const plano = await prisma.plano.upsert({
    where: { nome: "Plano Completo" },
    create: {
      id: "plano_completo",
      nome: "Plano Completo",
      descricao: "Acesso completo ao sistema PDV.",
      duracaoDias: 365,
      ativo: true,
    },
    update: {
      descricao: "Acesso completo ao sistema PDV.",
      duracaoDias: 365,
      ativo: true,
    },
  });

  const agora = new Date();
  const licencaExistente = await prisma.licencaEmpresa.findFirst({
    where: { empresaId: empresa.id },
    orderBy: { createdAt: "asc" },
  });

  if (licencaExistente) {
    await prisma.licencaEmpresa.update({
      where: { id: licencaExistente.id },
      data: {
        planoId: plano.id,
        status: "ATIVA",
        motivoBloqueio: null,
        expiraEm:
          licencaExistente.expiraEm > agora
            ? licencaExistente.expiraEm
            : adicionarDias(agora, plano.duracaoDias),
      },
    });
  } else {
    await prisma.licencaEmpresa.create({
      data: {
        id: "licenca_empresa_padrao",
        empresaId: empresa.id,
        planoId: plano.id,
        status: "ATIVA",
        inicioEm: agora,
        expiraEm: adicionarDias(agora, plano.duracaoDias),
      },
    });
  }

  const usuarioExistente = await prisma.usuario.findUnique({
    where: { email: SUPER_ADMIN_EMAIL },
  });

  const usuario = usuarioExistente
    ? await prisma.usuario.update({
        where: { id: usuarioExistente.id },
        data: {
          nome: "Super Admin",
          status: "ATIVO",
          roleGlobal: "SUPER_ADMIN",
        },
      })
    : await prisma.usuario.create({
        data: {
          nome: "Super Admin",
          email: SUPER_ADMIN_EMAIL,
          senhaHash: hashSenha(SUPER_ADMIN_PASSWORD),
          status: "ATIVO",
          roleGlobal: "SUPER_ADMIN",
        },
      });

  await prisma.usuarioEmpresa.upsert({
    where: {
      usuarioId_empresaId: {
        usuarioId: usuario.id,
        empresaId: empresa.id,
      },
    },
    create: {
      usuarioId: usuario.id,
      empresaId: empresa.id,
      cargo: "ADMINISTRADOR",
      ativo: true,
    },
    update: {
      cargo: "ADMINISTRADOR",
      ativo: true,
    },
  });
}

async function main() {
  await seedDadosAtuais();
  await seedFundacaoSaas();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
