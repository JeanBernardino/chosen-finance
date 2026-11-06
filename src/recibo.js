// Recibo de mercado em itens para um evento: pelo link do QR code da NFC-e (página da SEFAZ) ou pela foto do cupom (OCR do macOS + Ollama local).
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
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

const cent = v => Math.round((Number(v) || 0) * 100);

/**
 * Fecha os itens com o "valor a pagar" do cupom: o desconto que não está em item nenhum (cooperado, cupom no total)
 * é rateado pelo valor de cada item, em centavos, e o centavo que sobra vai para os maiores.
 * Só rateia a diferença que o desconto impresso explica: diferença sem explicação é erro de leitura, e a tela avisa.
 */
export function fecharTotal(itens, { total_a_pagar, descontos } = {}) {
  const total = cent(total_a_pagar), soma = itens.reduce((s, i) => s + cent(i.valor), 0), geral = soma - total;
  if (total > 0 && geral > 0 && geral <= cent(descontos)) {
    const partes = itens.map(i => Math.floor(geral * cent(i.valor) / soma));
    let sobra = geral - partes.reduce((s, v) => s + v, 0);
    for (const k of itens.map((_, k) => k).sort((a, b) => itens[b].valor - itens[a].valor)) if (sobra-- > 0) partes[k]++;
    itens = limparItens(itens.map((i, k) => ({ ...i, valor: (cent(i.valor) - partes[k]) / 100 })));
  }
  const final = itens.reduce((s, i) => s + cent(i.valor), 0);
  return { itens, total: total ? total / 100 : null, confere: total > 0 && final === total };
}

/**
 * Lançamentos lidos do cupom (produto ou desconto, na ordem impressa) em itens já com o desconto de cada um.
 * O OCR troca dígito (7 por 2, 1,800 por 1,000): onde o total da linha e quantidade × unitário divergem,
 * vale a combinação que fecha com o "valor total dos itens" impresso.
 */
export function montarItens({ lancamentos, total_itens, descontos, total_a_pagar } = {}) {
  const produtos = [];
  for (const l of Array.isArray(lancamentos) ? lancamentos : []) {
    if (l?.tipo === "desconto") { if (produtos.length) produtos.at(-1).desconto += Math.abs(cent(l.valor_total)); continue; }
    const linha = cent(l?.valor_total), conta = Math.round(Number(l?.quantidade) * Number(l?.valor_unitario) * 100) || 0;
    produtos.push({ descricao: l?.descricao, opcoes: [...new Set([linha, conta].filter(v => v > 0))], desconto: 0 });
  }
  const alvo = cent(total_itens), duvidas = produtos.flatMap((p, i) => p.opcoes.length > 1 ? [i] : []);
  let escolha = produtos.map(p => p.opcoes[0] ?? 0);
  if (alvo > 0 && duvidas.length <= 10) for (let m = 0; m < 1 << duvidas.length; m++) {
    const e = produtos.map(p => p.opcoes[0] ?? 0);
    duvidas.forEach((i, b) => { if (m >> b & 1) e[i] = produtos[i].opcoes[1]; });
    if (e.reduce((s, v) => s + v, 0) === alvo) { escolha = e; break; }
  }
  return fecharTotal(limparItens(produtos.map((p, i) => ({ descricao: p.descricao, valor: (escolha[i] - p.desconto) / 100 }))), { total_a_pagar, descontos });
}

/**
 * Itens da página de consulta da NFC-e no layout padrão do portal (tabela tabResult, uma linha "Item + n" por produto).
 * O valor do item na página é o bruto: o desconto vem só no total da nota e é rateado em fecharTotal.
 * shortcut: só esse layout (RS, PR, SP e a maioria); estado com página diferente ou com captcha (SC) cai no erro e a foto resolve.
 */
