// Assistente: conversa sobre os gastos com um modelo local do Ollama. Nada sai da máquina.
import { FORA_DOS_GASTOS } from "./categorias.js";

const OLLAMA = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const MODELO = process.env.OLLAMA_MODEL || "gemma3:12b";
const MAX_MENSAGENS = 20, MAX_TEXTO = 4000;

const brl = v => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ehGasto = t => t.valor < 0 && !FORA_DOS_GASTOS.includes(t.categoria);
// mesma compra parcelada em meses diferentes vira um estabelecimento só
const estabelecimento = d => d.replace(/\s*-?\s*parcela\s*\d+\/\d+/i, "").replace(/\s+\d{2}\/\d{2}$/, "").trim();

function somar(lista, chave, valor) {
  const m = new Map();
  for (const t of lista) { const k = chave(t); m.set(k, (m.get(k) ?? 0) + valor(t)); }
  return m;
}

/**
 * Resumo dos dados que vai no prompt. O modelo local tem pouco contexto e erra conta:
 * mandamos os números já somados em vez da lista crua de lançamentos.
 */
export function contexto(transacoes, gastosManuais, hoje = new Date().toISOString().slice(0, 10)) {
  const gastos = transacoes.filter(ehGasto);
  const meses = [...new Set(gastos.map(t => t.mes))].sort().slice(-12);
  const recentes = meses.slice(-3);
  const linhas = [`Hoje é ${hoje}. Valores em reais. Cartão conta no mês do vencimento da fatura.`];

  const porMes = somar(gastos, t => t.mes, t => -t.valor);
  linhas.push("", "## Gasto total por mês", ...meses.map(m => `- ${m}: ${brl(porMes.get(m))}`));

  const ultimos6 = meses.slice(-6);
  const porCat = new Map();
  for (const t of gastos.filter(t => ultimos6.includes(t.mes))) {
    const m = porCat.get(t.categoria) ?? new Map();
    m.set(t.mes, (m.get(t.mes) ?? 0) - t.valor);
    porCat.set(t.categoria, m);
  }
  const totalCat = ([, m]) => [...m.values()].reduce((a, b) => a + b, 0);
  linhas.push("", `## Por categoria e mês (${ultimos6.join(", ")})`,
    ...[...porCat].sort((a, b) => totalCat(b) - totalCat(a))
      .map(([c, m]) => `- ${c}: ${ultimos6.map(mes => `${mes} ${brl(m.get(mes) ?? 0)}`).join("; ")}`));

  const doRecente = gastos.filter(t => recentes.includes(t.mes));
  const porLoja = new Map();
  for (const t of doRecente) {
    const k = estabelecimento(t.descricao), e = porLoja.get(k) ?? { total: 0, vezes: 0, categoria: t.categoria };
    e.total -= t.valor; e.vezes++;
    porLoja.set(k, e);
  }
  linhas.push("", `## Onde mais gastou (${recentes.join(", ")})`,
    ...[...porLoja].sort((a, b) => b[1].total - a[1].total).slice(0, 30)
      .map(([k, e]) => `- ${k} [${e.categoria}]: ${brl(e.total)} em ${e.vezes} compra(s)`));

  // recorrente: aparece em pelo menos 3 dos últimos meses, sem ser parcela
  const ultimos4 = meses.slice(-4);
  const mesesDaLoja = new Map();
  for (const t of gastos.filter(t => !t.parcela_total && ultimos4.includes(t.mes))) {
    const k = estabelecimento(t.descricao), e = mesesDaLoja.get(k) ?? { meses: new Set(), ultimo: t };
    e.meses.add(t.mes);
    if (t.data > e.ultimo.data) e.ultimo = t;
    mesesDaLoja.set(k, e);
  }
  const recorrentes = [...mesesDaLoja].filter(([, e]) => e.meses.size >= 3);
  if (recorrentes.length) linhas.push("", "## Cobranças recorrentes (prováveis assinaturas)",
    ...recorrentes.map(([k, e]) => `- ${k} [${e.ultimo.categoria}]: ${brl(-e.ultimo.valor)} na última cobrança`));

  // parcelas ainda por vir, pela última parcela vista de cada compra
  const ultima = new Map();
  for (const t of transacoes.filter(t => t.parcela_total && t.valor < 0)) {
    const k = [t.origem, estabelecimento(t.descricao), t.parcela_total, t.valor].join("|");
    if ((ultima.get(k)?.parcela_atual ?? 0) < t.parcela_atual) ultima.set(k, t);
  }
  const abertas = [...ultima.values()].filter(t => t.parcela_atual < t.parcela_total);
  if (abertas.length) linhas.push("", "## Parcelamentos em aberto",
    ...abertas.map(t => `- ${estabelecimento(t.descricao)}: ${brl(-t.valor)}/mês, faltam ${t.parcela_total - t.parcela_atual} de ${t.parcela_total}`));

  const manuais = gastosManuais.filter(g => recentes.includes(g.data.slice(0, 7)));
  if (manuais.length) linhas.push("", `## Gastos manuais anotados (${recentes.join(", ")}), fora das faturas`,
    ...[...somar(manuais, g => g.categoria, g => g.valor)].sort((a, b) => b[1] - a[1]).map(([c, v]) => `- ${c}: ${brl(v)}`));

  return linhas.join("\n");
}

