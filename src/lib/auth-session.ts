import { SignJWT, jwtVerify } from "jose";
const COOKIE = "pdv_session";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 12;
function getSecret() {
  const secret = process.env.PDV_SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new Error(
      "Configure PDV_SESSION_SECRET com pelo menos 32 caracteres.",
    );
  return new TextEncoder().encode(secret);
}
export function isSessionCookieSecure() {
  const value = process.env.PDV_COOKIE_SECURE?.trim().toLowerCase();
  return value
    ? ["true", "1", "yes"].includes(value)
    : !!process.env.APP_ORIGIN?.startsWith("https://");
}
export function sessionCookieOptions(maxAge?: number) {
  return {
    httpOnly: true as const,
    secure: isSessionCookieSecure(),
    sameSite: "lax" as const,
    path: "/",
    ...(maxAge === undefined ? {} : { maxAge }),
  };
}
export type SessionClaims = {
  usuarioId: string;
  empresaId: string;
  sessaoId: string;
};
export async function createSessionJwt(claims: SessionClaims) {
  return new SignJWT({ empresaId: claims.empresaId, v: 2 })
    .setSubject(claims.usuarioId)
    .setJti(claims.sessaoId)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("pdv-comercio")
    .setAudience("pdv-operacional")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SEC}s`)
    .sign(getSecret());
}
export async function readSessionJwt(
  token: string | undefined,
): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
      issuer: "pdv-comercio",
      audience: "pdv-operacional",
    });
    if (
      payload.v !== 2 ||
      !payload.sub ||
      !payload.jti ||
      typeof payload.empresaId !== "string"
    )
      return null;
    return {
      usuarioId: payload.sub,
      empresaId: payload.empresaId,
      sessaoId: payload.jti,
    };
  } catch {
    return null;
  }
}
export async function verifySessionJwt(token: string | undefined) {
  return !!(await readSessionJwt(token));
}
export { COOKIE };
