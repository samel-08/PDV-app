import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { SignJWT } from "jose";
import { createSessionJwt, readSessionJwt } from "../../src/lib/auth-session";

test("JWT exige versão, assinatura, emissor, audiência, expiração e segredo configurado", async () => {
  const previous = process.env.PDV_SESSION_SECRET;
  process.env.PDV_SESSION_SECRET = randomBytes(32).toString("hex");
  const secret = new TextEncoder().encode(process.env.PDV_SESSION_SECRET);
  const claims = {
    usuarioId: "usuario_teste",
    empresaId: "empresa_teste",
    sessaoId: "sessao_teste",
  };
  try {
    const token = await createSessionJwt(claims);
    assert.deepEqual(await readSessionJwt(token), claims);
    const legacy = await new SignJWT({ sub: "pdv" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("pdv-comercio")
      .setAudience("pdv-operacional")
      .setExpirationTime("1h")
      .sign(secret);
    assert.equal(await readSessionJwt(legacy), null);
    const expired = await new SignJWT({ v: 2, empresaId: claims.empresaId })
      .setSubject(claims.usuarioId)
      .setJti(claims.sessaoId)
      .setIssuer("pdv-comercio")
      .setAudience("pdv-operacional")
      .setExpirationTime(0)
      .setProtectedHeader({ alg: "HS256" })
      .sign(secret);
    assert.equal(await readSessionJwt(expired), null);
    const otherIssuer = await new SignJWT({ v: 2, empresaId: claims.empresaId })
      .setSubject(claims.usuarioId)
      .setJti(claims.sessaoId)
      .setIssuer("outro")
      .setAudience("pdv-operacional")
      .setExpirationTime("1h")
      .setProtectedHeader({ alg: "HS256" })
      .sign(secret);
    assert.equal(await readSessionJwt(otherIssuer), null);
    process.env.PDV_SESSION_SECRET = randomBytes(32).toString("hex");
    assert.equal(await readSessionJwt(token), null);
    delete process.env.PDV_SESSION_SECRET;
    await assert.rejects(createSessionJwt(claims), /32 caracteres/);
    assert.equal(await readSessionJwt(token), null);
  } finally {
    if (previous === undefined) delete process.env.PDV_SESSION_SECRET;
    else process.env.PDV_SESSION_SECRET = previous;
  }
});
