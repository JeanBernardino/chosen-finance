import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { cartaoDa, vigiar } from "../src/entrada.js";

const cartoes = [
  { id: 1, banco: "Itau", ativo: true },
  { id: 2, banco: "Nubank", ativo: true },
  { id: 3, banco: "Nubank", ativo: false },
];

test("entrada: cartão pela origem, sem acento e só se for único e ativo", () => {
  assert.equal(cartaoDa("Itaú cartão", cartoes), 1);
  assert.equal(cartaoDa("Nubank cartão", cartoes), 2);
  assert.equal(cartaoDa("Itaú conta", cartoes), null);
  assert.equal(cartaoDa("Nubank cartão", [...cartoes, { id: 4, banco: "Nubank", ativo: true }]), null);
});

test("entrada: importa o que está estável, move para importados/ ou erros/", async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "entrada-"));
  const velho = new Date(Date.now() - 10000);
  for (const n of ["ok.ofx", "ruim.pdf", "nota.txt"]) {
    fs.writeFileSync(path.join(pasta, n), n);
    fs.utimesSync(path.join(pasta, n), velho, velho);
  }
  fs.writeFileSync(path.join(pasta, "gravando.ofx"), "x"); // recém-escrito: espera a próxima volta
  const vistos = [];
  const t = vigiar(async nome => { vistos.push(nome); if (nome === "ruim.pdf") throw new Error("layout"); return { lidas: 1, novas: 1 }; }, pasta);
  clearInterval(t);
  await new Promise(r => setTimeout(r, 50));
  assert.deepEqual(vistos.sort(), ["ok.ofx", "ruim.pdf"]);
  assert.ok(fs.existsSync(path.join(pasta, "importados", "ok.ofx")));
  assert.equal(fs.readFileSync(path.join(pasta, "erros", "ruim.pdf.txt"), "utf8"), "layout\n");
  assert.ok(fs.existsSync(path.join(pasta, "gravando.ofx")) && fs.existsSync(path.join(pasta, "nota.txt")));
});
