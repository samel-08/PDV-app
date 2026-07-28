import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  // Find products where estoqueAtual <= estoqueMinimo and are active
  const produtos = await prisma.produto.findMany({
    where: {
      ativo: true,
      estoqueMinimo: { gt: 0 },
    },
    select: {
      id: true,
      codigo: true,
      nome: true,
      estoqueAtual: true,
      estoqueMinimo: true,
      unidadeMedida: true,
    },
    orderBy: { nome: "asc" },
  });

  // Filter in JS since SQLite doesn't support column-to-column comparison in where
  const baixo = produtos.filter((p) => p.estoqueAtual <= p.estoqueMinimo);

  return NextResponse.json({ data: baixo, total: baixo.length });
}
