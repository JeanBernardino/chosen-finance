// Dados de exemplo: um banco à parte (chosen_finance_demo) com valores fictícios, para mostrar ou testar o app
// sem os dados reais. As datas acompanham o mês de hoje, então o exemplo sempre parece atual.
import * as db from "./db.js";
import { REGRAS_PADRAO } from "./categorias.js";

const somarMeses = (m, n) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1)).toISOString().slice(0, 7);
const diasAtras = (hoje, n) => new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() - n)).toISOString().slice(0, 10);

/** Tudo o que o exemplo grava, sem tocar no banco. Pseudoaleatório com semente fixa: o mesmo dia gera o mesmo exemplo. */
export function dadosDemo(hoje = new Date()) {
  let semente = 42;
  const sorteio = (min, max) => { semente = (semente * 16807) % 2147483647; return Math.round((min + (semente / 2147483647) * (max - min)) * 100) / 100; };
  const atual = hoje.toISOString().slice(0, 7);
  const cartoes = [{ nome: "Nubank", banco: "Nubank", cor: "#8A05BE" }, { nome: "Itaú", banco: "Itaú", cor: "#EC7000" }];
  const transacoes = { Nubank: [], "Itaú": [] };
  // parcelados: [descrição, cartão, valor da parcela, parcelas, mês da 1ª parcela (relativo ao atual)]
  const parcelados = [["Mp *Lojademo", "Nubank", 129.9, 6, -3], ["Amazon Marketplace", "Nubank", 249, 10, -7], ["Magalu Geladeira", "Itaú", 310, 12, -1]];

  for (let k = -5; k <= 0; k++) {
    const fatura = somarMeses(atual, k), compra = somarMeses(fatura, -1), vencimento = `${fatura}-10`;
    const lanc = (cartao, descricao, valor, extra = {}) => {
      const lista = transacoes[cartao];
      lista.push({ id: `demo-${fatura}-${cartao}-${lista.length}`, origem: `${cartao} cartão`, data: `${compra}-${String(1 + lista.length % 27).padStart(2, "0")}`,
        descricao, valor: -valor, categoria_banco: null, parcela_atual: null, parcela_total: null,
        arquivo: `exemplo-${cartao === "Nubank" ? "nubank" : "itau"}-${fatura}.${cartao === "Nubank" ? "ofx" : "pdf"}`, vencimento, ...extra });
    };
    lanc("Nubank", "Netflix.com", 44.9);
    lanc("Nubank", "Spotify", 21.9);
    if (k >= -2) lanc("Nubank", "Dm*Disney Plus", 33.9);
    for (let i = 0; i < 3; i++) lanc("Nubank", "Supermercado Bom Preço", sorteio(120, 380));
    for (let i = 0; i < 2; i++) lanc("Nubank", "Ifd*Pizzaria Exemplo", sorteio(55, 95));
    lanc("Nubank", "Restaurante Sabor Caseiro", sorteio(40, 80));
    for (let i = 0; i < 3; i++) lanc("Nubank", "Uber *Trip", sorteio(15, 40));
    if (k % 2) lanc("Nubank", "Loja de Roupas Exemplo", sorteio(80, 200), { categoria_banco: "vestuário" });
    lanc("Itaú", "Youtube Premium", 24.9);
    lanc("Itaú", "Academia Corpo Ativo", 99.9);
    for (let i = 0; i < 2; i++) lanc("Itaú", "Posto Ipiranga Centro", sorteio(150, 220));
    if (!(k % 2)) lanc("Itaú", "Drogaria Exemplo", sorteio(30, 90));
    for (const [descricao, cartao, valor, total, inicio] of parcelados) {
      const n = k - inicio + 1;
      if (n >= 1 && n <= total) lanc(cartao, descricao, valor, { parcela_atual: n, parcela_total: total });
    }
    lanc("Nubank", "Pagamento recebido", -1800);  // pagamento da fatura anterior: entra positivo e fica fora dos gastos
  }

  const gastos = [];
  for (let k = -5; k <= 0; k++) {
    const m = somarMeses(atual, k);
    gastos.push({ data: `${m}-05`, descricao: "Feira do produtor", valor: sorteio(40, 90), categoria: "Supermercado" },
      { data: `${m}-12`, descricao: "Pastel na feira", valor: sorteio(15, 30), categoria: "Restaurante e delivery" });
    if (k % 2) gastos.push({ data: `${m}-20`, descricao: "Corte de cabelo", valor: 50, categoria: "Serviços" });
  }

  return {
    cartoes, transacoes, gastos,
    orcamentos: [{ categoria: "Supermercado", limite: 1200 }, { categoria: "Restaurante e delivery", limite: 450 },
      { categoria: "Combustível", limite: 450 }, { categoria: "Assinaturas", limite: 150 }],
    financiamentos: [{ descricao: "Carro (exemplo)", valor: 1290, parcela_total: 48, primeira: `${somarMeses(atual, -14)}-01`, abatidas: 0 },
      { descricao: "Empréstimo (exemplo)", valor: 420, parcela_total: 12, primeira: `${somarMeses(atual, -4)}-01`, abatidas: 0 }],
    eventos: [
      { nome: "Churrasco de exemplo", data: diasAtras(hoje, 10), pessoas: ["Ana", "Beto + Carla", "Diego", "Eva"],
        pix_chave: "ana@exemplo.com", pix_nome: "Ana", acrescimo: 0, ativo: true, pesos: { Diego: 1.5 },
        gastos: [["Picanha (kg)", 3, 79.9, "Ana"], ["Linguiça (kg)", 2, 24.5, "Ana"], ["Carvão", 2, 22, "Diego"],
          ["Cerveja lata", 24, 4.29, "Diego"], ["Refrigerante 2L", 4, 9.99, "Eva"], ["Pão de alho", 2, 18.9, "Beto"]],
        acertos: [["Eva", "Ana", 50]] },
      { nome: "Viagem de exemplo à praia", data: diasAtras(hoje, 60), pessoas: ["Ana", "Diego", "Fábio"],
        pix_chave: null, pix_nome: null, acrescimo: 0, ativo: false, pesos: {},
        gastos: [["Hospedagem", 1, 900, "Ana"], ["Combustível", 1, 320, "Fábio"], ["Mercado", 1, 410.6, "Diego"]],
        acertos: [] },
    ],
  };
}

