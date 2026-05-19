import { SignJWT, jwtVerify } from "jose";

const COOKIE = "pdv_session";

/** 7 dias */
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

function getSecret() {
  const s = process.env.PDV_SESSION_SECRET;
  if (!s || s.length < 8) {
    return new TextEncoder().encode("pdv-dev-secret-altere-em-producao");
  }
  return new TextEncoder().encode(s);
}

/**
 * Cookie `Secure` só quando `PDV_COOKIE_SECURE=true` (HTTPS).
 * Padrão: false — permite login em localhost e na LAN via HTTP (ex.: http://192.168.x.x:3000).
 */
export function isSessionCookieSecure(): boolean {
  const v = process.env.PDV_COOKIE_SECURE?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

export type SessionCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge?: number;
};

export function sessionCookieOptions(maxAge?: number): SessionCookieOptions {
  const base = {
    httpOnly: true as const,
    secure: isSessionCookieSecure(),
    sameSite: "lax" as const,
    path: "/" as const,
  };
  if (maxAge === undefined) return base;
  return { ...base, maxAge };
}

export async function createSessionJwt(): Promise<string> {
  return new SignJWT({ sub: "pdv" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySessionJwt(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

export { COOKIE };
