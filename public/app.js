// Front: busca tudo uma vez e agrega no navegador (volume pessoal cabe com folga).
import { orcamento, parcelasAbertas, parcelasFinanciadas, parcelasPorMes, parcelasDoMes, porEstabelecimento, recorrentes, somarMeses } from "./analises.js";
const FORA_DOS_GASTOS = ["Pagamento de fatura", "Transferência entre contas"];
const $ = id => document.getElementById(id);
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format;
// modo privado: todo valor da tela passa por aqui, então mascarar aqui esconde tudo
let privado = false;
try { privado = localStorage.getItem("ocultar") === "1"; } catch {}
const brl = v => privado ? "R$ •••••" : moeda(v);
const MES_LONGO = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });
const MES_CURTO = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
// "Outubro 2026" nos rótulos; "out/26" no gráfico, onde o espaço é curto
const nomeMes = m => { const n = MES_LONGO.format(new Date(`${m}-01T00:00:00Z`)); return `${n[0].toUpperCase()}${n.slice(1)} ${m.slice(0, 4)}`; };
const mesCurto = m => `${MES_CURTO.format(new Date(`${m}-01T00:00:00Z`)).replace(".", "")}/${m.slice(2, 4)}`;
const mesAnterior = m => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 2, 1)).toISOString().slice(0, 7);
const dataBr = d => d.split("-").reverse().join("/");
const hoje = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const semAcento = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

let todas = [], cartoes = [], gastos = [], limites = [], financiamentos = [], categoriaAtiva = null;
// parcelas a pagar: as compras parceladas das faturas mais os financiamentos cadastrados
const emAberto = () => [...parcelasAbertas(todas), ...parcelasFinanciadas(financiamentos, hoje().slice(0, 7))];

async function api(metodo, url, corpo) {
  const r = await fetch(url, { method: metodo, body: corpo });
  const j = await r.json();
  if (!r.ok) throw new Error(j.erro);
  return j;
}
const json = (metodo, url, dados) => api(metodo, url, JSON.stringify(dados));

function status(msg, erro = false) {
  $("status").textContent = msg;
  $("status").classList.toggle("erro", erro);
}
// erro de qualquer ação vira mensagem na tela
const tentar = fn => async (...a) => { try { await fn(...a); } catch (err) { status(err.message, true); } };

// Esc ou clique fora fecha qualquer dialog como cancelar: sem trocar, o returnValue ficaria com o "ok" do último salvar
for (const d of document.querySelectorAll("dialog")) {
  let fora = false; // só fecha se o clique começou fora: arrastar a seleção de um campo até o fundo não descarta o form
  const noFundo = e => { const r = d.getBoundingClientRect(); return e.target === d && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom); };
  d.addEventListener("pointerdown", e => fora = noFundo(e));
  d.addEventListener("click", e => { if (fora && noFundo(e)) d.close("cancel"); });
  d.addEventListener("cancel", e => { e.preventDefault(); d.close("cancel"); });
}

// ---------- navegação e tema ----------
const VIEWS = { painel: () => carregar(), comparar: () => carregarComparar(), compromissos: () => carregarCompromissos(), gastos: () => carregarGastos(), importar: () => carregarImportacoes(), cartoes: () => carregarCartoes(),
  config: () => carregarRegras(), novidades: () => carregarNovidades() };
function rota() {
  const v = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : "painel";
  for (const s of document.querySelectorAll("[data-view]")) s.hidden = s.dataset.view !== v;
  for (const a of document.querySelectorAll(".menu a")) a.classList.toggle("ativo", a.hash === `#${v}`);
  status("");
  tentar(VIEWS[v])();
}
window.addEventListener("hashchange", rota);

const escuro = () => (document.documentElement.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
const rotuloTema = () => $("tema").querySelector("span").textContent = escuro() ? "Tema claro" : "Tema escuro";
$("tema").addEventListener("click", () => {
  const t = escuro() ? "light" : "dark";
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("tema", t); } catch {}
  rotuloTema();
});
rotuloTema();

const rotuloOcultar = () => { $("ocultar").querySelector("span").textContent = privado ? "Mostrar valores" : "Ocultar valores"; $("ocultar").setAttribute("aria-pressed", privado); };
$("ocultar").addEventListener("click", () => {
  privado = !privado;
  try { localStorage.setItem("ocultar", privado ? "1" : "0"); } catch {}
  rotuloOcultar();
  rota();
});
rotuloOcultar();

// ---------- grid padrão: toda tabela nova usa, para ordenar pelo cabeçalho e filtrar ----------
// Cabeçalho com <button class="ordenar" data-ordem="campo">; `chaves`: campo -> valor de ordenação (sem chave, vale
// o próprio campo da linha); texto começa crescente, número do maior. Filtra pela busca em `texto` e, se houver o select `cartao`, pela origem.
// Sem `colunas`, a linha de vazio ocupa as colunas do cabeçalho. Devolve a função que recebe as linhas e pinta.
function grade({ cab, corpo, busca, cartao, chaves, ordem, texto, linha, colunas, vazio, resumo }) {
  let lista = [];
  const chave = c => chaves[c] ?? (x => x[c]);
  const pintar = () => {
    const q = semAcento($(busca).value.trim()), o = cartao ? $(cartao).value : "", k = chave(ordem.campo);
    const vis = lista.filter(x => (!o || x.origem === o) && (!q || semAcento(texto(x)).includes(q)))
      .sort((a, b) => { const x = k(a), y = k(b); return (x < y ? -1 : x > y ? 1 : 0) * ordem.dir; });
    for (const b of $(cab).querySelectorAll("[data-ordem]")) {
      b.dataset.dir = b.dataset.ordem === ordem.campo ? (ordem.dir > 0 ? "asc" : "desc") : "";
      b.closest("th").setAttribute("aria-sort", b.dataset.dir ? (ordem.dir > 0 ? "ascending" : "descending") : "none");
    }
    $(corpo).innerHTML = vis.map(linha).join("") || `<tr><td colspan="${colunas ?? $(cab).querySelectorAll("th").length}" class="fraco centro">${vazio}</td></tr>`;
    resumo?.(vis);
  };
  $(cab).addEventListener("click", e => {
    const c = e.target.closest("[data-ordem]")?.dataset.ordem;
    if (!c) return;
    ordem = c === ordem.campo ? { campo: c, dir: -ordem.dir } : { campo: c, dir: lista.length && typeof chave(c)(lista[0]) === "number" ? -1 : 1 };
    pintar();
  });
  $(busca).addEventListener("input", pintar);
  if (cartao) $(cartao).addEventListener("change", pintar);
  return nova => {
    lista = nova;
    if (cartao) {
      const origens = [...new Set(lista.map(x => x.origem))].sort(), atual = $(cartao).value;
      $(cartao).innerHTML = `<option value="">Todos os cartões</option>` + origens.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
      $(cartao).value = origens.includes(atual) ? atual : "";
    }
    pintar();
  };
}

// ---------- painel ----------
async function carregar() {
  [todas, cartoes, limites, financiamentos] = await Promise.all([api("GET", "/api/transacoes"), api("GET", "/api/cartoes"), api("GET", "/api/orcamentos"), api("GET", "/api/financiamentos")]);
  // mês atual sempre na lista e selecionado ao abrir; depois mantém a escolha do usuário
  const meses = [...new Set([hoje().slice(0, 7), ...todas.map(t => t.mes)])].sort().reverse();
  const atual = $("mes").options.length ? $("mes").value : hoje().slice(0, 7);
  $("mes").innerHTML = `<option value="">Todo o período</option>` + meses.map(m => `<option value="${m}">${nomeMes(m)}</option>`).join("");
  $("mes").value = meses.includes(atual) ? atual : "";
  atualizarCategorias();
  render();
}

function atualizarCategorias() {
  $("listaCategorias").innerHTML = [...new Set([...todas.map(t => t.categoria), ...gastos.map(g => g.categoria)])].sort()
    .map(c => `<option value="${esc(c)}">`).join("");
}

// cada cartão com a cor do cadastro em todo o app
const cor = o => todas.find(t => t.origem === o && t.cor)?.cor
  ?? (/nubank/i.test(o) ? "var(--nubank)" : /ita[uú]/i.test(o) ? "var(--itau)" : "var(--chart)");
const ponto = o => `<i class="ponto" style="--cor:${cor(o)}"></i>`;
const ehGasto = t => t.valor < 0 && !FORA_DOS_GASTOS.includes(t.categoria);
const soma = lista => lista.reduce((s, t) => s - t.valor, 0);

