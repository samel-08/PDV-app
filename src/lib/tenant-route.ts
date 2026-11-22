import { NextResponse } from "next/server";
import { coreDb } from "@/lib/db-core";
import { COOKIE, readSessionJwt } from "@/lib/auth-session";
import {
  AccessError,
  CARGOS,
  runAsTenant,
  type Cargo,
  type TenantContext,
} from "@/lib/tenant-context";

export const MANAGERS: readonly Cargo[] = ["ADMINISTRADOR", "GERENTE"];
export const ADMINS: readonly Cargo[] = ["ADMINISTRADOR"];
export function assertOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const expected = process.env.APP_ORIGIN || new URL(req.url).origin;
  if (
    req.headers.get("origin") !== expected ||
    req.headers.get("sec-fetch-site") === "cross-site"
  ) {
    throw new AccessError("Origem da requisição não permitida.");
  }
}
export async function authenticate(req: Request): Promise<TenantContext> {
  const cookie = req.headers
    .get("cookie")
    ?.split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1);
  const claims = await readSessionJwt(cookie);
  if (!claims) throw new AccessError("Entre novamente para continuar.", 401);
  const expectedSession = req.headers.get("x-pdv-session");
  if (expectedSession && expectedSession !== claims.sessaoId)
    throw new AccessError("A sessão mudou. Entre novamente.", 401);
  const session = await coreDb.sessaoUsuario.findUnique({
    where: { id: claims.sessaoId },
    include: { vinculo: { include: { usuario: true, empresa: true } } },
  });
  if (
    !session ||
    session.revogadaEm ||
    session.expiraEm <= new Date() ||
    session.usuarioId !== claims.usuarioId ||
    session.empresaId !== claims.empresaId
  )
    throw new AccessError("Sessão encerrada.", 401);
  const link = session.vinculo;
  if (
    !link.ativo ||
    link.usuario.status !== "ATIVO" ||
    link.empresa.status !== "ATIVA" ||
    !CARGOS.includes(link.cargo as Cargo)
  )
    throw new AccessError("Acesso bloqueado.");
  return {
    usuarioId: session.usuarioId,
    empresaId: session.empresaId,
    cargo: link.cargo as Cargo,
    sessaoId: session.id,
    nome: link.usuario.nome,
    empresaNome: link.empresa.nome,
  };
}
const privateCostKeys = new Set([
  "precoCusto",
  "precoCustoSnapshot",
  "markupPercent",
  "lucroEstimado",
]);
function redactCosts(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactCosts);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !privateCostKeys.has(key))
      .map(([key, item]) => [key, redactCosts(item)]),
  );
}
export async function tenantRoute(
  req: Request,
  roles: readonly Cargo[],
  action: () => Promise<Response>,
): Promise<Response> {
  try {
    assertOrigin(req);
    const context = await authenticate(req);
    if (!roles.includes(context.cargo))
      throw new AccessError("Você não tem permissão para esta operação.");
    let response = await runAsTenant(context, action);
    if (response.headers.get("content-type")?.includes("application/json")) {
      const headers = response.headers;
      let value = await response.json();
      if (
        response.status >= 400 &&
        typeof value?.error === "string" &&
        /prisma|invocation|constraint|record.*not found/i.test(value.error)
      ) {
        const missing = /not found|record.*not found/i.test(value.error);
        value = {
          error:
            "Registro não encontrado ou dados inválidos para esta empresa.",
        };
        response = NextResponse.json(value, {
          status: missing ? 404 : response.status,
          headers,
        });
      } else {
        response = NextResponse.json(
          context.cargo === "CAIXA" ? redactCosts(value) : value,
          { status: response.status, headers },
        );
      }
    }
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String(error.code)
        : "";
    const invalid = error instanceof Error && error.name === "ZodError";
    const status =
      error instanceof AccessError
        ? error.status
        : invalid
          ? 400
          : code === "P2025"
            ? 404
            : ["P2002", "P2034", "P1008", "P2028"].includes(code)
              ? 409
              : code === "P2003"
                ? 400
                : 500;
    if (status === 500)
      console.error(
        "Falha na rota operacional",
        error instanceof Error ? error.name : "Erro",
      );
    return NextResponse.json(
      {
        error:
          error instanceof AccessError
            ? error.message
            : status === 409
              ? "A operação conflitou com outra alteração. Tente novamente."
              : status === 404
                ? "Registro não encontrado."
                : status === 400
                  ? "Dados inválidos para esta operação."
                  : "Não foi possível concluir a operação.",
      },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
