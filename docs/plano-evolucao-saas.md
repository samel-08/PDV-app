# Plano de evolução do PDV Comércio

## Estado da implementação

A primeira implementação operacional em SQLite está descrita em [multiempresa operacional](multiempresa-operacional.md): banco por empresa, login individual, escopo nas operações e testes A/B no navegador. A demonstração também usa empresa e usuário próprios, preservando seu banco fictício separado.

O [ensaio histórico](ensaio-migracao-multiempresa.md) permanece como preparação reproduzível e usa um snapshot próprio do schema antigo. O inventário `arquitetura-atual.md` é histórico, anterior a esta implementação.

As etapas abaixo documentam o contrato técnico e a evolução planejada. A implementação atual não representa lançamento comercial: PostgreSQL, hospedagem, cobrança, emissão fiscal e validação dos equipamentos continuam pendentes. Bancos reais ainda precisam de ensaio e conferência específicos antes de aplicar a migração.

## Conferência dos recursos solicitados

Revisão do código em 23/11/2026, na branch `codex/multiempresa-operacional`, commit `81260f8`. Esta revisão apenas atualiza o planejamento; não implementa os itens pendentes. “Existe” indica presença no código, não homologação comercial ou validação em equipamentos reais.

| Recurso | Estado | O que existe e o que falta |
| --- | --- | --- |
| Emissão fiscal integrada | Não implementado | O cupom informa **DOCUMENTO NÃO FISCAL**. Faltam integração fiscal, autorização, identificação do consumidor quando aplicável e os fluxos de consulta, cancelamento e contingência. A etapa fiscal do Paraná já está prevista neste plano. |
| Várias formas de pagamento | Existe para registro da venda | Dinheiro, Pix, crédito, débito e outros, inclusive combinação de pagamentos e cálculo de troco. Pix/cartão são registros manuais: não há cobrança, confirmação ou conciliação por provedor integrado. |
| Relatórios: mais vendidos, ticket médio e horários de pico | Parcial | Dashboard com ranking de produtos mais vendidos e ticket médio mensal/geral; relatório de caixa também calcula ticket médio. Falta relatório de vendas por hora e identificação dos horários de pico. |
| Contas a pagar e a receber integradas às vendas | Não implementado | Existem caixa, sangria, reforço e pagamentos da venda; não existe módulo de títulos, vencimentos, parcelas e baixas. As tabelas de cobrança de licença são para a futura assinatura do PDV e não atendem ao financeiro do lojista. |
| Cálculo de margem por produto | Parcial | Há preço de custo/venda, markup sobre custo, lucro unitário estimado na API de produtos e estimativa de lucro mensal no dashboard. Falta margem percentual sobre o preço de venda, exibida por produto. Markup e margem são cálculos diferentes. |
| Dashboard no celular em tempo real | Parcial | Interface com layout responsivo e indicadores protegidos por cargo; consulta de vendas a cada **60 segundos** enquanto a tela está ativa. Faltam atualização entre dispositivos com latência definida e validação em celular. Acesso remoto também depende da implantação segura; `localhost` no notebook não publica o sistema na internet. |
| Metas diárias por loja e vendedor, com acompanhamento visual | Não implementado | As vendas novas registram operador, mas não há cadastro de metas, apuração por loja/vendedor ou visualização do progresso. Operador de caixa não foi definido como vendedor. |
| Multilojas e multiusuário, com dados centralizados | Parcial | Múltiplos usuários por empresa, cargos e isolamento das empresas no mesmo SQLite. Cada empresa representa uma loja e permite um caixa aberto; cada usuário operacional tem um único vínculo ativo. Faltam filiais de uma mesma organização, seleção autorizada de loja e visão consolidada do dono. |

### Pendências adicionadas ou detalhadas na lista

Os itens abaixo ficam **somente planejados**. Não substituem a ordem de fundação, produção, assinatura e fiscal já definida neste documento. Recursos ausentes não devem ser anunciados como disponíveis.