const TABELAS = "transacao, cartao, gasto_manual, orcamento, financiamento, evento, evento_pessoa, evento_gasto, evento_acerto, regra";

/** Apaga tudo do banco de exemplo e grava o exemplo de novo. Só roda no banco de exemplo (ver server.js). */
export async function popularDemo(pool, hoje = new Date()) {
  const d = dadosDemo(hoje);
  await pool.query(`truncate ${TABELAS} restart identity cascade`);
  await db.salvarRegras(pool, REGRAS_PADRAO);
  for (const c of d.cartoes) {
    const { id } = await db.salvarCartao(pool, { ...c, ativo: true });
    await db.salvar(pool, d.transacoes[c.nome], id);
  }
  for (const g of d.gastos) await db.salvarGasto(pool, g);
  for (const o of d.orcamentos) await db.salvarOrcamento(pool, o);
  for (const f of d.financiamentos) await db.salvarFinanciamento(pool, f);
  for (const e of d.eventos) {
    const pessoas = e.pessoas.flatMap(l => { const n = l.split(" + "); return n.map(nome => ({ nome, grupo: n.length > 1 ? l : null })); });
    const { id } = await db.salvarEvento(pool, { ...e, pessoas });
    const ev = (await db.eventos(pool)).find(x => x.id === id), pid = nome => ev.pessoas.find(p => p.nome === nome).id;
    for (const [nome, peso] of Object.entries(e.pesos)) await db.pesoPessoa(pool, { evento_id: id, id: pid(nome), peso });
    for (const [descricao, quantidade, unitario, quem] of e.gastos)
      await db.salvarGastoEvento(pool, { evento_id: id, descricao, quantidade, valor: Math.round(quantidade * unitario * 100) / 100, pago_por: pid(quem) });
    for (const [de, para, valor] of e.acertos) await db.salvarAcerto(pool, { evento_id: id, de: pid(de), para: pid(para), valor });
    if (!e.ativo) await db.ativarEvento(pool, id, false);
  }
}

/** Abre o banco de exemplo, criando-o (vazio) no mesmo Postgres se ainda não existir. */
export async function abrirDemo(real, url) {
  const nome = new URL(url).pathname.slice(1);
  if (!/^\w+$/.test(nome)) throw new Error(`nome de banco inválido em DEMO_DATABASE_URL: ${nome}`);
  const { rowCount } = await real.query("select 1 from pg_database where datname = $1", [nome]);
  if (!rowCount) await real.query(`create database ${nome}`);
  const pool = db.abrir(url);
  await db.migrar(pool);
  return pool;
}
