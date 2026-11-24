import { AsyncLocalStorage } from "node:async_hooks";

export const CARGOS = ["ADMINISTRADOR", "GERENTE", "CAIXA"] as const;
export type Cargo = (typeof CARGOS)[number];
export type TenantContext = {
  usuarioId: string;
  empresaId: string;
  cargo: Cargo;
  sessaoId: string;
  nome: string;
  empresaNome: string;
};
export class AccessError extends Error {
  constructor(
    message: string,
    readonly status = 403,
  ) {
    super(message);
  }
}
const storage = new AsyncLocalStorage<TenantContext>();
export function tenantContext() {
  const value = storage.getStore();
  if (!value?.empresaId)
    throw new AccessError("Contexto de empresa obrigatório.", 401);
  return value;
}
export function empresaId() {
  return tenantContext().empresaId;
}
export function runAsTenant<T>(context: TenantContext, work: () => T): T {
  return storage.run(context, work);
}
