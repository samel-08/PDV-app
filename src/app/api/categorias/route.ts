import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { categoriaCreateSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET() {
  const rows = await prisma.categoria.findMany({ orderBy: { nome: "asc" } });
  return NextResponse.json({ data: rows });
}

export async function POST(req: Request) {
  try {
    const body = categoriaCreateSchema.parse(await req.json());
    const nome = body.nome.trim();
    const c = await prisma.categoria.create({ data: { nome } });
    return NextResponse.json(c, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao criar categoria.";
    if (typeof e === "object" && e && "code" in e && (e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Já existe uma categoria com este nome." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
