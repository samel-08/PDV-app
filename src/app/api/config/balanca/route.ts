import { AccessError } from "@/lib/tenant-context";
import { tenantRoute, ADMINS } from "@/lib/tenant-route";
import { CARGOS } from "@/lib/tenant-context";
import { NextResponse } from "next/server";
import { getConfigBalanca, updateConfigBalanca } from "@/lib/balanca-config";
import { configBalancaSchema } from "@/lib/validators";

export async function GET(req: Request) {
  return tenantRoute(req, CARGOS, async () => {
    const cfg = await getConfigBalanca();
    return NextResponse.json(cfg);
  });
}

export async function PUT(req: Request) {
  return tenantRoute(req, ADMINS, async () => {
    try {
      const data = configBalancaSchema.parse(await req.json());
      await updateConfigBalanca({
        tamanhoCodigoBarras: data.tamanhoCodigoBarras,
        prefixoIdentificacao: data.prefixoIdentificacao ?? "",
        codigoProdutoInicio: data.codigoProdutoInicio,
        codigoProdutoFim: data.codigoProdutoFim,
        pesoValorInicio: data.pesoValorInicio,
        pesoValorFim: data.pesoValorFim,
        contemTipo: data.contemTipo,
        casasDecimais: data.casasDecimais,
      });
      const cfg = await getConfigBalanca();
      return NextResponse.json(cfg);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar.";
      return NextResponse.json(
        { error: msg },
        { status: e instanceof AccessError ? e.status : 400 },
      );
    }
  });
}

export const runtime = "nodejs";
