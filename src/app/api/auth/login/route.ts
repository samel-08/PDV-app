import { NextResponse } from "next/server";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { coreDb } from "@/lib/db-core";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  COOKIE,
  createSessionJwt,
  SESSION_MAX_AGE_SEC,
  sessionCookieOptions,
} from "@/lib/auth-session";
import { assertOrigin } from "@/lib/tenant-route";
import { AccessError, CARGOS, type Cargo } from "@/lib/tenant-context";

export const runtime = "nodejs";
const bodySchema = z.object({
  usuario: z.string().trim().min(1).max(254),
  senha: z.string().min(1).max(256),
});
const dummyHash = hashPassword(randomUUID());
export async function POST(req: Request) {
  try {
    assertOrigin(req);
    const body = bodySchema.parse(await req.json());
    const email = body.usuario.toLowerCase();
    const id = createHash("sha256").update(email).digest("hex");
    const now = new Date();
    const windowStart = new Date(now.getTime() - 15 * 60_000);
    await coreDb.loginThrottle.deleteMany({
      where: { janelaEm: { lt: windowStart } },
    });
    const attempt = await coreDb.loginThrottle.upsert({
      where: { id },
      create: { id, tentativas: 1, janelaEm: now },
      update: { tentativas: { increment: 1 } },
    });
    if (attempt.tentativas > 10)
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde 15 minutos." },
        {
          status: 429,
          headers: { "Retry-After": "900", "Cache-Control": "no-store" },
        },
      );
    const user = await coreDb.usuario.findUnique({
      where: { email },
      include: {
        empresas: {
          where: { ativo: true, empresa: { status: "ATIVA" } },
          include: { empresa: true },
          take: 2,
        },
      },
    });
    const correct = await verifyPassword(
      body.senha,
      user?.senhaHash ?? (await dummyHash),
    );
    if (
      !correct ||
      !user ||
      user.status !== "ATIVO" ||
      user.empresas.length === 0 ||
      !CARGOS.includes(user.empresas[0].cargo as Cargo)
    ) {
      return NextResponse.json(
        { error: "Usuário ou senha inválidos, ou acesso indisponível." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (user.empresas.length !== 1)
      return NextResponse.json(
        {
          error:
            "Esta conta exige seleção de empresa, ainda não disponível. Contate o administrador.",
        },
        { status: 409 },
      );
    const company = user.empresas[0];
    const sessaoId = randomUUID();
    const token = await createSessionJwt({
      usuarioId: user.id,
      empresaId: company.empresaId,
      sessaoId,
    });
    await coreDb.$transaction([
      coreDb.loginThrottle.deleteMany({ where: { id } }),
      coreDb.sessaoUsuario.deleteMany({
        where: { usuarioId: user.id, expiraEm: { lt: now } },
      }),
      coreDb.sessaoUsuario.create({
        data: {
          id: sessaoId,
          usuarioId: user.id,
          empresaId: company.empresaId,
          expiraEm: new Date(now.getTime() + SESSION_MAX_AGE_SEC * 1000),
        },
      }),
    ]);
    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
    response.cookies.set(
      COOKIE,
      token,
      sessionCookieOptions(SESSION_MAX_AGE_SEC),
    );
    return response;
  } catch (error) {
    const status =
      error instanceof AccessError
        ? error.status
        : error instanceof z.ZodError
          ? 400
          : 500;
    return NextResponse.json(
      {
        error:
          error instanceof AccessError
            ? error.message
            : status === 400
              ? "Preencha usuário e senha."
              : "Não foi possível entrar. Confira a configuração do servidor.",
      },
      { status },
    );
  }
}
