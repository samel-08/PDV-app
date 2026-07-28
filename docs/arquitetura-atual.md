# Arquitetura atual do PDV

Data do inventario: 2026-07-16

Este documento registra o estado atual do projeto antes do inicio da migracao para SaaS multiempresa. A Fase 0 nao altera regra de negocio, banco de dados, rotas ou telas; ela apenas documenta o estado atual e valida a compilacao.

## Visao geral

O projeto e um PDV construido com:

- Next.js App Router
- React e TypeScript
- Prisma Client
- SQLite em desenvolvimento
- Tailwind CSS
- React Query
- JWT com `jose`
- Validacoes com `zod`

O sistema atual funciona como uma instalacao single-tenant: todos os dados pertencem implicitamente a uma unica empresa/loja. Ainda nao existem models de empresa, usuario por banco, cargo, permissao, licenca ou auditoria.

## Estrutura principal

Arquivos e pastas relevantes:

- `prisma/schema.prisma`: schema atual do banco SQLite.
- `prisma/dev.db`: banco local de desenvolvimento.
- `src/app/(dashboard)`: telas protegidas do sistema.
- `src/app/api`: rotas API.
- `src/app/login/page.tsx`: tela de login.
- `src/app/print`: layout e cupom de impressao.
- `src/components`: shell, modal, providers e componentes compartilhados.
- `src/lib`: servicos e utilitarios de dominio.
- `src/middleware.ts`: protecao de rotas e APIs.

## Models Prisma atuais

O schema atual possui:

- `Categoria`
- `Produto`
- `ConfigBalanca`
- `ConfigSistema`
- `CaixaSessao`
- `Venda`
- `ItensVenda`
- `PagamentoVenda`
- `MovimentacaoCaixa`
- `MovimentacaoEstoque`

Caracteristicas importantes:

- O datasource e `sqlite`.
- `Categoria.nome` e unico globalmente.
- `Produto.codigo` e unico globalmente.
- `Venda.numero` e unico globalmente.
- `ConfigSistema` usa `id = "singleton"`.
- `ConfigBalanca` usa `id = "singleton"`.
- Nenhum model operacional possui `empresaId`.
- Valores monetarios usam `Float`.

## Autenticacao atual

Arquivos:

- `src/lib/auth-session.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/middleware.ts`

Como funciona hoje:

- Login usa `PDV_LOGIN_USER` e `PDV_LOGIN_PASSWORD` do `.env`.
- Em desenvolvimento, senha padrao pode cair para `admin`.
- JWT guarda apenas `sub: "pdv"`.
- Middleware apenas verifica se o cookie `pdv_session` existe e e valido.
- Nao existe `Usuario` no banco.
- Nao existe `empresaId`, `cargo` ou `roleGlobal` na sessao.
- Nao existe controle de permissao por cargo.

Impacto para SaaS:

- Esta camada precisa ser substituida por login com usuarios cadastrados no banco.
- O JWT precisara carregar `usuarioId`, `empresaId`, `cargo` e `roleGlobal`.
- O middleware precisara validar permissao e licenca.

## Dados e isolamento

O projeto ainda nao possui multiempresa.

Consultas atuais sao globais em pontos como:

- `src/lib/vendas-service.ts`
- `src/lib/caixa-service.ts`
- `src/lib/dashboard-service.ts`
- rotas em `src/app/api/produtos`
- rotas em `src/app/api/categorias`
- rotas em `src/app/api/caixa`
- rotas em `src/app/api/config`
- rotas em `src/app/api/vendas`

Exemplos:

- `getCaixaAberto()` busca qualquer caixa com `status: "ABERTO"`.
- `finalizarVenda()` busca produtos por `id`, sem empresa.
- Dashboard agrega vendas e itens globais.
- Configuracoes usam registros singleton.

Para SaaS, cada uma dessas consultas precisara receber contexto de tenant e filtrar por `empresaId`.

## Funcionalidades atuais por modulo

### Produtos e categorias

Arquivos principais:

- `src/app/(dashboard)/produtos/page.tsx`
- `src/app/api/produtos/route.ts`
- `src/app/api/produtos/[id]/route.ts`
- `src/app/api/categorias/route.ts`
- `src/lib/validators.ts`
- `src/lib/produto-precos.ts`

