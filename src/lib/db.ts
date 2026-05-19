import { PrismaClient } from "@prisma/client";

/** Troque o sufixo após mudanças no schema para invalidar cliente Prisma em cache no dev (evita delegates undefined). */
const PRISMA_GLOBAL_KEY = "__pdv_prisma_client_v3__" as const;

const globalForPrisma = globalThis as unknown as Record<string, PrismaClient | undefined>;

export const prisma =
  globalForPrisma[PRISMA_GLOBAL_KEY] ??
  new PrismaClient({
    /** Em produção, logs vazios reduzem I/O no disco (útil em SSD lentos / CPU fraca). */
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : [],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma[PRISMA_GLOBAL_KEY] = prisma;
}
