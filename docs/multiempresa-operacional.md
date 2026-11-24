# Multiempresa operacional — primeira versão SQLite

## Entrega

As quatro partes da implementação são:

1. Schema operacional com propriedade por empresa, relações compostas e migração explícita dos dados legados.
2. Login individual com senha em hash, vínculo ativo e sessão revogável.
3. Escopo obrigatório nas APIs/serviços e permissões por cargo.
4. Verificação automatizada com empresas A/B, incluindo fluxos no navegador.

Esta versão é uma base funcional em SQLite, com uma loja/caixa aberto por empresa e um vínculo ativo de empresa por usuário. PostgreSQL, hospedagem de produção, autosserviço de cadastro/recuperação de senha, filiais, assinaturas e emissão fiscal não fazem parte desta entrega. Impressão/leitor físicos e desempenho no notebook precisam de validação local.

## Caminhos da implementação

| Área | Implementação |
| --- | --- |
| Schema | `prisma/schema.prisma`: dez entidades operacionais com empresa; sequência por empresa e sessões por vínculo. |
| Migração | `scripts/db/migrate.ts` e SQL versionado em `prisma/operational-migrations/`. Nunca chamado pelo servidor ao abrir o site. |
| Identidade | `src/lib/password.ts`, `src/lib/auth-session.ts` e `src/app/api/auth/`. |
| Contexto | `src/lib/tenant-context.ts`: contexto de requisição por `AsyncLocalStorage`, sem empresa padrão. |
| Autorização | `src/lib/tenant-route.ts`: origem da escrita, sessão, status, cargo, respostas sem cache e omissão de custos para caixa. |
| Banco operacional | `src/lib/db.ts`: extensão Prisma exige contexto, filtra leituras/escritas e inclui o escopo também nas transações. SQL bruto e modelos globais são recusados. |
| Acesso privilegiado | `src/lib/db-core.ts`: usado apenas por identidade e resolução da sessão; scripts de migração/provisionamento têm clientes administrativos próprios. |
| Interface | `src/components/session-gate.tsx`: bootstrap da identidade antes das telas, troca com recarga completa, cache limpo e detecção de aba antiga. |
| Provisionamento | `scripts/account-create.ts` e `scripts/provision.ts`, sem cadastro público ou senha universal. |

Os testes estáticos conferem que todas as rotas operacionais passam pelo wrapper e que não importam o cliente global. Novas rotas e serviços precisam manter esse contrato. Não use `coreDb`, `new PrismaClient` ou SQL bruto para contornar o escopo de um serviço operacional.

Chaves estrangeiras compostas impedem relações entre dados de empresas diferentes. Elas não substituem filtros de leitura: o cliente operacional e a autorização da API impõem o escopo. Não existe papel global que permita ignorar essa proteção nas APIs do PDV.

## Atualizar banco legado

O instalador aceita SQLite. O ensaio cobre a estrutura operacional histórica do repositório, com e sem as tabelas iniciais de fundação SaaS. Estruturas intermediárias diferentes, campos antigos ausentes, referências inválidas ou dados incompatíveis são recusados; não há tentativa de apagar/recriar o banco para fazê-lo caber no schema.

### Preparação no notebook

1. Pare o servidor antigo e impeça novas vendas durante a atualização.
2. Preserve `.env` e faça uma cópia externa consistente do arquivo SQLite. O arquivo pode conter dados reais e não deve ir para o Git.
3. Trabalhe primeiro sobre uma cópia e confirme que `DATABASE_URL` aponta para ela. Anote contagens de produtos, vendas, itens, caixa, pagamentos e movimentações, estoque e totais monetários.
4. Preencha no `.env`:
   - `MIGRATION_EMPRESA_ID`: ID explícito da empresa dona dos dados antigos.
   - `MIGRATION_EMPRESA_NOME`: nome se a empresa ainda não existir.
5. Instale a versão da aplicação e execute `npm run db:migrate:legacy`.

### O que o instalador faz

- Confere os checksums do schema e dos arquivos SQL.
- Detecta banco novo, versão atual, legado ou origem intermediária não reconhecida.
- Em banco legado, cria um backup SQLite consistente com `VACUUM INTO` em `backups/`, ao lado do arquivo de origem, antes das alterações. O caminho é informado pelo comando.
- Cria a fundação SaaS vazia se ela não existir; não cria usuários ou senhas de seed.
- Acrescenta `empresaId`, preenche os registros antigos com o dono explícito e aplica obrigatoriedade/unicidades/relações.
- Acrescenta sessões, rastreio do operador, idempotência e contador; inicializa a sequência com a maior venda de cada empresa.
- Compara todas as colunas antigas das dez tabelas operacionais: IDs, datas, quantidades, estoque, valores e referências.
- Verifica as chaves estrangeiras antes de confirmar a transação.
- Mantém operadores históricos desconhecidos como nulos.
- Bloqueia contas SaaS legadas. Elas não eram usadas pelo login por ambiente e podiam conter senhas padrão de seed; precisam de ativação explícita com senha nova.
- Registra a versão em `_PdvSchema`. Uma execução seguinte compatível não repete a carga nem reinicia a numeração.

As operações de reconstrução SQLite são transacionais. Chaves estrangeiras são desativadas na conexão somente para reconstruir tabelas, verificadas antes do commit e reativadas em `finally`. O índice parcial de caixa aberto é recriado explicitamente após reconstruções; o Prisma 6 não o descreve no schema.

### Conferência e ativação

Depois do ensaio, confira as contagens, histórico, estoque, caixa, valores e configurações na empresa de origem. Execute os testes e o roteiro do README. Só então repita no arquivo escolhido para uso, com o servidor parado.

