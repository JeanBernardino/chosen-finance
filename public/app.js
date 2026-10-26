// Front: busca tudo uma vez e agrega no navegador (volume pessoal cabe com folga).
const FORA_DOS_GASTOS = ["Pagamento de fatura", "Transferência entre contas"];
const $ = id => document.getElementById(id);
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format;
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

let todas = [], cartoes = [], gastos = [], categoriaAtiva = null;

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

// ---------- navegação e tema ----------
const VIEWS = { painel: () => carregar(), gastos: () => carregarGastos(), importar: () => carregarImportacoes(), cartoes: () => carregarCartoes(),
  config: () => carregarRegras() };
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

// ---------- painel ----------
async function carregar() {
  [todas, cartoes] = await Promise.all([api("GET", "/api/transacoes"), api("GET", "/api/cartoes")]);
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
    <div class="kpi"><span>Parcelas a pagar</span><strong>${brl(parcelasFuturas(todas))}</strong><small>soma das próximas parcelas</small></div>
    <div class="kpi"><span>Sem categoria</span><strong>${brl(soma(sem))}</strong><small>${sem.length} lançamentos para classificar</small></div>`;
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

// Quanto falta das compras parceladas, pela última parcela vista de cada compra.
function parcelasFuturas(lista) {
  const ultima = new Map();
  for (const t of lista.filter(t => t.parcela_total && t.valor < 0)) {
    const k = [t.origem, t.descricao, t.parcela_total, t.valor].join("|");
    if ((ultima.get(k)?.parcela_atual ?? 0) < t.parcela_atual) ultima.set(k, t);
  }
  return [...ultima.values()].reduce((s, t) => s + (t.parcela_total - t.parcela_atual) * -t.valor, 0);
}

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
$("categorias").addEventListener("click", e => {
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

// ---------- configurações: regras de categoria ----------
let regras = [];
const casa = (padrao, descricao) => { try { return new RegExp(padrao, "i").test(descricao); } catch { return false; } };

async function carregarRegras() {
  [regras, todas] = await Promise.all([api("GET", "/api/regras"), api("GET", "/api/transacoes")]);
  atualizarCategorias();
  renderRegras();
}

function renderRegras() {
  // quantos lançamentos cada regra classifica de fato (a primeira que casa vence)
  const usos = new Map();
  for (const t of todas) {
    const r = regras.find(r => casa(r.padrao, t.descricao));
    if (r) usos.set(r.id, (usos.get(r.id) ?? 0) + 1);
  }
  const busca = $("buscaRegra").value.trim().toLowerCase();
  $("linhasRegras").innerHTML = regras.map((r, i) => [r, i])
    .filter(([r]) => !busca || `${r.padrao} ${r.categoria}`.toLowerCase().includes(busca))
    .map(([r, i]) => `
    <tr>
      <td class="num mono fraco">${i + 1}</td>
      <td class="mono">${esc(r.padrao)}</td>
      <td><span class="tag">${esc(r.categoria)}</span></td>
      <td class="num mono ${usos.get(r.id) ? "" : "fraco"}">${usos.get(r.id) ?? 0}</td>
      <td class="acoes">
        <button class="icone" data-passo="-1" data-id="${r.id}" ${i ? "" : "disabled"} aria-label="Subir prioridade">↑</button>
        <button class="icone" data-passo="1" data-id="${r.id}" ${i < regras.length - 1 ? "" : "disabled"} aria-label="Descer prioridade">↓</button>
        <button class="icone" data-editar="${r.id}">editar</button>
        <button class="icone perigo" data-apagar="${r.id}">excluir</button>
      </td>
    </tr>`).join("") || `<tr><td colspan="5" class="fraco centro">Nenhuma regra.</td></tr>`;
}

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
$("buscaRegra").addEventListener("input", renderRegras);
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
  $("semGastos").hidden = lista.length > 0;
  $("linhasGastos").innerHTML = lista.map(g => `
    <tr>
      <td class="mono">${dataBr(g.data)}</td>
      <td>${esc(g.descricao)}</td>
      <td><span class="tag">${esc(g.categoria)}</span></td>
      <td>${g.cartao ? `<span class="badge"><i class="ponto" style="--cor:${esc(g.cor)}"></i>${esc(g.cartao)}</span>` : `<span class="fraco">Pix / dinheiro / débito</span>`}</td>
      <td class="num mono">${brl(g.valor)}</td>
      <td class="acoes"><button class="icone" data-editar="${g.id}">editar</button><button class="icone perigo" data-apagar="${g.id}">excluir</button></td>
    </tr>`).join("");
}

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
  $("linhasImportacoes").innerHTML = imps.map(i => `
    <tr>
      <td class="mono">${esc(i.arquivo ?? "—")}</td>
      <td><span class="badge"><i class="ponto" style="--cor:${esc(i.cor ?? cor(i.origem))}"></i>${esc(i.origem)}</span></td>
      <td class="mono fraco">${dataBr(i.de)} – ${dataBr(i.ate)}</td>
      <td class="num mono">${i.lancamentos}</td>
      <td class="num mono">${brl(i.gasto ?? 0)}</td>
      <td class="fraco">${new Date(i.em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
      <td class="acoes">${i.arquivo ? `<button class="icone perigo" data-arquivo="${esc(i.arquivo)}">excluir</button>` : ""}</td>
    </tr>`).join("") || `<tr><td colspan="7" class="fraco centro">Nenhuma importação ainda.</td></tr>`;
}

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