Estado atual:

- CRUD de produtos.
- Categorias.
- Precos de custo/venda.
- Markup.
- Unidade de medida.
- Estoque atual e minimo.
- Produto ativo/inativo.
- Paginacao de produtos.

Risco para SaaS:

- `codigo` de produto precisa ser unico por empresa, nao global.
- Categoria precisa ser unica por empresa, nao global.

### Estoque

Arquivos principais:

- `src/app/(dashboard)/estoque/page.tsx`
- `src/app/api/estoque/route.ts`
- `src/lib/vendas-service.ts`

Estado atual:

- Venda baixa estoque.
- Ajustes de estoque geram movimentacao.
- `ConfigSistema.permitirEstoqueNegativo` controla bloqueio de estoque.

Risco para SaaS:

- Configuracao de estoque negativo precisa ser por empresa.
- Movimentacoes de estoque precisam ter isolamento por empresa.

### PDV e vendas

Arquivos principais:

- `src/app/(dashboard)/pdv/page.tsx`
- `src/app/api/vendas/route.ts`
- `src/app/api/vendas/[id]/route.ts`
- `src/lib/vendas-service.ts`

Estado atual:

- Carrinho.
- Leitura de codigo comum e codigo de balanca.
- Multipagamento.
- Regra de troco apenas com dinheiro.
- Finalizacao de venda.
- Impressao/recibo.

Risco para SaaS:

- Numero da venda precisa ser unico por empresa.
- Venda precisa registrar `empresaId`.
- Venda deveria registrar `usuarioId` do operador.

### Caixa

Arquivos principais:

- `src/app/(dashboard)/caixa/page.tsx`
- `src/app/(dashboard)/caixa/relatorios/page.tsx`
- `src/app/api/caixa/*`
- `src/lib/caixa-service.ts`
- `src/lib/caixa-relatorio.ts`

Estado atual:

- Abertura de caixa.
- Sangria.
- Reforco.
- Fechamento.
- Saldo sugerido do ultimo fechamento.
- Relatorio de fechamento.
- Historico de movimentacoes.

Risco para SaaS:

- Caixa aberto precisa ser por empresa.
- No futuro, tambem pode precisar ser por usuario/terminal, mas isso nao faz parte da fase inicial.

### Configuracoes

Arquivos principais:

- `src/app/(dashboard)/configuracoes/page.tsx`
- `src/app/(dashboard)/configuracoes/balanca/page.tsx`
- `src/app/api/config/sistema/route.ts`
- `src/app/api/config/balanca/route.ts`
- `src/lib/balanca-config.ts`

Estado atual:

- Configuracao geral do sistema.
- Dados da empresa/loja para cupom.
- Configuracao de balanca.

Risco para SaaS:

- `ConfigSistema` e `ConfigBalanca` precisam ser por empresa.
- O conceito de `singleton` global nao serve para SaaS.

### Dashboard e historico

Arquivos principais:

- `src/app/(dashboard)/page.tsx`
- `src/app/(dashboard)/dashboard-charts.tsx`
- `src/app/(dashboard)/historico/page.tsx`
- `src/lib/dashboard-service.ts`

Estado atual:

- Indicadores de vendas.
- Produtos mais vendidos.
- Produtos parados.
- Pagamentos por forma.
- Historico de vendas.

Risco para SaaS:

- Todos os indicadores precisam filtrar por empresa.
- Historico precisa filtrar por empresa.

### Impressao

Arquivos principais:

- `src/app/print/layout.tsx`
- `src/app/print/print-cupom.css`
- `src/app/print/venda/[id]/page.tsx`
- `src/lib/print-venda.ts`

Estado atual:

- Cupom de venda em layout termico.
- Dados da empresa vindos de `ConfigSistema`.
- Pagamentos separados no cupom.

Risco para SaaS:

- Impressao precisa validar que a venda pertence a empresa do usuario.
- Dados do cupom precisam vir da configuracao da empresa logada.

## Alteracoes pendentes no Git

Ha alteracoes pendentes antes da migracao SaaS. Resumo de `git status --short`:

