# Plano de evolução do PDV Comércio

## Prioridade e estado deste documento

**Próxima prioridade: separar os dados das empresas e substituir o login único por usuários vinculados a uma empresa.** Essa fundação vem antes de cobrar assinaturas de vários lojistas na mesma aplicação.

Este é um plano de implementação. Os requisitos abaixo ainda não estão implementados. A demonstração continua sendo uma instalação de uma única loja, com banco fictício separado pelos comandos `demo:*`.

A referência deste diagnóstico é a branch `codex/preparar-demonstracao-local`, após a preparação da demonstração. O inventário `arquitetura-atual.md` é histórico: seu trecho que diz que não existem tabelas SaaS está superado pelo schema atual.

## Preparação executável disponível

O [ensaio de migração](ensaio-migracao-multiempresa.md) implementa fixtures A/B, SQL versionado de expansão/restrições, preenchimento por empresa explícita, reconciliação dos dados e testes de erro/rollback em SQLite descartável. É o primeiro ensaio de M1 e parte do desenho de M2. Não altera o schema operacional nem conclui o isolamento das rotas.

As tarefas abaixo continuam sendo os critérios da implementação operacional; o laboratório não as marca como entregues para produção.

## Ordem de importância

| Ordem | Entrega | Condição para avançar |
| --- | --- | --- |
| 1 | Login por usuário, vínculo com empresa e isolamento operacional | Testes com duas empresas provam que nenhuma consegue acessar ou modificar dados da outra. |
| 2 | Banco e implantação de produção | Migração ensaiada, backup restaurável, HTTPS, segredos e monitoramento configurados. PostgreSQL é a direção; o fornecedor não está escolhido. |
| 3 | Assinaturas e acesso por situação da cobrança | Pagamentos confirmados pelo servidor, avisos, vencimento e reativação testados. |
| 4 | Emissão fiscal para o Paraná | Requisitos estaduais, contador e provedor definidos; homologação concluída antes de prometer emissão. |
| 5 | Primeiros clientes e operação assistida | Fluxos essenciais, suporte, recuperação dos dados e limites do produto documentados. |

A preparação técnica de PostgreSQL pode acontecer durante a primeira entrega. A escolha do fornecedor e a contratação não precisam bloquear o desenho do isolamento. A ordem não autoriza lançar uma operação que precise de emissão fiscal antes de a integração estar pronta.

A demonstração foi compilada e teve venda, estoque, pagamento e fechamento verificados em ambiente de teste. Ainda falta conferir impressão física, leitor e desempenho no notebook de apresentação. Essa conferência pode ocorrer em paralelo e não exige a migração SaaS.

## Regras da primeira versão multiempresa

- A empresa representa uma loja no lançamento. Filiais e múltiplos terminais ficam para depois.
- Os dados operacionais pertencem à empresa; o usuário recebe acesso por `UsuarioEmpresa`.
- Dono e funcionário da mesma empresa compartilham os dados permitidos pelos seus cargos. Não criamos um banco ou catálogo independente por funcionário.
- Inicialmente cada usuário operacional terá um único vínculo ativo. Se houver vários, o login deve exigir seleção validada ou recusar explicitamente; nunca escolher a primeira empresa silenciosamente.
- Nenhuma requisição sem contexto válido pode usar uma empresa padrão como fallback.
- `empresaId` informado em body, query, cabeçalho ou URL nunca é autorização. O servidor deriva a empresa da sessão e verifica o vínculo.
- IDs difíceis de adivinhar não substituem autorização. Consultas por ID precisam validar a empresa.
- O cargo `SUPER_ADMIN` não concede acesso automático a todas as rotas do PDV. Rotas administrativas futuras serão separadas, explícitas e auditadas.
- A demonstração continua em banco separado. Não haverá uma senha que mude uma instalação real para dados fictícios.

## Evidência no código atual

