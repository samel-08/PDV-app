import { coreDb } from "@/lib/db-core";
import { AccessError, tenantContext } from "@/lib/tenant-context";
const tenantModels = new Set([
  "Categoria",
  "Produto",
  "ConfigBalanca",
  "ConfigSistema",
  "CaixaSessao",
  "Venda",
  "ItensVenda",
  "PagamentoVenda",
  "MovimentacaoCaixa",
  "MovimentacaoEstoque",
  "SequenciaVenda",
]);
const reads = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
  "upsert",
]);
const creates = new Set(["create", "createMany", "createManyAndReturn"]);
const identityRelations = new Set([
  "empresa",
  "operador",
  "usuario",
  "usuarios",
  "empresas",
  "vinculo",
  "sessoes",
  "licencas",
  "cobrancas",
  "auditLogs",
]);
function rejectIdentityRelations(value: unknown): void {
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (identityRelations.has(key))
      throw new AccessError("Relação de identidade reservada ao servidor.");
    if (typeof item === "object") rejectIdentityRelations(item);
  }
}
function checkTenantData(value: unknown, tenant: string): void {
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (key === "empresaId" && item !== tenant)
      throw new AccessError("Empresa inválida para esta operação.");
    if (key === "empresa" || key === "operador")
      throw new AccessError("Relação reservada ao servidor.");
    if (typeof item === "object") checkTenantData(item, tenant);
  }
}
/** Inclui transações; raw SQL, modelos globais e consultas sem contexto são recusados. */
export const prisma = coreDb.$extends({
  name: "empresa-obrigatoria",
  query: {
    async $allOperations({ model, operation, args, query }) {
      const context = tenantContext();
      if (!model || !tenantModels.has(model))
        throw new AccessError(
          "Modelo ou SQL não disponível na operação do PDV.",
        );
      if (!reads.has(operation) && !creates.has(operation))
        throw new AccessError("Operação não suportada pelo escopo de empresa.");
      const scoped = args as Record<string, unknown>;
      for (const key of ["where", "include", "select"])
        rejectIdentityRelations(scoped[key]);
      if (reads.has(operation))
        scoped.where = {
          ...((scoped.where ?? {}) as object),
          empresaId: context.empresaId,
        };
      for (const key of ["data", "create", "update"]) {
        const data = scoped[key];
        if (!data) continue;
        checkTenantData(data, context.empresaId);
        const rows = Array.isArray(data) ? data : [data];
        for (const row of rows) {
          if (!row || typeof row !== "object") continue;
          if (key === "create" || creates.has(operation))
            Object.assign(row, { empresaId: context.empresaId });
          if (
            [
              "Venda",
              "CaixaSessao",
              "MovimentacaoCaixa",
              "MovimentacaoEstoque",
            ].includes(model) &&
            (key === "create" || creates.has(operation))
          )
            Object.assign(row, { operadorId: context.usuarioId });
        }
      }
      return query(args);
    },
  },
});