function delta(atual, anterior, m) {
  if (!anterior) return `<small>sem dados de ${nomeMes(m)}</small>`;
  const p = (atual - anterior) / anterior * 100;
  return `<small><span class="delta ${p > 0 ? "sobe" : "desce"}">${p > 0 ? "▲" : "▼"} ${Math.abs(p).toFixed(0)}%</span> vs ${nomeMes(m)}</small>`;
}

function render() {
  $("vazio").hidden = todas.length > 0;
  $("painel").hidden = todas.length === 0;
  const mes = $("mes").value;
  const origens = [...new Set(todas.map(t => t.origem))].sort();
  const doMes = todas.filter(t => !mes || t.mes.startsWith(mes));
  const gastosF = doMes.filter(ehGasto);
  const total = soma(gastosF);
  const nMeses = new Set(gastosF.map(t => t.mes)).size || 1;
  const sem = gastosF.filter(t => t.categoria === "Sem categoria");
  const titulo = origens.every(o => todas.some(t => t.origem === o && t.cartao_id)) ? "Gasto nos cartões" : "Gasto";
  const porOrigem = new Map(quebrar(gastosF, t => t.origem).map(([o, e]) => [o, e.total]));
  const anterior = mes && mesAnterior(mes);

  $("kpis").innerHTML = `
    <div class="kpi destaque"><span>${titulo}</span><strong>${brl(total)}</strong>
      ${mes ? delta(total, soma(todas.filter(t => ehGasto(t) && t.mes.startsWith(anterior))), anterior) : `<small>todo o período · média ${brl(total / nMeses)}/mês</small>`}</div>
    ${origens.map(o => `<div class="kpi origem" style="--cor:${cor(o)}">
      <span class="titulo">${ponto(o)}${esc(o)}</span><strong>${brl(porOrigem.get(o) ?? 0)}</strong>
      <small>${total ? ((porOrigem.get(o) ?? 0) / total * 100).toFixed(0) : 0}% do gasto</small></div>`).join("")}
    <div class="kpi"><span>Parcelas a pagar</span><strong>${brl(emAberto().reduce((s, p) => s + p.restante, 0))}</strong><small><a href="#compromissos">ver mês a mês</a></small></div>
    <div class="kpi"><span>Sem categoria</span><strong>${brl(soma(sem))}</strong><small>${sem.length} lançamentos para classificar</small></div>`;
  // limite é mensal: o orçamento só aparece com um mês escolhido
  const orc = mes ? orcamento(gastosF, limites) : [];
  const alerta = orc.filter(o => o.pct >= 80).length;
  $("cardOrcamento").hidden = !orc.length;
  $("tOrcamento").textContent = mes ? `Orçamento de ${nomeMes(mes)}` : "Orçamento";
  $("resumoOrcamento").textContent = alerta ? `${alerta} ${alerta > 1 ? "categorias passaram" : "categoria passou"} de 80% do limite` : "Todas as categorias abaixo de 80% do limite";
  $("orcamento").innerHTML = orc.map(o => `
    <li><button class="barra ${o.pct > 100 ? "estourou" : o.pct >= 80 ? "alerta" : ""} ${o.categoria === categoriaAtiva ? "ativa" : ""}" data-categoria="${esc(o.categoria)}">
      <span class="rotulo">${esc(o.categoria)}</span>
      <span class="valor">${brl(o.gasto)} de ${brl(o.limite)} · ${o.pct.toFixed(0)}% · ${o.gasto > o.limite ? `passou ${brl(o.gasto - o.limite)}` : `faltam ${brl(o.limite - o.gasto)}`}</span>
      <span class="trilho"><span style="width:${Math.min(o.pct, 100).toFixed(2)}%"></span></span>
    </button></li>`).join("");
  $("tCategoria").textContent = `${titulo} por categoria`;
  $("tMes").textContent = `${titulo} por mês`;

  // cada gráfico esconde cartões pela própria legenda
  const legenda = g => origens.length > 1 ? origens.map(o =>
    `<button class="filtro-origem" data-origem="${esc(o)}" aria-pressed="${!ocultos[g].has(o)}" title="Mostrar/esconder ${esc(o)}">${ponto(o)}${esc(o)}</button>`).join("") : "";
  $("legCategoria").innerHTML = legenda("categoria");
  $("legMes").innerHTML = legenda("mes");

  const segmentos = (os, e, escala, eixo) => os.filter(o => e.por.get(o))
    .map(o => `<span style="${eixo}:${(e.por.get(o) / escala * 100).toFixed(2)}%;background:${cor(o)}"></span>`).join("");
  const dica = (os, e) => os.filter(o => e.por.get(o)).map(o => `${o}: ${brl(e.por.get(o))}`).join("\n");

  const osCat = origens.filter(o => !ocultos.categoria.has(o));
  const gastosCat = gastosF.filter(t => !ocultos.categoria.has(t.origem));
  const totalCat = soma(gastosCat);
  const porCategoria = quebrar(gastosCat, t => t.categoria);
  const maior = porCategoria[0]?.[1].total || 1;
  $("categorias").innerHTML = porCategoria.map(([c, e]) => `
    <li><button class="barra ${c === categoriaAtiva ? "ativa" : ""}" data-categoria="${esc(c)}" title="${esc(dica(osCat, e))}">
      <span class="rotulo">${esc(c)}</span><span class="valor">${brl(e.total)} · ${(e.total / totalCat * 100).toFixed(0)}%</span>
      <span class="trilho">${segmentos(osCat, e, maior, "width")}</span>
      ${osCat.length > 1 ? `<span class="detalhe">${osCat.filter(o => e.por.get(o)).map(o => `<span>${ponto(o)}${brl(e.por.get(o))}</span>`).join("")}</span>` : ""}
    </button></li>`).join("") || `<li class="fraco centro">Nenhum gasto.</li>`;

  // por mês ignora o filtro de mês: é a evolução
  const osMes = origens.filter(o => !ocultos.mes.has(o));
  const porMes = quebrar(todas.filter(t => ehGasto(t) && !ocultos.mes.has(t.origem) && (!categoriaAtiva || t.categoria === categoriaAtiva)),
    t => t.mes).sort((a, b) => a[0].localeCompare(b[0]));
  const topo = Math.max(...porMes.map(([, e]) => e.total), 1);
  $("meses").classList.toggle("filtrado", !!mes);
  $("meses").innerHTML = porMes.map(([m, e]) => `
    <div class="coluna ${m === mes ? "ativa" : ""}" title="${nomeMes(m)}: ${brl(e.total)}\n${esc(dica(osMes, e))}">
      <span class="valor">${brl(e.total).replace(/,\d\d$/, "")}</span>
      <span class="pilar" style="height:${(e.total / topo * 100).toFixed(1)}%">${segmentos(osMes, e, e.total, "height")}</span>
      <span class="rotulo">${mesCurto(m)}</span>
    </div>`).join("");

  // grid: filtros próprios (cartão, categoria, busca) e ordenação por coluna
  const opcoes = (el, todos, valores, atual) => {
    el.innerHTML = `<option value="">${todos}</option>` + valores.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
    el.value = valores.includes(atual) ? atual : "";
  };
  opcoes($("fOrigem"), "Todos os cartões", origens, $("fOrigem").value);
  opcoes($("fCategoria"), "Todas as categorias", [...new Set(doMes.map(t => t.categoria))].sort(), categoriaAtiva ?? "");
  const origem = $("fOrigem").value;
  const busca = $("busca").value.trim().toLowerCase();
  const chave = ORDEM[ordem.campo];
  const lista = doMes.filter(t => (!origem || t.origem === origem) && (!categoriaAtiva || t.categoria === categoriaAtiva)
    && (!busca || t.descricao.toLowerCase().includes(busca)))
    .sort((a, b) => { const x = chave(a), y = chave(b); return (x < y ? -1 : x > y ? 1 : 0) * ordem.dir; });
  $("resumoLista").textContent = `${lista.length} lançamentos · ${brl(soma(lista.filter(ehGasto)))} em gastos`;
  for (const b of document.querySelectorAll("#cabLinhas [data-ordem]")) {
    b.dataset.dir = b.dataset.ordem === ordem.campo ? (ordem.dir > 0 ? "asc" : "desc") : "";
    b.closest("th").setAttribute("aria-sort", b.dataset.dir ? (ordem.dir > 0 ? "ascending" : "descending") : "none");
  }
  $("linhas").innerHTML = lista.map(t => `
    <tr>
      <td class="mono">${dataBr(t.data)}</td>
      <td>${esc(t.descricao)}</td>
      <td><span class="badge">${ponto(t.origem)}${esc(t.origem)}</span></td>
      <td><button class="tag ${t.categoria === "Sem categoria" ? "pendente" : ""}" data-id="${esc(t.id)}">${esc(t.categoria)}</button></td>
      <td class="mono fraco">${t.parcela_total ? `${t.parcela_atual}/${t.parcela_total}` : ""}</td>
      <td class="num mono ${t.valor > 0 ? "entrada" : ""}">${brl(t.valor)}</td>
    </tr>`).join("") || `<tr><td colspan="6" class="fraco centro">Nenhum lançamento com esses filtros.</td></tr>`;
}