| Área | Situação observada | Trabalho necessário |
| --- | --- | --- |
| `prisma/schema.prisma` | Existem `Empresa`, `Usuario`, `UsuarioEmpresa`, `Plano`, `LicencaEmpresa`, `AuditLog`, `CobrancaLicenca` e `WebhookEvent`. As tabelas operacionais não têm `empresaId`. | Conectar identidade e empresa aos dados operacionais. |
| `src/lib/auth-session.ts` | O JWT identifica uma sessão genérica com `sub: "pdv"`. | Emitir sessão de usuário e empresa; rejeitar sessões legadas na versão SaaS. |
| `src/app/api/auth/login/route.ts` | Login compara credenciais do ambiente. | Validar usuário e hash de senha do banco, status e vínculo. |
| `src/middleware.ts` | Verifica apenas a validade do JWT. | Manter a barreira inicial e acrescentar autorização no servidor em cada operação. |
| `src/lib/vendas-service.ts` e `src/lib/caixa-service.ts` | Consultas globais; numeração de venda global. | Contexto obrigatório, transações consistentes e numeração por empresa. |
| `src/lib/run-importar-flexivel.ts` e `src/lib/run-produtos-csv-import.ts` | Procuram códigos e categorias globalmente. | Importar e atualizar somente dentro da empresa autenticada. |
| `src/lib/balanca-config.ts` e configuração do sistema | Usam `singleton` global. | Uma configuração independente por empresa. |
| `src/lib/dashboard-service.ts` e `src/lib/caixa-relatorio.ts` | Agregações e consultas por sessão não têm escopo de empresa. | Filtrar dados, totais, contagens e referências. |
| `src/components/providers.tsx` | Há cache no navegador. | Separar chaves por empresa e limpar dados privados ao sair ou trocar de contexto. |

## Modelagem proposta

Usar banco compartilhado com tabelas compartilhadas e escopo obrigatório por empresa. A aplicação acessa o banco pelo servidor; não expor uma conexão privilegiada no navegador.

| Entidade | Escopo e restrições planejadas |
| --- | --- |
| `Produto` | `empresaId` obrigatório; código único por `(empresaId, codigo)`. Categoria referenciada deve pertencer à mesma empresa. |
| `Categoria` | `empresaId` obrigatório; nome único por `(empresaId, nome)`. |
| `ConfigSistema`, `ConfigBalanca` | Um registro por empresa, com `empresaId` único. Remover a dependência de `id = "singleton"` global. |
| `CaixaSessao` | Empresa e usuário de abertura/fechamento. Uma sessão aberta por empresa na versão inicial, garantida também sob concorrência. |
| `Venda` | Empresa e operador; número único por `(empresaId, numero)`. Caixa da mesma empresa. |
| `ItensVenda`, `PagamentoVenda` | Empresa coerente com a venda; produto do item pertence à mesma empresa. |
| `MovimentacaoCaixa`, `MovimentacaoEstoque` | Empresa e ator quando a movimentação for feita por usuário; referências do mesmo escopo. |
| `UsuarioEmpresa` | Aproveitar o vínculo existente; validar `ativo`, cargo e status de usuário/empresa. |
| `AuditLog` | Empresa, ator e ação; não registrar senhas, tokens ou conteúdo completo de arquivos importados. |

Para relações entre dados operacionais, avaliar chaves estrangeiras compostas com `(empresaId, id)`, além das verificações do serviço. Uma chave estrangeira somente pelo ID garante existência, mas não garante que a relação seja entre registros da mesma empresa. Documentar como tratar referências opcionais, exclusões e históricos antes de gerar a migração.

A numeração de venda não deve continuar como `maior numero + 1` global. Usar contador por empresa, incrementado atomicamente na transação, ou solução equivalente que mantenha unicidade sob concorrência. Planejar idempotência de finalização para que a repetição da mesma requisição não crie duas vendas; a chave precisa ter escopo de empresa.

## Etapas de implementação da fundação

Cada etapa deve resultar em alteração pequena e verificável. Etapas incompletas não podem ser publicadas como multiempresa pronta.

### M1 — Preparar migração e fixtures

- [ ] Criar duas empresas fictícias A e B com produtos de mesmo código, categorias de mesmo nome e usuários diferentes.
- [ ] Registrar contagens e totais do banco de origem e preparar cópia para ensaio, sem dados reais em commits.
- [ ] Definir migrações versionadas. O `db:push` continua uma facilidade local, não um procedimento de atualização de produção.
- [ ] Definir como converter o banco existente: seus dados pertencem a uma empresa identificada explicitamente pelo responsável pela migração.
- [ ] Definir a estratégia de PostgreSQL e valores monetários: migrar `Float` para centavos inteiros ou `Decimal`, com reconciliação e arredondamento documentados.

