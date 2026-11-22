-- CreateTable
CREATE TABLE "SessaoUsuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "criadaEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" DATETIME NOT NULL,
    "revogadaEm" DATETIME,
    CONSTRAINT "SessaoUsuario_usuarioId_empresaId_fkey" FOREIGN KEY ("usuarioId", "empresaId") REFERENCES "UsuarioEmpresa" ("usuarioId", "empresaId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SequenciaVenda" (
    "empresaId" TEXT NOT NULL PRIMARY KEY,
    "ultimoNumero" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SequenciaVenda_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoginThrottle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "janelaEm" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CaixaSessao" (
    "operadorId" TEXT,
    "empresaId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "abertoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechadoEm" DATETIME,
    "valorInicial" REAL NOT NULL,
    "saldoFinalEsperado" REAL,
    "saldoFinalInformado" REAL,
    "diferenca" REAL,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    CONSTRAINT "CaixaSessao_operadorId_empresaId_fkey" FOREIGN KEY ("operadorId", "empresaId") REFERENCES "UsuarioEmpresa" ("usuarioId", "empresaId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CaixaSessao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CaixaSessao" ("abertoEm", "diferenca", "empresaId", "fechadoEm", "id", "saldoFinalEsperado", "saldoFinalInformado", "status", "valorInicial") SELECT "abertoEm", "diferenca", "empresaId", "fechadoEm", "id", "saldoFinalEsperado", "saldoFinalInformado", "status", "valorInicial" FROM "CaixaSessao";
DROP TABLE "CaixaSessao";
ALTER TABLE "new_CaixaSessao" RENAME TO "CaixaSessao";
CREATE UNIQUE INDEX "CaixaSessao_empresaId_id_key" ON "CaixaSessao"("empresaId", "id");
CREATE TABLE "new_Venda" (
    "operadorId" TEXT,
    "empresaId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "chaveIdempotencia" TEXT,
    "requisicaoHash" TEXT,
    "numero" INTEGER NOT NULL,
    "total" REAL NOT NULL,
    "formaPagamento" TEXT NOT NULL,
    "valorRecebido" REAL NOT NULL,
    "troco" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONCLUIDA',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caixaSessaoId" TEXT NOT NULL,
    CONSTRAINT "Venda_operadorId_empresaId_fkey" FOREIGN KEY ("operadorId", "empresaId") REFERENCES "UsuarioEmpresa" ("usuarioId", "empresaId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Venda_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Venda_empresaId_caixaSessaoId_fkey" FOREIGN KEY ("empresaId", "caixaSessaoId") REFERENCES "CaixaSessao" ("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Venda" ("caixaSessaoId", "createdAt", "empresaId", "formaPagamento", "id", "numero", "status", "total", "troco", "valorRecebido") SELECT "caixaSessaoId", "createdAt", "empresaId", "formaPagamento", "id", "numero", "status", "total", "troco", "valorRecebido" FROM "Venda";
DROP TABLE "Venda";
ALTER TABLE "new_Venda" RENAME TO "Venda";
CREATE INDEX "Venda_createdAt_idx" ON "Venda"("createdAt");
CREATE INDEX "Venda_caixaSessaoId_createdAt_idx" ON "Venda"("caixaSessaoId", "createdAt");
CREATE INDEX "Venda_status_idx" ON "Venda"("status");
CREATE UNIQUE INDEX "Venda_empresaId_id_key" ON "Venda"("empresaId", "id");
CREATE UNIQUE INDEX "Venda_empresaId_numero_key" ON "Venda"("empresaId", "numero");
CREATE UNIQUE INDEX "Venda_empresaId_chaveIdempotencia_key" ON "Venda"("empresaId", "chaveIdempotencia");
CREATE TABLE "new_MovimentacaoCaixa" (
    "operadorId" TEXT,
    "empresaId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "valor" REAL NOT NULL,
    "descricao" TEXT,
    "referenciaVendaId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caixaSessaoId" TEXT NOT NULL,
    CONSTRAINT "MovimentacaoCaixa_operadorId_empresaId_fkey" FOREIGN KEY ("operadorId", "empresaId") REFERENCES "UsuarioEmpresa" ("usuarioId", "empresaId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovimentacaoCaixa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovimentacaoCaixa_empresaId_referenciaVendaId_fkey" FOREIGN KEY ("empresaId", "referenciaVendaId") REFERENCES "Venda" ("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovimentacaoCaixa_empresaId_caixaSessaoId_fkey" FOREIGN KEY ("empresaId", "caixaSessaoId") REFERENCES "CaixaSessao" ("empresaId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MovimentacaoCaixa" ("caixaSessaoId", "createdAt", "descricao", "empresaId", "id", "referenciaVendaId", "tipo", "valor") SELECT "caixaSessaoId", "createdAt", "descricao", "empresaId", "id", "referenciaVendaId", "tipo", "valor" FROM "MovimentacaoCaixa";
DROP TABLE "MovimentacaoCaixa";
ALTER TABLE "new_MovimentacaoCaixa" RENAME TO "MovimentacaoCaixa";
CREATE INDEX "MovimentacaoCaixa_caixaSessaoId_createdAt_idx" ON "MovimentacaoCaixa"("caixaSessaoId", "createdAt");
CREATE INDEX "MovimentacaoCaixa_empresaId_idx" ON "MovimentacaoCaixa"("empresaId");
CREATE TABLE "new_MovimentacaoEstoque" (
    "operadorId" TEXT,
    "empresaId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "quantidade" REAL NOT NULL,
    "motivo" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "produtoId" TEXT NOT NULL,
    CONSTRAINT "MovimentacaoEstoque_operadorId_empresaId_fkey" FOREIGN KEY ("operadorId", "empresaId") REFERENCES "UsuarioEmpresa" ("usuarioId", "empresaId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovimentacaoEstoque_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovimentacaoEstoque_empresaId_produtoId_fkey" FOREIGN KEY ("empresaId", "produtoId") REFERENCES "Produto" ("empresaId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MovimentacaoEstoque" ("createdAt", "empresaId", "id", "motivo", "produtoId", "quantidade", "tipo") SELECT "createdAt", "empresaId", "id", "motivo", "produtoId", "quantidade", "tipo" FROM "MovimentacaoEstoque";
DROP TABLE "MovimentacaoEstoque";
ALTER TABLE "new_MovimentacaoEstoque" RENAME TO "MovimentacaoEstoque";
CREATE INDEX "MovimentacaoEstoque_produtoId_createdAt_idx" ON "MovimentacaoEstoque"("produtoId", "createdAt");
CREATE INDEX "MovimentacaoEstoque_empresaId_idx" ON "MovimentacaoEstoque"("empresaId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SessaoUsuario_usuarioId_expiraEm_idx" ON "SessaoUsuario"("usuarioId", "expiraEm");

-- Reinstala a restrição não representada pelo Prisma após reconstrução de tabelas.
CREATE UNIQUE INDEX IF NOT EXISTS "CaixaSessao_empresa_aberta_key" ON "CaixaSessao"("empresaId") WHERE "status" = 'ABERTO';
