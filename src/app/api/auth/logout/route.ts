import { NextResponse } from "next/server";
import { coreDb } from "@/lib/db-core";
import { COOKIE, sessionCookieOptions } from "@/lib/auth-session";
import { CARGOS, tenantContext } from "@/lib/tenant-context";
import { tenantRoute } from "@/lib/tenant-route";
export async function POST(req: Request) {
  return tenantRoute(req, CARGOS, async () => {
    await coreDb.sessaoUsuario.update({
      where: { id: tenantContext().sessaoId },
      data: { revogadaEm: new Date() },
    });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE, "", sessionCookieOptions(0));
    return response;
  });
}
