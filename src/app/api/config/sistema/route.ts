import { AccessError } from "@/lib/tenant-context";
import { empresaId } from "@/lib/tenant-context";
import { tenantRoute, ADMINS } from "@/lib/tenant-route";
import { CARGOS } from "@/lib/tenant-context";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type EmpresaCampo =
  | "nomeFantasia"
  | "razaoSocial"
  | "cnpj"
  | "inscricaoEstadual"
  | "telefoneWhatsApp"
  | "enderecoCompleto"
  | "cidade"
  | "estado"
  | "cep"
  | "mensagemRodapeCupom"
  | "observacaoCupom";

type ConfigSistemaBody = {
  permitirEstoqueNegativo?: boolean;
} & Partial<Record<EmpresaCampo, unknown>>;

const camposEmpresa: { key: EmpresaCampo; max: number }[] = [
  { key: "nomeFantasia", max: 120 },
  { key: "razaoSocial", max: 160 },
  { key: "cnpj", max: 18 },
  { key: "inscricaoEstadual", max: 40 },
  { key: "telefoneWhatsApp", max: 20 },
  { key: "enderecoCompleto", max: 240 },
  { key: "cidade", max: 80 },
  { key: "estado", max: 2 },
  { key: "cep", max: 9 },
  { key: "mensagemRodapeCupom", max: 180 },
  { key: "observacaoCupom", max: 180 },
];

function limparTexto(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const texto = value.trim();
  return texto ? texto.slice(0, max) : null;
}

function dadosEmpresa(body: ConfigSistemaBody) {
  const data: Partial<Record<EmpresaCampo, string | null>> = {};
  for (const campo of camposEmpresa) {
    if (Object.prototype.hasOwnProperty.call(body, campo.key)) {
      const valor = limparTexto(body[campo.key], campo.max);
      data[campo.key] =
        campo.key === "estado" && valor ? valor.toUpperCase() : valor;
    }
  }
  return data;
}

export async function GET(req: Request) {
  return tenantRoute(req, CARGOS, async () => {
    const config = await prisma.configSistema.findUniqueOrThrow({
      where: { empresaId: empresaId() },
    });
    return NextResponse.json(config);
  });
}

export async function PATCH(req: Request) {
  return tenantRoute(req, ADMINS, async () => {
    try {
      const body = (await req.json()) as ConfigSistemaBody;
      const empresa = dadosEmpresa(body);
      const estoque =
        typeof body.permitirEstoqueNegativo === "boolean"
          ? { permitirEstoqueNegativo: body.permitirEstoqueNegativo }
          : {};

      const config = await prisma.configSistema.upsert({
        where: { empresaId: empresaId() },
        create: {
          empresaId: empresaId(),

          permitirEstoqueNegativo: body.permitirEstoqueNegativo ?? false,
          ...empresa,
        },
        update: {
          ...estoque,
          ...empresa,
        },
      });
      return NextResponse.json(config);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Erro ao salvar configuração.";
      return NextResponse.json(
        { error: msg },
        { status: e instanceof AccessError ? e.status : 400 },
      );
    }
  });
}

export const runtime = "nodejs";