- [ ] **Fiscal integrado (etapa já prevista):** definir provedor e requisitos aplicáveis ao Paraná com o contador; planejar homologação, certificado/credenciais, dados fiscais dos produtos, CPF/CNPJ do consumidor quando aplicável, autorização, XML/protocolo, documento auxiliar, cancelamento e contingência. Aceite: emissão autorizada e demais fluxos validados no ambiente apropriado antes de uso comercial.
- [ ] **Pagamentos integrados (extensão opcional do registro atual):** decidir se o produto também fará cobrança Pix/cartão. Se entrar no escopo, definir provedor, confirmação pelo servidor, tratamento de eventos repetidos, estorno e conciliação. Aceite: uma venda não é considerada paga apenas por seleção da forma de pagamento ou exibição de QR Code. Separar essa integração da cobrança da assinatura do PDV.
- [ ] **Horários de pico:** agrupar vendas concluídas por hora, com filtro de período e fuso da loja, mostrando quantidade e valor em gráfico/tabela. Aceite: totais conciliados com as vendas do período, sem misturar empresas e sem incluir vendas canceladas.
- [ ] **Contas a pagar e receber:** definir títulos manuais, origem em venda a prazo/parcelada, vencimento, saldo, baixa parcial, atraso e vínculo com caixa. Definir como despesas e compras gerarão contas a pagar. Aceite: receber uma parcela não duplica faturamento nem entrada no caixa; cancelamento/estorno tem tratamento definido e histórico preservado.
- [ ] **Margem por produto:** exibir margem bruta estimada `(preço de venda - custo) / preço de venda × 100`, mantendo o markup identificado separadamente. Tratar preço zero e custo ausente; documentar que taxas, impostos e despesas não estão incluídos sem modelagem própria. Aceite: custo R$ 60 e venda R$ 100 mostram markup de 66,67% e margem de 40%.
- [ ] **Dashboard móvel e atualização entre dispositivos:** definir latência esperada e escolher consulta periódica ajustada ou eventos conforme a arquitetura de produção. Mostrar última atualização, tratar reconexão e validar leitura/navegação em celular com dados da loja autorizada. Aceite: venda concluída em outro dispositivo aparece dentro do prazo definido, sem recarga manual nem acesso a dados de outra empresa; acesso externo usa hospedagem com HTTPS.
- [ ] **Metas diárias:** definir se o vendedor será o operador da venda ou uma identificação própria; cadastrar metas por loja e vendedor, apurar vendas concluídas no fuso da loja e exibir realizado, restante e percentual. Aceite: cancelamentos e dias sem vendas têm comportamento definido; vendas antigas sem operador não são atribuídas a alguém por suposição.
- [ ] **Multilojas:** definir organização dona das filiais, vínculo/permissão por loja, seleção explícita do contexto e visão consolidada autorizada. Decidir compartilhamento de catálogo, estoque e preços antes de modelar. Aceite: o dono autorizado consulta suas filiais e o consolidado; funcionários acessam apenas suas lojas e empresas independentes continuam isoladas.
- [ ] **Gestão de usuários pela interface:** complementar o provisionamento assistido atual com criação/convite, cargos, bloqueio e recuperação de acesso. Aceite: gestão restrita ao responsável autorizado, com revogação de sessões e sem senha universal.

### Evidências desta conferência

- Fiscal: `src/app/print/venda/[id]/page.tsx` identifica o documento como não fiscal; não foi encontrada integração SEFAZ/provedor no código da aplicação.
- Pagamentos: `src/lib/validators.ts`, `src/lib/pagamentos.ts` e `src/lib/vendas-service.ts` definem formas, validações e persistência dos pagamentos.
- Relatórios e atualização: `src/lib/dashboard-service.ts`, `src/lib/caixa-relatorio.ts` e `src/app/(dashboard)/page.tsx` calculam/exibem os indicadores e configuram a consulta a cada 60 segundos. A consulta de estoque baixo usa 120 segundos.
- Preços: `src/lib/produto-precos.ts` calcula markup; `src/app/api/produtos/route.ts` retorna lucro unitário estimado; `src/app/(dashboard)/produtos/page.tsx` oferece custo, venda e markup.
- Financeiro, metas e filiais: o inventário de modelos em `prisma/schema.prisma` não contém entidades desses módulos; não foram encontradas telas/serviços correspondentes. Movimentação de caixa não substitui contas a pagar/receber.
- Usuários e empresas: `prisma/schema.prisma`, `src/app/api/auth/login/route.ts`, `src/lib/tenant-route.ts` e [multiempresa operacional](multiempresa-operacional.md) documentam o escopo e os limites atuais.

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

## Inventário histórico anterior à implementação multiempresa

A tabela abaixo registra o diagnóstico que originou M1–M6; não descreve o estado atual. Para a implementação entregue, consulte [multiempresa operacional](multiempresa-operacional.md); para os recursos comerciais solicitados, consulte a conferência acima.

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

- [x] Criar duas empresas fictícias A e B com produtos de mesmo código, categorias de mesmo nome e usuários diferentes.
- [x] Registrar contagens e totais do banco de origem e preparar cópia para ensaio, sem dados reais em commits.
- [x] Definir migrações versionadas. O `db:push` continua uma facilidade local, não um procedimento de atualização de produção.
- [x] Definir como converter o banco existente: seus dados pertencem a uma empresa identificada explicitamente pelo responsável pela migração.
- [ ] Definir a estratégia de PostgreSQL e valores monetários: migrar `Float` para centavos inteiros ou `Decimal`, com reconciliação e arredondamento documentados.

**Aceite:** é possível reproduzir o cenário A/B em banco descartável e restaurar o backup de origem. Nenhum comando desta preparação altera o banco real automaticamente.

### M2 — Schema e preenchimento dos dados existentes

