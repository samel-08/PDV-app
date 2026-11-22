-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Categoria" (
    "empresaId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Categoria_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Categoria" ("createdAt", "empresaId", "id", "nome") SELECT "createdAt", "empresaId", "id", "nome" FROM "Categoria";
DROP TABLE "Categoria";
ALTER TABLE "new_Categoria" RENAME TO "Categoria";
CREATE UNIQUE INDEX "Categoria_empresaId_id_key" ON "Categoria"("empresaId", "id");
CREATE UNIQUE INDEX "Categoria_empresaId_nome_key" ON "Categoria"("empresaId", "nome");
CREATE TABLE "new_Produto" (
    "empresaId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "precoCusto" REAL NOT NULL,
    "precoVenda" REAL NOT NULL,
    "markupPercent" REAL NOT NULL DEFAULT 0,
    "unidadeMedida" TEXT NOT NULL DEFAULT 'UN',
    "estoqueAtual" REAL NOT NULL DEFAULT 0,
    "estoqueMinimo" REAL NOT NULL DEFAULT 0,
    "categoriaId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Produto_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Produto_empresaId_categoriaId_fkey" FOREIGN KEY ("empresaId", "categoriaId") REFERENCES "Categoria" ("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Produto" ("ativo", "categoriaId", "codigo", "createdAt", "empresaId", "estoqueAtual", "estoqueMinimo", "id", "markupPercent", "nome", "precoCusto", "precoVenda", "unidadeMedida", "updatedAt") SELECT "ativo", "categoriaId", "codigo", "createdAt", "empresaId", "estoqueAtual", "estoqueMinimo", "id", "markupPercent", "nome", "precoCusto", "precoVenda", "unidadeMedida", "updatedAt" FROM "Produto";
DROP TABLE "Produto";
ALTER TABLE "new_Produto" RENAME TO "Produto";
CREATE INDEX "Produto_ativo_idx" ON "Produto"("ativo");
CREATE INDEX "Produto_categoriaId_idx" ON "Produto"("categoriaId");
CREATE INDEX "Produto_nome_idx" ON "Produto"("nome");
CREATE UNIQUE INDEX "Produto_empresaId_id_key" ON "Produto"("empresaId", "id");
CREATE UNIQUE INDEX "Produto_empresaId_codigo_key" ON "Produto"("empresaId", "codigo");
CREATE TABLE "new_ConfigBalanca" (
    "empresaId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "tamanhoCodigoBarras" INTEGER NOT NULL DEFAULT 13,
    "prefixoIdentificacao" TEXT NOT NULL DEFAULT '',
    "codigoProdutoInicio" INTEGER NOT NULL DEFAULT 1,
    "codigoProdutoFim" INTEGER NOT NULL DEFAULT 6,
    "pesoValorInicio" INTEGER NOT NULL DEFAULT 7,
    "pesoValorFim" INTEGER NOT NULL DEFAULT 12,
    "contemTipo" TEXT NOT NULL DEFAULT 'PESO',
    "casasDecimais" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConfigBalanca_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ConfigBalanca" ("casasDecimais", "codigoProdutoFim", "codigoProdutoInicio", "contemTipo", "empresaId", "id", "pesoValorFim", "pesoValorInicio", "prefixoIdentificacao", "tamanhoCodigoBarras", "updatedAt") SELECT "casasDecimais", "codigoProdutoFim", "codigoProdutoInicio", "contemTipo", "empresaId", "id", "pesoValorFim", "pesoValorInicio", "prefixoIdentificacao", "tamanhoCodigoBarras", "updatedAt" FROM "ConfigBalanca";
DROP TABLE "ConfigBalanca";
ALTER TABLE "new_ConfigBalanca" RENAME TO "ConfigBalanca";
CREATE UNIQUE INDEX "ConfigBalanca_empresaId_key" ON "ConfigBalanca"("empresaId");
CREATE TABLE "new_ConfigSistema" (
    "empresaId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "permitirEstoqueNegativo" BOOLEAN NOT NULL DEFAULT false,
    "nomeFantasia" TEXT,
    "razaoSocial" TEXT,
    "cnpj" TEXT,
    "inscricaoEstadual" TEXT,
    "telefoneWhatsApp" TEXT,
    "enderecoCompleto" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "cep" TEXT,
    "mensagemRodapeCupom" TEXT,
    "observacaoCupom" TEXT,
    CONSTRAINT "ConfigSistema_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ConfigSistema" ("cep", "cidade", "cnpj", "empresaId", "enderecoCompleto", "estado", "id", "inscricaoEstadual", "mensagemRodapeCupom", "nomeFantasia", "observacaoCupom", "permitirEstoqueNegativo", "razaoSocial", "telefoneWhatsApp") SELECT "cep", "cidade", "cnpj", "empresaId", "enderecoCompleto", "estado", "id", "inscricaoEstadual", "mensagemRodapeCupom", "nomeFantasia", "observacaoCupom", "permitirEstoqueNegativo", "razaoSocial", "telefoneWhatsApp" FROM "ConfigSistema";
DROP TABLE "ConfigSistema";
ALTER TABLE "new_ConfigSistema" RENAME TO "ConfigSistema";
CREATE UNIQUE INDEX "ConfigSistema_empresaId_key" ON "ConfigSistema"("empresaId");
CREATE TABLE "new_CaixaSessao" (
    "empresaId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "abertoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechadoEm" DATETIME,
    "valorInicial" REAL NOT NULL,
    "saldoFinalEsperado" REAL,
    "saldoFinalInformado" REAL,
    "diferenca" REAL,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    CONSTRAINT "CaixaSessao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CaixaSessao" ("abertoEm", "diferenca", "empresaId", "fechadoEm", "id", "saldoFinalEsperado", "saldoFinalInformado", "status", "valorInicial") SELECT "abertoEm", "diferenca", "empresaId", "fechadoEm", "id", "saldoFinalEsperado", "saldoFinalInformado", "status", "valorInicial" FROM "CaixaSessao";
DROP TABLE "CaixaSessao";
ALTER TABLE "new_CaixaSessao" RENAME TO "CaixaSessao";
CREATE UNIQUE INDEX "CaixaSessao_empresaId_id_key" ON "CaixaSessao"("empresaId", "id");
CREATE TABLE "new_Venda" (
    "empresaId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" INTEGER NOT NULL,
    "total" REAL NOT NULL,
    "formaPagamento" TEXT NOT NULL,
    "valorRecebido" REAL NOT NULL,
    "troco" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONCLUIDA',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caixaSessaoId" TEXT NOT NULL,
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
CREATE TABLE "new_ItensVenda" (
    "empresaId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "quantidade" REAL NOT NULL,
    "precoUnitario" REAL NOT NULL,
    "precoCustoSnapshot" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    "vendaId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    CONSTRAINT "ItensVenda_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ItensVenda_empresaId_vendaId_fkey" FOREIGN KEY ("empresaId", "vendaId") REFERENCES "Venda" ("empresaId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItensVenda_empresaId_produtoId_fkey" FOREIGN KEY ("empresaId", "produtoId") REFERENCES "Produto" ("empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ItensVenda" ("empresaId", "id", "precoCustoSnapshot", "precoUnitario", "produtoId", "quantidade", "subtotal", "vendaId") SELECT "empresaId", "id", "precoCustoSnapshot", "precoUnitario", "produtoId", "quantidade", "subtotal", "vendaId" FROM "ItensVenda";
DROP TABLE "ItensVenda";
ALTER TABLE "new_ItensVenda" RENAME TO "ItensVenda";
CREATE INDEX "ItensVenda_vendaId_idx" ON "ItensVenda"("vendaId");
CREATE INDEX "ItensVenda_produtoId_idx" ON "ItensVenda"("produtoId");
CREATE INDEX "ItensVenda_empresaId_idx" ON "ItensVenda"("empresaId");
CREATE TABLE "new_PagamentoVenda" (
    "empresaId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "formaPagamento" TEXT NOT NULL,
    "valor" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vendaId" TEXT NOT NULL,
    CONSTRAINT "PagamentoVenda_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PagamentoVenda_empresaId_vendaId_fkey" FOREIGN KEY ("empresaId", "vendaId") REFERENCES "Venda" ("empresaId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PagamentoVenda" ("createdAt", "empresaId", "formaPagamento", "id", "valor", "vendaId") SELECT "createdAt", "empresaId", "formaPagamento", "id", "valor", "vendaId" FROM "PagamentoVenda";
DROP TABLE "PagamentoVenda";
ALTER TABLE "new_PagamentoVenda" RENAME TO "PagamentoVenda";
CREATE INDEX "PagamentoVenda_vendaId_idx" ON "PagamentoVenda"("vendaId");
CREATE INDEX "PagamentoVenda_empresaId_idx" ON "PagamentoVenda"("empresaId");
CREATE TABLE "new_MovimentacaoCaixa" (
    "empresaId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "valor" REAL NOT NULL,
    "descricao" TEXT,
    "referenciaVendaId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caixaSessaoId" TEXT NOT NULL,
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
    "empresaId" TEXT NOT NULL,
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "quantidade" REAL NOT NULL,
    "motivo" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "produtoId" TEXT NOT NULL,
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


-- Restrição SQLite explícita: Prisma 6 não descreve índices parciais no schema.
CREATE UNIQUE INDEX "CaixaSessao_empresa_aberta_key" ON "CaixaSessao"("empresaId") WHERE "status" = 'ABERTO';
