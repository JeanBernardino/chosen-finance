import assert from "node:assert/strict";
import { test } from "node:test";
import { orcamento, parcelasAbertas, parcelasDoMes, parcelasFinanciadas, parcelasPorMes, porEstabelecimento, recorrentes } from "../public/analises.js";

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

test("parcelasDoMes traz só as parcelas que caem no mês, com o número que terão lá", () => {
  const a = t("2026-12", "A", -50, "x", { parcela_atual: 1, parcela_total: 3 });
  const b = t("2026-12", "B", -30, "x", { parcela_atual: 3, parcela_total: 4 });
  const abertas = parcelasAbertas([a, b]);
  assert.deepEqual(parcelasDoMes(abertas, "2027-01").map(p => [p.descricao, p.n, p.valor]).sort(), [["A", 2, 50], ["B", 4, 30]]);
  assert.deepEqual(parcelasDoMes(abertas, "2027-02").map(p => [p.descricao, p.n]), [["A", 3]]);
  assert.deepEqual(parcelasDoMes(abertas, "2027-03"), []);
});

test("parcelasPorMes soma compras diferentes e vira o ano", () => {
  const a = t("2026-12", "A", -50, "x", { parcela_atual: 1, parcela_total: 3 });
  const b = t("2026-12", "B", -30, "x", { parcela_atual: 3, parcela_total: 4 });
  assert.deepEqual(parcelasPorMes(parcelasAbertas([a, b])), [["2027-01", 80], ["2027-02", 50]]);
});

test("recorrentes acha assinatura, ignora o que repete no mês, marca alta de preço e some com a que saiu da última fatura", () => {
  const meses = ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
  const gastos = [
    ...meses.map((m, i) => t(m, "Netflix", i < 5 ? -39.9 : -44.9, "Assinaturas")),
    ...meses.flatMap(m => [t(m, "Supermercado X", -200, "Supermercado"), t(m, "Supermercado X", -150, "Supermercado")]),
    ...meses.slice(0, 3).map(m => t(m, "Academia", -99, "Academia")),               // parou em julho
    t("2026-09", "Spotify", -21.9, "Assinaturas"), t("2026-10", "Spotify", -21.9, "Assinaturas"), // 2 meses basta em Assinaturas
    t("2026-09", "Padaria", -10, "Restaurante"), t("2026-10", "Padaria", -12, "Restaurante"),   // 2 meses fora de Assinaturas não
    ...meses.slice(3).map((m, i) => t(m, "Loja Y", [-138, -448, -90][i], "Compras")),         // valor variável não
    t("2026-08", "Dm *Disney", -33.9, "Assinaturas"), t("2026-10", "Dm*Disney", -33.9, "Assinaturas"),
    ...meses.slice(0, 4).map(m => t(m, "Youtube", -24.9, "Assinaturas", { origem: "Itaú" })),   // última fatura do Itaú é 2026-09
    t("2026-09", "Outra loja", -5, "Compras", { origem: "Itaú" }),
  ];
  const r = Object.fromEntries(recorrentes(gastos).map(a => [a.descricao, a]));
  assert.deepEqual(Object.keys(r).sort(), ["Dm*Disney", "Netflix", "Spotify"]); // Academia e Youtube não vieram na última fatura
  assert.equal(r.Netflix.valor, 44.9);
  assert.equal(r.Netflix.anterior, 39.9);
});

test("orcamento soma por categoria com limite e ordena pelo mais estourado", () => {
  const doMes = [t("2026-10", "a", -300, "Restaurante"), t("2026-10", "b", -250, "Restaurante"), t("2026-10", "c", -100, "Mercado")];
  assert.deepEqual(orcamento(doMes, [{ categoria: "Mercado", limite: 400 }, { categoria: "Restaurante", limite: 500 }, { categoria: "Lazer", limite: 100 }]), [
    { categoria: "Restaurante", limite: 500, gasto: 550, pct: 110 },
    { categoria: "Mercado", limite: 400, gasto: 100, pct: 25 },
    { categoria: "Lazer", limite: 100, gasto: 0, pct: 0 },
  ]);
});

test("porEstabelecimento junta a mesma loja por cartão, conta vezes e meses e ordena pelo que mais repete", () => {
  const gastos = [
    t("2026-09", "Ifood *Pizza", -50), t("2026-09", "IFOOD * Pizza", -30), t("2026-10", "Ifood*Pizza", -20),
    t("2026-10", "Loja X - Parcela 1/2", -300), t("2026-10", "Ifood*Pizza", -40, "Compras online", { origem: "Itaú" }),
  ];
  assert.deepEqual(porEstabelecimento(gastos).map(e => [e.descricao, e.origem, e.vezes, e.meses, e.total]), [
    ["Ifood*Pizza", "Nubank", 3, 2, 100], ["Loja X", "Nubank", 1, 1, 300], ["Ifood*Pizza", "Itaú", 1, 1, 40]]);
});

test("parcelasFinanciadas conta a parcela do mês como paga e some com o financiamento quitado", () => {
  const carro = { id: 1, descricao: "Carro", valor: "1500.00", parcela_total: 48, primeira: "2025-03-01" };
  const quitado = { id: 2, descricao: "Moto", valor: 300, parcela_total: 12, primeira: "2024-01-01" };
  const futuro = { id: 3, descricao: "Reforma", valor: 200, parcela_total: 3, primeira: "2026-12" };
  const [c, f, ...resto] = parcelasFinanciadas([carro, quitado, futuro], "2026-10");
  assert.deepEqual(resto, []);
  assert.deepEqual([c.parcela_atual, c.faltam, c.mes, c.fim, c.restante, c.origem], [20, 28, "2026-10", "2029-02", 42000, "Financiamento"]);
  assert.deepEqual([f.parcela_atual, f.faltam, f.mes, f.fim], [0, 3, "2026-11", "2027-02"]);
  assert.deepEqual(parcelasPorMes([f]), [["2026-12", 200], ["2027-01", 200], ["2027-02", 200]]);
});

test("parcelasFinanciadas: abatidas no fim contam como pagas e antecipam a última, sem mudar o valor do mês", () => {
  // 12 pagas pelo calendário (nov/25 a out/26) + 3 abatidas = 15 de 48
  const [p] = parcelasFinanciadas([{ id: 1, descricao: "Carro", valor: 1000, parcela_total: 48, primeira: "2025-11-01", abatidas: 3 }], "2026-10");
  assert.deepEqual([p.parcela_atual, p.faltam, p.fim, p.restante], [15, 33, "2029-07", 33000]);
  assert.equal(parcelasPorMes([p]).at(-1)[0], "2029-07");
});
