import assert from "node:assert/strict";
import { test } from "node:test";
import { copiaCola, crc16, normalizarChave } from "../src/pix.js";

test("crc16 bate com o valor de verificação do CRC-16/CCITT-FALSE", () => {
  assert.equal(crc16("123456789"), "29B1");
});

test("normalizarChave põe a chave no formato que o banco aceita", () => {
  assert.equal(normalizarChave("(47) 99123-4567"), "+5547991234567");
  assert.equal(normalizarChave("5547991234567"), "+5547991234567");
  assert.equal(normalizarChave("+55 47 99123-4567"), "+5547991234567");
  assert.equal(normalizarChave("529.982.247-25"), "52998224725");        // CPF válido não vira celular
  assert.equal(normalizarChave("11.222.333/0001-81"), "11222333000181");
  assert.equal(normalizarChave(" Jean@Exemplo.com "), "jean@exemplo.com");
  assert.equal(normalizarChave("123E4567-E12B-12D1-A456-426655440000"), "123e4567-e12b-12d1-a456-426655440000");
});

test("copiaCola bate com o exemplo do manual do BR Code", () => {
  const s = copiaCola({ chave: "123e4567-e12b-12d1-a456-426655440000", nome: "Fulano de Tal", cidade: "BRASILIA", valor: 1 });
  assert.ok(s.startsWith("00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-42665544000052040000530398654041.005802BR5913Fulano de Tal"));
  assert.equal(crc16("00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304"), "1D3D");
});

test("copiaCola monta o BR Code com valor, nome sem acento e CRC no fim", () => {
  const s = copiaCola({ chave: "jean@exemplo.com", nome: "João da Silva", cidade: "São José", valor: 42.5 });
  assert.equal(s, "00020126380014br.gov.bcb.pix0116jean@exemplo.com520400005303986540542.505802BR5913Joao da Silva6008Sao Jose62070503***6304" + s.slice(-4));
  assert.equal(crc16(s.slice(0, -4)), s.slice(-4));
});
