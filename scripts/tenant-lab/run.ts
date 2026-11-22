import { TenantLab } from "./lab";

async function main() {
  const lab = await TenantLab.create();
  try {
    await lab.seedLegacy();
    const result = await lab.migrate("empresa_a");
    await lab.seedCompanyB();
    const own = await lab.productForUser("usuario_a", "empresa_a", "produto_a");
    const other = await lab.productForUser("usuario_a", "empresa_a", "produto_b");
    if (own.length !== 1 || other.length !== 0) throw new Error("A verificação de escopo falhou.");
    console.log(`Ensaio concluído: ${result.tables} tabelas e ${result.rows} registros antigos reconciliados.`);
    console.log("Empresas fictícias A/B criadas com código 001 e venda número 1 independentes.");
    console.log("Banco descartável removido ao encerrar. A aplicação e seus logins continuam de uma única loja.");
  } finally { await lab.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