// valor ordena pelo tamanho do gasto: decrescente = maiores gastos primeiro
const ORDEM = {
  data: t => t.data, descricao: t => t.descricao.toLowerCase(), origem: t => t.origem, categoria: t => t.categoria,
  parcela: t => t.parcela_total ? t.parcela_total - t.parcela_atual : -1, valor: t => -t.valor,
};
let ordem = { campo: "data", dir: -1 };
const ocultos = { categoria: new Set(), mes: new Set() };

// Soma os gastos por chave, guardando quanto veio de cada origem: [[chave, {total, por: Map(origem -> valor)}], ...]
const quebrar = (lista, chave) => {
  const m = new Map();
  for (const t of lista) {
    const e = m.get(chave(t)) ?? m.set(chave(t), { total: 0, por: new Map() }).get(chave(t));
    e.total -= t.valor;
    e.por.set(t.origem, (e.por.get(t.origem) ?? 0) - t.valor);
  }
  return [...m].sort((a, b) => b[1].total - a[1].total);
};

$("mes").addEventListener("change", render);
$("busca").addEventListener("input", render);
$("fOrigem").addEventListener("change", render);
$("fCategoria").addEventListener("change", e => { categoriaAtiva = e.target.value || null; render(); });
for (const l of [$("legCategoria"), $("legMes")]) l.addEventListener("click", e => {
  const o = e.target.closest("[data-origem]")?.dataset.origem;
  if (!o) return;
  const s = ocultos[l.dataset.grafico];
  s.has(o) ? s.delete(o) : s.add(o);
  render();
});
$("cabLinhas").addEventListener("click", e => {
  const c = e.target.closest("[data-ordem]")?.dataset.ordem;
  if (!c) return;
  // texto começa crescente; data, parcela e valor começam do maior
  ordem = c === ordem.campo ? { campo: c, dir: -ordem.dir } : { campo: c, dir: ["descricao", "origem", "categoria"].includes(c) ? 1 : -1 };
  render();
});
for (const el of [$("categorias"), $("orcamento")]) el.addEventListener("click", e => {
  const c = e.target.closest("[data-categoria]")?.dataset.categoria;
  if (!c) return;
  categoriaAtiva = categoriaAtiva === c ? null : c;
  render();
});

// Classificar: vira regra, para o app aprender o estabelecimento.
$("linhas").addEventListener("click", e => {
  const id = e.target.closest("[data-id]")?.dataset.id;
  const t = id && todas.find(x => x.id === id);
  if (!t) return;
  $("clsDescricao").textContent = t.descricao;
  $("clsCategoria").value = t.categoria === "Sem categoria" ? "" : t.categoria;
  $("clsPadrao").value = "^" + t.descricao.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  $("dlgClassificar").showModal();
});
$("dlgClassificar").addEventListener("close", tentar(async () => {
  if ($("dlgClassificar").returnValue !== "ok") return;
  await json("POST", "/api/regras", { padrao: $("clsPadrao").value, categoria: $("clsCategoria").value });
  status("Regra salva.");
  await carregar();
}));

// ---------- comparar períodos ----------
const proximoMes = m => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 1)).toISOString().slice(0, 7);
const mesesEntre = (de, ate) => { const l = []; for (let m = de; m <= ate; m = proximoMes(m)) l.push(m); return l; };
const variacao = (b, a) => {
  if (!a) return b ? `<span class="fraco">novo</span>` : "";
  const p = (b - a) / a * 100;
  return Math.abs(p) < 0.5 ? `<span class="fraco">= 0%</span>` : `<span class="delta ${p > 0 ? "sobe" : "desce"}">${p > 0 ? "▲" : "▼"} ${Math.abs(p).toFixed(0)}%</span>`;
};

async function carregarComparar() {
  todas = await api("GET", "/api/transacoes");
  const meses = [...new Set(todas.map(t => t.mes))].sort();
  $("cmpVazio").hidden = meses.length > 0;
  $("cmp").hidden = meses.length === 0;
  if (!meses.length) return;
  const ultimo = meses.at(-1), padrao = { cmpDe: meses.at(-2) ?? ultimo, cmpAte: ultimo };
  for (const id of Object.keys(padrao)) {
    const atual = $(id).value;
    $(id).innerHTML = mesesEntre(meses[0], ultimo).map(m => `<option value="${m}">${nomeMes(m)}</option>`).join("");
    $(id).value = atual && atual >= meses[0] && atual <= ultimo ? atual : padrao[id];
  }
  renderComparar();
}

function renderComparar() {
  // "até" antes do "de" vira o mesmo mês, para o intervalo nunca ficar vazio
  if ($("cmpAte").value < $("cmpDe").value) $("cmpAte").value = $("cmpDe").value;
  const de = $("cmpDe").value, ate = $("cmpAte").value, span = mesesEntre(de, ate);
  const gastos = todas.filter(ehGasto);
  const porMes = new Map(quebrar(gastos, t => t.mes).map(([m, e]) => [m, e.total]));
  const valores = span.map(m => porMes.get(m) ?? 0);
  const total = valores.reduce((s, v) => s + v, 0);
  const maior = span[valores.indexOf(Math.max(...valores))], menor = span[valores.indexOf(Math.min(...valores))];

  $("cmpKpis").innerHTML = `
    <div class="kpi destaque"><span>No intervalo</span><strong>${brl(total)}</strong><small>${span.length} ${span.length > 1 ? "meses" : "mês"} · ${mesCurto(de)} a ${mesCurto(ate)}</small></div>
    <div class="kpi"><span>Média por mês</span><strong>${brl(total / span.length)}</strong><small>&nbsp;</small></div>
    <div class="kpi"><span>Mês que mais gastei</span><strong>${brl(porMes.get(maior) ?? 0)}</strong><small>${nomeMes(maior)}</small></div>
    <div class="kpi"><span>Mês que menos gastei</span><strong>${brl(porMes.get(menor) ?? 0)}</strong><small>${nomeMes(menor)}</small></div>`;

  // a variação do primeiro mês usa o mês anterior ao intervalo, quando houver
  const topo = Math.max(...valores, 1);
  $("cmpMeses").innerHTML = span.map((m, i) => `
    <button class="coluna" data-det data-mes="${m}" title="${nomeMes(m)}: ${brl(valores[i])}" aria-label="Detalhar ${nomeMes(m)}">
      <span class="valor">${brl(valores[i]).replace(/,\d\d$/, "")}</span>
      <span class="pilar cheio" style="height:${(valores[i] / topo * 100).toFixed(1)}%"></span>
      <span class="rotulo">${mesCurto(m)}</span><span class="var">${variacao(valores[i], porMes.get(mesAnterior(m)) ?? 0)}</span>
    </button>`).join("");

  // categoria x mês: cada célula com a variação contra o mês anterior da mesma categoria
  const cel = new Map();
  for (const t of gastos.filter(t => t.mes >= mesAnterior(de) && t.mes <= ate))
    cel.set(`${t.categoria}|${t.mes}`, (cel.get(`${t.categoria}|${t.mes}`) ?? 0) - t.valor);
  const v = (c, m) => cel.get(`${c}|${m}`) ?? 0;
  const cats = [...new Set(gastos.filter(t => span.includes(t.mes)).map(t => t.categoria))]
    .map(c => [c, span.reduce((s, m) => s + v(c, m), 0)]).sort((x, y) => y[1] - x[1]);
  $("cmpBase").textContent = "Cada mês contra o anterior. Clique num valor para ver os estabelecimentos";
  $("cmpCab").innerHTML = `<tr><th><button class="ordenar" data-ordem="categoria">Categoria</button></th>${span.map(m =>
    `<th class="num"><button class="ordenar" data-ordem="${m}">${mesCurto(m)}</button></th>`).join("")}<th class="num"><button class="ordenar" data-ordem="total">Total</button></th></tr>`;
  // cada linha leva os meses (meses), os valores do intervalo (vals) e do mês anterior a cada um (ants); cada mês também vira campo, para ordenar
  gradeComparar(cats.map(([c, total]) => ({ categoria: c, total, meses: span, vals: span.map(m => v(c, m)), ants: span.map(m => v(c, mesAnterior(m))),
    ...Object.fromEntries(span.map(m => [m, v(c, m)])) })));
}
// botão que abre os estabelecimentos; sem categoria vale todas, sem mês vale o intervalo
const detalhe = (rotulo, categoria, mes) => `<button class="detalhar" data-det${categoria ? ` data-categoria="${esc(categoria)}"` : ""}${mes ? ` data-mes="${mes}"` : ""}>${rotulo}</button>`;
const celula = (val, ant, categoria, mes) => `<td class="num mono">${val ? detalhe(brl(val), categoria, mes) : `<span class="fraco">—</span>`}<small>${variacao(val, ant)}</small></td>`;
const somaCol = (lista, campo, i) => lista.reduce((s, x) => s + x[campo][i], 0);
// o total soma só as categorias visíveis, para acompanhar a busca
const gradeComparar = grade({
  cab: "cmpCab", corpo: "cmpCategorias", busca: "buscaCmp", chaves: { categoria: x => x.categoria.toLowerCase() },
  ordem: { campo: "total", dir: -1 }, texto: x => x.categoria, vazio: "Nenhuma categoria com esses filtros.",
  linha: x => `<tr><td>${detalhe(esc(x.categoria), x.categoria)}</td>${x.vals.map((val, i) => celula(val, x.ants[i], x.categoria, x.meses[i])).join("")}<td class="num mono">${detalhe(brl(x.total), x.categoria)}</td></tr>`,
  resumo: lista => $("cmpTotal").innerHTML = lista.length ? `<tr><td>Total</td>${lista[0].vals.map((_, i) =>
    celula(somaCol(lista, "vals", i), somaCol(lista, "ants", i), null, lista[0].meses[i])).join("")}<td class="num mono">${detalhe(brl(lista.reduce((s, x) => s + x.total, 0)))}</td></tr>` : "",
});
for (const id of ["cmpDe", "cmpAte"]) $(id).addEventListener("change", renderComparar);

