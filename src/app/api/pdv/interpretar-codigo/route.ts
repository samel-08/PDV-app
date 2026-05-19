import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { candidatosCodigoProduto, extrairDigitosBalanca, quantidadeDoSegmento } from "@/lib/balanca";
import { getConfigBalanca } from "@/lib/balanca-config";

const bodySchema = z.object({
  codigoBarras: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const { codigoBarras } = bodySchema.parse(await req.json());
    const cfg = await getConfigBalanca();
    const digits = extrairDigitosBalanca(cfg, codigoBarras);
    if (!digits) {
      return NextResponse.json(
        { error: "Código não confere com o tamanho ou prefixo configurado para a balança." },
        { status: 400 }
      );
    }

    const candidatos = candidatosCodigoProduto(cfg, digits);
    const produto = await prisma.produto.findFirst({
      where: { ativo: true, codigo: { in: candidatos } },
    });
    if (!produto) {
      return NextResponse.json({ error: "Produto não encontrado para o código extraído." }, { status: 404 });
    }

    const quantidade = quantidadeDoSegmento(cfg, digits, produto.precoVenda);
    if (quantidade == null) {
      return NextResponse.json({ error: "Não foi possível interpretar peso/valor no código." }, { status: 400 });
    }

    return NextResponse.json({
      produto: {
        id: produto.id,
        codigo: produto.codigo,
        nome: produto.nome,
        precoVenda: produto.precoVenda,
      },
      quantidade,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao interpretar código.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
