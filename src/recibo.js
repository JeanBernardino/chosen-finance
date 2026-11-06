// Recibo de mercado em itens para um evento: pelo link do QR code da NFC-e (página da SEFAZ) ou pela foto do cupom (Ollama local).
import { ollama } from "./assistente.js";

const invalido = msg => Object.assign(new Error(msg), { status: 400 });
const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const texto = s => s.replace(/&(#x?[\da-f]+|\w+);/gi, (m, e) => e[0] === "#"
  ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENTIDADES[e.toLowerCase()] ?? m)
  .replace(/\s+/g, " ").trim();

/** Fica só o que dá para lançar: descrição não vazia e valor positivo em centavos. */
export const limparItens = itens => (Array.isArray(itens) ? itens : [])
  .map(i => ({ descricao: typeof i?.descricao === "string" ? i.descricao.trim().slice(0, 200) : "", valor: Math.round(Number(i?.valor) * 100) / 100 }))
  .filter(i => i.descricao && i.valor > 0 && i.valor < 1e10);

/**
 * Itens da página de consulta da NFC-e no layout padrão do portal (tabela tabResult, uma linha "Item + n" por produto).
 * shortcut: só esse layout (RS, PR, SC, SP e a maioria); estado com página diferente cai no erro e a foto resolve.
 * shortcut: desconto no total da nota não é rateado nos itens; se incomodar, lançar um item negativo de desconto.
 */
export function itensNfce(html) {
  return limparItens([...html.matchAll(/<tr[^>]*id="Item \+ \d+"[^>]*>([\s\S]*?)<\/tr>/gi)].map(([, linha]) => ({
    descricao: texto(linha.match(/class="txtTit2?"[^>]*>([^<]*)/)?.[1] ?? ""),
    valor: Number((linha.match(/class="valor"[^>]*>([\d.,]+)/)?.[1] ?? "").replace(/\./g, "").replace(",", ".")),
  })));
}

export async function lerNfce(link) {
  let url;
  try { url = new URL(link); } catch { throw invalido("link inválido: cole o endereço do QR code da nota"); }
  // o servidor busca a página: só portais da SEFAZ, para o campo não virar um proxy para qualquer endereço
  if (!/^https?:$/.test(url.protocol) || !url.hostname.endsWith(".gov.br")) throw invalido("o link precisa ser da SEFAZ (endereço .gov.br do QR code)");
  const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(20000) })
    .catch(() => { throw Object.assign(new Error("não consegui abrir a página da SEFAZ: confira a internet ou use a foto"), { status: 502 }); });
  if (!r.ok) throw Object.assign(new Error(`a SEFAZ respondeu ${r.status}: tente de novo ou use a foto`), { status: 502 });
  const buf = await r.arrayBuffer();
  let html;
  try { html = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { html = new TextDecoder("windows-1252").decode(buf); }
  const itens = itensNfce(html);
  if (!itens.length) throw invalido("não achei os itens nessa página da SEFAZ: use a foto do cupom");
  return itens;
}

const PROMPT = `Este é um cupom fiscal de mercado. Liste cada produto comprado com a descrição como está impressa e o valor
total da linha em reais (quantidade vezes valor unitário, já com o desconto do item, se houver). Ignore subtotal, total,
descontos gerais, troco, forma de pagamento, tributos e qualquer linha que não seja produto.`;
const FORMATO = {
  type: "object", required: ["itens"],
  properties: { itens: { type: "array", items: { type: "object", required: ["descricao", "valor"], properties: { descricao: { type: "string" }, valor: { type: "number" } } } } },
};

export async function lerFoto(buf) {
  const r = await ollama({ stream: false, format: FORMATO, options: { temperature: 0 },
    messages: [{ role: "user", content: PROMPT, images: [buf.toString("base64")] }] });
  let itens;
  try { itens = limparItens(JSON.parse((await r.json()).message?.content ?? "").itens); } catch { itens = []; }
  if (!itens.length) throw invalido("não consegui ler itens na foto: tire outra mais de perto, com o cupom reto e iluminado");
  return itens;
}
