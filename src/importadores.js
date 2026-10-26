// Leitura dos arquivos dos bancos: OFX (Nubank, Itaú conta) e PDF da fatura do cartão Itaú.
import crypto from "node:crypto";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const BANCOS = { 260: "Nubank", 341: "Itaú" };
const PARCELA_OFX = /\s*-\s*Parcela (\d+)\/(\d+)/i;
const LINHA_ITAU = /^(\d{2})\/(\d{2}) (.+?) (-?[\d.]+,\d{2})$/;
const PARCELA_ITAU = / (\d{2})\/(\d{2})$/;
const INICIO_ITAU = "Lançamentos: compras e saques";
const FIM_ITAU = ["Compras parceladas", "Pagamentos efetuados", "Lançamentos no cartão", "Encargos cobrados"];

export async function ler(nome, buf) {
  if (/\.ofx$/i.test(nome)) return lerOfx(buf, nome);
  if (/\.pdf$/i.test(nome)) return lerFaturaItau(buf, nome);
  throw new Error("formato não suportado (use .ofx ou o .pdf da fatura Itaú)");
}

const iso = (a, m, d) => `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function transacao(origem, id, data, descricao, valor, categoriaBanco, parcela, arquivo) {
  return {
    id: `${origem}:${id}`, origem, data, descricao, valor, categoria_banco: categoriaBanco,
    parcela_atual: parcela ? Number(parcela[1]) : null, parcela_total: parcela ? Number(parcela[2]) : null, arquivo,
  };
}

export function lerOfx(buf, arquivo) {
  let texto;
  try { texto = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { texto = new TextDecoder("windows-1252").decode(buf); }
  // OFX 1.x é SGML (tags sem fechamento), então parser XML não serve
  const tag = (t, s = texto) => s.match(new RegExp(`<${t}>([^<\\r\\n]*)`))?.[1].trim();
  const codigo = (tag("FID") || tag("BANKID") || "").replace(/^0+/, "");
  const origem = `${BANCOS[codigo] ?? tag("ORG") ?? "OFX"} ${texto.includes("<CREDITCARDMSGSRSV1>") ? "cartão" : "conta"}`;
  return [...texto.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/g)].map(([, bloco]) => {
    const descricao = tag("MEMO", bloco) || tag("NAME", bloco) || "";
    const d = tag("DTPOSTED", bloco);
    // Nubank repete o FITID da compra no IOF dela: o id precisa do valor e da descrição
    const id = `${tag("FITID", bloco)}:${crypto.createHash("sha1").update(tag("TRNAMT", bloco) + descricao).digest("hex").slice(0, 8)}`;
    return transacao(origem, id, iso(d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)),
      descricao.replace(PARCELA_OFX, ""), Number(tag("TRNAMT", bloco).replace(",", ".")), null, descricao.match(PARCELA_OFX), arquivo);
  });
}

// Texto da página em linhas, coluna da esquerda inteira antes da direita.
async function linhasEmColunas(doc) {
  const linhas = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    // shortcut: corte fixo entre as 2 colunas do layout atual da fatura; se o Itaú mudar o layout, achar o x do 2º cabeçalho "DATA"
    const corte = pagina.view[2] * 0.585;
    const colunas = [new Map(), new Map()];
    for (const it of (await pagina.getTextContent()).items) {
      if (!it.str) continue;
      const col = colunas[it.transform[4] < corte ? 0 : 1];
      const y = Math.round(it.transform[5]);
      if (!col.has(y)) col.set(y, []);
      col.get(y).push(it);
    }
    for (const col of colunas)
      for (const y of [...col.keys()].sort((a, b) => b - a))
        linhas.push(col.get(y).sort((a, b) => a.transform[4] - b.transform[4]).map(i => i.str).join("").replace(/\s+/g, " ").trim());
  }
  return linhas;
}

export async function lerFaturaItau(buf, arquivo) {
  const doc = await getDocument({ data: new Uint8Array(buf), verbosity: 0 }).promise;
  const linhas = await linhasEmColunas(doc);
  await doc.destroy();
  const emissao = linhas.join("\n").match(/Emiss[ãa]o: (\d{2})\/(\d{2})\/(\d{4})/);
  if (!emissao) throw new Error("não parece uma fatura do cartão Itaú (data de emissão não encontrada)");
  const [, diaF, mesF, anoF] = emissao.map(Number);
  const fechamento = iso(anoF, mesF, diaF);

  const transacoes = [], repetidas = new Map();
  let dentro = false;
  linhas.forEach((linha, i) => {
    if (linha.startsWith(INICIO_ITAU)) return void (dentro = true);
    if (FIM_ITAU.some(f => linha.startsWith(f))) return void (dentro = false);
    const m = dentro && linha.match(LINHA_ITAU);
    if (!m) return;
    let [, dia, mes, descricao, valor] = m;
    const parcela = descricao.match(PARCELA_ITAU);
    if (parcela) descricao = descricao.slice(0, parcela.index);
    // a fatura não traz o ano: mês depois do fechamento é do ano anterior;
    // parcela 2+ é de compra antiga e pesa no mês da fatura, não no da compra
    const data = parcela && Number(parcela[1]) > 1 ? fechamento : iso(anoF - (Number(mes) > mesF), mes, dia);
    const prox = linhas[i + 1] ?? "";
    const categoria = prox && !LINHA_ITAU.test(prox) && ![INICIO_ITAU, "Principal", "DATA", ...FIM_ITAU].some(p => prox.startsWith(p))
      ? prox.split(" ")[0] : null;
    const chave = JSON.stringify([fechamento, dia, mes, descricao, valor]);
    repetidas.set(chave, (repetidas.get(chave) ?? 0) + 1);
    const id = crypto.createHash("sha1").update(chave + repetidas.get(chave)).digest("hex").slice(0, 16);
    transacoes.push(transacao("Itaú cartão", id, data, descricao.trim(),
      -Number(valor.replace(/\./g, "").replace(",", ".")), categoria, parcela, arquivo));
  });
  return transacoes;
}
