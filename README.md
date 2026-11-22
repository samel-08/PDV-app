# PDV Comércio

PDV web para pequenos comércios, com Next.js, React, TypeScript, Prisma e SQLite. Interface em português e valores em reais.

## Estado atual e acesso

O sistema funciona como **uma instalação de uma única loja**. O login atual usa credenciais de configuração; não há cadastro de clientes do SaaS, seleção de empresa ou isolamento de dados por usuário. As tabelas iniciais de empresas e licenças ainda não controlam o acesso operacional.

**Trocar o usuário ou a senha não troca os produtos nem o banco.** A demonstração abaixo é separada por arquivo de banco e comandos próprios, não por uma senha especial. Não coloque empresas diferentes nesta instalação esperando que os logins separem seus dados.

O comprovante é **não fiscal**: não emite NFC-e, não autoriza documentos na SEFAZ e não processa pagamentos. Dinheiro, Pix e cartão são formas de pagamento registradas manualmente no PDV. Assinaturas, cobrança automática e emissão fiscal são etapas futuras.

## Requisitos

- Node.js 20 ou superior compatível com o Next.js 15 e npm.
- Navegador atualizado.
- Internet para instalar dependências e fazer o primeiro build (inclui download da fonte). Depois de preparado, o servidor local pode ser acessado na mesma máquina sem hospedagem externa.

## Demonstração local com dados fictícios

Na pasta do projeto, execute:

```bash
npm ci
npm run demo:setup
npm run demo:dev
```

Abra **http://localhost:3000**. O preparo informa o usuário `demo` e uma **senha aleatória**, salva em `.env.demo`. Esse arquivo contém também o segredo da sessão e não é versionado. Para trocar credenciais, edite os valores simples, sem aspas, de `.env.demo` e reinicie o servidor. Não use as credenciais do seed de superadministrador: aquele cadastro ainda não participa do login.

Os comandos `demo:*` usam exclusivamente **`prisma/demo.db`**, mesmo se houver `DATABASE_URL` no `.env` ou no terminal. Não alteram `.env`, `prisma/dev.db` ou o seed normal. `.env` e `.env.demo` não devem ser compartilhados nem enviados ao GitHub.

O preparo cria seis produtos com estoque: bebidas, dois produtos a granel e duas peças de vestuário. As peças são produtos separados, sem um módulo de grades de tamanho/cor. Configura uma loja fictícia em Curitiba, sem CNPJ real, e uma interpretação de etiqueta de balança para testes.

Executar `demo:setup` novamente **preserva vendas, estoque e configurações já existentes**; não reinicia o banco nem repõe o estoque consumido. Não há reset automático. Se precisar de uma demonstração limpa, pare o servidor, faça uma cópia do banco de demonstração, remova somente `prisma/demo.db` e seus eventuais arquivos auxiliares e execute `demo:setup` novamente. Nunca faça isso com um banco real.

### Apresentação com build otimizado

O modo de desenvolvimento é útil para ajustes. Para apresentar, pare o servidor e execute:

```bash
npm run demo:build
npm run demo:start
```

O servidor fica restrito a `127.0.0.1:3000`. Os comandos normais e os de demonstração usam a mesma porta e a mesma pasta de build `.next`; execute uma modalidade de cada vez e refaça o build ao trocar de versão. Não use estes comandos para oferecer acesso público ou operação multiempresa.

### Roteiro de cinco minutos

1. Entre com o usuário e a senha informados pelo preparo.
2. Abra o caixa com R$ 100 de saldo inicial.
3. Busque `001` (água, R$ 2,50) e adicione uma unidade.
4. Digite a etiqueta fictícia **`2100010002500`**: ela representa 250 g de granola, cadastrada a R$ 32/kg (R$ 8,00).
5. Confira o total de R$ 10,50. Registre R$ 20 em dinheiro e verifique R$ 9,50 de troco.
6. Abra o comprovante não fiscal. Sem impressora, use a prévia do navegador ou salve em PDF.
7. Confira a venda no histórico, a baixa do estoque e os indicadores.
8. Feche o caixa: se essa foi a única movimentação após abrir, o saldo esperado é R$ 110,50.

A etiqueta serve apenas para demonstrar a interpretação do código; a integração física com leitores, balanças e impressoras deve ser testada no equipamento utilizado. Use a demonstração com dados fictícios, sem informações de clientes reais.

## Instalação local com banco próprio

**Se já existe `.env` ou um banco com dados, preserve ambos e faça backup antes de atualizar o schema.** A sequência abaixo é para uma instalação nova:

