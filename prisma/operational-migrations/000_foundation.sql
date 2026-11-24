-- Compatibilidade com origens operacionais sem as tabelas SaaS. Não cria usuários.
CREATE TABLE IF NOT EXISTS "Empresa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVA',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "roleGlobal" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "UsuarioEmpresa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UsuarioEmpresa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UsuarioEmpresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Plano" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "duracaoDias" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "LicencaEmpresa" (
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

CREATE TABLE IF NOT EXISTS "AuditLog" (
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

CREATE TABLE IF NOT EXISTS "CobrancaLicenca" (
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

CREATE TABLE IF NOT EXISTS "WebhookEvent" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "Empresa_cnpj_key" ON "Empresa"("cnpj");

CREATE INDEX IF NOT EXISTS "Empresa_status_idx" ON "Empresa"("status");

CREATE INDEX IF NOT EXISTS "Empresa_nome_idx" ON "Empresa"("nome");

CREATE UNIQUE INDEX IF NOT EXISTS "Usuario_email_key" ON "Usuario"("email");

CREATE INDEX IF NOT EXISTS "Usuario_status_idx" ON "Usuario"("status");

CREATE INDEX IF NOT EXISTS "Usuario_roleGlobal_idx" ON "Usuario"("roleGlobal");

CREATE INDEX IF NOT EXISTS "UsuarioEmpresa_empresaId_cargo_idx" ON "UsuarioEmpresa"("empresaId", "cargo");

CREATE INDEX IF NOT EXISTS "UsuarioEmpresa_usuarioId_idx" ON "UsuarioEmpresa"("usuarioId");

CREATE UNIQUE INDEX IF NOT EXISTS "UsuarioEmpresa_usuarioId_empresaId_key" ON "UsuarioEmpresa"("usuarioId", "empresaId");

CREATE UNIQUE INDEX IF NOT EXISTS "Plano_nome_key" ON "Plano"("nome");

CREATE INDEX IF NOT EXISTS "Plano_ativo_idx" ON "Plano"("ativo");

CREATE INDEX IF NOT EXISTS "LicencaEmpresa_empresaId_status_idx" ON "LicencaEmpresa"("empresaId", "status");

CREATE INDEX IF NOT EXISTS "LicencaEmpresa_planoId_idx" ON "LicencaEmpresa"("planoId");

CREATE INDEX IF NOT EXISTS "LicencaEmpresa_expiraEm_idx" ON "LicencaEmpresa"("expiraEm");

CREATE INDEX IF NOT EXISTS "AuditLog_empresaId_createdAt_idx" ON "AuditLog"("empresaId", "createdAt");

CREATE INDEX IF NOT EXISTS "AuditLog_usuarioId_createdAt_idx" ON "AuditLog"("usuarioId", "createdAt");

CREATE INDEX IF NOT EXISTS "AuditLog_acao_createdAt_idx" ON "AuditLog"("acao", "createdAt");

CREATE INDEX IF NOT EXISTS "AuditLog_createdByRole_createdAt_idx" ON "AuditLog"("createdByRole", "createdAt");

CREATE INDEX IF NOT EXISTS "CobrancaLicenca_empresaId_status_idx" ON "CobrancaLicenca"("empresaId", "status");

CREATE INDEX IF NOT EXISTS "CobrancaLicenca_planoId_idx" ON "CobrancaLicenca"("planoId");

CREATE UNIQUE INDEX IF NOT EXISTS "CobrancaLicenca_provider_providerRef_key" ON "CobrancaLicenca"("provider", "providerRef");

CREATE INDEX IF NOT EXISTS "WebhookEvent_provider_processado_idx" ON "WebhookEvent"("provider", "processado");

CREATE INDEX IF NOT EXISTS "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "WebhookEvent_provider_eventId_key" ON "WebhookEvent"("provider", "eventId");