// clique numa categoria, num mês ou num total: os estabelecimentos que somaram aquilo, do que mais repete ao que menos
const gradeEstab = grade({
  cab: "cabEstab", corpo: "linhasEstab", busca: "buscaEstab", cartao: "cartaoEstab",
  chaves: { descricao: e => e.descricao.toLowerCase(), categoria: e => e.categoria.toLowerCase() },
  ordem: { campo: "vezes", dir: -1 }, texto: e => `${e.descricao} ${e.categoria}`, vazio: "Nenhum estabelecimento com esses filtros.",
  linha: e => `
    <tr>
      <td>${esc(e.descricao)}</td>
      <td>${esc(e.categoria)}</td>
      <td><span class="badge">${ponto(e.origem)}${esc(e.origem)}</span></td>
      <td class="num mono">${e.vezes}</td>
      <td class="num mono">${e.meses}</td>
      <td class="num mono">${brl(e.total)}</td>
    </tr>`,
  // o total acompanha a busca: buscar "ifood" soma todos os pedidos
  resumo: lista => $("totalEstab").innerHTML = `<tr><td colspan="3">Total · ${lista.length} ${lista.length === 1 ? "estabelecimento" : "estabelecimentos"}</td>
    <td class="num mono">${lista.reduce((s, e) => s + e.vezes, 0)}</td><td></td><td class="num mono">${brl(lista.reduce((s, e) => s + e.total, 0))}</td></tr>`,
});
$("cmp").addEventListener("click", e => {
  const b = e.target.closest("[data-det]");
  if (!b) return;
  const { categoria, mes } = b.dataset, meses = mes ? [mes] : mesesEntre($("cmpDe").value, $("cmpAte").value);
  $("tEstab").textContent = `${categoria ?? "Todas as categorias"} · ${mes ? nomeMes(mes) : `${nomeMes(meses[0])} a ${nomeMes(meses.at(-1))}`}`;
  gradeEstab(porEstabelecimento(todas.filter(t => ehGasto(t) && meses.includes(t.mes) && (!categoria || t.categoria === categoria))));
  $("dlgEstab").showModal();
});

// ---------- compromissos: parcelas que faltam e assinaturas ----------
// variação contra a cobrança anterior; abaixo de 1% é câmbio ou arredondamento, não reajuste
const reajuste = a => { const p = (a.valor - a.anterior) / a.anterior; return Math.abs(p) < 0.01 ? 0 : p; };
let abertas = [], ativas = [], noGrafico = [];
// simulação numa grid: desmarcar tira do total e o formulário acrescenta itens `nova`; só vale até recarregar a página
function simulador({ botao, tabela, form, corpo, chave, novo, pintar }) {
  const s = { ativo: false, cortadas: new Set(), novas: [] };
  s.lista = base => s.ativo ? [...base, ...s.novas] : base;
  s.fica = lista => s.ativo ? lista.filter(x => !s.cortadas.has(chave(x))) : lista;
  s.classe = x => s.ativo && s.cortadas.has(chave(x)) ? "cortada" : "";
  s.celula = x => `<td class="sim">${x.nova ? `<button class="btn link perigo" data-remover="${s.novas.indexOf(x)}" aria-label="Tirar ${esc(x.descricao)} da simulação">✕</button>`
    : `<input type="checkbox" data-sim="${esc(chave(x))}" ${s.cortadas.has(chave(x)) ? "" : "checked"} aria-label="Manter ${esc(x.descricao)}">`}</td>`;
  $(botao).addEventListener("click", e => {
    s.ativo = !s.ativo;
    e.currentTarget.setAttribute("aria-pressed", s.ativo);
    $(tabela).classList.toggle("simulando", s.ativo);
    $(form).hidden = !s.ativo;
    pintar();
  });
  $(form).addEventListener("submit", e => {
    e.preventDefault();
    s.novas.push({ nova: true, origem: "Simulação", ...novo(Object.fromEntries(new FormData(e.target))) });
    e.target.reset();
    pintar();
  });
  $(corpo).addEventListener("click", e => {
    const i = e.target.closest("[data-remover]")?.dataset.remover;
    if (i === undefined) return;
    s.novas.splice(i, 1);
    pintar();
  });
  $(corpo).addEventListener("change", e => {
    const k = e.target.dataset.sim;
    if (k === undefined) return;
    e.target.checked ? s.cortadas.delete(k) : s.cortadas.add(k);
    pintar();
  });
  return s;
}
const diferenca = (dif, unidade = "") => Math.abs(dif) < 0.005 ? "sem mudança" : dif > 0
  ? `<span class="delta sobe">▲ ${brl(dif)}${unidade} a mais</span>` : `<span class="delta desce">▼ economia de ${brl(-dif)}${unidade}</span>`;

