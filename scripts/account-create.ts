import { PrismaClient } from "@prisma/client";
import { provision } from "./provision";
import type { Cargo } from "../src/lib/tenant-context";
const db = new PrismaClient();
provision(db, {
  empresaId: process.env.EMPRESA_ID,
  empresaNome: process.env.EMPRESA_NOME,
  nome: process.env.ACCOUNT_NAME?.trim() || "Administrador",
  email: process.env.ACCOUNT_LOGIN ?? "",
  password: process.env.ACCOUNT_PASSWORD ?? "",
  resetExisting: process.env.ACCOUNT_RESET_EXISTING === "true",
  cargo: (process.env.ACCOUNT_ROLE ?? "ADMINISTRADOR") as Cargo,
})
  .then((result) =>
    console.log(
      `Conta preparada: ${result.email}. Empresa: ${result.empresaId}. ${process.env.ACCOUNT_RESET_EXISTING === "true" ? "Senha atualizada e sessões antigas revogadas." : "Credenciais existentes preservadas."}`,
    ),
  )
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Falha");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