Arquivos modificados:

- `.gitignore`
- `package-lock.json`
- `package.json`
- `prisma/schema.prisma`
- `src/app/(dashboard)/caixa/page.tsx`
- `src/app/(dashboard)/configuracoes/balanca/page.tsx`
- `src/app/(dashboard)/dashboard-charts.tsx`
- `src/app/(dashboard)/historico/page.tsx`
- `src/app/(dashboard)/importar-produtos/page.tsx`
- `src/app/(dashboard)/page.tsx`
- `src/app/(dashboard)/pdv/page.tsx`
- `src/app/(dashboard)/produtos/page.tsx`
- `src/app/api/caixa/fechar/route.ts`
- `src/app/api/caixa/movimentacoes/route.ts`
- `src/app/api/caixa/sessao/route.ts`
- `src/app/api/produtos/busca/route.ts`
- `src/app/api/produtos/route.ts`
- `src/app/api/vendas/[id]/route.ts`
- `src/app/api/vendas/route.ts`
- `src/app/print/layout.tsx`
- `src/app/print/venda/[id]/page.tsx`
- `src/components/app-shell.tsx`
- `src/components/modal.tsx`
- `src/lib/csv-produtos-import.ts`
- `src/lib/dashboard-service.ts`
- `src/lib/validators.ts`
- `src/lib/vendas-service.ts`

Arquivos/pastas novos nao rastreados:

- `.codex/`
- `openspec/`
- `src/app/(dashboard)/caixa/relatorios/`
- `src/app/(dashboard)/configuracoes/page.tsx`
- `src/app/(dashboard)/estoque/`
- `src/app/(dashboard)/importar-tabela/`
- `src/app/api/caixa/relatorio/`
- `src/app/api/config/sistema/`
- `src/app/api/estoque/`
- `src/app/api/produtos/estoque-baixo/`
- `src/app/api/produtos/importar-flexivel/`
- `src/app/print/print-cupom.css`
- `src/components/csv-import-rapido.tsx`
- `src/lib/caixa-relatorio.ts`
- `src/lib/importar-produtos-flexivel.ts`
- `src/lib/print-venda.ts`
- `src/lib/run-importar-flexivel.ts`

Observacao: a Fase 1 deve partir deste estado real, nao do ultimo commit. Recomenda-se gerar backup/commit/checkpoint antes de alterar o schema para SaaS.

## Riscos antes da migracao SaaS

- Muitas alteracoes pendentes tornam dificil separar regressao antiga de regressao da migracao.
- O schema ja foi alterado em relacao ao ultimo commit.
- Ha arquivos novos ainda nao rastreados que fazem parte de funcionalidades recentes.
- Strings em alguns arquivos aparecem com acentuacao corrompida no terminal, provavelmente por encoding; isso deve ser tratado com cuidado para evitar churn desnecessario.
- `Float` e usado para dinheiro; para SaaS futuro e PostgreSQL, sera melhor migrar para `Decimal` ou centavos inteiros, mas nao nesta fase.
- O login atual nao e adequado para SaaS.
- O isolamento por empresa ainda nao existe.

## Recomendacao de checkpoint

Antes da Fase 1:

1. Confirmar que o build passa.
2. Fazer backup de `prisma/dev.db`.
3. Registrar esta documentacao.
4. Criar um checkpoint no Git ou uma copia da pasta, se preferir nao commitar ainda.

## Proxima fase sugerida

Fase 1 deve ser pequena e focada em fundacao:

- Adicionar models SaaS base em `prisma/schema.prisma`:
  - `Empresa`
  - `Usuario`
  - `UsuarioEmpresa`
  - `Plano`
  - `LicencaEmpresa`
  - `AuditLog`
  - `CobrancaLicenca`
  - `WebhookEvent`
- Ainda nao migrar todas as tabelas operacionais.
- Criar seed/helper inicial para empresa padrao e SUPER_ADMIN.
- Rodar `npx prisma db push` e `npx prisma generate` somente apos aprovacao da Fase 1.

Essa abordagem reduz risco porque cria a fundacao SaaS sem quebrar imediatamente produtos, vendas, caixa e estoque.
