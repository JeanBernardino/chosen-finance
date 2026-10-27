// Leitura dos arquivos dos bancos: OFX (Nubank, Itaú conta) e PDF da fatura do cartão Itaú.
import crypto from "node:crypto";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";

const BANCOS = { 260: "Nubank", 341: "Itaú" };
const PARCELA_OFX = /\s*-\s*Parcela (\d+)\/(\d+)/i;
const LINHA_ITAU = /^(\d{2})\/(\d{2}) (.+?) (-?[\d.]+,\d{2})$/;
const PARCELA_ITAU = / (\d{2})\/(\d{2})$/;
const INICIO_ITAU = ["Lançamentos: compras e saques", "Lançamentos internacionais"];
const IOF_ITAU = /^Repasse de IOF em R\$ ?([\d.]+,\d{2})$/;
const FIM_ITAU = ["Total lançamentos inter", "Compras parceladas", "Pagamentos efetuados", "Lançamentos no cartão", "Encargos cobrados"];

export async function ler(nome, buf) {
  if (/\.ofx$/i.test(nome)) return lerOfx(buf, nome);
  if (/\.pdf$/i.test(nome)) return lerFaturaItau(buf, nome);
  throw new Error("formato não suportado (use .ofx ou o .pdf da fatura Itaú)");
}