const SISTEMA = dados => `Você é o assistente financeiro pessoal do app Chosen Finance. Responda em português do Brasil,
direto e prático, como um amigo que entende de finanças. Use só os dados abaixo: se a resposta não estiver neles, diga
que não sabe. Não invente valores nem estabelecimentos. Ao sugerir cortes, cite a categoria ou o estabelecimento e quanto
daria para economizar por mês. Formate com parágrafos curtos, listas com "- " e **negrito** para valores.

# Dados do usuário
${dados}`;

/** Valida o histórico vindo da tela: só papéis de conversa, tamanho limitado. */
export function validarMensagens(m) {
  if (!Array.isArray(m) || !m.length) throw Object.assign(new Error("mensagem vazia"), { status: 400 });
  return m.slice(-MAX_MENSAGENS).map(({ role, content }) => {
    if (!["user", "assistant"].includes(role) || typeof content !== "string" || !content.trim())
      throw Object.assign(new Error("mensagem inválida"), { status: 400 });
    return { role, content: content.slice(0, MAX_TEXTO) };
  });
}

/** Repassa a resposta do Ollama para `res` em texto puro, pedaço a pedaço. */
export async function conversar(mensagens, dados, res) {
  const parar = new AbortController();
  res.on("close", () => parar.abort()); // usuário saiu da tela: para de gerar
  const r = await fetch(`${OLLAMA}/api/chat`, {
    method: "POST", signal: parar.signal,
    body: JSON.stringify({ model: MODELO, stream: true, options: { num_ctx: 16384 },
      messages: [{ role: "system", content: SISTEMA(dados) }, ...mensagens] }),
  }).catch(() => { throw Object.assign(new Error("Ollama não está rodando. Inicie com: brew services start ollama"), { status: 503 }); });
  if (!r.ok) {
    const erro = (await r.json().catch(() => ({}))).error ?? `Ollama respondeu ${r.status}`;
    throw Object.assign(new Error(/not found/.test(erro) ? `modelo não baixado. Rode: ollama pull ${MODELO}`
      : /killed/.test(erro) ? "o Ollama ficou sem memória: aumente a memória do Docker Desktop (Settings > Resources) ou use um modelo menor em OLLAMA_MODEL"
      : erro), { status: 502 });
  }
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  let resto = "";
  for await (const pedaco of r.body.pipeThrough(new TextDecoderStream())) {
    const linhas = (resto + pedaco).split("\n");
    resto = linhas.pop();
    for (const l of linhas) if (l.trim()) res.write(JSON.parse(l).message?.content ?? "");
  }
  res.end();
}