```bash
npm ci
```

Copie `.env.example` para `.env` apenas se este não existir:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```bash
# Linux/macOS
cp -n .env.example .env
```

Edite o `.env` e configure:

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | `file:./dev.db` usa `prisma/dev.db`. |
| `PDV_LOGIN_USER` | Usuário local; por exemplo, `admin`. Se omitido, a verificação de usuário é desativada. |
| `PDV_LOGIN_PASSWORD` | Defina uma senha própria com pelo menos 4 caracteres; prefira uma senha longa. O modelo deixa o valor vazio para você preencher. |
| `PDV_SESSION_SECRET` | Segredo aleatório longo para assinar sessões; não compartilhe. |
| `PDV_COOKIE_SECURE` | `false` em localhost HTTP; `true` ao usar HTTPS. |

Para gerar um segredo:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

**Senha padrão legada:** em `npm run dev`, se `PDV_LOGIN_PASSWORD` estiver completamente ausente, o código usa `admin`. Uma variável definida como vazia não ativa esse padrão. Em produção não existe esse fallback. Essa senha não ativa um modo de demonstração e não seleciona outra empresa. Para a demonstração, prefira os comandos `demo:*`, com credenciais próprias geradas.

Depois de configurar uma instalação nova:

```bash
npm run db:push
npm run db:seed
npm run dev
```

O seed normal mantém os produtos legados com estoque inicial zero; ajuste o estoque antes de vender. Ele também cria a fundação de empresas/planos/usuários, mas esses cadastros não são usados pelo login atual. `SUPER_ADMIN_EMAIL` e `SUPER_ADMIN_PASSWORD` configuram apenas esse cadastro futuro; não são as credenciais atuais do PDV.

Para compilar e iniciar esta instalação:

```bash
npm run build
npm run start:local
```

## Próximo desenvolvimento: isolamento por empresa

O próximo passo é substituir o login único por usuários vinculados a empresas e isolar produtos, vendas, estoque, caixa, relatórios e importações. O [plano de evolução SaaS](docs/plano-evolucao-saas.md) registra a ordem de execução, os arquivos envolvidos, a migração dos dados e os testes com duas empresas.

Esse plano ainda não é uma funcionalidade pronta. A demonstração e as credenciais descritas acima continuam sendo de uma única instalação. O vínculo com empresa, e não apenas o nome do usuário, determinará os dados disponíveis na versão futura.

### Ensaio de migração em banco descartável

A preparação da migração já pode ser executada com duas lojas fictícias, sem usar o banco real:

```bash
npm run lab:tenancy
npm run test:tenancy
```

O ensaio confere preservação dos dados, códigos iguais em empresas diferentes, rejeição de vínculos cruzados e rollback. Ele cria e remove seu próprio SQLite, ignorando `DATABASE_URL`. Isso **não ativa contas multiempresa no PDV**. Veja [o funcionamento e os limites do laboratório](docs/ensaio-migracao-multiempresa.md).

## Funcionalidades

- Produtos, categorias, busca, preço de custo/venda e unidades de medida.
- Estoque, ajustes, estoque mínimo e movimentações.
- Carrinho, leitura de códigos, produtos por peso e pagamento dividido.
- Abertura, sangria, reforço e fechamento de caixa.
- Histórico, indicadores e comprovante de venda não fiscal.
- Dados da loja e configuração de interpretação de etiquetas de balança.

## Verificação

```bash
npm run test:pagamentos
npm run lint
npm run demo:build
```

Os testes de pagamentos cobrem falta de um centavo, troco de um centavo, excedente sem dinheiro, pagamento dividido e somas fracionadas. A compilação não substitui o roteiro manual nem o teste de impressão e equipamentos no notebook de apresentação.

## Cuidados com dados e evolução comercial

- Não versione `.env`, `.env.demo`, senhas, certificados ou bancos SQLite. O `.env.example` contém somente um modelo público de configuração.
- Faça backup do SQLite com o servidor parado e guarde a cópia fora da máquina; valide a recuperação.
- Para várias lojas, ainda será necessário login individual, permissões e isolamento completo por empresa, além de infraestrutura, backups e monitoramento.
- A futura migração para PostgreSQL exige planejamento dos dados e das migrações; não basta trocar a URL.
- O estado da fundação SaaS no schema é mais recente que o inventário histórico em `docs/arquitetura-atual.md`.
- Em notebooks fracos, use o build otimizado e teste o equipamento real. SQLite continua adequado para esta demonstração local.
