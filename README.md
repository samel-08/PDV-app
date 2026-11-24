# PDV Comércio

PDV web para pequenos comércios, com Next.js, React, TypeScript, Prisma e SQLite. Interface em português e valores em reais.

## Estado atual

O sistema tem **usuários individuais vinculados a empresas**. Produtos, categorias, estoque, vendas, caixa, configurações, importações, relatórios e comprovantes usam a empresa da sessão autenticada. Dono e funcionários compartilham os dados da mesma loja, com permissões por cargo.

O primeiro escopo é **uma loja por empresa, um caixa aberto por empresa e um vínculo ativo de empresa por usuário**. Se uma conta tiver vários vínculos ativos, o login recusa a entrada sem escolher uma empresa silenciosamente. Seleção de empresa, filiais, cadastro público e assinaturas ainda não estão disponíveis.

A implementação atual usa SQLite. Migração e testes de PostgreSQL, hospedagem, cobrança, emissão fiscal e operação sem internet com sincronização continuam etapas futuras. O comprovante é **não fiscal**. Pix e cartão são registrados manualmente como formas de pagamento, sem cobrança pelo provedor.

## Indicadores de gestão

- **Margem bruta por produto:** coluna na lista e prévia no formulário, separada do markup. Custo R$ 60 e venda R$ 100 resultam em margem de 40%. Venda abaixo do custo mostra valor negativo. Custo/venda não positivos mostram margem indisponível; taxas, impostos e despesas não estão incluídos.
- **Horários de pico:** seção do dashboard com filtro de datas (até 93 dias), quantidade e valor das vendas concluídas em cada hora, incluindo empates no pico. O relatório usa o fuso de São Paulo, respeita a empresa autenticada e permite consulta apenas a administrador/gerente. Atualiza a cada 60 segundos enquanto a tela está ativa.
- Não é necessário migrar o banco para esses indicadores. Os demais recursos pendentes continuam no [plano de evolução](docs/plano-evolucao-saas.md).

Verifique os cálculos com `npm run test:indicadores`. Os testes de integração e leitura móvel fazem parte de `npm run test:e2e` (requer build e navegador Playwright).

## Requisitos

- **Node.js 22.12 ou superior** e npm.
- Navegador atualizado.
- Internet para instalar dependências e fazer o primeiro build, inclusive o download da fonte.

## Demonstração com dados fictícios

Na pasta do projeto:

```bash
npm ci
npm run demo:setup
npm run demo:dev
```

Abra **http://localhost:3000**. O preparo informa o usuário `demo` e uma senha aleatória, armazenados somente em `.env.demo`. Não existe senha universal `admin`.

Os comandos `demo:*` usam exclusivamente **`prisma/demo.db`**, com empresa e usuário próprios. Ignoram o `DATABASE_URL` da instalação real e não sobrescrevem `.env`. Se já houver uma demonstração antiga, o preparo migra esse arquivo fictício, mantém seus dados e provisiona o usuário da demonstração. Repetir o preparo não repõe o estoque nem apaga vendas; ele revalida as credenciais da demonstração e revoga suas sessões anteriores.

Para apresentar com build otimizado, pare o modo de desenvolvimento:

```bash
npm run demo:build
npm run demo:start
```

As modalidades normal e de demonstração compartilham a porta 3000 e a pasta `.next`: execute uma de cada vez e refaça o build após mudar de versão. A demonstração não é ativada por uma senha especial em um banco real.

### Roteiro de apresentação

1. Entre com a credencial exibida no preparo e abra o caixa com R$ 100.
2. Adicione `001` — uma água de R$ 2,50.
3. Digite a etiqueta fictícia **`2100010002500`** — 250 g de granola a R$ 32/kg, total R$ 8.
4. Confira a venda de R$ 10,50 e registre R$ 20 em dinheiro: troco R$ 9,50.
5. Abra o comprovante não fiscal; sem impressora, use a prévia ou salve em PDF.
6. Confira histórico, estoque e indicadores.
7. Feche o caixa: sem outras movimentações, o saldo esperado é R$ 110,50.

O catálogo contém seis produtos por unidade/peso, incluindo duas peças de vestuário separadas. Não existe módulo de grade de tamanho/cor. Leitor, impressora e desempenho devem ser conferidos no equipamento real.

## Instalação nova com banco próprio

**Se já existe `.env` ou banco com dados, preserve ambos e leia a seção de migração.** Não substitua o banco pelo arquivo da demonstração.

```bash
npm ci
```

Copie `.env.example` para `.env` somente se o arquivo não existir:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```bash
# Linux/macOS
cp -n .env.example .env
```

Preencha no `.env`:

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | `file:./dev.db` usa `prisma/dev.db`. |
| `PDV_SESSION_SECRET` | Segredo aleatório de pelo menos 32 caracteres. Sem fallback de desenvolvimento. |
| `PDV_COOKIE_SECURE` | `false` para localhost HTTP; `true` para HTTPS. |
| `APP_ORIGIN` | Origem pública exata, por exemplo `https://app.seudominio.com.br`, sem `/` final. Em localhost pode ficar vazia. |
| `EMPRESA_ID`, `EMPRESA_NOME` | ID estável escolhido para a loja e seu nome. Sem ID, será gerado um e informado pelo comando. Guarde-o para novos funcionários. |
| `ACCOUNT_LOGIN`, `ACCOUNT_PASSWORD`, `ACCOUNT_NAME` | Login/e-mail, senha de 12–256 caracteres e nome do administrador a provisionar. |
| `ACCOUNT_ROLE` | `ADMINISTRADOR`, `GERENTE` ou `CAIXA`. Uma empresa nova precisa de administrador. |
| `ACCOUNT_RESET_EXISTING` | `false` preserva credenciais existentes. `true` redefine explicitamente a senha do login na empresa escolhida e revoga suas sessões. |

