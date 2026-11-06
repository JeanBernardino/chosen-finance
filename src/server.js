// Servidor local: API JSON + arquivos de public/. Só escuta em 127.0.0.1 (dados financeiros).
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import * as db from "./db.js";
import { categorizar } from "./categorias.js";
import { ler } from "./importadores.js";
import { cartaoDa, PASTA, vigiar } from "./entrada.js";
import { contexto, conversar, validarMensagens } from "./assistente.js";
import { lerFoto, lerNfce, limparItens } from "./recibo.js";

const PORT = Number(process.env.PORT || 4780);
const PUBLIC = new URL("../public/", import.meta.url).pathname;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };
const MAX_UPLOAD = 20 * 1024 * 1024;
// lida a cada pedido, como o CHANGELOG: um release com o servidor no ar já aparece sem reiniciar
const versao = () => JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url))).version;
// Novidades: o CHANGELOG.md é a mesma fonte das notas do release no GitHub
const CHANGELOG = new URL("../CHANGELOG.md", import.meta.url);
const releases = () => fs.readFileSync(CHANGELOG, "utf8").split(/^## /m).slice(1).map(sec => {
  const [cab, ...resto] = sec.split("\n"), m = cab.match(/^\[(.+?)\](?: - (\S+))?/);
  return m && { versao: m[1], data: m[2] ?? null, notas: resto.join("\n").trim() };
}).filter(Boolean);

const pool = db.abrir();
await db.migrar(pool);

const invalido = msg => Object.assign(new Error(msg), { status: 400 });
const texto = v => typeof v === "string" && v.trim() ? v.trim() : null;
const idOuNulo = v => v == null || v === "" ? null : Number.isInteger(Number(v)) ? Number(v) : (() => { throw invalido("id inválido"); })();

async function corpo(req) {
  const partes = [];
  let total = 0;
  for await (const p of req) {
    if ((total += p.length) > MAX_UPLOAD) throw Object.assign(new Error("arquivo maior que 20 MB"), { status: 413 });
    partes.push(p);
  }
  return Buffer.concat(partes);
}

vigiar(async (nome, buf) => {
  const lidas = await ler(nome, buf);
  if (!lidas.length) throw invalido("nenhum lançamento encontrado no arquivo (layout não reconhecido?)");
  return { lidas: lidas.length, novas: await db.salvar(pool, lidas, cartaoDa(lidas[0].origem, await db.cartoes(pool))) };
});

