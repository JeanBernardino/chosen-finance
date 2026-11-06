import assert from "node:assert/strict";
import { test } from "node:test";
import { itensNfce, lerNfce, limparItens } from "../src/recibo.js";

test("itensNfce lê os produtos do layout padrão da consulta da NFC-e", () => {
  const item = (n, nome, valor) => `<tr id="Item + ${n}"><td valign="top"><span class="txtTit">${nome}</span><span class="RCod">(Código: 789 )</span><br />
    <span class="Rqtd"><strong>Qtde.:</strong>2</span><span class="RvlUnit"><strong>Vl. Unit.:</strong>&nbsp;4,99</span></td>
    <td align="right" valign="top" class="txtTit noWrap">Vl. Total<br /><span class="valor">${valor}</span></td></tr>`;
  const html = `<table id="tabResult">${item(1, "LEITE UHT  INTEGRAL 1L", "9,98")}${item(2, "CARVÃO &amp; LENHA 5KG", "1.234,50")}${item(3, "BRINDE", "0,00")}</table>
    <div id="linhaTotal"><label>Valor a pagar R$:</label><span class="totalNumb">1.244,48</span></div>`;
  assert.deepEqual(itensNfce(html), [{ descricao: "LEITE UHT INTEGRAL 1L", valor: 9.98 }, { descricao: "CARVÃO & LENHA 5KG", valor: 1234.5 }]);
  assert.deepEqual(itensNfce("<html>outra página</html>"), []);
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
