import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";

const origin = "http://127.0.0.1:3137";
const periodo = "inicio=2025-06-01&fim=2025-06-01";

test("indicadores: isolamento, cancelamentos, permissão e leitura móvel", async ({ browser }) => {
  const metadata = JSON.parse(await readFile("work/e2e-current.json", "utf8"));
  const db = new PrismaClient({ datasources: { db: { url: `file:${metadata.file}` } } });
  const context = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 } });
  const ids: string[] = [];
  const caixas: string[] = [];
  let produtoId: string | undefined;
  try {
    expect((await context.request.get(`/api/dashboard/horarios?${periodo}`)).status()).toBe(401);
    for (const empresa of ["a", "b"]) {
      const empresaId = `test_empresa_${empresa}`;
      const caixa = await db.caixaSessao.create({ data: { empresaId, valorInicial: 0, status: "FECHADO" } });
      caixas.push(caixa.id);
      for (const [indice, status] of ["CONCLUIDA", "CANCELADA"].entries()) {
        const venda = await db.venda.create({ data: {
          empresaId, caixaSessaoId: caixa.id, numero: 9000000 + indice,
          total: empresa === "a" ? 100 : 999, formaPagamento: "PIX", valorRecebido: 0, troco: 0,
          status, createdAt: new Date("2025-06-01T13:00:00Z"),
        } });
        ids.push(venda.id);
      }
    }
    const produto = await db.produto.create({ data: { empresaId: "test_empresa_a", codigo: "MARGEM100", nome: "Produto margem", precoCusto: 60, precoVenda: 100 } });
    produtoId = produto.id;
    const response = await context.request.post("/api/auth/login", {
      headers: { Origin: origin }, data: { usuario: "admin.a@example.invalid", senha: "Somente-teste-123!A" },
    });
    expect(response.status()).toBe(200);
    const report = await (await context.request.get(`/api/dashboard/horarios?${periodo}&empresaId=test_empresa_b`)).json();
    expect(report.totalVendas).toBe(1);
    expect(report.totalVendido).toBe(100);
    expect(report.horarios[10].quantidade).toBe(1);
    expect(report.picos).toEqual([10]);
    expect((await context.request.get("/api/dashboard/horarios?inicio=bad&fim=bad")).status()).toBe(400);
    const produtos = await (await context.request.get("/api/produtos?q=MARGEM100")).json();
    expect(produtos.data.find((p: { id: string }) => p.id === produtoId).margemPercent).toBe(40);
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Horários de pico" })).toBeVisible();
    await page.getByLabel("De", { exact: true }).fill("2025-06-01");
    await page.getByLabel("Até", { exact: true }).fill("2025-06-01");
    await page.getByRole("button", { name: "Consultar", exact: true }).click();
    await expect(page.getByText(/1 vendas ·.*100,00/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.goto("/produtos");
    await expect(page.getByRole("columnheader", { name: "Margem bruta" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "40%", exact: true })).toBeVisible();
    await context.request.post("/api/auth/logout", { headers: { Origin: origin } });
    expect((await context.request.post("/api/auth/login", {
      headers: { Origin: origin }, data: { usuario: "caixa@example.invalid", senha: "Somente-teste-123!A" },
    })).status()).toBe(200);
    expect((await context.request.get(`/api/dashboard/horarios?${periodo}`)).status()).toBe(403);
    expect(await (await context.request.get("/api/produtos")).text()).not.toContain("margemPercent");
  } finally {
    await context.close();
    await db.venda.deleteMany({ where: { id: { in: ids } } });
    await db.caixaSessao.deleteMany({ where: { id: { in: caixas } } });
    if (produtoId) await db.produto.delete({ where: { id: produtoId } });
    await db.$disconnect();
  }
});
