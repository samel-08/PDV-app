import { NextResponse } from "next/server";
import { z } from "zod";
import { COOKIE, createSessionJwt, SESSION_MAX_AGE_SEC, sessionCookieOptions } from "@/lib/auth-session";

const bodySchema = z.object({
  usuario: z.string().optional().default(""),
  senha: z.string().min(1, "Informe a senha."),
});

export async function POST(req: Request) {
  try {
    const body = bodySchema.parse(await req.json());
    const expectedUser = process.env.PDV_LOGIN_USER?.trim();
    const expectedPass =
      process.env.PDV_LOGIN_PASSWORD ??
      (process.env.NODE_ENV !== "production" ? "admin" : undefined);

    if (!expectedPass || expectedPass.length < 4) {
      return NextResponse.json(
        {
          error:
            "Defina PDV_LOGIN_PASSWORD no arquivo .env (mín. 4 caracteres) para usar o sistema em produção.",
        },
        { status: 500 }
      );
    }

    if (expectedUser && body.usuario.trim() !== expectedUser) {
      return NextResponse.json({ error: "Usuário ou senha inválidos." }, { status: 401 });
    }

    if (body.senha !== expectedPass) {
      return NextResponse.json({ error: "Usuário ou senha inválidos." }, { status: 401 });
    }

    const jwt = await createSessionJwt();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE, jwt, sessionCookieOptions(SESSION_MAX_AGE_SEC));
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro ao entrar.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