export function itensNfce(html) {
  const numero = s => Number((s ?? "").replace(/\./g, "").replace(",", "."));
  const rodape = rotulo => numero(html.match(new RegExp(`${rotulo}[^<]*<\\/label>\\s*<span[^>]*>([\\d.,]+)`, "i"))?.[1]);
  const itens = limparItens([...html.matchAll(/<tr[^>]*id="Item \+ \d+"[^>]*>([\s\S]*?)<\/tr>/gi)].map(([, linha]) => ({
    descricao: texto(linha.match(/class="txtTit2?"[^>]*>([^<]*)/)?.[1] ?? ""),
    valor: numero(linha.match(/class="valor"[^>]*>([\d.,]+)/)?.[1]),
  })));
  return fecharTotal(itens, { total_a_pagar: rodape("Valor a pagar"), descontos: rodape("Descontos") });
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
  const lido = itensNfce(html);
  if (!lido.itens.length) throw invalido(/captcha|SecurityVerify|valida[cç][aã]o de seguran/i.test(html + r.url)
    ? "a SEFAZ deste estado pede verificação de segurança e não deixa ler pelo link: use a foto do cupom"
    : "não achei os itens nessa página da SEFAZ: use a foto do cupom");
  return lido;
}

const PROMPT = `Abaixo está um cupom fiscal de mercado ou restaurante (NFC-e). Liste, na ordem impressa, cada lançamento da lista de itens:
- produto: descrição sem o código, quantidade, valor unitário e o valor total da linha;
- desconto: cada linha de desconto ou abatimento (ex.: "Desconto", "Desc. cooperado") vira um lançamento próprio, na posição em que aparece, com o valor positivo em valor_total.
Do rodapé, informe o valor total dos itens, o valor total dos descontos e o valor total a pagar (0 quando não houver).
Ignore troco, forma de pagamento, tributos e o resto. Escreva os números com ponto decimal.`;
const LANCAMENTO = { type: "object", required: ["tipo", "descricao", "quantidade", "valor_unitario", "valor_total"], properties: {
  tipo: { type: "string", enum: ["produto", "desconto"] }, descricao: { type: "string" },
  quantidade: { type: "number" }, valor_unitario: { type: "number" }, valor_total: { type: "number" } } };
const FORMATO = { type: "object", required: ["lancamentos", "total_itens", "descontos", "total_a_pagar"], properties: {
  lancamentos: { type: "array", items: LANCAMENTO }, total_itens: { type: "number" }, descontos: { type: "number" }, total_a_pagar: { type: "number" } } };
const OCR = new URL("./ocr.swift", import.meta.url).pathname;

/** Texto da foto pelo OCR do macOS: lê números bem melhor que o modelo olhando a imagem. Fora do macOS (ou sem o swift), null. */
async function ocr(buf) {
  const pasta = await fs.mkdtemp(path.join(os.tmpdir(), "recibo-"));
  try {
    await fs.writeFile(path.join(pasta, "foto"), buf);
    const { stdout } = await promisify(execFile)("swift", [OCR, path.join(pasta, "foto")], { timeout: 60000 });
    return stdout.trim() || null;
  } catch {
    return null;
  } finally {
    await fs.rm(pasta, { recursive: true, force: true });
  }
}

/** Com o texto do OCR, o modelo só organiza as linhas; sem ele, olha a própria imagem (erra mais os números). */
export async function lerFoto(buf) {
  const texto = await ocr(buf);
  const r = await ollama({ stream: false, format: FORMATO, options: { temperature: 0 },
    messages: [texto ? { role: "user", content: `${PROMPT}\n\nTexto do cupom (lido por OCR, pode ter erros de leitura):\n${texto}` }
      : { role: "user", content: PROMPT, images: [buf.toString("base64")] }] });
  let lido;
  try { lido = montarItens(JSON.parse((await r.json()).message?.content ?? "")); } catch { lido = { itens: [] }; }
  if (!lido.itens.length) throw invalido("não consegui ler itens na foto: tire outra mais de perto, com o cupom reto e iluminado");
  return lido;
}
