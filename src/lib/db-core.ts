/** Acesso global reservado a identidade, provisionamento e migração. Não usar em rotas operacionais. */
import { PrismaClient } from "@prisma/client";
const globalDb = globalThis as unknown as { pdvCore?: PrismaClient };
export const coreDb = globalDb.pdvCore ?? new PrismaClient({ log: [] });
if (process.env.NODE_ENV !== "production") globalDb.pdvCore = coreDb;
