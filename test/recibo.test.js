import assert from "node:assert/strict";
import { test } from "node:test";
import { fecharTotal, itensNfce, lerNfce, limparItens, montarItens } from "../src/recibo.js";

test("itensNfce lê os produtos do layout padrão da consulta da NFC-e", () => {
  const item = (n, nome, valor) => `<tr id="Item + ${n}"><td valign="top"><span class="txtTit">${nome}</span><span class="RCod">(Código: 789 )</span><br />
    <span class="Rqtd"><strong>Qtde.:</strong>2</span><span class="RvlUnit"><strong>Vl. Unit.:</strong>&nbsp;4,99</span></td>
    <td align="right" valign="top" class="txtTit noWrap">Vl. Total<br /><span class="valor">${valor}</span></td></tr>`;
  const html = (desconto, total) => `<table id="tabResult">${item(1, "LEITE UHT  INTEGRAL 1L", "9,98")}${item(2, "CARVÃO &amp; LENHA 5KG", "1.234,50")}${item(3, "BRINDE", "0,00")}</table>
    <div id="linhaTotal"><label>Descontos R$:</label><span class="totalNumb">${desconto}</span></div>
    <div id="linhaTotal"><label>Valor a pagar R$:</label><span class="totalNumb txtMax">${total}</span></div>`;
  assert.deepEqual(itensNfce(html("0,00", "1.244,48")), { total: 1244.48, confere: true,
    itens: [{ descricao: "LEITE UHT INTEGRAL 1L", valor: 9.98 }, { descricao: "CARVÃO & LENHA 5KG", valor: 1234.5 }] });
  // a página traz o item bruto e o desconto só no total: rateado pelo valor de cada item
  assert.deepEqual(itensNfce(html("124,45", "1.120,03")).itens.map(i => i.valor), [8.99, 1111.04]);
  assert.deepEqual(itensNfce("<html>outra página</html>").itens, []);
});

test("limparItens descarta o que não dá para lançar e arredonda em centavos", () => {
  assert.deepEqual(limparItens([{ descricao: " Pão ", valor: "12.345" }, { descricao: "", valor: 3 }, { descricao: "x", valor: -1 }, null]),
    [{ descricao: "Pão", valor: 12.35 }]);
  assert.deepEqual(limparItens("lixo"), []);
});

test("lerNfce só aceita link da SEFAZ", async () => {
  await assert.rejects(lerNfce("http://127.0.0.1:4780/api/transacoes"), /SEFAZ/);
  await assert.rejects(lerNfce("file:///etc/passwd"), /SEFAZ/);
  await assert.rejects(lerNfce("não é link"), /link inválido/);
});

test("montarItens liga cada desconto ao produto de cima e corrige o dígito que o OCR trocou", () => {
  // cupom de lanchonete: o OCR leu a embalagem (1 × 2,00) como 7,00 no total da linha
  const p = (descricao, quantidade, valor_unitario, valor_total) => ({ tipo: "produto", descricao, quantidade, valor_unitario, valor_total });
  const d = valor_total => ({ tipo: "desconto", descricao: "Desconto", quantidade: 1, valor_unitario: valor_total, valor_total });
  const r = montarItens({ total_itens: 109.8, descontos: 16.9, total_a_pagar: 92.9, lancamentos: [
    p("LANCHE DUPLO", 1, 41.9, 41.9), d(-12.45), p("SANDUICHE FRANGO", 1, 24.9, 24.9), d(4.45),
    p("COCA COLA REFIL", 1, 12.9, 12.9), p("COCA COLA ZERO REFIL", 1, 12.9, 12.9), p("AC. BATATA FRITA MEDIA", 2, 1.1, 2.2),
    p("EMBALAGEM", 1, 2, 7), p("AC. SACHE MAIONESE", 2, 2, 4), p("AC. FRANGO EMPANADO", 1, 9, 9)] });
  assert.deepEqual(r.itens.map(i => i.valor), [29.45, 20.45, 12.9, 12.9, 2.2, 2, 4, 9]);
  assert.deepEqual([r.total, r.confere], [92.9, true]);
  assert.deepEqual(montarItens({}), { itens: [], total: null, confere: false });
});

test("fecharTotal rateia o desconto de cooperado no total e avisa quando a diferença não se explica", () => {
  const itens = [{ descricao: "Arroz", valor: 30 }, { descricao: "Feijão", valor: 10 }, { descricao: "Sal", valor: 0.01 }];
  const r = fecharTotal(itens, { total_a_pagar: 38, descontos: 2.01 });
  assert.deepEqual(r.itens.map(i => i.valor), [28.49, 9.5, 0.01]);
  assert.equal(r.confere, true);
  // faltam 5,00 sem desconto impresso que explique: não mexe e a tela pede conferência
  assert.deepEqual(fecharTotal(itens, { total_a_pagar: 35.01, descontos: 0 }), { itens, total: 35.01, confere: false });
});
