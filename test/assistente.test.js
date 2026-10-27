import assert from "node:assert/strict";
import { test } from "node:test";
import { contexto, validarMensagens } from "../src/assistente.js";

const t = (mes, descricao, valor, categoria, extra = {}) => ({ mes, data: `${mes}-10`, descricao, valor, categoria, origem: "Nubank", ...extra });

test("contexto soma por mês e categoria, ignorando pagamento de fatura", () => {
  const txt = contexto([
    t("2026-08", "Netflix", -55.9, "Assinaturas"), t("2026-09", "Netflix", -55.9, "Assinaturas"), t("2026-10", "Netflix", -55.9, "Assinaturas"),
    t("2026-10", "Ifd*Pizza", -80, "Restaurante e delivery"),
    t("2026-10", "Pagamento recebido", 3000, "Pagamento de fatura"),
    t("2026-10", "Pagamento de fatura", -3000, "Pagamento de fatura"),
  ], [{ data: "2026-10-05", valor: 20, categoria: "Café" }], "2026-10-27");
  assert.match(txt, /- 2026-10: R\$\s135,90/);
  assert.doesNotMatch(txt, /3\.000/);
  assert.match(txt, /## Cobranças recorrentes[\s\S]*- Netflix \[Assinaturas\]: R\$\s55,90/);
  assert.match(txt, /## Gastos manuais[\s\S]*- Café: R\$\s20,00/);
});

test("contexto junta parcelas da mesma compra e mostra o que falta", () => {
  const p = n => t(`2026-0${7 + n}`, `Mp *Loja - Parcela ${n}/6`, -100, "Compras online", { parcela_atual: n, parcela_total: 6 });
  const txt = contexto([p(1), p(2), p(3)], [], "2026-10-27");
  assert.match(txt, /- Mp \*Loja: R\$\s100,00\/mês, faltam 3 de 6/);
  assert.match(txt, /- Mp \*Loja \[Compras online\]: R\$\s300,00 em 3 compra/);
  assert.doesNotMatch(txt, /Cobranças recorrentes/);
});

test("validarMensagens aceita só user/assistant e corta o histórico", () => {
  assert.throws(() => validarMensagens([]), /vazia/);
  assert.throws(() => validarMensagens([{ role: "system", content: "x" }]), /inválida/);
  const longa = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}`, extra: 1 }));
  const ok = validarMensagens(longa);
  assert.equal(ok.length, 20);
  assert.deepEqual(ok.at(-1), { role: "assistant", content: "m29" });
});