Para criar um novo administrador ou funcionário, preencha `EMPRESA_ID`, `ACCOUNT_NAME`, `ACCOUNT_LOGIN`, `ACCOUNT_PASSWORD` e `ACCOUNT_ROLE` e execute `npm run account:create`. Para uma empresa nova, informe também `EMPRESA_NOME` e use administrador.

Para redefinir a senha e reativar um login legado que já pertence à empresa, use explicitamente `ACCOUNT_RESET_EXISTING=true`. O comando atualiza o hash, reativa o vínculo e revoga as sessões anteriores. Volte a opção para `false` depois do uso. Sem essa opção, senhas e vínculos existentes são preservados. Login de outra empresa não é associado automaticamente.

Guarde o ID da empresa retornado pelo provisionamento. Credenciais de ambiente não são comparadas diretamente no login: a conta precisa existir no banco. Não há interface pública de criação de empresas ou usuários nesta etapa.

### Se houver falha

A transação é revertida, inclusive alterações de schema e status dos usuários. O backup criado antes da migração permanece disponível. Resolva a inconsistência numa cópia, volte a ensaiar e nunca use `prisma db push`, `migrate reset` ou exclusão de tabelas como tentativa de recuperação.

Se for preciso voltar de versão antes de reabrir para vendas, restaure a cópia anterior e o código compatível. Se já houver novas operações, pare as escritas e reconcilie os dados antes de restaurar; restaurar cegamente perderia vendas novas.

Os testes comprovam o procedimento em fixtures, não garantem a condição de um banco real que ainda não foi inspecionado.

## Login e sessão

- Senhas usam `scrypt`, salt aleatório e comparação em tempo constante. Novas senhas têm 12–256 caracteres.
- A assinatura do JWT exige segredo de pelo menos 32 caracteres, com emissor, audiência, algoritmo e versão definidos. Sessões genéricas antigas são rejeitadas.
- A sessão tem registro revogável no banco, expira em até 12 horas e pertence a um vínculo usuário/empresa.
- Cada requisição confere usuário, empresa e vínculo ativos, cargo atual, revogação e expiração; o cargo não é confiado a um JWT antigo.
- O login tem limitação compartilhada por conta no banco, numa janela de 15 minutos; hospedagem pública e proteção de tráfego serão avaliadas na implantação.
- Escritas exigem `Origin` correto. Ferramentas HTTP de teste precisam enviar esse cabeçalho. `APP_ORIGIN` deve ser a origem pública exata quando existir proxy/domínio.
- Logout revoga a sessão no servidor, além de expirar o cookie. Reutilizar o cookie antigo é recusado.
- Login com vários vínculos ativos é recusado até existir uma seleção explícita; não há escolha automática da primeira loja.

## Cache e abas

A interface só monta as telas após carregar a identidade. Entrar/sair provoca navegação completa, descartando cache, carrinho, pagamentos e comprovante da sessão anterior. Uma notificação local sem dados pessoais avisa outras abas sobre a troca.

As requisições da interface levam `X-PDV-Session`, vinculado à sessão carregada na aba. Se o cookie mudar para outra conta, uma aba antiga não pode continuar recebendo dados da nova sessão com a identidade anterior. A API recusa a incompatibilidade e a interface limpa o estado. O cabeçalho não concede acesso: a autorização continua dependendo do cookie assinado e do vínculo no banco.

## Vendas e concorrência

- `Idempotency-Key` é obrigatório na finalização. O PDV gera a chave e a reutiliza para repetir o mesmo corpo após erro de rede; mudar os itens/pagamentos gera outra chave.
- A chave é única por empresa e associada ao hash da requisição. Repetir a mesma chave/corpo retorna a venda já registrada, sem nova baixa. Reusar a chave com outro corpo retorna conflito. A mesma chave em outra empresa não colide.
- O contador da empresa é incrementado na transação da venda. Fechar/reabrir caixa não reinicia a numeração. Uma migração continua a numeração histórica.
- Estoque é conferido e baixado na transação; quando estoque negativo é proibido, a atualização também exige saldo suficiente.
- Caixa é validado dentro da transação da venda. Fechamento e movimentações também são transacionais; não se conclui uma venda nova num caixa já fechado.
- Há um índice parcial para uma sessão aberta por empresa. Aberturas concorrentes não criam dois caixas abertos.
- Em conflito, a operação pode ser recusada para nova tentativa. O teste da última unidade exige uma venda aceita e outra recusada, sem saldo negativo; isso não é uma garantia de capacidade/carga para produção.

## Verificação reproduzível

```bash
npm ci
npm run test:pagamentos
npm run test:tenancy
npm run test:operational
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

O laboratório histórico mantém um snapshot próprio (`prisma/tenant-lab/legacy-schema.prisma`) para não depender do schema operacional atual. Os testes operacionais cobrem instalação, backup, migração, contas antigas, contexto obrigatório, restrições e preservação dos dados. Os testes de navegador usam servidor/banco exclusivos e verificam APIs e troca de contas de duas empresas, inclusive importações, permissões, saldo/fechamento e concorrência.

Arquivos temporários, bancos, backups, credenciais locais e rastros não são versionados. O servidor de testes usa porta 3137 e não reutiliza servidor já aberto.

## Evolução das migrações

Os arquivos desta entrega descrevem a versão operacional 2. Não altere migrações/checksums de uma versão já instalada para forçar sua aceitação. Uma próxima mudança de schema precisa de uma nova migração, versão e testes de atualização; a aplicação deve continuar recusando versões incompatíveis.

O inventário `arquitetura-atual.md` é histórico e não descreve o estado operacional desta versão. O [plano SaaS](plano-evolucao-saas.md) continua como referência para PostgreSQL, assinatura e emissão fiscal, com os itens já implementados identificados no estado da entrega.