- [x] Adicionar campos e relações de empresa; adaptar índices e unicidades.
- [x] Fazer migração em fases: acrescentar campos, preencher registros antigos, validar, tornar obrigatórios e remover unicidades globais substituídas.
- [x] Migrar cada configuração global para a empresa de origem. Empresas novas recebem configurações próprias.
- [x] Atribuir itens, pagamentos e movimentações coerentemente com suas vendas, caixas e produtos.
- [x] Identificar e resolver referências órfãs ou inconsistentes antes de aplicar restrições.
- [x] Preservar números e totais históricos. Movimentações antigas podem manter ator desconhecido documentado; não inventar um usuário que teria feito a ação.
- [x] Adaptar seed normal e seed de demonstração ao novo schema, preservando o banco separado da demonstração.

**Aceite:** nenhum dado operacional fica sem empresa; as duas empresas podem usar o mesmo código de produto; uma relação entre registros de A e B é rejeitada. Contagens e totais antigos reconciliam com a origem.

### M3 — Identidade e autorização no servidor

- [x] Reaproveitar o formato de hash `scrypt` existente no seed e implementar verificação segura; não comparar senha em texto com o banco.
- [x] Emitir JWT com usuário e empresa selecionada, expiração e identificação de versão da sessão. O cargo precisa ser confirmado conforme o vínculo atual, sem depender indefinidamente de um JWT antigo.
- [x] Centralizar resolução do contexto em um helper de servidor, por exemplo `requireEmpresaContext()`, contendo `usuarioId`, `empresaId` e cargo autorizado.
- [x] Conferir usuário ativo, empresa ativa e vínculo ativo. Sessões revogadas ou vinculadas a usuário bloqueado não podem continuar operando até expirar o JWT.
- [x] Exigir segredo forte fora do desenvolvimento, cookies adequados ao HTTPS e mensagens de erro sem indicar se determinado e-mail existe.
- [x] Proteger o login contra tentativas excessivas e validar a origem das operações de escrita baseadas em cookie.
- [x] Remover o fallback de credenciais do ambiente na operação SaaS. A demonstração deverá autenticar seu próprio usuário no banco fictício quando essa transição ocorrer.
- [x] Rejeitar o JWT legado e orientar um novo login. Não reinterpretá-lo como acesso à empresa padrão.

**Aceite:** A e B autenticam separadamente. Sem sessão, a API retorna 401; sem vínculo/permissão, 403; objeto inexistente ou pertencente a outra empresa retorna 404 sem expor informações. O contrato deve ser consistente por rota.

### M4 — Isolar todas as leituras e alterações

- [x] Exigir contexto nos serviços; não aceitar `empresaId` opcional nem inferir uma empresa global.
- [x] Aplicar escopo a buscas, listagens, contagens, agregações, inclusão de relações e consultas por ID.
- [x] Na criação, definir a empresa no servidor; não espalhar campos arbitrários do body para o banco.
- [x] Em atualização/exclusão, validar posse na própria operação ou transação, incluindo `categoriaId`, `produtoId`, `vendaId` e `sessaoId` recebidos.
- [x] Manter abertura de caixa, baixa de estoque, contador de venda e movimentos coerentes sob requisições simultâneas.
- [x] Verificar o caixa dentro da transação da venda; uma venda não pode ser concluída em caixa fechado por outra requisição.
- [x] Isolar importações CSV/XLSX, inclusive pré-carregamento de códigos, categorias, modo atualizar e mensagens de erro.
- [x] Isolar interpretação de etiqueta de balança, configuração, impressão e relatório de caixa por ID.

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

- [x] Vincular a interface à sessão/empresa, limpar cache e descartar respostas de uma sessão anterior; a implementação usa recarga completa e cabeçalho de sessão, em vez de seleção de empresa na mesma árvore de cache.
- [x] Limpar carrinho, pagamentos, comprovante e consultas privadas na transição de sessão.
- [x] Impedir que uma requisição iniciada na sessão anterior preencha a tela da próxima sessão.
- [x] Separar navegação operacional de administração global.

**Aceite:** o funcionário usa o PDV da empresa correta, sem visualizar custos ou executar alterações administrativas por chamada direta à API. Sair de A e entrar em B no mesmo navegador não mostra dados de A.

### M6 — Validar e ensaiar implantação

- [x] Automatizar cenários A/B e concorrência relevantes em SQLite: escopo, relações, importações, sessão, idempotência, última unidade e caixa aberto único. Ampliação e ensaio em PostgreSQL continuam pendentes.
- [x] Executar os testes de pagamentos existentes, lint e build.
- [ ] Ensaiar a migração no mesmo mecanismo de banco escolhido para produção; testar só SQLite não valida o comportamento concorrente de PostgreSQL.
- [x] Registrar versão da aplicação, backup anterior, resultado da migração, conferência de dados e procedimento de recuperação.
- [x] Planejar janela de atualização que impeça escritas durante exportação/migração final.

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

## Próxima etapa

Validar a demonstração no notebook e equipamentos reais; ensaiar uma cópia autorizada do banco legado. Em paralelo, comparar PostgreSQL/hospedagem e preparar a etapa de assinaturas. Não contratar serviços nem prometer emissão fiscal apenas por a fundação multiempresa estar implementada.
