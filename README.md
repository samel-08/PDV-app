# PDV Comércio

Sistema de ponto de venda (web) com **Next.js**, **Prisma** e **SQLite** — interface em **português (Brasil)** e valores em **Real (R$)**.

## Funcionalidades

- **Dashboard** com indicadores e gráficos (atualização periódica e após vendas)
- **Produtos** (CRUD, busca com debounce, filtros ativo/inativo, paginação, código único)
- **PDV** (carrinho, pagamentos dinheiro/pix/cartão, troco, comprovante para impressão)
- **Caixa** (abertura, sangria, reforço, fechamento, saldo e movimentações)
- **Histórico de vendas** (filtros por número e período, detalhes, paginação)

## Requisitos

- Node.js 20+

## Instalação

```bash
cd pdv-app
copy .env.example .env
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Se aparecer erro ao **cadastrar produto** ou **criar categoria** (tabela `Categoria` inexistente, coluna `markupPercent` faltando), o SQLite está **desatualizado** em relação ao schema. Pare o `npm run dev`, rode de novo **`npx prisma db push`** (ou `npm run db:push`), depois **`npx prisma generate`**, e suba o servidor outra vez.

Abra `http://localhost:3000` — você será redirecionado para **`/login`**.

### Login

- Variáveis no `.env` (veja `.env.example`):
  - **`PDV_LOGIN_PASSWORD`**: senha para entrar (mín. 4 caracteres). Em **desenvolvimento**, se estiver vazia, a senha padrão é **`admin`**.
  - **`PDV_LOGIN_USER`** (opcional): se preenchido, o campo usuário na tela deve coincidir.
  - **`PDV_SESSION_SECRET`**: recomendado definir uma string longa em produção (cookie assinado com JWT).

## Se a interface aparecer “só texto”, sem layout

1. Pare o servidor (`Ctrl+C`).
2. Na pasta `pdv-app`, apague o cache e reinstale dependências:

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm install
npm run dev
```

3. Atualize o navegador com **Ctrl+F5** (recarregar ignorando cache).

## Produção

Para uso real, prefira **PostgreSQL** (troque `provider` e `DATABASE_URL` no Prisma), coloque o app atrás de **HTTPS** e adicione **autenticação** (usuários por perfil: caixa, gerente).

### Máquina fraca (ex.: Lubuntu, 2 GB RAM)

- Faça **`npm run build` no mesmo Linux** onde o app vai rodar (Prisma/OpenSSL alinhados ao sistema).
- Se o `build` estourar memória: `NODE_OPTIONS=--max-old-space-size=1536 npm run build`.
- Para uso só na máquina: `npm run start:local` (Next em `127.0.0.1:3000`).
- O projeto usa **`output: "standalone"`** no Next: após o build existe `.next/standalone/` com servidor mínimo (útil para copiar poucos arquivos para o PDV). Ajuste o processo conforme a [documentação do Next.js](https://nextjs.org/docs/app/building-your-application/deploying#standalone) (copiar `.next/static` e `public` junto).

## Scripts

| Comando | Descrição |
|--------|------------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Inicia build |
| `npm run start:local` | Produção só em **127.0.0.1** (uso offline/local) |
| `npm run db:push` | Aplica schema no SQLite |
| `npm run db:seed` | Produtos de exemplo |
