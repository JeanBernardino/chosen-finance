import assert from "node:assert/strict";
import { test } from "node:test";
import { orcamento, parcelasAbertas, parcelasPorMes } from "../public/analises.js";

const t = (mes, descricao, valor, categoria = "Compras online", extra = {}) =>
  ({ mes, data: `${mes}-10`, descricao, valor, categoria, origem: "Nubank", ...extra });

test("parcelasAbertas junta a mesma compra e projeta o que falta mês a mês", () => {
  // a 1ª parcela vem com centavos diferentes e ainda é a mesma compra
  const p = n => t(`2026-${String(7 + n).padStart(2, "0")}`, `Mp *Loja - Parcela ${n}/5`, n === 1 ? -100.04 : -100, "Compras online", { parcela_atual: n, parcela_total: 5 });
  const tv = t("2026-10", "Tv 02/02", -900, "Eletrônicos", { parcela_atual: 2, parcela_total: 2 }); // já quitada
  const abertas = parcelasAbertas([p(1), p(2), p(3), tv]);
  assert.equal(abertas.length, 1);
  assert.deepEqual({ ...abertas[0], cor: undefined }, {
    descricao: "Mp *Loja", origem: "Nubank", cor: undefined, categoria: "Compras online", valor: 100,
    parcela_atual: 3, parcela_total: 5, faltam: 2, mes: "2026-10", fim: "2026-12", restante: 200 });
  assert.deepEqual(parcelasPorMes(abertas), [["2026-11", 100], ["2026-12", 100]]);
});

test("parcelasPorMes soma compras diferentes e vira o ano", () => {
  const a = t("2026-12", "A", -50, "x", { parcela_atual: 1, parcela_total: 3 });
  const b = t("2026-12", "B", -30, "x", { parcela_atual: 3, parcela_total: 4 });
  assert.deepEqual(parcelasPorMes(parcelasAbertas([a, b])), [["2027-01", 80], ["2027-02", 50]]);
});

test("orcamento soma por categoria com limite e ordena pelo mais estourado", () => {
  const doMes = [t("2026-10", "a", -300, "Restaurante"), t("2026-10", "b", -250, "Restaurante"), t("2026-10", "c", -100, "Mercado")];
  assert.deepEqual(orcamento(doMes, [{ categoria: "Mercado", limite: 400 }, { categoria: "Restaurante", limite: 500 }, { categoria: "Lazer", limite: 100 }]), [
    { categoria: "Restaurante", limite: 500, gasto: 550, pct: 110 },
    { categoria: "Mercado", limite: 400, gasto: 100, pct: 25 },
    { categoria: "Lazer", limite: 100, gasto: 0, pct: 0 },
  ]);
});
