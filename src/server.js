// Servidor local: API JSON + arquivos de public/. Só escuta em 127.0.0.1 (dados financeiros).
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import * as db from "./db.js";
import { categorizar } from "./categorias.js";
import { ler } from "./importadores.js";

const PORT = Number(process.env.PORT || 4780);
const PUBLIC = new URL("../public/", import.meta.url).pathname;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };
const MAX_UPLOAD = 20 * 1024 * 1024;

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

const rotas = {
  "GET /api/transacoes": async () => categorizar(await db.transacoes(pool), await db.regras(pool)),
  "POST /api/importar": async (req, url) => {
    const nome = url.searchParams.get("nome") ?? "";
    const lidas = await ler(nome, await corpo(req));
    return { arquivo: nome, lidas: lidas.length, novas: await db.salvar(pool, lidas, idOuNulo(url.searchParams.get("cartao"))) };
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
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const send = (status, body, type = "application/json; charset=utf-8") => {
    res.writeHead(status, { "content-type": type });
    res.end(type.startsWith("application/json") ? JSON.stringify(body) : body);
  };
  try {
    const rota = rotas[`${req.method} ${url.pathname}`];
    if (rota) return send(200, await rota(req, url));
    if (req.method !== "GET") return send(404, { erro: "não encontrado" });
    const arquivo = path.join(PUBLIC, path.normalize(url.pathname === "/" ? "index.html" : url.pathname));
    if (!arquivo.startsWith(PUBLIC) || !fs.existsSync(arquivo)) return send(404, "não encontrado", "text/plain");
    send(200, fs.readFileSync(arquivo), TYPES[path.extname(arquivo)] ?? "application/octet-stream");
  } catch (e) {
    // regex inválida e JSON malformado são erro de quem chamou; 23xxx é violação de constraint (nome repetido, data inválida...)
    const status = e.status ?? (e instanceof SyntaxError || /^(23|22)/.test(e.code ?? "") ? 400 : 500);
    send(status, { erro: e.code === "23505" ? "já existe um cadastro com esse nome" : e.message });
  }
}).listen(PORT, "127.0.0.1", () => console.log(`Chosen Finance em http://127.0.0.1:${PORT}`));
