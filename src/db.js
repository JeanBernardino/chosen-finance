// Postgres local. DATABASE_URL troca o banco (o teste usa outro).
import pg from "pg";
import { REGRAS_PADRAO } from "./categorias.js";

pg.types.setTypeParser(1700, Number); // numeric
pg.types.setTypeParser(1082, v => v); // date fica 'AAAA-MM-DD', sem fuso

export function abrir(url = process.env.DATABASE_URL || "postgres://localhost/chosen_finance") {
  return new pg.Pool({ connectionString: url });
}

export async function migrar(db) {
  const { rows: [{ nova }] } = await db.query("select to_regclass('regra') is null as nova");
  await db.query(`
    create table if not exists transacao (
      id              text primary key,
      origem          text not null,
      data            date not null,
      descricao       text not null,
      valor           numeric(12,2) not null,  -- negativo = saída
      categoria_banco text,
      parcela_atual   int,
      parcela_total   int,
      arquivo         text,
      importado_em    timestamptz not null default now());
    create table if not exists regra (
      id        serial primary key,
      prioridade int not null,                  -- menor vence
      padrao    text not null,
      categoria text not null);
    create table if not exists cartao (
      id     serial primary key,
      nome   text not null unique,
      banco  text not null,
      cor    text not null default '#008F63',
      ativo  boolean not null default true);
    alter table transacao add column if not exists cartao_id int references cartao;
    alter table transacao add column if not exists vencimento date;  -- vencimento da fatura do cartão
    create table if not exists gasto_manual (
      id        serial primary key,
      data      date not null,
      descricao text not null,
      valor     numeric(12,2) not null check (valor > 0),  -- positivo = quanto saiu
      categoria text not null,
      cartao_id int references cartao,                       -- só informativo: o painel é das faturas
      criado_em timestamptz not null default now());
    create table if not exists orcamento (
      categoria text primary key,
      limite    numeric(12,2) not null check (limite > 0));  -- por mês, sobre os gastos das faturas
    create table if not exists financiamento (
      id            serial primary key,
      descricao     text not null,
      valor         numeric(12,2) not null check (valor > 0),          -- por parcela
      parcela_total int not null check (parcela_total between 1 and 600),
      primeira      date not null);                                   -- mês da 1ª parcela (dia 1)
    alter table financiamento add column if not exists abatidas int not null default 0;  -- quitadas de trás para frente
    create table if not exists evento (                                  -- churrasco, viagem: gastos rachados entre os participantes
      id   serial primary key,
      nome text not null,
      data date not null);
    create table if not exists evento_pessoa (
      id        serial primary key,
      evento_id int not null references evento on delete cascade,
      nome      text not null,
      unique (evento_id, nome),
      unique (id, evento_id));
    create table if not exists evento_gasto (
      id        serial primary key,
      evento_id int not null references evento on delete cascade,
      descricao text not null,
      valor     numeric(12,2) not null check (valor > 0),
      pago_por  int not null,
      foreign key (pago_por, evento_id) references evento_pessoa (id, evento_id));  -- quem pagou é do mesmo evento`);
  if (nova) await salvarRegras(db, REGRAS_PADRAO);
  // cartões que já vinham das importações antes do cadastro existir
  await db.query(`
    insert into cartao (nome, banco, cor)
      select distinct replace(origem, ' cartão', ''), replace(origem, ' cartão', ''),
             case when origem ilike 'nubank%' then '#8A05BE' when origem ilike 'ita%' then '#EC7000' else '#008F63' end
        from transacao where origem like '% cartão' and cartao_id is null
    on conflict (nome) do nothing;
    update transacao t set cartao_id = c.id from cartao c
     where t.cartao_id is null and t.origem = c.nome || ' cartão';`);
}

/** Grava as transações ignorando as já importadas; devolve quantas eram novas. */
export async function salvar(db, transacoes, cartaoId = null) {
  if (!transacoes.length) return 0;
  const cols = ["id", "origem", "data", "descricao", "valor", "categoria_banco", "parcela_atual", "parcela_total", "arquivo", "vencimento"];
  const { rowCount } = await db.query(
    `insert into transacao (${cols}, cartao_id) select *, $11::int from unnest($1::text[], $2::text[], $3::date[], $4::text[], $5::numeric[],
       $6::text[], $7::int[], $8::int[], $9::text[], $10::date[]) on conflict (id) do nothing`,
    [...cols.map(c => transacoes.map(t => t[c])), cartaoId]);
  return rowCount;
}

