import assert from "node:assert/strict";
import test from "node:test";
import { pagamentoSchema } from "../src/lib/validators";
import { calcularPagamentos } from "../src/lib/pagamentos";

test("um centavo a menos impede a finalização", () => {
  const resultado = calcularPagamentos(10, [{ formaPagamento: "PIX", valor: 9.99 }]);
  assert.equal(resultado.suficiente, false);
  assert.equal(resultado.restante, 0.01);
});
test("um centavo a mais em dinheiro gera troco", () => {
  const resultado = calcularPagamentos(10, [{ formaPagamento: "DINHEIRO", valor: 10.01 }]);
  assert.equal(resultado.troco, 0.01);
  assert.equal(resultado.excedenteValido, true);
});
test("excedente em Pix sem dinheiro é recusado", () => {
  assert.equal(calcularPagamentos(10, [{ formaPagamento: "PIX", valor: 10.01 }]).excedenteValido, false);
});
test("pagamento dividido devolve apenas dinheiro disponível", () => {
  const resultado = calcularPagamentos(10, [
    { formaPagamento: "PIX", valor: 8 }, { formaPagamento: "DINHEIRO", valor: 5 },
  ]);
  assert.equal(resultado.troco, 3);
  assert.equal(resultado.valorDinheiro - resultado.troco, 2);
  assert.equal(calcularPagamentos(10, [
    { formaPagamento: "PIX", valor: 10.01 }, { formaPagamento: "DINHEIRO", valor: 0.01 },
  ]).excedenteValido, false);
});
test("somar pagamentos fracionados não cria falta ou troco", () => {
  const resultado = calcularPagamentos(0.3, [
    { formaPagamento: "PIX", valor: 0.1 }, { formaPagamento: "DINHEIRO", valor: 0.2 },
  ]);
  assert.equal(resultado.suficiente, true);
  assert.equal(resultado.troco, 0);
  assert.equal(resultado.restante, 0);
});

test("pagamentos não aceitam frações menores que um centavo", () => {
  assert.equal(pagamentoSchema.safeParse({ formaPagamento: "PIX", valor: 1.005 }).success, false);
  assert.equal(pagamentoSchema.safeParse({ formaPagamento: "PIX", valor: 10.01 }).success, true);
});
