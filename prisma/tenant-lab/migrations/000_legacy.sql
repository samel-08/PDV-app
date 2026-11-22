-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Produto" (
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
    CONSTRAINT "Produto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConfigBalanca" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "tamanhoCodigoBarras" INTEGER NOT NULL DEFAULT 13,
    "prefixoIdentificacao" TEXT NOT NULL DEFAULT '',
    "codigoProdutoInicio" INTEGER NOT NULL DEFAULT 1,
    "codigoProdutoFim" INTEGER NOT NULL DEFAULT 6,
    "pesoValorInicio" INTEGER NOT NULL DEFAULT 7,
    "pesoValorFim" INTEGER NOT NULL DEFAULT 12,
    "contemTipo" TEXT NOT NULL DEFAULT 'PESO',
    "casasDecimais" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ConfigSistema" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
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
    "observacaoCupom" TEXT
);

-- CreateTable
CREATE TABLE "CaixaSessao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "abertoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechadoEm" DATETIME,
    "valorInicial" REAL NOT NULL,
    "saldoFinalEsperado" REAL,
    "saldoFinalInformado" REAL,
    "diferenca" REAL,
    "status" TEXT NOT NULL DEFAULT 'ABERTO'
);

-- CreateTable
CREATE TABLE "Venda" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" INTEGER NOT NULL,
    "total" REAL NOT NULL,
    "formaPagamento" TEXT NOT NULL,
    "valorRecebido" REAL NOT NULL,
    "troco" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONCLUIDA',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caixaSessaoId" TEXT NOT NULL,
    CONSTRAINT "Venda_caixaSessaoId_fkey" FOREIGN KEY ("caixaSessaoId") REFERENCES "CaixaSessao" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItensVenda" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quantidade" REAL NOT NULL,
    "precoUnitario" REAL NOT NULL,
    "precoCustoSnapshot" REAL NOT NULL,
    "subtotal" REAL NOT NULL,
    "vendaId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    CONSTRAINT "ItensVenda_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItensVenda_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PagamentoVenda" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formaPagamento" TEXT NOT NULL,
    "valor" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vendaId" TEXT NOT NULL,
    CONSTRAINT "PagamentoVenda_vendaId_fkey" FOREIGN KEY ("vendaId") REFERENCES "Venda" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MovimentacaoCaixa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "valor" REAL NOT NULL,
    "descricao" TEXT,
    "referenciaVendaId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "caixaSessaoId" TEXT NOT NULL,
    CONSTRAINT "MovimentacaoCaixa_caixaSessaoId_fkey" FOREIGN KEY ("caixaSessaoId") REFERENCES "CaixaSessao" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MovimentacaoEstoque" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "quantidade" REAL NOT NULL,
    "motivo" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "produtoId" TEXT NOT NULL,
    CONSTRAINT "MovimentacaoEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVA',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "roleGlobal" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UsuarioEmpresa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsuarioEmpresa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UsuarioEmpresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Plano" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "duracaoDias" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LicencaEmpresa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL,
    "planoId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVA',
    "inicioEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" DATETIME NOT NULL,
    "motivoBloqueio" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LicencaEmpresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LicencaEmpresa_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "Plano" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT,
    "usuarioId" TEXT,
    "createdByRole" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT,
    "entidadeId" TEXT,
    "detalhes" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CobrancaLicenca" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "empresaId" TEXT NOT NULL,
    "planoId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "valor" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "vencimento" DATETIME,
    "pagoEm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CobrancaLicenca_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CobrancaLicenca_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "Plano" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "tipo" TEXT,
    "payload" TEXT NOT NULL,
    "processado" BOOLEAN NOT NULL DEFAULT false,
    "erro" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processadoEm" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nome_key" ON "Categoria"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_codigo_key" ON "Produto"("codigo");

-- CreateIndex
CREATE INDEX "Produto_ativo_idx" ON "Produto"("ativo");

