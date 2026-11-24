import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { hashPassword } from "../src/lib/password";
import { CARGOS, type Cargo } from "../src/lib/tenant-context";

export async function provision(
  db: PrismaClient,
  input: {
    empresaId?: string;
    empresaNome?: string;
    nome: string;
    email: string;
    password: string;
    cargo?: Cargo;
    resetExisting?: boolean;
  },
) {
  const email = input.email.trim().toLowerCase();
  const requestedId = input.empresaId?.trim() || undefined;
  if (
    !email ||
    email.length > 254 ||
    /\s/.test(email) ||
    !input.nome.trim() ||
    input.password.length < 12 ||
    input.password.length > 256
  )
    throw new Error("Informe login e senha de 12 a 256 caracteres.");
  const cargo = input.cargo ?? "ADMINISTRADOR";
  if (!CARGOS.includes(cargo)) throw new Error("Cargo inválido.");
  const senhaHash = await hashPassword(input.password);
  return db.$transaction(async (tx) => {
    let empresa = requestedId
      ? await tx.empresa.findUnique({ where: { id: requestedId } })
      : null;
    const created = !empresa;
    if (!empresa) {
      if (!input.empresaNome?.trim() || cargo !== "ADMINISTRADOR")
        throw new Error(
          "Informe uma empresa existente ou o nome da nova empresa com administrador.",
        );
      empresa = await tx.empresa.create({
        data: {
          id: requestedId ?? randomUUID(),
          nome: input.empresaNome.trim(),
        },
      });
    }
    const existing = await tx.usuario.findUnique({
      where: { email },
      include: { empresas: true },
    });
    if (
      existing &&
      (!existing.empresas.some((link) => link.empresaId === empresa!.id) ||
        existing.empresas.some((link) => link.empresaId !== empresa!.id))
    ) {
      throw new Error(
        "Login já vinculado a outra empresa. Não há vinculação automática entre lojas.",
      );
    }
    const user = existing
      ? input.resetExisting
        ? await tx.usuario.update({
            where: { id: existing.id },
            data: {
              nome: input.nome,
              senhaHash,
              status: "ATIVO",
              roleGlobal: null,
            },
          })
        : existing
      : await tx.usuario.create({
          data: { nome: input.nome, email, senhaHash },
        });
    if (existing && input.resetExisting)
      await tx.sessaoUsuario.updateMany({
        where: { usuarioId: existing.id },
        data: { revogadaEm: new Date() },
      });
    await tx.usuarioEmpresa.upsert({
      where: {
        usuarioId_empresaId: { usuarioId: user.id, empresaId: empresa.id },
      },
      create: { usuarioId: user.id, empresaId: empresa.id, cargo },
      update: input.resetExisting ? { cargo, ativo: true } : {},
    });
    await tx.configSistema.upsert({
      where: { empresaId: empresa.id },
      create: { empresaId: empresa.id, nomeFantasia: empresa.nome },
      update: {},
    });
    await tx.configBalanca.upsert({
      where: { empresaId: empresa.id },
      create: { empresaId: empresa.id },
      update: {},
    });
    await tx.sequenciaVenda.upsert({
      where: { empresaId: empresa.id },
      create: { empresaId: empresa.id },
      update: {},
    });
    return {
      empresaId: empresa.id,
      usuarioId: user.id,
      email: user.email,
      created,
    };
  });
}
