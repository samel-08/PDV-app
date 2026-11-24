import { test, expect, type APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const origin = "http://127.0.0.1:3137";
const password = "Somente-teste-123!A";
async function login(request: APIRequestContext, user: string) {
  const response = await request.post("/api/auth/login", {
    headers: { Origin: origin },
    data: { usuario: user, senha: password },
  });
  expect(response.status()).toBe(200);
}
async function post(
  request: APIRequestContext,
  path: string,
  data: unknown,
  key?: string,
) {
  return request.post(path, {
    headers: { Origin: origin, ...(key ? { "Idempotency-Key": key } : {}) },
    data,
  });
}
async function open(request: APIRequestContext) {
  const current = await (await request.get("/api/caixa/sessao")).json();
  if (!current.aberto)
    expect(
      (await post(request, "/api/caixa/abrir", { valorInicial: 100 })).status(),
    ).toBe(201);
}

test("API: identidade, catálogos, relações, importações, configurações e impressão são isolados", async ({
  browser,
}) => {
  const a = await browser.newContext({ baseURL: origin }),
    b = await browser.newContext({ baseURL: origin });
  try {
    expect((await a.request.get("/api/produtos")).status()).toBe(401);
    await login(a.request, "admin.a@example.invalid");
    await login(b.request, "admin.b@example.invalid");
    const listA = await (
      await a.request.get("/api/produtos?empresaId=test_empresa_b&pageSize=100")
    ).json();
    expect(
      listA.data.every(
        (p: { empresaId: string }) => p.empresaId === "test_empresa_a",
      ),
    ).toBe(true);
    expect(listA.total).toBe(2);
    expect(
      (await (await b.request.get("/api/produtos?pageSize=100")).json()).total,
    ).toBe(2);
    expect(
      (
        await a.request.patch("/api/produtos/test_produto_b", {
          headers: { Origin: origin },
          data: { nome: "Invadido" },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await a.request.delete("/api/produtos/test_produto_b", {
          headers: { Origin: origin },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await post(a.request, "/api/produtos", {
          codigo: "bad",
          nome: "bad",
          precoCusto: 1,
          precoVenda: 2,
          categoriaId: "cat_b",
        })
      ).status(),
    ).toBeGreaterThanOrEqual(400);
    expect(
      (
        await post(a.request, "/api/estoque", {
          produtoId: "test_produto_b",
          tipo: "ENTRADA",
          quantidade: 5,
          motivo: "bad",
        })
      ).status(),
    ).toBe(404);
    const created = await post(a.request, "/api/produtos", {
      empresaId: "test_empresa_b",
      codigo: "OWN",
      nome: "Somente A",
      precoCusto: 1,
      precoVenda: 2,
    });
    expect(created.status()).toBe(201);
    expect((await created.json()).empresaId).toBe("test_empresa_a");
    const configB = await (await b.request.get("/api/config/sistema")).json();
    expect(
      (
        await a.request.patch("/api/config/sistema", {
          headers: { Origin: origin },
          data: { nomeFantasia: "Loja A modificada" },
        })
      ).status(),
    ).toBe(200);
    expect(
      (await (await b.request.get("/api/config/sistema")).json()).nomeFantasia,
    ).toBe(configB.nomeFantasia);
    expect(
      (await (await a.request.get("/api/config/balanca")).json())
        .prefixoIdentificacao,
    ).toBe("2");
    expect(
      (await (await b.request.get("/api/config/balanca")).json())
        .prefixoIdentificacao,
    ).toBe("9");
    expect(
      (
        await post(a.request, "/api/pdv/interpretar-codigo", {
          codigoBarras: "9100010002500",
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await post(a.request, "/api/pdv/interpretar-codigo", {
          codigoBarras: "2100010002500",
        })
      ).status(),
    ).toBe(200);
    const csv =
      "Código,Nome,Categoria,Custo,Preço de venda,Unidade de medida\nIMPORT_A,Importado A,Importação,1,2,UN\n";
    const uploaded = await a.request.post("/api/produtos/importar-csv", {
      headers: { Origin: origin },
      multipart: {
        arquivo: {
          name: "catalogo.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(csv),
        },
      },
    });
    expect(uploaded.status()).toBe(200);
    expect((await uploaded.json()).imported).toBe(1);
    expect(
      (
        await (
          await b.request.get("/api/produtos/busca?codigo=IMPORT_A")
        ).json()
      ).data,
    ).toEqual([]);
    await open(a.request);
    await open(b.request);
    const saleA = await post(
      a.request,
      "/api/vendas",
      {
        itens: [{ produtoId: "test_produto_a", quantidade: 1 }],
        pagamentos: [{ formaPagamento: "DINHEIRO", valor: 2.5 }],
      },
      randomUUID(),
    );
    const saleB = await post(
      b.request,
      "/api/vendas",
      {
        itens: [{ produtoId: "test_produto_b", quantidade: 1 }],
        pagamentos: [{ formaPagamento: "PIX", valor: 7.5 }],
      },
      randomUUID(),
    );
    expect(saleA.status()).toBe(201);
    expect(saleB.status()).toBe(201);
    const sa = await saleA.json(),
      sb = await saleB.json();
    expect(sa.numero).toBe(1);
    expect(sb.numero).toBe(1);
    expect((await a.request.get(`/api/vendas/${sb.id}`)).status()).toBe(404);
    expect((await b.request.get(`/api/vendas/${sa.id}`)).status()).toBe(404);
    const sessionB = await (await b.request.get("/api/caixa/sessao")).json();
    expect(
      (
        await a.request.get(
          `/api/caixa/relatorio?sessaoId=${sessionB.sessao.id}`,
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await post(
          a.request,
          "/api/vendas",
          {
            itens: [{ produtoId: "test_produto_b", quantidade: 1 }],
            pagamentos: [{ formaPagamento: "PIX", valor: 7.5 }],
          },
          randomUUID(),
        )
      ).status(),
    ).toBe(404);
    const page = await a.newPage();
    await page.goto(`/print/venda/${sb.id}`);
    await expect(page.locator("body")).toContainText("Venda não encontrada.");
    await expect(page.locator("body")).not.toContainText("Produto exclusivo B");
    const dashA = await (await a.request.get("/api/dashboard")).json();
    expect(JSON.stringify(dashA)).not.toContain("Produto exclusivo B");
    expect((await (await a.request.get("/api/vendas")).json()).total).toBe(1);
    expect((await (await b.request.get("/api/vendas")).json()).total).toBe(1);
  } finally {
    await a.close();
    await b.close();
  }
});

test("API: repetição de finalização não duplica e estoque não fica negativo sob concorrência", async ({
  browser,
}) => {
  const a = await browser.newContext({ baseURL: origin });
  try {
    await login(a.request, "admin.a@example.invalid");
    await open(a.request);
    const key = randomUUID(),
      data = {
        itens: [{ produtoId: "test_produto_a", quantidade: 1 }],
        pagamentos: [{ formaPagamento: "PIX", valor: 2.5 }],
      };
    const first = await post(a.request, "/api/vendas", data, key),
      repeat = await post(a.request, "/api/vendas", data, key);
    expect(first.status()).toBe(201);
    expect(repeat.status()).toBe(201);
    expect((await first.json()).id).toBe((await repeat.json()).id);
    expect(
      (
        await post(
          a.request,
          "/api/vendas",
          { ...data, pagamentos: [{ formaPagamento: "DINHEIRO", valor: 5 }] },
          key,
        )
      ).status(),
    ).toBe(409);
    const created = await post(a.request, "/api/produtos", {
      codigo: "ULTIMA",
      nome: "Última unidade",
      precoCusto: 1,
      precoVenda: 10,
      estoqueAtual: 1,
    });
    const p = await created.json();
    expect(created.status()).toBe(201);
    const sale = {
      itens: [{ produtoId: p.id, quantidade: 1 }],
      pagamentos: [{ formaPagamento: "PIX", valor: 10 }],
    };
    const results = await Promise.all([
      post(a.request, "/api/vendas", sale, randomUUID()),
      post(a.request, "/api/vendas", sale, randomUUID()),
    ]);
    expect(results.filter((r) => r.status() === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status() >= 400)).toHaveLength(1);
    const own = await (await a.request.get(`/api/produtos?q=ULTIMA`)).json();
    expect(own.data[0].estoqueAtual).toBe(0);
  } finally {
    await a.close();
  }
});

test("API: permissões, ocultação de custos, origem e logout revogável", async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: origin });
  try {
    await login(context.request, "caixa@example.invalid");
    const catalog = await (await context.request.get("/api/produtos")).json();
    expect(JSON.stringify(catalog)).not.toMatch(
      /precoCusto|markupPercent|lucroEstimado/,
    );
    expect(
      (
        await post(context.request, "/api/produtos", {
          codigo: "NO",
          nome: "NO",
          precoCusto: 1,
          precoVenda: 1,
        })
      ).status(),
    ).toBe(403);
    expect((await context.request.get("/api/dashboard")).status()).toBe(403);
    expect(
      (
        await post(context.request, "/api/caixa/abrir", { valorInicial: 0 })
      ).status(),
    ).toBe(403);
    expect((await context.request.get("/api/vendas")).status()).toBe(200);
    expect(
      JSON.stringify(await (await context.request.get("/api/vendas")).json()),
    ).not.toMatch(/precoCusto/);
    expect(
      (
        await context.request.post("/api/vendas", {
          headers: { Origin: "https://outro.example" },
          data: {},
        })
      ).status(),
    ).toBe(403);
    const oldCookie = (await context.cookies()).find(
      (c) => c.name === "pdv_session",
    )!;
    expect((await post(context.request, "/api/auth/logout", {})).status()).toBe(
      200,
    );
    await context.addCookies([oldCookie]);
    expect((await context.request.get("/api/produtos")).status()).toBe(401);
    await login(context.request, "gerente@example.invalid");
    expect((await context.request.get("/api/dashboard")).status()).toBe(200);
    expect(
      (
        await context.request.patch("/api/config/sistema", {
          headers: { Origin: origin },
          data: { nomeFantasia: "NO" },
        })
      ).status(),
    ).toBe(403);
  } finally {
    await context.close();
  }
});

test("API: bloqueio de usuário, empresa e vínculo é aplicado com cookie ainda válido", async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: origin });
  const metadata = JSON.parse(await readFile("work/e2e-current.json", "utf8"));
  const db = new PrismaClient({
    datasources: { db: { url: `file:${metadata.file.replaceAll("\\", "/")}` } },
  });
  try {
    await login(context.request, "admin.b@example.invalid");
    await db.usuario.update({
      where: { id: metadata.users.b },
      data: { status: "BLOQUEADO" },
    });
    expect((await context.request.get("/api/produtos")).status()).toBe(403);
    await db.usuario.update({
      where: { id: metadata.users.b },
      data: { status: "ATIVO" },
    });
    await db.empresa.update({
      where: { id: "test_empresa_b" },
      data: { status: "BLOQUEADA" },
    });
    expect((await context.request.get("/api/produtos")).status()).toBe(403);
    await db.empresa.update({
      where: { id: "test_empresa_b" },
      data: { status: "ATIVA" },
    });
    await db.usuarioEmpresa.update({
      where: {
        usuarioId_empresaId: {
          usuarioId: metadata.users.b,
          empresaId: "test_empresa_b",
        },
      },
      data: { ativo: false },
    });
    expect((await context.request.get("/api/produtos")).status()).toBe(403);
    await db.usuarioEmpresa.update({
      where: {
        usuarioId_empresaId: {
          usuarioId: metadata.users.b,
          empresaId: "test_empresa_b",
        },
      },
      data: { ativo: true, cargo: "CAIXA" },
    });
    expect((await context.request.get("/api/dashboard")).status()).toBe(403);
    expect((await context.request.get("/api/produtos")).status()).toBe(200);
    await db.sessaoUsuario.updateMany({
      where: { usuarioId: metadata.users.b },
      data: { expiraEm: new Date(Date.now() - 1000) },
    });
    expect((await context.request.get("/api/produtos")).status()).toBe(401);
  } finally {
    await db.usuario.update({
      where: { id: metadata.users.b },
      data: { status: "ATIVO" },
    });
    await db.empresa.update({
      where: { id: "test_empresa_b" },
      data: { status: "ATIVA" },
    });
    await db.usuarioEmpresa.update({
      where: {
        usuarioId_empresaId: {
          usuarioId: metadata.users.b,
          empresaId: "test_empresa_b",
        },
      },
      data: { ativo: true, cargo: "ADMINISTRADOR" },
    });
    await db.$disconnect();
    await context.close();
  }
});

test("navegador: login A, venda por peso, logout e login B sem dados de A", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page
    .locator('input[autocomplete="username"]')
    .fill("admin.a@example.invalid");
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(origin + "/");
  await expect(page.locator("header")).toContainText("Empresa fictícia A");
  await open(context.request);
  await page.goto("/pdv");
  await page.locator("#pdv-busca-produto").fill("2100010002500");
  await expect(
    page.getByText("Granola exclusiva A", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: /Finalizar venda/ }).click();
  await page.getByPlaceholder("Valor", { exact: true }).fill("10,00");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  const saved = page.waitForResponse(
    (r) => r.url().endsWith("/api/vendas") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: /Confirmar/ }).click();
  const response = await saved;
  expect(response.status()).toBe(201);
  const sale = await response.json();
  expect(sale.total).toBe(8);
  expect(sale.troco).toBe(2);
  const receipt = await context.newPage();
  await receipt.goto(`/print/venda/${sale.id}`);
  await expect(
    receipt.getByText("DOCUMENTO NÃO FISCAL", { exact: true }),
  ).toBeVisible();
  await expect(receipt.locator("body")).toContainText("Granola exclusiva A");
  await receipt.pdf({
    path: "work/e2e-comprovante.pdf",
    width: "80mm",
    height: "220mm",
    printBackground: true,
  });
  await receipt.close();
  await page.goto("/produtos");
  await expect(
    page.getByText("Produto exclusivo A", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "work/e2e-empresa-a.png", fullPage: true });
  await page.getByRole("button", { name: "Sair", exact: true }).first().click();
  await page.waitForURL(origin + "/login");
  await page
    .locator('input[autocomplete="username"]')
    .fill("admin.b@example.invalid");
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(origin + "/");
  await page.goto("/produtos");
  await expect(
    page.getByText("Produto exclusivo B", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Produto exclusivo A");
  await page.screenshot({ path: "work/e2e-empresa-b.png", fullPage: true });
  await page.goto("/pdv");
  await expect(page.locator("body")).not.toContainText("Granola exclusiva A");
  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(
      page.getByRole("heading", { name: "PDV", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
  expect(errors).toEqual([]);
});

test("navegador: caixa tem menu limitado e troca em outra aba invalida o contexto antigo", async ({
  browser,
}) => {
  const context = await browser.newContext({ baseURL: origin });
  try {
    await login(context.request, "caixa@example.invalid");
    const cashier = await context.newPage();
    await cashier.goto("/");
    await cashier.waitForURL(origin + "/pdv");
    await cashier
      .getByRole("button", { name: "Abrir menu", exact: true })
      .click();
    await expect(
      cashier.getByRole("link", { name: "Produtos", exact: true }),
    ).toHaveCount(0);
    await expect(
      cashier.getByRole("link", { name: "Configurações", exact: true }),
    ).toHaveCount(0);
    await cashier.goto("/produtos");
    await expect(
      cashier.getByRole("heading", { name: "Acesso indisponível" }),
    ).toBeVisible();
    await login(context.request, "admin.a@example.invalid");
    const old = await context.newPage();
    await old.goto("/produtos");
    await expect(
      old.getByText("Produto exclusivo A", { exact: true }),
    ).toBeVisible();
    const oldIdentity = await (
      await context.request.get("/api/auth/me")
    ).json();
    await login(context.request, "admin.b@example.invalid");
    expect(
      (
        await context.request.get("/api/produtos", {
          headers: { "X-PDV-Session": oldIdentity.sessaoId },
        })
      ).status(),
    ).toBe(401);
    const changed = old.waitForResponse(
      (r) => r.url().endsWith("/api/produtos") && r.status() === 401,
    );
    await old.evaluate(() => {
      void fetch("/api/produtos");
    });
    await changed;
    await old.waitForURL(origin + "/login");
    await expect(old.locator("body")).not.toContainText("Produto exclusivo A");
    const active = await context.newPage();
    await active.goto("/produtos");
    await expect(
      active.getByText("Produto exclusivo B", { exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test("API: importação flexível atualiza apenas o catálogo da empresa autenticada", async ({
  browser,
}) => {
  const a = await browser.newContext({ baseURL: origin }),
    b = await browser.newContext({ baseURL: origin });
  try {
    await login(a.request, "admin.a@example.invalid");
    await login(b.request, "admin.b@example.invalid");
    const beforeB = (await (await b.request.get("/api/produtos?q=001")).json())
      .data;
    const mapping = {
      codigo: 0,
      nome: 1,
      precoCusto: 2,
      precoVenda: 3,
      estoqueAtual: 4,
      categoria: null,
      unidadeMedida: null,
      estoqueMinimo: null,
      codigoBarras: null,
      status: null,
    };
    const file =
      "codigo,nome,custo,venda,estoque\n001,Produto A atualizado,1,4,40\n";
    const response = await a.request.post(
      "/api/produtos/importar-flexivel/executar",
      {
        headers: { Origin: origin },
        multipart: {
          arquivo: {
            name: "atualizar.csv",
            mimeType: "text/csv",
            buffer: Buffer.from(file),
          },
          mapping: JSON.stringify(mapping),
          mode: "atualizar",
        },
      },
    );
    expect(response.status()).toBe(200);
    expect((await response.json()).atualizados).toBe(1);
    expect(
      (await (await a.request.get("/api/produtos?q=001")).json()).data[0].nome,
    ).toBe("Produto A atualizado");
    expect(
      (await (await b.request.get("/api/produtos?q=001")).json()).data,
    ).toEqual(beforeB);
    expect(
      (
        await a.request.delete("/api/categorias/cat_b", {
          headers: { Origin: origin },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await (
          await a.request.get("/api/estoque?produtoId=test_produto_b")
        ).json()
      ).data,
    ).toEqual([]);
  } finally {
    await a.close();
    await b.close();
  }
});

test("API: caixa fecha com saldo correto, impede venda fechado e só reabre uma vez", async ({
  browser,
}) => {
  const a = await browser.newContext({ baseURL: origin }),
    b = await browser.newContext({ baseURL: origin });
  try {
    await login(a.request, "admin.a@example.invalid");
    await login(b.request, "admin.b@example.invalid");
    await open(a.request);
    await open(b.request);
    const oldB = await (await b.request.get("/api/caixa/sessao")).json();
    expect(
      (await post(a.request, "/api/caixa/reforco", { valor: 5 })).status(),
    ).toBe(201);
    expect(
      (await post(a.request, "/api/caixa/sangria", { valor: 3 })).status(),
    ).toBe(201);
    const before = await (await a.request.get("/api/caixa/sessao")).json();
    const closed = await post(a.request, "/api/caixa/fechar", {
      saldoInformado: before.sessao.saldo,
    });
    expect(closed.status()).toBe(200);
    const report = await closed.json();
    expect(report.relatorio.saldoEsperado).toBe(before.sessao.saldo);
    expect(report.relatorio.diferenca).toBe(0);
    const data = {
      itens: [{ produtoId: "test_produto_a", quantidade: 1 }],
      pagamentos: [{ formaPagamento: "PIX", valor: 4 }],
    };
    expect(
      (await post(a.request, "/api/vendas", data, randomUUID())).status(),
    ).toBe(400);
    const openings = await Promise.all([
      post(a.request, "/api/caixa/abrir", { valorInicial: 0 }),
      post(a.request, "/api/caixa/abrir", { valorInicial: 0 }),
    ]);
    expect(openings.filter((r) => r.status() === 201)).toHaveLength(1);
    expect(openings.filter((r) => r.status() >= 400)).toHaveLength(1);
    const key = randomUUID();
    const response = await post(a.request, "/api/vendas", data, key);
    expect(response.status()).toBe(201);
    expect((await response.json()).numero).toBeGreaterThan(1);
    // A mesma chave em B pertence a outra empresa e não colide com a venda de A.
    const saleB = await post(
      b.request,
      "/api/vendas",
      {
        itens: [{ produtoId: "test_produto_b", quantidade: 1 }],
        pagamentos: [{ formaPagamento: "PIX", valor: 7.5 }],
      },
      key,
    );
    expect(saleB.status()).toBe(201);
    expect((await saleB.json()).empresaId).toBe("test_empresa_b");
    const currentB = await (await b.request.get("/api/caixa/sessao")).json();
    expect(currentB.sessao.id).toBe(oldB.sessao.id);
    expect(currentB.sessao.status).toBe("ABERTO");
    expect(currentB.sessao.saldo).toBe(oldB.sessao.saldo);
  } finally {
    await a.close();
    await b.close();
  }
});