/**
 * Importadas, com o nome do cartão como origem. Gasto manual tem visão própria e não entra aqui.
 * `mes` é o mês de pagamento: a fatura do cartão conta inteira no mês do vencimento,
 * mesmo com compras de meses anteriores.
 */
export const transacoes = async db => (await db.query(`
  select t.id, coalesce(c.nome, t.origem) as origem, t.data, to_char(coalesce(t.vencimento, t.data), 'YYYY-MM') as mes,
         t.descricao, t.valor, t.categoria_banco,
         t.parcela_atual, t.parcela_total, t.cartao_id, c.cor
    from transacao t left join cartao c on c.id = t.cartao_id
   order by t.data desc, t.id`)).rows;

export const importacoes = async db => (await db.query(`
  select t.arquivo, coalesce(c.nome, t.origem) as origem, c.cor, count(*)::int as lancamentos, min(t.data) as de, max(t.data) as ate,
         sum(-t.valor) filter (where t.valor < 0) as gasto, max(t.importado_em) as em
    from transacao t left join cartao c on c.id = t.cartao_id
   group by 1, 2, 3 order by em desc`)).rows;

/** Apaga os lançamentos de um arquivo, para reimportar no cartão certo. */
export const apagarImportacao = async (db, arquivo) =>
  (await db.query("delete from transacao where arquivo = $1", [arquivo])).rowCount;

export const cartoes = async db => (await db.query(`
  select c.*, (select count(*)::int from transacao where cartao_id = c.id) as lancamentos
    from cartao c order by ativo desc, nome`)).rows;

export async function salvarCartao(db, { id, nome, banco, cor, ativo }) {
  const v = [nome, banco, cor, ativo];
  return (await (id
    ? db.query("update cartao set nome = $1, banco = $2, cor = $3, ativo = $4 where id = $5 returning *", [...v, id])
    : db.query("insert into cartao (nome, banco, cor, ativo) values ($1, $2, $3, $4) returning *", v))).rows[0];
}

/** Só apaga cartão sem lançamentos; com histórico, o caminho é desativar. */
export const apagarCartao = async (db, id) =>
  (await db.query("delete from cartao c where id = $1 and not exists (select 1 from transacao where cartao_id = c.id) and not exists (select 1 from gasto_manual where cartao_id = c.id)", [id])).rowCount;

export const gastosManuais = async db => (await db.query(`
  select g.*, c.nome as cartao, c.cor from gasto_manual g left join cartao c on c.id = g.cartao_id order by g.data desc, g.id desc`)).rows;

export async function salvarGasto(db, { id, data, descricao, valor, categoria, cartao_id }) {
  const v = [data, descricao, valor, categoria, cartao_id];
  return (await (id
    ? db.query("update gasto_manual set data = $1, descricao = $2, valor = $3, categoria = $4, cartao_id = $5 where id = $6 returning *", [...v, id])
    : db.query("insert into gasto_manual (data, descricao, valor, categoria, cartao_id) values ($1, $2, $3, $4, $5) returning *", v))).rows[0];
}

export const apagarGasto = async (db, id) => (await db.query("delete from gasto_manual where id = $1", [id])).rowCount;

export const orcamentos = async db => (await db.query("select categoria, limite from orcamento order by categoria")).rows;

export const salvarOrcamento = async (db, { categoria, limite }) => (await db.query(
  "insert into orcamento (categoria, limite) values ($1, $2) on conflict (categoria) do update set limite = excluded.limite returning *",
  [categoria, limite])).rows[0];

export const apagarOrcamento = async (db, categoria) => (await db.query("delete from orcamento where categoria = $1", [categoria])).rowCount;

export const financiamentos = async db => (await db.query("select * from financiamento order by descricao")).rows;

export async function salvarFinanciamento(db, { id, descricao, valor, parcela_total, primeira, abatidas }) {
  const v = [descricao, valor, parcela_total, primeira, abatidas];
  return (await (id
    ? db.query("update financiamento set descricao = $1, valor = $2, parcela_total = $3, primeira = $4, abatidas = $5 where id = $6 returning *", [...v, id])
    : db.query("insert into financiamento (descricao, valor, parcela_total, primeira, abatidas) values ($1, $2, $3, $4, $5) returning *", v))).rows[0];
}

export const apagarFinanciamento = async (db, id) => (await db.query("delete from financiamento where id = $1", [id])).rowCount;

export const regras = async db =>
  (await db.query("select padrao, categoria from regra order by prioridade")).rows.map(r => [r.padrao, r.categoria]);

