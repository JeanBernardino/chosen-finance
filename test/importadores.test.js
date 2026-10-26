import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { categorizar, REGRAS_PADRAO } from "../src/categorias.js";
import { ler, lerOfx } from "../src/importadores.js";

const OFX = `OFXHEADER:100
<OFX><SIGNONMSGSRSV1><SONRS><FI><ORG>NU PAGAMENTOS S.A.</ORG><FID>260</FID></FI></SONRS></SIGNONMSGSRSV1>
<CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260904000000[-3:BRT]
<TRNAMT>-87.40
<FITID>abc
<MEMO>Mp *Lojaexemplo - Parcela 3/6
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT</TRNTYPE>
<DTPOSTED>20260910000000[-3:BRT]</DTPOSTED>
<TRNAMT>1500.00</TRNAMT>
<FITID>def</FITID>
<MEMO>Pagamento recebido</MEMO>
</STMTTRN>
</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`;

test("OFX: SGML sem fechamento, parcela no memo, cartão Nubank", () => {
  const [a, b] = lerOfx(Buffer.from(OFX), "x.ofx");
  assert.deepEqual(
    { origem: a.origem, data: a.data, descricao: a.descricao, valor: a.valor, p: [a.parcela_atual, a.parcela_total] },
    { origem: "Nubank cartão", data: "2026-09-04", descricao: "Mp *Lojaexemplo", valor: -87.40, p: [3, 6] });
  assert.equal(b.valor, 1500.00);
});

test("OFX: compra e IOF com o mesmo FITID viram 2 lançamentos", () => {
  const dois = OFX.replace("<FITID>def", "<FITID>abc");
  const [a, b] = lerOfx(Buffer.from(dois), "x.ofx");
  assert.notEqual(a.id, b.id);
  assert.deepEqual(lerOfx(Buffer.from(dois), "x.ofx").map(t => t.id), [a.id, b.id]); // estável ao reimportar
});

test("categorizar: regra vence, depois categoria do banco, 'outros' não conta", () => {
  const [spotify, cooper, x, pag] = categorizar([
    { descricao: "Dm*Spotify P4747", categoria_banco: null },
    { descricao: "LOJA QUALQUER", categoria_banco: "supermercado" },
    { descricao: "XPTO", categoria_banco: "outros" },
    { descricao: "Pagamento recebido", categoria_banco: null },
  ], REGRAS_PADRAO).map(t => t.categoria);
  assert.deepEqual([spotify, cooper, x, pag], ["Assinaturas", "Supermercado", "Sem categoria", "Pagamento de fatura"]);
});

// Arquivos reais ficam fora do repositório; o teste roda quando eles existem na máquina.
const ITAU = process.env.FATURA_ITAU;
test("fatura Itaú real bate com o total impresso", { skip: !ITAU && "defina FATURA_ITAU=/caminho/fatura.pdf (e TOTAL_ITAU)" }, async () => {
  const t = await ler(ITAU, fs.readFileSync(ITAU));
  const total = t.reduce((s, x) => s - x.valor, 0);
  assert.equal(total.toFixed(2), Number(process.env.TOTAL_ITAU).toFixed(2));
  assert.ok(t.every(x => /^\d{4}-\d{2}-\d{2}$/.test(x.data)));
});

test("OFX cartão: vencimento = fechamento (DTEND) + 7 dias; sem DTEND fica nulo", () => {
  const comFim = OFX.replace("<BANKTRANLIST>", "<BANKTRANLIST><DTSTART>20260904000000[-3:BRT]<DTEND>20261004000000[-3:BRT]");
  assert.deepEqual([...new Set(lerOfx(Buffer.from(comFim), "x.ofx").map(t => t.vencimento))], ["2026-10-11"]);
  assert.equal(lerOfx(Buffer.from(OFX), "x.ofx")[0].vencimento, null);
});