Gere o segredo:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Depois de configurar uma instalação nova:

```bash
npm run db:init
npm run account:create
npm run dev
```

`db:init` cria o schema versionado e verifica a versão em execuções seguintes. **Não cria usuários ou senhas padrão.** `account:create` é provisionamento administrativo por terminal, não cadastro público. O login lê o hash no banco; mudar a variável `ACCOUNT_PASSWORD` sem executar o provisionamento não muda a senha.

`PDV_LOGIN_USER` e `PDV_LOGIN_PASSWORD` só alimentam a preparação do banco fictício nos comandos de demonstração. Não permitem entrar diretamente em uma instalação normal. `SUPER_ADMIN_EMAIL` e `SUPER_ADMIN_PASSWORD` não concedem mais um login global.

Para criar um funcionário, mantenha o `EMPRESA_ID` da loja, escolha outro `ACCOUNT_LOGIN`, nome, senha e cargo e execute `account:create`. Não há vinculação automática de um login já pertencente a outra empresa. Ao terminar, remova os campos de senha de provisionamento do `.env` se não precisar deles; o hash permanece no banco.

Para compilar e iniciar localmente:

```bash
npm run build
npm run start:local
```

## Atualização de banco antigo

A migração **não é executada ao abrir o site**. Ela foi testada em arquivos fictícios, não no seu notebook. Consulte o [procedimento operacional](docs/multiempresa-operacional.md) e ensaie primeiro com uma cópia.

1. Pare o servidor antigo, preserve seu `.env` e faça uma cópia externa do banco.
2. Defina `MIGRATION_EMPRESA_ID` como a empresa dona de todos os dados da instalação antiga. Preencha `MIGRATION_EMPRESA_NOME` se ela ainda não existir.
3. Execute `npm run db:migrate:legacy` sobre a cópia. O comando também cria um backup consistente antes das alterações e informa seu caminho.
4. Confira as contagens, valores, estoque, configurações e histórico. Se houver referências inválidas ou mais de um caixa aberto, a migração falha e reverte as alterações.
5. Provisione um administrador com senha nova. **Contas SaaS antigas ficam bloqueadas**, porque podiam conter senhas de seed que nunca eram utilizadas pelo login anterior.
6. Para reativar explicitamente um login antigo da empresa, use `ACCOUNT_RESET_EXISTING=true` e uma senha nova com `account:create`; depois volte a opção para `false`.
7. Só depois do ensaio, repita o procedimento no banco escolhido para uso.

Os registros antigos mantêm IDs, datas, estoque e valores; operadores históricos desconhecidos ficam nulos. A numeração da empresa continua a partir da maior venda existente. Tokens de sessão antigos deixam de funcionar: todos precisam entrar novamente.

`db:push` agora é um alias do instalador seguro para compatibilidade. Não execute `npx prisma db push`, `migrate reset` ou SQL experimental contra um banco com dados. O instalador atual aceita SQLite; PostgreSQL exige migração própria.

## Permissões

| Ação | Administrador | Gerente | Caixa |
| --- | --- | --- | --- |
| Buscar produtos, registrar venda e consultar/imprimir vendas da loja | Sim | Sim | Sim |
| Alterar produtos/categorias, importar catálogo e ajustar estoque | Sim | Sim | Não |
| Abrir/fechar caixa, sangria e reforço | Sim | Sim | Não |
| Indicadores e relatórios gerenciais | Sim | Sim | Não |
| Alterar configurações da loja/balança | Sim | Não | Não |

O caixa aguarda abertura por administrador/gerente. APIs recusam ações sem permissão, mesmo quando chamadas diretamente. Respostas ao caixa omitem custos e margem. Consultas operacionais sem contexto de empresa falham; trocar IDs ou enviar `empresaId` no corpo não concede acesso a outra loja.

As sessões duram até 12 horas, podem ser revogadas e verificam vínculo/cargo/status no banco a cada requisição. Logout revoga o cookie no servidor. A interface recarrega a sessão ao entrar/sair e descarta cache/carrinho; abas antigas são avisadas da troca, e o servidor recusa uma sessão de aba incompatível com o cookie atual.

## Verificação

```bash
npm run test:pagamentos
npm run test:tenancy
npm run test:operational
npm run lint
npm run build
```

Para testar APIs e navegador com duas empresas fictícias:

```bash
npx playwright install chromium
npm run test:e2e
```

O teste abre um servidor exclusivo na porta **3137**, cria seu próprio banco em `work/e2e/` e o remove ao terminar. Não usa o banco normal nem o da demonstração. As credenciais dos arquivos de teste são apenas dessas fixtures descartáveis. Bancos, logs e rastros ficam ignorados pelo Git. Um encerramento forçado do processo pode deixar artefatos em `work/`, que podem ser removidos depois de parar os testes.

O ensaio histórico também continua disponível com `npm run lab:tenancy`; ele é separado da implementação operacional. Veja [o laboratório](docs/ensaio-migracao-multiempresa.md) e [o plano de evolução](docs/plano-evolucao-saas.md).

## Próximas etapas comerciais

- Escolher e ensaiar PostgreSQL, hospedagem, backups externos e monitoramento.
- Implementar planos, cobrança, avisos de vencimento, bloqueio comercial e reativação.
- Integrar emissão fiscal do Paraná com os requisitos do lojista e do contador.
- Validar impressão, leitores e desempenho no notebook de apresentação.

Não versione `.env`, `.env.demo`, senhas, certificados, bancos ou backups. A `.env.example` é apenas um modelo sem credenciais reais.