**Aceite:** é possível reproduzir o cenário A/B em banco descartável e restaurar o backup de origem. Nenhum comando desta preparação altera o banco real automaticamente.

### M2 — Schema e preenchimento dos dados existentes

- [ ] Adicionar campos e relações de empresa; adaptar índices e unicidades.
- [ ] Fazer migração em fases: acrescentar campos, preencher registros antigos, validar, tornar obrigatórios e remover unicidades globais substituídas.
- [ ] Migrar cada configuração global para a empresa de origem. Empresas novas recebem configurações próprias.
- [ ] Atribuir itens, pagamentos e movimentações coerentemente com suas vendas, caixas e produtos.
- [ ] Identificar e resolver referências órfãs ou inconsistentes antes de aplicar restrições.
- [ ] Preservar números e totais históricos. Movimentações antigas podem manter ator desconhecido documentado; não inventar um usuário que teria feito a ação.
- [ ] Adaptar seed normal e seed de demonstração ao novo schema, preservando o banco separado da demonstração.

**Aceite:** nenhum dado operacional fica sem empresa; as duas empresas podem usar o mesmo código de produto; uma relação entre registros de A e B é rejeitada. Contagens e totais antigos reconciliam com a origem.

### M3 — Identidade e autorização no servidor

- [ ] Reaproveitar o formato de hash `scrypt` existente no seed e implementar verificação segura; não comparar senha em texto com o banco.
- [ ] Emitir JWT com usuário e empresa selecionada, expiração e identificação de versão da sessão. O cargo precisa ser confirmado conforme o vínculo atual, sem depender indefinidamente de um JWT antigo.
- [ ] Centralizar resolução do contexto em um helper de servidor, por exemplo `requireEmpresaContext()`, contendo `usuarioId`, `empresaId` e cargo autorizado.
- [ ] Conferir usuário ativo, empresa ativa e vínculo ativo. Sessões revogadas ou vinculadas a usuário bloqueado não podem continuar operando até expirar o JWT.
- [ ] Exigir segredo forte fora do desenvolvimento, cookies adequados ao HTTPS e mensagens de erro sem indicar se determinado e-mail existe.
- [ ] Proteger o login contra tentativas excessivas e validar a origem das operações de escrita baseadas em cookie.
- [ ] Remover o fallback de credenciais do ambiente na operação SaaS. A demonstração deverá autenticar seu próprio usuário no banco fictício quando essa transição ocorrer.
- [ ] Rejeitar o JWT legado e orientar um novo login. Não reinterpretá-lo como acesso à empresa padrão.

**Aceite:** A e B autenticam separadamente. Sem sessão, a API retorna 401; sem vínculo/permissão, 403; objeto inexistente ou pertencente a outra empresa retorna 404 sem expor informações. O contrato deve ser consistente por rota.

### M4 — Isolar todas as leituras e alterações

- [ ] Exigir contexto nos serviços; não aceitar `empresaId` opcional nem inferir uma empresa global.
- [ ] Aplicar escopo a buscas, listagens, contagens, agregações, inclusão de relações e consultas por ID.
- [ ] Na criação, definir a empresa no servidor; não espalhar campos arbitrários do body para o banco.
- [ ] Em atualização/exclusão, validar posse na própria operação ou transação, incluindo `categoriaId`, `produtoId`, `vendaId` e `sessaoId` recebidos.
- [ ] Manter abertura de caixa, baixa de estoque, contador de venda e movimentos coerentes sob requisições simultâneas.
- [ ] Verificar o caixa dentro da transação da venda; uma venda não pode ser concluída em caixa fechado por outra requisição.
- [ ] Isolar importações CSV/XLSX, inclusive pré-carregamento de códigos, categorias, modo atualizar e mensagens de erro.
- [ ] Isolar interpretação de etiqueta de balança, configuração, impressão e relatório de caixa por ID.

**Aceite:** a matriz A/B abaixo passa em todas as áreas, e a demonstração continua permitindo o roteiro do README.

### M5 — Permissões e cache da interface

Política inicial proposta, a ser implementada também no servidor:

| Ação | Administrador | Gerente | Caixa |
| --- | --- | --- | --- |
| Consultar catálogo de venda e concluir venda | Sim | Sim | Sim |
| Ver custos, margens e relatórios gerenciais | Sim | Sim | Não |
| Gerenciar produtos e ajustar estoque | Sim | Sim | Não |
| Importar catálogo | Sim | Sim | Não |
| Abrir/fechar caixa e registrar sangria/reforço | Sim | Sim | Não inicialmente |
| Ver/imprimir venda operacional da empresa | Sim | Sim | Sim, com resposta limitada aos campos operacionais |
| Gerenciar usuários e configuração da empresa | Sim | Não inicialmente | Não |

O caixa depende de abertura por administrador/gerente nessa política inicial. A eventual permissão para o operador abrir ou fechar deve ser uma decisão explícita e testada. Ocultar um botão não basta: a API deve recusar a ação sem permissão. Respostas ao caixa não devem incluir campos de custo por meio de relações completas de produto.

- [ ] Incluir a empresa nas chaves de cache e descartar respostas antigas ao sair ou trocar de contexto.
- [ ] Limpar carrinho, pagamentos, comprovante e consultas privadas na transição de sessão.
- [ ] Impedir que uma requisição iniciada na sessão anterior preencha a tela da próxima sessão.
- [ ] Separar navegação operacional de administração global.

**Aceite:** o funcionário usa o PDV da empresa correta, sem visualizar custos ou executar alterações administrativas por chamada direta à API. Sair de A e entrar em B no mesmo navegador não mostra dados de A.

### M6 — Validar e ensaiar implantação

- [ ] Automatizar a matriz A/B e os testes de concorrência relevantes.
- [ ] Executar os testes de pagamentos existentes, lint e build.
- [ ] Ensaiar a migração no mesmo mecanismo de banco escolhido para produção; testar só SQLite não valida o comportamento concorrente de PostgreSQL.
- [ ] Registrar versão da aplicação, backup anterior, resultado da migração, conferência de dados e procedimento de recuperação.
- [ ] Planejar janela de atualização que impeça escritas durante exportação/migração final.

**Aceite:** o isolamento não depende de disciplina manual de quem usa o sistema; ele é imposto pelo servidor e pelas restrições do banco. Falha na validação impede a liberação multiempresa.

## Mapa obrigatório de revisão

Usar a busca por chamadas `prisma.` e `tx.` como inventário auxiliar; a busca sozinha não comprova isolamento. Examinar os serviços e os caminhos indiretos.

| Superfície | Arquivos/pastas |
| --- | --- |
| Produtos e categorias | `src/app/api/produtos`, `src/app/api/categorias`, `src/lib/validators.ts` |
| Estoque | `src/app/api/estoque`, `src/lib/vendas-service.ts` |
| Caixa e fechamento | `src/app/api/caixa`, `src/lib/caixa-service.ts`, `src/lib/caixa-relatorio.ts` |
| Vendas e comprovantes | `src/app/api/vendas`, `src/lib/vendas-service.ts`, `src/app/print/venda/[id]/page.tsx` |
| Importações | `src/app/api/produtos/importar-csv`, `src/app/api/produtos/importar-flexivel`, `src/lib/run-produtos-csv-import.ts`, `src/lib/run-importar-flexivel.ts` |
| Configuração e balança | `src/app/api/config`, `src/app/api/pdv/interpretar-codigo`, `src/lib/balanca-config.ts` |
| Indicadores | `src/app/api/dashboard`, `src/lib/dashboard-service.ts` |
| Sessão e cache | `src/lib/auth-session.ts`, `src/middleware.ts`, `src/app/api/auth`, `src/components/providers.tsx` e chaves de consultas das telas |

## Matriz mínima de testes de isolamento

Preparar A e B com valores distintos e códigos iguais. Repetir as tentativas nos dois sentidos.

