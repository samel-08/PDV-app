import { AccessError } from "@/lib/tenant-context";
import { empresaId } from "@/lib/tenant-context";
import { tenantRoute, MANAGERS } from "@/lib/tenant-route";
import { CARGOS } from "@/lib/tenant-context";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { categoriaCreateSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return tenantRoute(req, CARGOS, async () => {
    const rows = await prisma.categoria.findMany({ orderBy: { nome: "asc" } });
    return NextResponse.json({ data: rows });
  });
}

export async function POST(req: Request) {
  return tenantRoute(req, MANAGERS, async () => {
    try {
      const body = categoriaCreateSchema.parse(await req.json());
      const nome = body.nome.trim();
      const c = await prisma.categoria.create({
        data: { empresaId: empresaId(), nome },
      });
      return NextResponse.json(c, { status: 201 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao criar categoria.";
      if (
        typeof e === "object" &&
        e &&
        "code" in e &&
        (e as { code?: string }).code === "P2002"
      ) {
        return NextResponse.json(
          { error: "Já existe uma categoria com este nome." },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: msg },
        { status: e instanceof AccessError ? e.status : 400 },
      );
    }
  });
}