async function carregarCompromissos() {
  [todas, financiamentos] = await Promise.all([api("GET", "/api/transacoes"), api("GET", "/api/financiamentos")]);
  abertas = emAberto();
  const porMes = parcelasPorMes(abertas);
  ativas = recorrentes(todas.filter(ehGasto));
  const mensal = ativas.reduce((s, a) => s + a.valor, 0);
  const subiram = ativas.filter(a => reajuste(a) > 0);
  const proximo = porMes.find(([m]) => m >= hoje().slice(0, 7));

  $("kpisCompromissos").innerHTML = `
    <div class="kpi destaque"><span>Parcelas a pagar</span><strong>${brl(abertas.reduce((s, p) => s + p.restante, 0))}</strong>
      <small>${abertas.length} ${abertas.length === 1 ? "parcelamento" : "parcelamentos"} em aberto</small></div>
    <div class="kpi"><span>Parcelas ${proximo ? `em ${nomeMes(proximo[0])}` : "no próximo mês"}</span><strong>${brl(proximo?.[1] ?? 0)}</strong><small>já comprometido</small></div>
    <div class="kpi"><span>Assinaturas por mês</span><strong>${brl(mensal)}</strong><small>${brl(mensal * 12)} por ano · ${ativas.length} ativas</small></div>
    <div class="kpi"><span>Subiram de preço</span><strong>${subiram.length}</strong><small>${esc(subiram.map(a => a.descricao).join(", ")) || "nenhuma"}</small></div>`;

  pintarParcelas();
  pintarAssinaturas();
}
// o gráfico acompanha a simulação: sem as compras desmarcadas e com as acrescentadas
function pintarParcelas() {
  const lista = simParcelas.lista(abertas);
  gradeParcelas(lista);
  noGrafico = simParcelas.fica(lista);
  const porMes = parcelasPorMes(noGrafico), topo = Math.max(...porMes.map(([, v]) => v), 1);
  $("parcelasSimuladas").hidden = !simParcelas.ativo;
  $("parcelasMes").hidden = !porMes.length;
  $("semParcelas").hidden = porMes.length > 0;
  $("parcelasMes").innerHTML = porMes.map(([m, v]) => `
    <button class="coluna" data-mes="${m}" title="${nomeMes(m)}: ${brl(v)}" aria-label="Ver parcelas de ${nomeMes(m)}: ${brl(v)}">
      <span class="valor">${brl(v).replace(/,\d\d$/, "")}</span>
      <span class="pilar cheio" style="height:${(v / topo * 100).toFixed(1)}%"></span>
      <span class="rotulo">${mesCurto(m)}</span>
    </button>`).join("");
}
const simParcelas = simulador({
  botao: "simularParcelas", tabela: "tabelaParcelas", form: "parcelaForm", corpo: "linhasParcelas", pintar: pintarParcelas,
  chave: p => `${p.origem}|${p.descricao}|${p.fim}|${p.parcela_total}`,
  // shortcut: a 1ª parcela simulada cai no mês que vem; não olha o fechamento do cartão
  novo: ({ descricao, valor, parcelas }) => { const mes = hoje().slice(0, 7), n = Number(parcelas);
    return { descricao: descricao.trim(), valor: Number(valor), parcela_atual: 0, parcela_total: n, faltam: n, mes, fim: somarMeses(mes, n), restante: n * Number(valor) }; },
});
const gradeParcelas = grade({
  cab: "cabParcelas", corpo: "linhasParcelas", busca: "buscaParcelas", cartao: "cartaoParcelas",
  chaves: { descricao: p => p.descricao.toLowerCase() },
  ordem: { campo: "restante", dir: -1 }, texto: p => p.descricao, colunas: 7, vazio: "Nenhuma compra parcelada em aberto.",
  linha: p => `
    <tr class="${simParcelas.classe(p)}">
      ${simParcelas.celula(p)}
      <td>${esc(p.descricao)}${p.financiamento ? ` <button class="icone" data-financiamento="${p.id}">editar</button>` : ""}</td>
      <td><span class="badge">${ponto(p.origem)}${esc(p.origem)}</span></td>
      <td class="mono">${p.nova ? `<span class="delta sobe">+ simulada</span> <span class="fraco">· ${p.faltam}x</span>` : `${p.parcela_atual}/${p.parcela_total} <span class="fraco">· faltam ${p.faltam}</span>`}</td>
      <td class="num mono">${brl(p.valor)}</td>
      <td>${nomeMes(p.fim)}</td>
      <td class="num mono">${brl(p.restante)}</td>
    </tr>`,
  // o total acompanha a busca e o cartão
  resumo: lista => { const reais = lista.filter(p => !p.nova), fica = simParcelas.fica(lista);
    const mes = l => l.reduce((s, p) => s + p.valor, 0), resta = l => l.reduce((s, p) => s + p.restante, 0);
    $("totalParcelas").innerHTML = `<tr><td class="sim"></td><td colspan="3">Total · ${reais.length} ${reais.length === 1 ? "compra" : "compras"}</td>
      <td class="num mono">${brl(mes(reais))}</td><td></td><td class="num mono">${brl(resta(reais))}</td></tr>` + (simParcelas.ativo ? `
      <tr><td class="sim"></td><td colspan="3">Simulado · ${fica.length} ${fica.length === 1 ? "compra" : "compras"} · ${diferenca(resta(fica) - resta(reais))}</td>
      <td class="num mono">${brl(mes(fica))}</td><td></td><td class="num mono">${brl(resta(fica))}</td></tr>` : ""); },
});

// financiamento: cadastrado à mão, entra nas parcelas como se fosse uma compra parcelada
function abrirFinanciamento(f = {}) {
  const form = $("formFinanciamento");
  form.dataset.id = f.id ?? "";
  $("tFinanciamento").textContent = f.id ? "Editar financiamento" : "Novo financiamento";
  $("apagarFinanciamento").hidden = !f.id;
  for (const k of ["descricao", "valor", "parcela_total", "abatidas"]) form.elements[k].value = f[k] || "";
  form.elements.primeira.value = f.primeira?.slice(0, 7) ?? "";
  previaFinanciamento();
  $("dlgFinanciamento").showModal();
}
function previaFinanciamento() {
  const { valor, parcela_total, primeira, abatidas } = Object.fromEntries(new FormData($("formFinanciamento")));
  const ok = /^\d{4}-\d{2}$/.test(primeira) && valor > 0 && Number.isInteger(+parcela_total) && parcela_total > 0
    && Number.isInteger(+abatidas) && +abatidas >= 0 && +abatidas < +parcela_total;
  const [p] = ok ? parcelasFinanciadas([{ descricao: "", valor, parcela_total: +parcela_total, primeira, abatidas: +abatidas }], hoje().slice(0, 7)) : [];
  $("previaFinanciamento").textContent = !ok ? ""
    : p ? `${p.parcela_atual} de ${p.parcela_total} pagas${p.abatidas ? ` (${p.abatidas} abatidas)` : ""} · faltam ${p.faltam} (${brl(p.restante)}) · última em ${nomeMes(p.fim)}.`
    : "Todas as parcelas já passaram: não entra nos compromissos.";
}
$("formFinanciamento").addEventListener("input", previaFinanciamento);
$("novoFinanciamento").addEventListener("click", () => abrirFinanciamento());
$("linhasParcelas").addEventListener("click", e => {
  const id = e.target.closest("[data-financiamento]")?.dataset.financiamento;
  if (id) abrirFinanciamento(financiamentos.find(f => f.id === +id));
});
$("dlgFinanciamento").addEventListener("close", tentar(async () => {
  const r = $("dlgFinanciamento").returnValue, f = $("formFinanciamento");
  if (r === "apagar") {
    if (!confirm(`Excluir ${f.elements.descricao.value}?`)) return;
    await api("DELETE", `/api/financiamentos?id=${f.dataset.id}`);
    status("Financiamento excluído.");
  } else if (r === "ok") {
    await json("POST", "/api/financiamentos", { ...Object.fromEntries(new FormData(f)), id: f.dataset.id || null });
    status("Financiamento salvo.");
  } else return;
  await carregarCompromissos();
}));

const situacao = a => reajuste(a) > 0 ? `<span class="delta sobe">▲ subiu de ${brl(a.anterior)}</span>`
  : reajuste(a) < 0 ? `<span class="delta desce">▼ caiu de ${brl(a.anterior)}</span>` : "Ativa";
const pintarAssinaturas = () => gradeAssinaturas(simAssinaturas.lista(ativas));
const simAssinaturas = simulador({
  botao: "simularAssinaturas", tabela: "tabelaAssinaturas", form: "acrescimoForm", corpo: "linhasAssinaturas", pintar: pintarAssinaturas,
  chave: a => `${a.origem}|${a.descricao}`,
  // anterior = valor: sem reajuste, para a ordenação por situação não dividir por zero
  novo: ({ descricao, valor }) => ({ descricao: descricao.trim(), valor: Number(valor), anterior: Number(valor), categoria: "Assinaturas", meses: 0 }),
});
const gradeAssinaturas = grade({
  cab: "cabAssinaturas", corpo: "linhasAssinaturas", busca: "buscaAssinaturas", cartao: "cartaoAssinaturas",
  chaves: { descricao: a => a.descricao.toLowerCase(), ano: a => a.valor, reajuste },
  ordem: { campo: "valor", dir: -1 }, texto: a => `${a.descricao} ${a.categoria}`, colunas: 8, vazio: "Nenhuma cobrança recorrente encontrada.",
  linha: a => `
    <tr class="${simAssinaturas.classe(a)}">
      ${simAssinaturas.celula(a)}
      <td>${esc(a.descricao)}</td>
      <td><span class="tag">${esc(a.categoria)}</span></td>
      <td><span class="badge">${ponto(a.origem)}${esc(a.origem)}</span></td>
      <td class="num mono">${a.nova ? "—" : a.meses}</td>
      <td class="num mono">${brl(a.valor)}</td>
      <td class="num mono">${brl(a.valor * 12)}</td>
      <td>${a.nova ? `<span class="delta sobe">+ simulada</span>` : situacao(a)}</td>
    </tr>`,
  resumo: lista => { const reais = lista.filter(a => !a.nova), fica = simAssinaturas.fica(lista);
    const mes = reais.reduce((s, a) => s + a.valor, 0), sim = fica.reduce((s, a) => s + a.valor, 0);
    $("totalAssinaturas").innerHTML = `<tr><td class="sim"></td><td colspan="4">Total · ${reais.length} ${reais.length === 1 ? "assinatura" : "assinaturas"}</td>
      <td class="num mono">${brl(mes)}</td><td class="num mono">${brl(mes * 12)}</td><td></td></tr>` + (simAssinaturas.ativo ? `
      <tr><td class="sim"></td><td colspan="4">Simulado · ${fica.length} ${fica.length === 1 ? "assinatura" : "assinaturas"}</td>
      <td class="num mono">${brl(sim)}</td><td class="num mono">${brl(sim * 12)}</td><td>${diferenca(sim - mes, "/mês")}</td></tr>` : ""); },
});