| Cenário | Resultado esperado |
| --- | --- |
| A lista produtos, histórico e indicadores | Apenas registros e totais de A; paginação e contagens também limitadas a A. |
| A busca o ID de produto, venda, categoria ou caixa de B | 404; sem dados de B na resposta. |
| A tenta editar/excluir produto ou categoria de B | Rejeição; dados de B intactos. |
| A cria produto com categoria de B | Rejeição; nenhum vínculo cruzado criado. |
| A envia venda com produto de B ou relatório com caixa de B | Rejeição; nenhum estoque, caixa ou pagamento alterado. |
| A importa código já existente em B no modo atualizar | Cria/atualiza somente em A; B fica intacta. |
| A consulta e altera configuração da balança | A configuração de B permanece independente. |
| A acessa diretamente a URL de impressão de venda de B | Nenhum dado da venda de B é exibido. |
| Caixa chama API gerencial sem usar a interface | 403 ou resposta operacional explicitamente limitada, conforme o contrato da rota. |
| Usuário/vínculo é bloqueado após login | A próxima operação protegida é rejeitada, mesmo com JWT ainda não expirado. |
| Body/query tenta substituir `empresaId` | O servidor recusa ou ignora o campo sem mudar o escopo; não existe acesso a B. |
| Duas empresas abrem caixa simultaneamente | Cada uma pode ter seu próprio caixa; nenhuma interfere na outra. |
| A abre duas sessões simultâneas ou finaliza vendas concorrentes | Restrições preservam uma sessão aberta, números únicos e estoque coerente. |
| Repetição da mesma finalização em A | Uma única venda e uma única baixa; a mesma chave em B não conflita com A. |
| Logout de A e login de B na mesma aba | Sem catálogo, carrinho, comprovante ou resposta pendente de A aparecendo em B. |
| Banco legado é migrado | Quantidades, totais e relações preservados, atribuídos à empresa explícita de origem. |
| Comandos `demo:*` são executados após a migração | Operam somente em `demo.db`; preservam o banco real. |

## Migração e recuperação dos dados

1. Confirmar qual banco e qual empresa serão migrados; registrar contagens e totais.
2. Parar escritas e fazer backup consistente. Ensaio deve usar uma cópia, nunca o único banco disponível.
3. Aplicar a migração na cópia e preencher os vínculos de empresa em ordem de dependência.
4. Validar ausência de registros sem empresa, referências cruzadas, números duplicados e diferenças de valores.
5. Executar a matriz A/B e o roteiro da demonstração.
6. Somente após o ensaio, preparar a atualização do ambiente escolhido, com versão e janela definidas.
7. Se houver falha antes da reabertura para escritas, restaurar o backup e a versão anterior compatível. Se já houver novas vendas, interromper escritas e reconciliar antes de restaurar; um restore cego perderia operações novas.

Não copiar SQL de migração SQLite diretamente para PostgreSQL. A carga inicial precisa converter tipos e preservar relações, datas e valores. O fornecedor do banco não deve alterar as regras de autorização.

## Decisões posteriores, sem bloquear a fundação

- **Hospedagem e banco:** comparar custo total, região, backups, recuperação, limites de conexão e suporte. Nenhuma contratação feita por este plano.
- **Pagamento:** comparar provedores e tarifas antes de fixar preço ou prometer recorrência por Pix. A referência comercial é R$ 100–150 por loja, ainda não um preço aprovado.
- **Mensalidade:** intenção atual de aviso três dias antes, vencimento no dia de aniversário e bloqueio operacional no dia seguinte. Definir fuso, virada do mês, dia 29/30/31, atraso na confirmação e preservação do histórico antes de implementar. O seed atual de 365 dias não representa a política mensal planejada.
- **Fiscal:** foco inicial em comércios de Curitiba e região, no Paraná; confirmar exigências vigentes, contador, certificado e provedor na etapa fiscal. O comprovante atual permanece não fiscal.
- **Sem internet:** não foi decidido. Web, PWA e executável não garantem sincronização offline por si só.
- **Cadastro e recuperação de conta:** planejar convite/cadastro, confirmação de contato e recuperação de senha antes de abrir inscrições ao público. Provisionamento inicial pode ser assistido e seguro, sem senha universal.
- **Equipamentos e outro produto:** leitores/impressoras serão testados separadamente; locação de computadores e agenda para barbearia não entram nesta migração.

## Próxima alteração de código sugerida

Começar por **M1 + desenho de M2** em banco descartável: fixtures de duas empresas e migração versionada com conferência de dados. Em seguida, implementar M2 e M3, depois propagar o contexto obrigatório em M4. Não ativar modo multiempresa enquanto houver rotas operacionais globais.

A preparação deste documento não migra bancos, não cria contas reais, não libera cobrança e não muda o funcionamento da demonstração.
