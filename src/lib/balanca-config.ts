import { prisma } from "@/lib/db";
import { empresaId } from "@/lib/tenant-context";
import type { ConfigBalancaDTO } from "@/lib/balanca-types";
function dto(
  row: Awaited<ReturnType<typeof prisma.configBalanca.findUniqueOrThrow>>,
): ConfigBalancaDTO {
  return { ...row, contemTipo: row.contemTipo === "VALOR" ? "VALOR" : "PESO" };
}
export async function getConfigBalanca(): Promise<ConfigBalancaDTO> {
  return dto(
    await prisma.configBalanca.findUniqueOrThrow({
      where: { empresaId: empresaId() },
    }),
  );
}
export async function updateConfigBalanca(data: Omit<ConfigBalancaDTO, "id">) {
  await prisma.configBalanca.upsert({
    where: { empresaId: empresaId() },
    create: { ...data, empresaId: empresaId() },
    update: data,
  });
}
