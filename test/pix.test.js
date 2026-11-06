import assert from "node:assert/strict";
import { test } from "node:test";
import { config, copiaCola, crc16 } from "../src/pix.js";

test("crc16 bate com o valor de verificação do CRC-16/CCITT-FALSE", () => {
  assert.equal(crc16("123456789"), "29B1");
});

test("copiaCola monta o BR Code com valor, nome sem acento e CRC no fim", () => {
  const s = copiaCola({ chave: "jean@exemplo.com", nome: "João da Silva", cidade: "São José", valor: 42.5 });
  assert.equal(s, "00020126380014br.gov.bcb.pix0116jean@exemplo.com520400005303986540542.505802BR5913Joao da Silva6008Sao Jose62070503***6304" + s.slice(-4));
  assert.equal(crc16(s.slice(0, -4)), s.slice(-4));
});

test("config só liga com chave e titular", () => {
  assert.equal(config({ PIX_CHAVE: "x" }), null);
  assert.deepEqual(config({ PIX_CHAVE: "x", PIX_NOME: "Jean" }), { chave: "x", nome: "Jean", cidade: "BRASIL" });
});