// clique numa coluna: as parcelas que caem naquele mês, com o nº que a parcela terá lá
const gradeParcelasMes = grade({
  cab: "cabParcelasMes", corpo: "linhasParcelasMes", busca: "buscaParcelasMes", cartao: "cartaoParcelasMes",
  chaves: { descricao: p => p.descricao.toLowerCase(), origem: p => p.origem, parcela: p => p.parcela_total - p.n, valor: p => p.valor },
  ordem: { campo: "valor", dir: -1 }, texto: p => p.descricao, colunas: 4, vazio: "Nenhuma parcela com esses filtros.",
  linha: p => `
    <tr>
      <td>${esc(p.descricao)}</td>
      <td><span class="badge">${ponto(p.origem)}${esc(p.origem)}</span></td>
      <td class="mono">${p.n}/${p.parcela_total}</td>
      <td class="num mono">${brl(p.valor)}</td>
    </tr>`,
  resumo: lista => $("totalParcelasMes").innerHTML = `<tr><td colspan="3">Total · ${lista.length} ${lista.length === 1 ? "parcela" : "parcelas"}</td>
    <td class="num mono">${brl(lista.reduce((s, p) => s + p.valor, 0))}</td></tr>`,
});
$("parcelasMes").addEventListener("click", e => {
  const m = e.target.closest(".coluna")?.dataset.mes;
  if (!m) return;
  $("tParcelasMes").textContent = `Parcelas de ${nomeMes(m)}`;
  gradeParcelasMes(parcelasDoMes(noGrafico, m));
  $("dlgParcelasMes").showModal();
});

// ---------- novidades: notas de cada versão (CHANGELOG.md); ponto no menu enquanto houver versão não vista ----------
let versao = "", releases = [];
const VISTA = "versaoVista";
const vista = () => { try { return localStorage.getItem(VISTA); } catch { return null; } };
function pintarVersao() {
  $("versao").hidden = !versao;
  $("versao").innerHTML = `v${esc(versao)}${vista() !== versao ? `<span class="ponto-novo" aria-label="versão nova"></span>` : ""}`;
}
function md(src) { // o markdown do CHANGELOG: ### título, - item, **negrito**, `código`; escapa antes
  const inline = t => esc(t).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  let html = "", lista = false;
  for (const l of src.split("\n")) {
    const li = l.match(/^\s*- (.*)/);
    if (!li && lista && !/^\s{2,}\S/.test(l)) { html += "</ul>"; lista = false; }
    if (li) { if (!lista) { html += "<ul>"; lista = true; } html += `<li>${inline(li[1])}`; }
    else if (lista && l.trim()) html += ` ${inline(l.trim())}`; // continuação do item na linha de baixo
    else if (l.startsWith("### ")) html += `<h3>${inline(l.slice(4))}</h3>`;
    else if (l.trim()) html += `<p>${inline(l)}</p>`;
  }
  return html + (lista ? "</ul>" : "");
}
async function carregarNovidades() {
  if (!releases.length) ({ versao, releases } = await api("GET", "/api/releases"));
  try { localStorage.setItem(VISTA, versao); } catch {}
  pintarVersao();
  $("novidades").innerHTML = releases.map(r => `<article class="card release"><div class="card-topo"><div><h2>v${esc(r.versao)}</h2>
    <p class="sub">${r.data ? dataBr(r.data) : ""}${r.versao === versao ? " · versão atual" : ""}</p></div></div>${md(r.notas)}</article>`).join("")
    || `<p class="fraco">Sem notas de versão.</p>`;
}
api("GET", "/api/releases").then(r => { ({ versao, releases } = r); pintarVersao(); }).catch(() => {});

// ---------- assistente: chat com o modelo local ----------
// só em memória: recarregar a página começa conversa nova
let conversa = [];
const bolha = (role, html) => {
  $("conversa").insertAdjacentHTML("beforeend", `<div class="msg ${role}">${html}</div>`);
  return $("conversa").lastElementChild;
};
async function perguntar(texto) {
  if (!texto.trim() || $("btnChat").disabled) return;
  $("sugestoes").hidden = true;
  conversa.push({ role: "user", content: texto.trim() });
  bolha("user", esc(texto.trim()));
  const resposta = bolha("assistant", `<p class="fraco">Pensando…</p>`);
  $("pergunta").value = "";
  $("btnChat").disabled = true;
  try {
    const r = await fetch("/api/chat", { method: "POST", body: JSON.stringify({ mensagens: conversa }) });
    if (!r.ok) throw new Error((await r.json()).erro);
    const leitor = r.body.pipeThrough(new TextDecoderStream()).getReader();
    let txt = "";
    for (let p; !(p = await leitor.read()).done;) {
      resposta.innerHTML = md(txt += p.value);
      $("conversa").scrollTop = $("conversa").scrollHeight; // rola só o painel, não a página por trás
    }
    conversa.push({ role: "assistant", content: txt });
  } catch (err) {
    conversa.pop(); // pergunta sem resposta não vai no histórico
    resposta.classList.add("erro");
    resposta.textContent = err.message;
  } finally {
    $("btnChat").disabled = false;
    $("pergunta").focus();
  }
}
$("formChat").addEventListener("submit", e => { e.preventDefault(); perguntar($("pergunta").value); });
$("pergunta").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); perguntar($("pergunta").value); }
});
$("sugestoes").addEventListener("click", e => e.target.closest("button") && perguntar(e.target.textContent));
// painel flutuante: abre por cima de qualquer tela, conversa continua ao navegar
const mostrarChat = abrir => {
  $("chatFlutuante").hidden = !abrir;
  $("abrirChat").setAttribute("aria-expanded", abrir);
  if (abrir) $("pergunta").focus(); else $("abrirChat").focus();
};
$("abrirChat").addEventListener("click", () => mostrarChat($("chatFlutuante").hidden));
$("fecharChat").addEventListener("click", () => mostrarChat(false));
$("chatFlutuante").addEventListener("keydown", e => e.key === "Escape" && mostrarChat(false));
$("limparChat").addEventListener("click", () => {
  conversa = [];
  $("conversa").querySelectorAll(".msg").forEach(m => m.remove());
  $("sugestoes").hidden = false;
});

// ---------- configurações: regras de categoria ----------
let regras = [];
const casa = (padrao, descricao) => { try { return new RegExp(padrao, "i").test(descricao); } catch { return false; } };

async function carregarRegras() {
  [regras, todas, limites] = await Promise.all([api("GET", "/api/regras"), api("GET", "/api/transacoes"), api("GET", "/api/orcamentos")]);
  atualizarCategorias();
  renderRegras();
  renderOrcamentos();
}

function renderRegras() {
  // quantos lançamentos cada regra classifica de fato (a primeira que casa vence)
  const usos = new Map();
  for (const t of todas) {
    const r = regras.find(r => casa(r.padrao, t.descricao));
    if (r) usos.set(r.id, (usos.get(r.id) ?? 0) + 1);
  }
  gradeRegras(regras.map((r, i) => ({ ...r, pos: i + 1, usos: usos.get(r.id) ?? 0 })));
}
// "#" é a prioridade: a ordem padrão é a da lista, e subir/descer mexe na prioridade, não na ordem exibida
const gradeRegras = grade({
  cab: "cabRegras", corpo: "linhasRegras", busca: "buscaRegra",
  chaves: { padrao: r => r.padrao.toLowerCase(), categoria: r => r.categoria.toLowerCase() },
  ordem: { campo: "pos", dir: 1 }, texto: r => `${r.padrao} ${r.categoria}`, colunas: 5, vazio: "Nenhuma regra.",
  linha: r => `
    <tr>
      <td class="num mono fraco">${r.pos}</td>
      <td class="mono">${esc(r.padrao)}</td>
      <td><span class="tag">${esc(r.categoria)}</span></td>
      <td class="num mono ${r.usos ? "" : "fraco"}">${r.usos}</td>
      <td class="acoes">
        <button class="icone" data-passo="-1" data-id="${r.id}" ${r.pos > 1 ? "" : "disabled"} aria-label="Subir prioridade">↑</button>
        <button class="icone" data-passo="1" data-id="${r.id}" ${r.pos < regras.length ? "" : "disabled"} aria-label="Descer prioridade">↓</button>
        <button class="icone" data-editar="${r.id}">editar</button>
        <button class="icone perigo" data-apagar="${r.id}">excluir</button>
      </td>
    </tr>`,
});

