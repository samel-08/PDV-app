import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const codigo = (searchParams.get("codigo") ?? "").trim();
  const q = (searchParams.get("q") ?? "").trim();

  if (codigo) {
    const produto = await prisma.produto.findFirst({
      where: {
        ativo: true,
        codigo,
      },
      select: {
        id: true,
        codigo: true,
        nome: true,
        precoVenda: true,
        unidadeMedida: true,
        ativo: true,
      },
    });

    return NextResponse.json({ data: produto ? [produto] : [] });
  }

  if (!q) return NextResponse.json({ data: [] });

  const rows = await prisma.produto.findMany({
    where: {
      ativo: true,
      OR: [{ nome: { contains: q } }, { codigo: { contains: q } }],
    },
    take: 20,
    orderBy: { nome: "asc" },
    select: {
      id: true,
      codigo: true,
      nome: true,
      precoVenda: true,
      unidadeMedida: true,
      ativo: true,
    },
  });

  return NextResponse.json({ data: rows });
}
