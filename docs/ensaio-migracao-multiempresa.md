# Ensaio de migração multiempresa — SQLite

## Entrega e limite

Este laboratório implementa o primeiro ensaio de M1 e parte do desenho de M2 do [plano SaaS](plano-evolucao-saas.md). Ele cria uma origem fictícia de uma loja, migra seus dados para uma empresa explícita e acrescenta uma segunda empresa para testar as restrições do modelo proposto.

**Não é uma atualização da aplicação para multiempresa.** O schema operacional `prisma/schema.prisma`, o login, as rotas e a demonstração permanecem iguais. Não tente entrar com os usuários A/B no PDV: eles existem somente durante o ensaio descartável e não têm senhas de acesso fornecidas.

## Como executar

Na raiz do projeto, depois de instalar as dependências:

```bash
npm ci
npm run lab:tenancy
npm run test:tenancy
```

`lab:tenancy` executa o exemplo e imprime seu resumo. `test:tenancy` verifica também os casos de erro. O ensaio cria um arquivo SQLite novo em um diretório aleatório dentro de `work/tenant-lab/` e o remove ao terminar. Não precisa copiar `.env.example` nem configurar um banco para isso.

Não há argumento para escolher banco de origem ou destino. O cliente do ensaio define sua conexão explicitamente e ignora `DATABASE_URL`, inclusive quando ela aponta para outro arquivo. O `.env` não é reescrito. A pasta `work/` é ignorada pelo Git. Se o processo for encerrado à força, pode restar um diretório descartável; ele não será reutilizado no próximo ensaio.

O schema experimental usa `TENANT_LAB_DATABASE_URL` e uma saída de cliente separada, para não substituir o cliente operacional. Os comandos acima não geram esse cliente: usam a conexão descartável com SQL e o cliente atual para criar os dados legados. Não execute `db:push` ou `migrate deploy` contra um banco real usando os arquivos deste laboratório.

## Arquivos e sequência

| Arquivo | Papel |
| --- | --- |
| `prisma/tenant-lab/migrations/000_legacy.sql` | Snapshot versionado do schema atual; cria a origem vazia do ensaio. |
| `prisma/tenant-lab/migrations/001_expand.sql` | Acrescenta `empresaId` inicialmente opcional às dez tabelas operacionais. |
| `scripts/tenant-lab/lab.ts` | Cria os dados fictícios, exige dono explícito, preenche os campos, executa a migração e reconcilia os dados. |
| `prisma/tenant-lab/migrations/002_constraints.sql` | Reconstrói tabelas SQLite com empresa obrigatória, unicidades por empresa e relações compostas. |
| `prisma/tenant-lab/schema.prisma` | Modelo experimental usado como referência para o SQL final; não é o schema do PDV. |
| `prisma/tenant-lab/manifest.json` | Checksums do schema de origem, modelo experimental e SQL; alterações exigem revisar o ensaio. |
| `tests/tenant-lab/migration.test.ts` | Testes de preservação, validação de vínculos, restrições e rollback. |

O preenchimento dos dados antigos usa a empresa `empresa_a`, criada explicitamente pela fixture. A rotina recusa empresa vazia ou inexistente; isso não é um fallback para uma empresa padrão em requisições do PDV.

Expansão, preenchimento e aplicação das restrições acontecem na mesma transação SQLite do ensaio. O procedimento desativa as chaves estrangeiras na conexão somente durante a reconstrução das tabelas, executa `foreign_key_check` antes de confirmar e volta a ativá-las mesmo em caso de erro. Compara todas as colunas antigas, linha por linha: IDs, datas, estoque, preços, valores e referências. Se uma validação falhar, a transação é revertida.

Essa estratégia foi ensaiada em SQLite descartável; não é um procedimento pronto para migrar PostgreSQL ou bancos reais.

## Cenário verificado

- Origem com 11 registros distribuídos pelas dez tabelas operacionais: categoria, produto, duas configurações, caixa, venda, item, pagamento e movimentos de caixa/estoque.
- Usuário A vinculado à empresa A; usuário B vinculado à empresa B, ambos fictícios e sem papel de superadministrador.
- Empresas A/B com produto de código `001`, categoria `Bebidas` e venda número `1`, mas valores e estoques distintos.
- Uma configuração por empresa e um caixa aberto por empresa; configurações e caixas de empresas diferentes coexistem.
- Restrição de um caixa aberto implementada por índice parcial SQLite em `002_constraints.sql`. O Prisma 6 não representa esse índice no schema; o teste específico e o SQL precisam ser mantidos juntos.
- Relações compostas impedem usar categoria, produto, venda ou caixa de outra empresa, incluindo `referenciaVendaId` das movimentações de caixa.
- Configurações da empresa A podem mudar sem alterar as de B.
- Dados antigos são preservados, e a migração não pode ser repetida na mesma instância do ensaio.
- Uma referência órfã simulada provoca rollback, preserva a origem inconsistente e permite corrigir a referência e tentar novamente.
- Uma origem com dois caixas abertos é recusada sem alterações; o conflito precisa ser resolvido antes de migrar.
- Um arquivo externo apontado por `DATABASE_URL` permanece intacto.

O helper `productForUser()` pertence exclusivamente ao laboratório: exige vínculo ativo e consulta produto com filtro de empresa. **Ele não protege as rotas atuais.** O banco compartilhado ainda permite uma consulta SQL sem filtro listar várias empresas; proteger leituras depende da futura autorização e do escopo obrigatório na aplicação. As chaves compostas protegem a coerência das relações, não substituem essa autorização.

## Como manter o ensaio

O SQL foi gerado com Prisma 6 a partir do schema atual, de uma etapa intermediária com `empresaId` opcional e do modelo experimental final. A restrição parcial de caixa aberto foi acrescentada explicitamente.

Ao alterar o modelo:

1. Revise o contrato e os testes antes de atualizar checksums.
2. Gere um diff entre os modelos da etapa correspondente, em arquivos temporários; não conecte o comando a um banco real.
3. Revise operações de reconstrução, cópia dos dados, índices, ações de exclusão e referências compostas.
4. Preserve a migração de origem como snapshot histórico. Se o schema operacional mudar, planeje uma nova versão do ensaio em vez de apenas aceitar um novo hash.
5. Execute os testes de migração, pagamentos, lint e build. Um checksum válido confirma consistência dos arquivos, não a correção da migração.

O executor de SQL é específico para os arquivos versionados deste laboratório, sem triggers ou ponto e vírgula dentro de literais. Não é um leitor genérico de dumps e não aceita SQL enviado por usuário.

## O que falta para ativar multiempresa

- Migração real, estratégia de produção/PostgreSQL e recuperação ensaiada com uma cópia autorizada da origem.
- Decidir a representação monetária final e reconciliar a conversão. Este ensaio preserva `Float` para não misturar mudanças de dinheiro e isolamento.
- Login por usuário, sessão com empresa, revogação e permissões por cargo.
- Escopo obrigatório em todas as APIs/serviços, importações, relatórios, balança e impressão.
- Contador transacional de vendas por empresa, idempotência e validação concorrente de estoque/caixa.
- Operadores nas vendas/movimentações e tratamento documentado dos atores históricos desconhecidos.
- Cache e carrinho separados por sessão/empresa, com testes no navegador.
- Adaptação dos seeds normal e de demonstração quando o schema operacional mudar.

As duas empresas deste ensaio não devem ser oferecidas como contas funcionais do produto. A próxima etapa é implementar a migração operacional e a identidade; a liberação fica condicionada à matriz completa do plano SaaS.
