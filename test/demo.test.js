import assert from "node:assert/strict";
import { test } from "node:test";
import { dadosDemo } from "../src/demo.js";
import { categorizar, REGRAS_PADRAO, SEM_CATEGORIA } from "../src/categorias.js";

test("exemplo: faturas dos 6 últimos meses até o atual, ids únicos, parcelas válidas", () => {
  const d = dadosDemo(new Date("2026-11-13T12:00:00Z"));
  const todas = Object.values(d.transacoes).flat();
  assert.deepEqual([...new Set(todas.map(t => t.vencimento.slice(0, 7)))].sort(), ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
  assert.equal(new Set(todas.map(t => t.id)).size, todas.length);
  assert.ok(todas.every(t => /^\d{4}-\d{2}-\d{2}$/.test(t.data) && t.valor !== 0));
  assert.ok(todas.filter(t => t.parcela_total).every(t => t.parcela_atual >= 1 && t.parcela_atual <= t.parcela_total));
  assert.deepEqual(dadosDemo(new Date("2026-11-13T12:00:00Z")), d); // mesmo dia, mesmo exemplo
});

test("exemplo: todo gasto cai numa categoria pelas regras padrão", () => {
  const todas = Object.values(dadosDemo().transacoes).flat();
  assert.deepEqual(categorizar(todas, REGRAS_PADRAO).filter(t => t.categoria === SEM_CATEGORIA).map(t => t.descricao), []);
});