const reais = v => Number(v.replace(/\./g, "").replace(",", "."));
const iso = (a, m, d) => `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function transacao(origem, id, data, descricao, valor, categoriaBanco, parcela, arquivo, vencimento = null) {
  return {
    id: `${origem}:${id}`, origem, data, descricao, valor, categoria_banco: categoriaBanco,
    parcela_atual: parcela ? Number(parcela[1]) : null, parcela_total: parcela ? Number(parcela[2]) : null, arquivo, vencimento,
  };
}

export function lerOfx(buf, arquivo) {
  let texto;
  try { texto = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch { texto = new TextDecoder("windows-1252").decode(buf); }
  // OFX 1.x é SGML (tags sem fechamento), então parser XML não serve
  const tag = (t, s = texto) => s.match(new RegExp(`<${t}>([^<\\r\\n]*)`))?.[1].trim();
  const codigo = (tag("FID") || tag("BANKID") || "").replace(/^0+/, "");
  const cartao = texto.includes("<CREDITCARDMSGSRSV1>");
  const origem = `${BANCOS[codigo] ?? tag("ORG") ?? "OFX"} ${cartao ? "cartão" : "conta"}`;
  // OFX não traz o vencimento; no cartão, o fim do extrato é o fechamento
  // shortcut: vencimento = fechamento + 7 dias (regra do Nubank); se outro banco divergir, guardar o dia de vencimento no cartão
  const fim = cartao && tag("DTEND");
  const vencimento = fim ? new Date(Date.UTC(+fim.slice(0, 4), +fim.slice(4, 6) - 1, +fim.slice(6, 8) + 7)).toISOString().slice(0, 10) : null;
  return [...texto.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/g)].map(([, bloco]) => {
    const descricao = tag("MEMO", bloco) || tag("NAME", bloco) || "";
    const d = tag("DTPOSTED", bloco);
    // Nubank repete o FITID da compra no IOF dela: o id precisa do valor e da descrição
    const id = `${tag("FITID", bloco)}:${crypto.createHash("sha1").update(tag("TRNAMT", bloco) + descricao).digest("hex").slice(0, 8)}`;
    return transacao(origem, id, iso(d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)),
      descricao.replace(PARCELA_OFX, ""), Number(tag("TRNAMT", bloco).replace(",", ".")), null, descricao.match(PARCELA_OFX), arquivo, vencimento);
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

// O PDF baixado do site desenha o texto em pedaços soltos e o pdfjs os junta com espaços falsos
// ("Lanç am ent o s", "583 ,33"); aqui a linha é refeita pelos trechos: espaço só onde o vão é de palavra.
async function linhasPorTrechos(doc) {
  const linhas = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const corte = pagina.view[2] * 0.585;
    const colunas = [new Map(), new Map()];
    const ops = await pagina.getOperatorList();
    // shortcut: ignora escala do Tm, Tc/Tw e Tz (o layout atual não usa); se a fatura mudar, ler a matriz inteira
    let tamanho = 0, x = 0, y = 0;
    ops.fnArray.forEach((fn, i) => {
      const a = ops.argsArray[i];
      if (fn === OPS.setFont) tamanho = a[1];
      else if (fn === OPS.beginText) x = y = 0;
      else if (fn === OPS.setTextMatrix) [x, y] = [a[4], a[5]];
      else if (fn === OPS.moveText) [x, y] = [x + a[0], y + a[1]];
      else if (fn === OPS.showText) {
        const str = a[0].map(g => g.unicode ?? "").join("");
        const largura = a[0].reduce((s, g) => s + (typeof g === "number" ? -g : g.width), 0) * tamanho / 1000;
        if (!str.trim()) return;
        const col = colunas[x < corte ? 0 : 1], linha = Math.round(y);
        if (!col.has(linha)) col.set(linha, []);
        col.get(linha).push({ str, x, fim: x + largura, tamanho });
      }
    });
    for (const col of colunas)
      for (const y of [...col.keys()].sort((a, b) => b - a)) {
        const ts = col.get(y).sort((a, b) => a.x - b.x);
        // vão entre letras fica em até ~0,16 em; entre palavras, a partir de ~0,20 em
        linhas.push(ts.map((t, i) => (i && t.x - ts[i - 1].fim > 0.18 * t.tamanho ? " " : "") + t.str).join("").replace(/\s+/g, " ").trim());
      }
  }
  return linhas;
}

export async function lerFaturaItau(buf, arquivo) {
  const doc = await getDocument({ data: new Uint8Array(buf), verbosity: 0 }).promise;
  try {
    const t = lancamentosItau(await linhasEmColunas(doc), arquivo);
    return t.length ? t : lancamentosItau(await linhasPorTrechos(doc), arquivo, true);
  } finally {
    await doc.destroy();
  }
}

// semEspaco: títulos em negrito saem com espaços falsos mesmo refeitos pelos trechos
function lancamentosItau(linhas, arquivo, semEspaco = false) {
  const marca = (linha, m) => semEspaco ? linha.replace(/ /g, "").startsWith(m.replace(/ /g, "")) : linha.startsWith(m);
  const emissao = linhas.join("\n").match(/Emiss[ãa]o: (\d{2})\/(\d{2})\/(\d{4})/);
  if (!emissao) throw new Error("não parece uma fatura do cartão Itaú (data de emissão não encontrada)");
  const [, diaF, mesF, anoF] = emissao.map(Number);
  const fechamento = iso(anoF, mesF, diaF);
  const venc = linhas.join("\n").match(/Vencimento: (\d{2})\/(\d{2})\/(\d{4})/);
  const vencimento = venc ? iso(venc[3], venc[2], venc[1]) : null;

  const transacoes = [], repetidas = new Map();
  let dentro = false;
  linhas.forEach((linha, i) => {
    if (INICIO_ITAU.some(m => marca(linha, m))) return void (dentro = true);
    const iof = dentro && linha.match(IOF_ITAU);
    if (iof) return void transacoes.push(transacao("Itaú cartão", `iof:${fechamento}`, fechamento, "Repasse de IOF", -reais(iof[1]), null, null, arquivo, vencimento));
    if (FIM_ITAU.some(f => marca(linha, f))) return void (dentro = false);
    const m = dentro && linha.match(LINHA_ITAU);
    if (!m) return;
    let [, dia, mes, descricao, valor] = m;
    const parcela = descricao.match(PARCELA_ITAU);
    if (parcela) descricao = descricao.slice(0, parcela.index);
    // a fatura não traz o ano: mês depois do fechamento é do ano anterior;
    // parcela 2+ é de compra antiga e pesa no mês da fatura, não no da compra
    const data = parcela && Number(parcela[1]) > 1 ? fechamento : iso(anoF - (Number(mes) > mesF), mes, dia);
    const prox = linhas[i + 1] ?? "";
    // na compra internacional a linha seguinte é o valor na moeda de origem ("257,76 BRL 49,18"), não a categoria
    const categoria = prox && !LINHA_ITAU.test(prox) && !/^\d/.test(prox) && ![...INICIO_ITAU, "Principal", "DATA", ...FIM_ITAU].some(p => marca(prox, p))
      ? prox.split(" ")[0] : null;
    const chave = JSON.stringify([fechamento, dia, mes, descricao, valor]);
    repetidas.set(chave, (repetidas.get(chave) ?? 0) + 1);
    const id = crypto.createHash("sha1").update(chave + repetidas.get(chave)).digest("hex").slice(0, 16);
    transacoes.push(transacao("Itaú cartão", id, data, descricao.trim(),
      -reais(valor), categoria, parcela, arquivo, vencimento));
  });
  return transacoes;
}