-- CreateIndex
CREATE INDEX "Produto_categoriaId_idx" ON "Produto"("categoriaId");

-- CreateIndex
CREATE INDEX "Produto_nome_idx" ON "Produto"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Venda_numero_key" ON "Venda"("numero");

-- CreateIndex
CREATE INDEX "Venda_createdAt_idx" ON "Venda"("createdAt");

-- CreateIndex
CREATE INDEX "Venda_caixaSessaoId_createdAt_idx" ON "Venda"("caixaSessaoId", "createdAt");

-- CreateIndex
CREATE INDEX "Venda_status_idx" ON "Venda"("status");

-- CreateIndex
CREATE INDEX "ItensVenda_vendaId_idx" ON "ItensVenda"("vendaId");

-- CreateIndex
CREATE INDEX "ItensVenda_produtoId_idx" ON "ItensVenda"("produtoId");

-- CreateIndex
CREATE INDEX "PagamentoVenda_vendaId_idx" ON "PagamentoVenda"("vendaId");

-- CreateIndex
CREATE INDEX "MovimentacaoCaixa_caixaSessaoId_createdAt_idx" ON "MovimentacaoCaixa"("caixaSessaoId", "createdAt");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_produtoId_createdAt_idx" ON "MovimentacaoEstoque"("produtoId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_cnpj_key" ON "Empresa"("cnpj");

-- CreateIndex
CREATE INDEX "Empresa_status_idx" ON "Empresa"("status");

-- CreateIndex
CREATE INDEX "Empresa_nome_idx" ON "Empresa"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_status_idx" ON "Usuario"("status");

-- CreateIndex
CREATE INDEX "Usuario_roleGlobal_idx" ON "Usuario"("roleGlobal");

-- CreateIndex
CREATE INDEX "UsuarioEmpresa_empresaId_cargo_idx" ON "UsuarioEmpresa"("empresaId", "cargo");

-- CreateIndex
CREATE INDEX "UsuarioEmpresa_usuarioId_idx" ON "UsuarioEmpresa"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioEmpresa_usuarioId_empresaId_key" ON "UsuarioEmpresa"("usuarioId", "empresaId");

-- CreateIndex
CREATE UNIQUE INDEX "Plano_nome_key" ON "Plano"("nome");

-- CreateIndex
CREATE INDEX "Plano_ativo_idx" ON "Plano"("ativo");

-- CreateIndex
CREATE INDEX "LicencaEmpresa_empresaId_status_idx" ON "LicencaEmpresa"("empresaId", "status");

-- CreateIndex
CREATE INDEX "LicencaEmpresa_planoId_idx" ON "LicencaEmpresa"("planoId");

-- CreateIndex
CREATE INDEX "LicencaEmpresa_expiraEm_idx" ON "LicencaEmpresa"("expiraEm");

-- CreateIndex
CREATE INDEX "AuditLog_empresaId_createdAt_idx" ON "AuditLog"("empresaId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_usuarioId_createdAt_idx" ON "AuditLog"("usuarioId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_acao_createdAt_idx" ON "AuditLog"("acao", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdByRole_createdAt_idx" ON "AuditLog"("createdByRole", "createdAt");

-- CreateIndex
CREATE INDEX "CobrancaLicenca_empresaId_status_idx" ON "CobrancaLicenca"("empresaId", "status");

-- CreateIndex
CREATE INDEX "CobrancaLicenca_planoId_idx" ON "CobrancaLicenca"("planoId");

-- CreateIndex
CREATE UNIQUE INDEX "CobrancaLicenca_provider_providerRef_key" ON "CobrancaLicenca"("provider", "providerRef");

-- CreateIndex
CREATE INDEX "WebhookEvent_provider_processado_idx" ON "WebhookEvent"("provider", "processado");

-- CreateIndex
CREATE INDEX "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_eventId_key" ON "WebhookEvent"("provider", "eventId");
