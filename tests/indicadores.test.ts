import assert from "node:assert/strict";
import test from "node:test";
import { margemFromPrecos, markupFromPrecos } from "../src/lib/produto-precos";
import { agregarHorarios, periodoHorarios } from "../src/lib/horarios-pico";

test("margem sobre venda difere de markup e preserva prejuízo", () => {
  assert.equal(margemFromPrecos(60, 100), 40);
  assert.equal(markupFromPrecos(60, 100), 66.67);
  assert.equal(margemFromPrecos(120, 100), -20);
  assert.equal(margemFromPrecos(100, 100), 0);
  for (const [custo, venda] of [[0, 100], [60, 0], [-1, 1], [NaN, 1], [1, Infinity]]) {
    assert.equal(margemFromPrecos(custo, venda), null);
  }
});

test("horários respeitam dias de São Paulo, limites inclusivos, empates e centavos", () => {
  const venda = (data: string, total = 0.1) => ({ createdAt: new Date(data), total });
  const resultado = agregarHorarios([
    venda("2026-11-01T02:59:59Z", 999), // ainda outubro em São Paulo
    venda("2026-11-01T03:00:00Z"),
    venda("2026-11-01T03:30:00Z", 0.2),
    venda("2026-11-02T02:59:59.999Z", 10),
    venda("2026-11-01T23:00:00-03:00", 5),
    venda("2026-11-02T03:00:00Z", 999),
  ], "2026-11-01", "2026-11-01");
  assert.equal(resultado.totalVendas, 4);
  assert.equal(resultado.totalVendido, 15.3);
  assert.deepEqual(resultado.picos, [0, 23]);
  assert.equal(resultado.horarios[0].total, 0.3);
  assert.equal(resultado.horarios.length, 24);
  assert.deepEqual(agregarHorarios([], "2026-11-01", "2026-11-01").picos, []);
});

test("período rejeita datas inválidas, inversão e consultas excessivas", () => {
  for (const [inicio, fim] of [["2026-02-30", "2026-03-01"], ["bad", "2026-03-01"], ["2026-03-02", "2026-03-01"], ["2026-01-01", "2026-12-31"]]) {
    assert.throws(() => periodoHorarios(inicio, fim));
  }
  const periodo = periodoHorarios("2026-11-01", "2026-11-01");
  assert.ok(periodo.gte <= new Date("2026-11-01T03:00:00Z"));
  assert.ok(periodo.lt > new Date("2026-11-02T02:59:59.999Z"));
});