function abrirRegra(r = {}) {
  const f = $("formRegra");
  f.dataset.id = r.id ?? "";
  $("tRegra").textContent = r.id ? "Editar regra" : "Nova regra";
  f.elements.padrao.value = r.padrao ?? "";
  f.elements.categoria.value = r.categoria ?? "";
  previaRegra();
  $("dlgRegra").showModal();
}
function previaRegra() {
  const f = $("formRegra"), p = f.elements.padrao.value.trim();
  let msg = f.dataset.id ? "Editar mantém a posição na lista." : "Regra nova entra no topo da lista e vence as outras.";
  if (p) {
    try { new RegExp(p); msg = `Casa com ${todas.filter(t => casa(p, t.descricao)).length} lançamentos. ${msg}`; }
    catch { msg = "Regex inválida."; }
  }
  $("previaRegra").textContent = msg;
}
$("formRegra").elements.padrao.addEventListener("input", previaRegra);
$("novaRegra").addEventListener("click", () => abrirRegra());
$("linhasRegras").addEventListener("click", tentar(async e => {
  const b = e.target.closest("button");
  const r = b && regras.find(r => r.id === +(b.dataset.id ?? b.dataset.editar ?? b.dataset.apagar));
  if (!r) return;
  if (b.dataset.editar) return abrirRegra(r);
  if (b.dataset.passo) await json("POST", "/api/regras/mover", { id: r.id, passo: +b.dataset.passo });
  else {
    if (!confirm(`Excluir a regra ${r.padrao}?`)) return;
    await api("DELETE", `/api/regras?id=${r.id}`);
    status("Regra excluída.");
  }
  await carregarRegras();
}));
$("dlgRegra").addEventListener("close", tentar(async () => {
  if ($("dlgRegra").returnValue !== "ok") return;
  const f = $("formRegra");
  await json("POST", "/api/regras", { id: f.dataset.id || null, padrao: f.elements.padrao.value, categoria: f.elements.categoria.value });
  status("Regra salva.");
  await carregarRegras();
}));

// ---------- configurações: orçamento por categoria ----------
// média dos 3 últimos meses com fatura, para ajudar a escolher o limite
function mediaRecente(categoria) {
  const gs = todas.filter(ehGasto), ultimos = [...new Set(gs.map(t => t.mes))].sort().slice(-3);
  return soma(gs.filter(t => t.categoria === categoria && ultimos.includes(t.mes))) / (ultimos.length || 1);
}
const renderOrcamentos = () => gradeOrcamento(limites.map(o => ({ ...o, media: mediaRecente(o.categoria) })));
const gradeOrcamento = grade({
  cab: "cabOrcamento", corpo: "linhasOrcamento", busca: "buscaOrcamento", chaves: { categoria: o => o.categoria.toLowerCase() },
  ordem: { campo: "categoria", dir: 1 }, texto: o => o.categoria, colunas: 4,
  vazio: "Nenhum limite. Defina quanto quer gastar por mês em cada categoria.",
  linha: o => `
    <tr>
      <td><span class="tag">${esc(o.categoria)}</span></td>
      <td class="num mono">${brl(o.limite)}</td>
      <td class="num mono fraco">${brl(o.media)}</td>
      <td class="acoes"><button class="icone" data-editar="${esc(o.categoria)}">editar</button><button class="icone perigo" data-apagar="${esc(o.categoria)}">excluir</button></td>
    </tr>`,
});
function abrirOrcamento(o = {}) {
  const f = $("formOrcamento");
  $("tLimite").textContent = o.categoria ? "Editar limite" : "Novo limite";
  f.elements.categoria.value = o.categoria ?? "";
  f.elements.categoria.readOnly = !!o.categoria; // a categoria é a chave: trocar é excluir e criar outro
  f.elements.limite.value = o.limite ?? "";
  previaOrcamento();
  $("dlgOrcamento").showModal();
  if (o.categoria) f.elements.limite.focus();
}
function previaOrcamento() {
  const c = $("formOrcamento").elements.categoria.value.trim();
  $("previaOrcamento").textContent = c ? `Média de ${c} nos últimos 3 meses: ${brl(mediaRecente(c))}.` : "";
}
$("formOrcamento").elements.categoria.addEventListener("input", previaOrcamento);
$("novoOrcamento").addEventListener("click", () => abrirOrcamento());
$("linhasOrcamento").addEventListener("click", tentar(async e => {
  const b = e.target.closest("button");
  const o = b && limites.find(o => o.categoria === (b.dataset.editar ?? b.dataset.apagar));
  if (!o) return;
  if (b.dataset.editar) return abrirOrcamento(o);
  if (!confirm(`Excluir o limite de ${o.categoria}?`)) return;
  await api("DELETE", `/api/orcamentos?categoria=${encodeURIComponent(o.categoria)}`);
  status("Limite excluído.");
  await carregarRegras();
}));
$("dlgOrcamento").addEventListener("close", tentar(async () => {
  if ($("dlgOrcamento").returnValue !== "ok") return;
  await json("POST", "/api/orcamentos", Object.fromEntries(new FormData($("formOrcamento"))));
  status("Limite salvo.");
  await carregarRegras();
}));

// ---------- gastos manuais ----------
async function carregarGastos() {
  [gastos, cartoes] = await Promise.all([api("GET", "/api/gastos"), api("GET", "/api/cartoes")]);
  const meses = [...new Set([hoje().slice(0, 7), ...gastos.map(g => g.data.slice(0, 7))])].sort().reverse();
  const atual = $("mesGastos").value || hoje().slice(0, 7);
  $("mesGastos").innerHTML = meses.map(m => `<option value="${m}">${nomeMes(m)}</option>`).join("") + `<option value="">Todo o período</option>`;
  $("mesGastos").value = meses.includes(atual) || atual === "" ? atual : meses[0];
  if (!todas.length) todas = await api("GET", "/api/transacoes"); // só para sugerir categorias
  atualizarCategorias();
  renderGastos();
}

function renderGastos() {
  const mes = $("mesGastos").value;
  const doMes = m => gastos.filter(g => !m || g.data.startsWith(m));
  const lista = doMes(mes);
  const total = lista.reduce((s, g) => s + g.valor, 0);
  const noCartao = lista.filter(g => g.cartao_id).reduce((s, g) => s + g.valor, 0);
  const porCat = Object.entries(lista.reduce((a, g) => (a[g.categoria] = (a[g.categoria] ?? 0) + g.valor, a), {})).sort((a, b) => b[1] - a[1]);
  const anterior = mes && mesAnterior(mes);
  $("kpisGastos").innerHTML = `
    <div class="kpi destaque"><span>Gasto ${mes ? `em ${nomeMes(mes)}` : "no período"}</span><strong>${brl(total)}</strong>
      ${mes ? delta(total, doMes(anterior).reduce((s, g) => s + g.valor, 0), anterior) : `<small>${lista.length} lançamentos</small>`}</div>
    <div class="kpi"><span>Pix, dinheiro, débito</span><strong>${brl(total - noCartao)}</strong><small>${total ? ((total - noCartao) / total * 100).toFixed(0) : 0}% do mês</small></div>
    <div class="kpi"><span>No cartão</span><strong>${brl(noCartao)}</strong><small>${total ? (noCartao / total * 100).toFixed(0) : 0}% do mês</small></div>
    <div class="kpi"><span>Maior categoria</span><strong>${porCat[0] ? brl(porCat[0][1]) : "—"}</strong><small>${esc(porCat[0]?.[0] ?? "nenhum gasto")}</small></div>`;
  // origem: o filtro de cartão da grade separa por ela
  gradeGastos(lista.map(g => ({ ...g, origem: g.cartao ?? "Pix / dinheiro / débito" })));
}
const gradeGastos = grade({
  cab: "cabGastos", corpo: "linhasGastos", busca: "buscaGastos", cartao: "cartaoGastos",
  chaves: { descricao: g => g.descricao.toLowerCase(), categoria: g => g.categoria.toLowerCase() },
  ordem: { campo: "data", dir: -1 }, texto: g => `${g.descricao} ${g.categoria}`, colunas: 6, vazio: "Nenhum gasto com esses filtros.",
  linha: g => `
    <tr>
      <td class="mono">${dataBr(g.data)}</td>
      <td>${esc(g.descricao)}</td>
      <td><span class="tag">${esc(g.categoria)}</span></td>
      <td>${g.cartao ? `<span class="badge"><i class="ponto" style="--cor:${esc(g.cor)}"></i>${esc(g.cartao)}</span>` : `<span class="fraco">${g.origem}</span>`}</td>
      <td class="num mono">${brl(g.valor)}</td>
      <td class="acoes"><button class="icone" data-editar="${g.id}">editar</button><button class="icone perigo" data-apagar="${g.id}">excluir</button></td>
    </tr>`,
});