export const listaRegras = async db =>
  (await db.query("select id, padrao, categoria from regra order by prioridade")).rows;

export async function editarRegra(db, id, padrao, categoria) {
  new RegExp(padrao);
  return (await db.query("update regra set padrao = $2, categoria = $3 where id = $1", [id, padrao, categoria])).rowCount;
}

export const apagarRegra = async (db, id) => (await db.query("delete from regra where id = $1", [id])).rowCount;

/** Troca a prioridade com a vizinha de cima (`passo` < 0) ou de baixo. */
export async function moverRegra(db, id, passo) {
  await db.query(`
    with alvo as (select id, prioridade from regra where id = $1),
         viz as (select r.id, r.prioridade from regra r, alvo a
                  where (r.prioridade - a.prioridade) * $2 > 0
                  order by abs(r.prioridade - a.prioridade) limit 1)
    update regra r set prioridade = case when r.id = (select id from alvo) then (select prioridade from viz) else (select prioridade from alvo) end
     where r.id in ((select id from alvo), (select id from viz))`, [id, Math.sign(passo)]);
}

/** Substitui todas as regras; `lista` em ordem de prioridade. */
export async function salvarRegras(db, lista) {
  for (const [p] of lista) new RegExp(p);
  await emTransacao(db, async c => {
    await c.query("delete from regra");
    await c.query("insert into regra (prioridade, padrao, categoria) select * from unnest($1::int[], $2::text[], $3::text[])",
      [lista.map((_, i) => i), lista.map(r => r[0]), lista.map(r => r[1])]);
  });
}

async function emTransacao(db, fn) {
  const c = await db.connect();
  try {
    await c.query("begin");
    const r = await fn(c);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

/** Regra criada pela tela vence todas as outras. */
export async function adicionarRegra(db, padrao, categoria) {
  new RegExp(padrao);
  await db.query("insert into regra (prioridade, padrao, categoria) select coalesce(min(prioridade), 0) - 1, $1, $2 from regra",
    [padrao, categoria]);
}

/** Eventos com participantes e gastos: volume pequeno, vai tudo de uma vez. */
export const eventos = async db => (await db.query(`
  select e.id, e.nome, e.data,
         coalesce((select json_agg(json_build_object('id', p.id, 'nome', p.nome) order by p.id) from evento_pessoa p where p.evento_id = e.id), '[]') as pessoas,
         coalesce((select json_agg(json_build_object('id', g.id, 'descricao', g.descricao, 'valor', g.valor, 'pago_por', g.pago_por) order by g.id)
                     from evento_gasto g where g.evento_id = e.id), '[]') as gastos
    from evento e order by e.data desc, e.id desc`)).rows;

/** Participantes pelo nome: mantém os que continuam, cria os novos e tira os que saíram (se não pagaram nada). */
export const salvarEvento = (db, { id, nome, data, pessoas }) => emTransacao(db, async c => {
  const ev = (await (id
    ? c.query("update evento set nome = $1, data = $2 where id = $3 returning id", [nome, data, id])
    : c.query("insert into evento (nome, data) values ($1, $2) returning id", [nome, data]))).rows[0];
  if (!ev) throw Object.assign(new Error("evento não encontrado"), { status: 404 });
  try {
    await c.query("delete from evento_pessoa where evento_id = $1 and nome <> all($2::text[])", [ev.id, pessoas]);
  } catch (e) {
    throw e.code === "23503" ? Object.assign(new Error("quem já pagou algum gasto não pode sair do evento: troque o pagador ou exclua o gasto antes"), { status: 400 }) : e;
  }
  await c.query("insert into evento_pessoa (evento_id, nome) select $1, unnest($2::text[]) on conflict do nothing", [ev.id, pessoas]);
  return ev;
});

export const apagarEvento = async (db, id) => (await db.query("delete from evento where id = $1", [id])).rowCount;

export async function salvarGastoEvento(db, { id, evento_id, descricao, valor, pago_por }) {
  const v = [evento_id, descricao, valor, pago_por];
  return (await (id
    ? db.query("update evento_gasto set evento_id = $1, descricao = $2, valor = $3, pago_por = $4 where id = $5 returning *", [...v, id])
    : db.query("insert into evento_gasto (evento_id, descricao, valor, pago_por) values ($1, $2, $3, $4) returning *", v))).rows[0];
}

export const apagarGastoEvento = async (db, id) => (await db.query("delete from evento_gasto where id = $1", [id])).rowCount;