const rotas = {
  "GET /api/releases": () => ({ versao: versao(), releases: releases() }),
  "GET /api/transacoes": async () => categorizar(await db.transacoes(pool), await db.regras(pool)),
  "POST /api/importar": async (req, url) => {
    const nome = url.searchParams.get("nome") ?? "";
    const lidas = await ler(nome, await corpo(req));
    if (!lidas.length) throw invalido("nenhum lançamento encontrado no arquivo (layout não reconhecido?)");
    // o banco lido do arquivo manda: na tela, vários arquivos de uma vez levam um só cartão escolhido
    const cartao = cartaoDa(lidas[0].origem, await db.cartoes(pool)) ?? idOuNulo(url.searchParams.get("cartao"));
    return { arquivo: nome, lidas: lidas.length, novas: await db.salvar(pool, lidas, cartao) };
  },
  "GET /api/importacoes": () => db.importacoes(pool),
  "DELETE /api/importacoes": async (req, url) => ({ apagados: await db.apagarImportacao(pool, url.searchParams.get("arquivo") ?? "") }),

  "GET /api/cartoes": () => db.cartoes(pool),
  "POST /api/cartoes": async req => {
    const c = JSON.parse(await corpo(req));
    const nome = texto(c.nome), banco = texto(c.banco);
    if (!nome || !banco) throw invalido("nome e banco são obrigatórios");
    if (!/^#[0-9a-f]{6}$/i.test(c.cor ?? "")) throw invalido("cor inválida");
    return db.salvarCartao(pool, { id: idOuNulo(c.id), nome, banco, cor: c.cor, ativo: c.ativo !== false });
  },
  "DELETE /api/cartoes": async (req, url) => {
    if (!await db.apagarCartao(pool, idOuNulo(url.searchParams.get("id"))))
      throw invalido("cartão com lançamentos não pode ser excluído: desative-o");
    return { ok: true };
  },

  "GET /api/gastos": () => db.gastosManuais(pool),
  "POST /api/gastos": async req => {
    const g = JSON.parse(await corpo(req));
    const descricao = texto(g.descricao), categoria = texto(g.categoria), valor = Number(g.valor);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(g.data ?? "") || !descricao || !categoria) throw invalido("data, descrição e categoria são obrigatórias");
    if (!(valor > 0) || valor >= 1e10) throw invalido("valor deve ser maior que zero");
    return db.salvarGasto(pool, { id: idOuNulo(g.id), data: g.data, descricao, valor, categoria, cartao_id: idOuNulo(g.cartao_id) });
  },
  "DELETE /api/gastos": async (req, url) => ({ apagados: await db.apagarGasto(pool, idOuNulo(url.searchParams.get("id"))) }),
  "GET /api/orcamentos": () => db.orcamentos(pool),
  "POST /api/orcamentos": async req => {
    const o = JSON.parse(await corpo(req));
    const categoria = texto(o.categoria), limite = Number(o.limite);
    if (!categoria) throw invalido("categoria é obrigatória");
    if (!(limite > 0) || limite >= 1e10) throw invalido("limite deve ser maior que zero");
    return db.salvarOrcamento(pool, { categoria, limite });
  },
  "DELETE /api/orcamentos": async (req, url) => ({ apagados: await db.apagarOrcamento(pool, url.searchParams.get("categoria") ?? "") }),
  "GET /api/financiamentos": () => db.financiamentos(pool),
  "POST /api/financiamentos": async req => {
    const f = JSON.parse(await corpo(req));
    const descricao = texto(f.descricao), valor = Number(f.valor), parcela_total = Number(f.parcela_total);
    if (!descricao || !/^\d{4}-\d{2}$/.test(f.primeira ?? "")) throw invalido("descrição e mês da 1ª parcela são obrigatórios");
    if (!(valor > 0) || valor >= 1e10) throw invalido("valor deve ser maior que zero");
    if (!Number.isInteger(parcela_total) || parcela_total < 1 || parcela_total > 600) throw invalido("parcelas deve ser de 1 a 600");
    const abatidas = Number(f.abatidas || 0);
    if (!Number.isInteger(abatidas) || abatidas < 0 || abatidas >= parcela_total) throw invalido("parcelas abatidas deve ser de 0 a uma a menos que o total");
    return db.salvarFinanciamento(pool, { id: idOuNulo(f.id), descricao, valor, parcela_total, primeira: `${f.primeira}-01`, abatidas });
  },
  "DELETE /api/financiamentos": async (req, url) => ({ apagados: await db.apagarFinanciamento(pool, idOuNulo(url.searchParams.get("id"))) }),
  "GET /api/eventos": () => db.eventos(pool),
  "POST /api/eventos": async req => {
    const e = JSON.parse(await corpo(req));
    const nome = texto(e.nome), pessoas = [], vistos = new Set();
    // uma linha por participante; "Ana + Beto" na mesma linha é um grupo (casal): cada um é uma parte, o acerto sai junto
    for (const linha of (Array.isArray(e.pessoas) ? e.pessoas : []).map(texto).filter(Boolean)) {
      const nomes = [...new Set(linha.split("+").map(texto).filter(Boolean))].filter(n => !vistos.has(n));
      for (const n of nomes) { vistos.add(n); pessoas.push({ nome: n, grupo: nomes.length > 1 ? nomes.join(" + ") : null }); }
    }
    if (!nome || !/^\d{4}-\d{2}-\d{2}$/.test(e.data ?? "")) throw invalido("nome e data são obrigatórios");
    if (!pessoas.length || pessoas.length > 100 || pessoas.some(p => p.nome.length > 60)) throw invalido("informe de 1 a 100 participantes, com até 60 letras cada");
    return db.salvarEvento(pool, { id: idOuNulo(e.id), nome, data: e.data, pessoas });
  },
  "POST /api/eventos/ativo": async req => {
    const e = JSON.parse(await corpo(req));
    if (!await db.ativarEvento(pool, idOuNulo(e.id), e.ativo !== false)) throw Object.assign(new Error("evento não encontrado"), { status: 404 });
    return { ok: true };
  },
  "DELETE /api/eventos": async (req, url) => ({ apagados: await db.apagarEvento(pool, idOuNulo(url.searchParams.get("id"))) }),
  "POST /api/eventos/gastos": async req => {
    const g = JSON.parse(await corpo(req));
    const descricao = texto(g.descricao), valor = Number(g.valor), evento_id = idOuNulo(g.evento_id), pago_por = idOuNulo(g.pago_por);
    if (!descricao || !evento_id || !pago_por) throw invalido("descrição e quem pagou são obrigatórios");
    if (!(valor > 0) || valor >= 1e10) throw invalido("valor deve ser maior que zero");
    return db.salvarGastoEvento(pool, { id: idOuNulo(g.id), evento_id, descricao, valor, pago_por });
  },
  // só lê: os itens voltam para a tela revisar antes de lançar. Com ?url é o link da NFC-e; sem, o corpo é a foto
  "POST /api/eventos/recibo": async (req, url) => {
    const link = url.searchParams.get("url");
    if (link) return lerNfce(link);
    const foto = await corpo(req);
    if (!foto.length) throw invalido("envie a foto do cupom ou o link da nota");
    return lerFoto(foto);
  },
  "POST /api/eventos/gastos/lote": async req => {
    const g = JSON.parse(await corpo(req));
    const evento_id = idOuNulo(g.evento_id), pago_por = idOuNulo(g.pago_por), itens = limparItens(g.itens);
    if (!evento_id || !pago_por) throw invalido("evento e quem pagou são obrigatórios");
    if (!itens.length || itens.length !== g.itens.length || itens.length > 500) throw invalido("cada item precisa de descrição e valor maior que zero (até 500 itens)");
    return { novos: await db.salvarGastosEvento(pool, { evento_id, pago_por, itens }) };
  },
  // acerto da divisão marcado como pago: abate do saldo de quem pagou e de quem recebeu
  "POST /api/eventos/acertos": async req => {
    const a = JSON.parse(await corpo(req));
    const evento_id = idOuNulo(a.evento_id), de = idOuNulo(a.de), para = idOuNulo(a.para), valor = Number(a.valor);
    if (!evento_id || !de || !para || de === para) throw invalido("evento, quem pagou e quem recebeu são obrigatórios");
    if (!(valor > 0) || valor >= 1e10) throw invalido("valor deve ser maior que zero");
    return db.salvarAcerto(pool, { evento_id, de, para, valor });
  },
  "DELETE /api/eventos/acertos": async (req, url) => ({ apagados: await db.apagarAcerto(pool, idOuNulo(url.searchParams.get("id"))) }),
  "DELETE /api/eventos/lancamentos": async (req, url) => ({ apagados: await db.zerarEvento(pool, idOuNulo(url.searchParams.get("evento_id"))) }),
  "DELETE /api/eventos/gastos": async (req, url) => ({ apagados: await db.apagarGastoEvento(pool, idOuNulo(url.searchParams.get("id"))) }),
  "GET /api/regras": () => db.listaRegras(pool),
  // sem id: regra nova, vence todas as outras; com id: edita mantendo a prioridade
  "POST /api/regras": async req => {
    const r = JSON.parse(await corpo(req));
    const padrao = texto(r.padrao), categoria = texto(r.categoria), id = idOuNulo(r.id);
    if (!padrao || !categoria) throw invalido("padrão e categoria são obrigatórios");
    if (id) await db.editarRegra(pool, id, padrao, categoria);
    else await db.adicionarRegra(pool, padrao, categoria);
    return { ok: true };
  },
  "POST /api/regras/mover": async req => {
    const { id, passo } = JSON.parse(await corpo(req));
    await db.moverRegra(pool, idOuNulo(id), Number(passo) || 0);
    return { ok: true };
  },
  "DELETE /api/regras": async (req, url) => ({ apagados: await db.apagarRegra(pool, idOuNulo(url.searchParams.get("id"))) }),
  // responde em streaming direto no res: a rota não devolve corpo
  "POST /api/chat": async (req, url, res) => {
    const mensagens = validarMensagens(JSON.parse(await corpo(req)).mensagens);
    const [lista, regras, manuais, fins] = await Promise.all([db.transacoes(pool), db.regras(pool), db.gastosManuais(pool), db.financiamentos(pool)]);
    await conversar(mensagens, contexto(categorizar(lista, regras), manuais, undefined, fins), res);
  },
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const send = (status, body, type = "application/json; charset=utf-8") => {
    res.writeHead(status, { "content-type": type });
    res.end(type.startsWith("application/json") ? JSON.stringify(body) : body);
  };
  try {
    const rota = rotas[`${req.method} ${url.pathname}`];
    if (rota) {
      const r = await rota(req, url, res);
      return res.headersSent || send(200, r);
    }
    if (req.method !== "GET") return send(404, { erro: "não encontrado" });
    const arquivo = path.join(PUBLIC, path.normalize(url.pathname === "/" ? "index.html" : url.pathname));
    if (!arquivo.startsWith(PUBLIC) || !fs.existsSync(arquivo)) return send(404, "não encontrado", "text/plain");
    send(200, fs.readFileSync(arquivo), TYPES[path.extname(arquivo)] ?? "application/octet-stream");
  } catch (e) {
    if (res.headersSent) return res.end(); // caiu no meio do streaming: só fecha
    // regex inválida e JSON malformado são erro de quem chamou; 23xxx é violação de constraint (nome repetido, data inválida...)
    const status = e.status ?? (e instanceof SyntaxError || /^(23|22)/.test(e.code ?? "") ? 400 : 500);
    send(status, { erro: e.code === "23505" ? "já existe um cadastro com esse nome" : e.message });
  }
}).listen(PORT, "127.0.0.1", () => console.log(`Chosen Finance em http://127.0.0.1:${PORT} · importa sozinho o que cair em ${PASTA}`));