function abrirGasto(g = { data: hoje() }) {
  const f = $("formGasto");
  f.dataset.id = g.id ?? "";
  $("tGasto").textContent = g.id ? "Editar gasto" : "Novo gasto";
  // cartão inativo continua na lista só se for o do gasto em edição
  $("gastoCartao").innerHTML = `<option value="">Pix, dinheiro ou débito</option>` + cartoes.filter(c => c.ativo || c.id === g.cartao_id)
    .map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join("");
  for (const k of ["data", "valor", "descricao", "categoria"]) f.elements[k].value = g[k] ?? "";
  f.elements.cartao_id.value = g.cartao_id ?? "";
  $("dlgGasto").showModal();
}
$("novoGasto").addEventListener("click", () => abrirGasto());
$("mesGastos").addEventListener("change", renderGastos);
$("linhasGastos").addEventListener("click", tentar(async e => {
  const editar = e.target.closest("[data-editar]")?.dataset.editar;
  if (editar) return abrirGasto(gastos.find(g => g.id === +editar));
  const apagar = e.target.closest("[data-apagar]")?.dataset.apagar;
  if (!apagar || !confirm("Excluir este gasto?")) return;
  await api("DELETE", `/api/gastos?id=${apagar}`);
  status("Gasto excluído.");
  await carregarGastos();
}));
$("dlgGasto").addEventListener("close", tentar(async () => {
  if ($("dlgGasto").returnValue !== "ok") return;
  const f = $("formGasto");
  await json("POST", "/api/gastos", { ...Object.fromEntries(new FormData(f)), id: f.dataset.id || null });
  status("Gasto salvo.");
  todas = [];
  await carregarGastos();
}));

// ---------- importar ----------
async function carregarImportacoes() {
  const [imps, cs] = await Promise.all([api("GET", "/api/importacoes"), api("GET", "/api/cartoes")]);
  cartoes = cs;
  const atual = $("cartaoImportar").value;
  $("cartaoImportar").innerHTML = cartoes.filter(c => c.ativo).map(c => `<option value="${c.id}">${esc(c.nome)}</option>`).join("")
    + `<option value="">Conta corrente (sem cartão)</option>`;
  if (atual && [...$("cartaoImportar").options].some(o => o.value === atual)) $("cartaoImportar").value = atual;
  gradeImportacoes(imps);
}
const gradeImportacoes = grade({
  cab: "cabImportacoes", corpo: "linhasImportacoes", busca: "buscaImportacoes", cartao: "cartaoImportacoes",
  chaves: { arquivo: i => (i.arquivo ?? "").toLowerCase(), gasto: i => i.gasto ?? 0, em: i => new Date(i.em).getTime() },
  ordem: { campo: "em", dir: -1 }, texto: i => `${i.arquivo ?? ""} ${i.origem}`, colunas: 7, vazio: "Nenhuma importação com esses filtros.",
  linha: i => `
    <tr>
      <td class="mono">${esc(i.arquivo ?? "—")}</td>
      <td><span class="badge"><i class="ponto" style="--cor:${esc(i.cor ?? cor(i.origem))}"></i>${esc(i.origem)}</span></td>
      <td class="mono fraco">${dataBr(i.de)} – ${dataBr(i.ate)}</td>
      <td class="num mono">${i.lancamentos}</td>
      <td class="num mono">${brl(i.gasto ?? 0)}</td>
      <td class="fraco">${new Date(i.em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
      <td class="acoes">${i.arquivo ? `<button class="icone perigo" data-arquivo="${esc(i.arquivo)}">excluir</button>` : ""}</td>
    </tr>`,
});

function arquivosEscolhidos() {
  const fs = [...$("arquivos").files];
  $("escolhidos").textContent = fs.map(f => f.name).join(", ");
  $("btnImportar").disabled = !fs.length;
  // sugere o cartão pelo banco no nome do arquivo; o usuário confirma
  const nome = semAcento(fs.map(f => f.name).join(" "));
  const c = cartoes.find(c => c.ativo && nome.includes(semAcento(c.banco)));
  if (c) $("cartaoImportar").value = c.id;
}
$("arquivos").addEventListener("change", arquivosEscolhidos);
for (const ev of ["dragenter", "dragover"]) $("soltar").addEventListener(ev, e => { e.preventDefault(); $("soltar").classList.add("sobre"); });
for (const ev of ["dragleave", "drop"]) $("soltar").addEventListener(ev, () => $("soltar").classList.remove("sobre"));
$("soltar").addEventListener("drop", e => { e.preventDefault(); $("arquivos").files = e.dataTransfer.files; arquivosEscolhidos(); });

$("formImportar").addEventListener("submit", tentar(async e => {
  e.preventDefault();
  $("btnImportar").disabled = true;
  const msgs = [];
  for (const f of $("arquivos").files) {
    try {
      const r = await api("POST", `/api/importar?nome=${encodeURIComponent(f.name)}&cartao=${$("cartaoImportar").value}`, f);
      msgs.push(`${f.name}: ${r.novas} novos de ${r.lidas}`);
    } catch (err) {
      msgs.push(`${f.name}: ${err.message}`);
    }
  }
  $("arquivos").value = "";
  arquivosEscolhidos();
  status(msgs.join(" · "), msgs.some(m => !/novos de/.test(m)));
  todas = [];
  await carregarImportacoes();
}));
$("linhasImportacoes").addEventListener("click", tentar(async e => {
  const arquivo = e.target.closest("[data-arquivo]")?.dataset.arquivo;
  if (!arquivo || !confirm(`Excluir todos os lançamentos de ${arquivo}? Dá para importar de novo depois.`)) return;
  const r = await api("DELETE", `/api/importacoes?arquivo=${encodeURIComponent(arquivo)}`);
  status(`${r.apagados} lançamentos excluídos.`);
  await carregarImportacoes();
}));

// ---------- cartões ----------
async function carregarCartoes() {
  cartoes = await api("GET", "/api/cartoes");
  $("listaCartoes").innerHTML = cartoes.map(c => `
    <article class="cartao ${c.ativo ? "" : "inativo"}" style="--cor:${esc(c.cor)}">
      <div class="face"><div><strong>${esc(c.nome)}</strong>${c.banco === c.nome ? "" : `<br><span>${esc(c.banco)}</span>`}</div><i class="chipcard"></i></div>
      <div class="info">
        <span><span class="situacao ${c.ativo ? "on" : "off"}">${c.ativo ? "Ativo" : "Inativo"}</span> · <span class="fraco">${c.lancamentos} lançamentos</span></span>
        <span>
          <button class="icone" data-editar="${c.id}">editar</button>
          <button class="icone" data-alternar="${c.id}">${c.ativo ? "desativar" : "ativar"}</button>
          ${c.lancamentos ? "" : `<button class="icone perigo" data-apagar="${c.id}">excluir</button>`}
        </span>
      </div>
    </article>`).join("") || `<p class="fraco">Nenhum cartão cadastrado.</p>`;
}

function abrirCartao(c = { cor: "#008f63", ativo: true }) {
  const f = $("formCartao");
  f.dataset.id = c.id ?? "";
  $("tCartao").textContent = c.id ? "Editar cartão" : "Novo cartão";
  for (const k of ["nome", "banco", "cor"]) f.elements[k].value = c[k] ?? "";
  f.elements.ativo.checked = c.ativo;
  $("dlgCartao").showModal();
}
$("novoCartao").addEventListener("click", () => abrirCartao());
$("listaCartoes").addEventListener("click", tentar(async e => {
  const b = e.target.closest("button");
  const c = b && cartoes.find(c => c.id === +(b.dataset.editar ?? b.dataset.alternar ?? b.dataset.apagar));
  if (!c) return;
  if (b.dataset.editar) return abrirCartao(c);
  if (b.dataset.alternar) {
    await json("POST", "/api/cartoes", { ...c, ativo: !c.ativo });
    status(`${c.nome} ${c.ativo ? "desativado" : "ativado"}.`);
  } else {
    if (!confirm(`Excluir o cartão ${c.nome}?`)) return;
    await api("DELETE", `/api/cartoes?id=${c.id}`);
    status("Cartão excluído.");
  }
  todas = [];
  await carregarCartoes();
}));
$("dlgCartao").addEventListener("close", tentar(async () => {
  if ($("dlgCartao").returnValue !== "ok") return;
  const f = $("formCartao");
  await json("POST", "/api/cartoes", { id: f.dataset.id || null, nome: f.elements.nome.value, banco: f.elements.banco.value,
    cor: f.elements.cor.value, ativo: f.elements.ativo.checked });
  status("Cartão salvo.");
  todas = [];
  await carregarCartoes();
}));

rota();
