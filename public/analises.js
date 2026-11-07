// Contas sobre os lançamentos, usadas pela tela (app.js) e pelo assistente (src/assistente.js). Só funções puras.

// mesma compra parcelada em meses diferentes vira um estabelecimento só
export const estabelecimento = d => d.replace(/\s*-?\s*parcela\s*\d+\/\d+/i, "").replace(/\s+\d{2}\/\d{2}$/, "").trim();
export const somarMeses = (m, n) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1)).toISOString().slice(0, 7);

/**
 * Compras parceladas com parcelas por vir, pela última parcela vista de cada uma.
 * As que faltam caem uma por mês depois de `mes` (o mês da última vista); `fim` é o mês da última parcela.
 */
export function parcelasAbertas(transacoes) {
  const ultima = new Map();
  for (const t of transacoes) {
    if (!t.parcela_total || t.valor >= 0) continue;
    // a compra é identificada pelo mês em que começou, não pelo valor: a 1ª parcela costuma vir com centavos diferentes
    // shortcut: duas compras iguais na mesma loja, no mesmo mês e no mesmo nº de parcelas viram uma; separar pelo valor se acontecer
    const k = [t.origem, estabelecimento(t.descricao), t.parcela_total, somarMeses(t.mes, -t.parcela_atual)].join("|");
    if ((ultima.get(k)?.parcela_atual ?? 0) < t.parcela_atual) ultima.set(k, t);
  }
  return [...ultima.values()].filter(t => t.parcela_atual < t.parcela_total).map(t => {
    const faltam = t.parcela_total - t.parcela_atual;
    return { descricao: estabelecimento(t.descricao), origem: t.origem, cor: t.cor, categoria: t.categoria, valor: -t.valor,
      parcela_atual: t.parcela_atual, parcela_total: t.parcela_total, faltam, mes: t.mes, fim: somarMeses(t.mes, faltam),
      restante: faltam * -t.valor };
  }).sort((a, b) => b.restante - a.restante);
}

/**
 * Financiamentos cadastrados à mão (fora dos cartões) no mesmo formato de `parcelasAbertas`. A parcela de `mesAtual`
 * conta como já paga, como a da fatura do mês; `primeira` é o mês da 1ª parcela ('AAAA-MM' ou data). `abatidas` são
 * parcelas quitadas de trás para frente: contam como pagas e encurtam o fim, sem mudar o valor do mês.
 */
export const parcelasFinanciadas = (financiamentos, mesAtual) => financiamentos.map(f => {
  const primeira = f.primeira.slice(0, 7), valor = Number(f.valor), abatidas = f.abatidas ?? 0, mensais = f.parcela_total - abatidas;
  const meses = (+mesAtual.slice(0, 4) - +primeira.slice(0, 4)) * 12 + +mesAtual.slice(5, 7) - +primeira.slice(5, 7);
  const noMes = Math.min(Math.max(meses + 1, 0), mensais), faltam = mensais - noMes;
  return { id: f.id, financiamento: true, descricao: f.descricao, origem: "Financiamento", categoria: "Financiamento", valor,
    parcela_atual: noMes + abatidas, parcela_total: f.parcela_total, abatidas, faltam, mes: somarMeses(primeira, noMes - 1),
    fim: somarMeses(primeira, mensais - 1), restante: faltam * valor };
}).filter(p => p.faltam > 0);

/** Quanto as parcelas em aberto cobram em cada mês futuro: [[mes, valor], ...] em ordem. */
export function parcelasPorMes(abertas) {
  const m = new Map();
  for (const p of abertas) for (let i = 1; i <= p.faltam; i++) {
    const mes = somarMeses(p.mes, i);
    m.set(mes, (m.get(mes) ?? 0) + p.valor);
  }
  return [...m].sort((a, b) => a[0].localeCompare(b[0]));
}

/**
 * Parcelas já pagas até `mesAtual`, uma por mês: as das faturas, pelo mês da fatura, mais as dos financiamentos que já
 * venceram (a de `mesAtual` conta como paga, como em `parcelasFinanciadas`). `n` é o número da parcela. Somadas às de
 * `parcelasPorMes`, dão a curva inteira sem contar nada duas vezes.
 */
export function parcelasPagas(transacoes, financiamentos, mesAtual) {
  const l = transacoes.filter(t => t.parcela_total && t.valor < 0).map(t => ({ mes: t.mes, descricao: estabelecimento(t.descricao),
    origem: t.origem, n: t.parcela_atual, parcela_total: t.parcela_total, valor: -t.valor }));
  for (const f of financiamentos) {
    const primeira = f.primeira.slice(0, 7), mensais = f.parcela_total - (f.abatidas ?? 0);
    for (let i = 0, mes = primeira; i < mensais && mes <= mesAtual; mes = somarMeses(primeira, ++i))
      l.push({ mes, descricao: f.descricao, origem: "Financiamento", n: i + 1, parcela_total: f.parcela_total, valor: Number(f.valor) });
  }
  return l;
}
export const somaPorMes = itens => { const m = new Map(); for (const p of itens) m.set(p.mes, (m.get(p.mes) ?? 0) + p.valor); return m; };

/** As parcelas em aberto que caem em `mes`, cada uma com `n`, o número que a parcela terá nesse mês. */
export const parcelasDoMes = (abertas, mes) => abertas.flatMap(p => {
  for (let i = 1; i <= p.faltam; i++) if (somarMeses(p.mes, i) === mes) return [{ ...p, n: p.parcela_atual + i }];
  return [];
});

/**
 * Prováveis assinaturas nos últimos 6 meses de `gastos` (já sem pagamento de fatura): mesmo estabelecimento, sem ser
 * parcela, cobrado no máximo uma vez por mês (supermercado e restaurante repetem no mês), com valor parecido (a menor
 * cobrança é ao menos 75% da maior: cabe reajuste, não compra de valor variável) e em pelo menos 3 meses,
 * ou 2 se já está na categoria Assinaturas. Só entra a que veio na última fatura do seu cartão: se não veio,
 * pode já ter sido cancelada.
 */
export function recorrentes(gastos) {
  const meses = [...new Set(gastos.map(t => t.mes))].sort().slice(-6);
  const porLoja = new Map(), ultimaFatura = new Map();
  for (const t of gastos) {
    if (t.mes > (ultimaFatura.get(t.origem) ?? "")) ultimaFatura.set(t.origem, t.mes);
    if (t.parcela_total || !meses.includes(t.mes)) continue;
    const k = estabelecimento(t.descricao).replace(/\s*\*\s*/g, "*"); // "Dm *Spotify" e "Dm*Spotify" são a mesma
    porLoja.set(k, [...porLoja.get(k) ?? [], t]);
  }
  const lista = [];
  for (const ts of porLoja.values()) {
    const nMeses = new Set(ts.map(t => t.mes)).size;
    ts.sort((a, b) => a.data.localeCompare(b.data));
    const ultima = ts.at(-1), anterior = ts.at(-2);
    const valores = ts.map(t => -t.valor);
    if (ultima.mes !== ultimaFatura.get(ultima.origem) || ts.length > nMeses || nMeses < (ultima.categoria === "Assinaturas" ? 2 : 3) || Math.min(...valores) < Math.max(...valores) * 0.75) continue;
    lista.push({ descricao: estabelecimento(ultima.descricao), categoria: ultima.categoria, origem: ultima.origem, cor: ultima.cor, valor: -ultima.valor,
      anterior: -anterior.valor, meses: nMeses });
  }
  return lista.sort((a, b) => b.valor - a.valor);
}

/** Orçamento do mês: quanto cada categoria com limite já gastou. `limites`: [{categoria, limite}]. */
export const orcamento = (gastosDoMes, limites) => limites.map(({ categoria, limite }) => {
  const gasto = gastosDoMes.filter(t => t.categoria === categoria).reduce((s, t) => s - t.valor, 0);
  return { categoria, limite, gasto, pct: gasto * 100 / limite };
}).sort((a, b) => b.pct - a.pct);

/**
 * Gastos agrupados por estabelecimento e cartão, do que mais se repete para o que menos: quantas vezes apareceu,
 * em quantos meses e quanto somou. Parcelas da mesma compra contam como vezes da mesma loja.
 */
export function porEstabelecimento(gastos) {
  const m = new Map();
  for (const t of gastos) {
    const d = estabelecimento(t.descricao).replace(/\s*\*\s*/g, "*"); // "Dm *Spotify" e "Dm*Spotify" são a mesma
    const k = `${t.origem}|${d.toLowerCase()}`;
    const e = m.get(k) ?? m.set(k, { descricao: d, origem: t.origem, cor: t.cor, categoria: t.categoria, vezes: 0, porMes: {}, total: 0 }).get(k);
    e.vezes++;
    e.porMes[t.mes] = (e.porMes[t.mes] ?? 0) - t.valor;
    e.total -= t.valor;
  }
  return [...m.values()].map(e => ({ ...e, meses: Object.keys(e.porMes).length })).sort((a, b) => b.vezes - a.vezes || b.total - a.total);
}

/**
 * Racha os gastos de um evento pelo `peso` de cada pessoa (padrão 1) e diz quem paga quem:
 * quem tem peso 2 (comeu 2 hambúrgueres) paga o dobro de quem tem 1.
 * Conta em centavos e sempre arredonda para cima: o mesmo peso paga sempre o mesmo valor.
 * `acrescimo` (%) cobra a mais em cima de tudo; o que passa do gasto (acréscimo e centavos do arredondamento)
 * fica com o `organizador` (nome do participante; sem ele, o primeiro da lista), e os saldos fecham em zero.
 * Pessoas com o mesmo `grupo` (casal, família) contam uma parte cada, mas acertam juntas, em nome do grupo.
 * `pagamentos` são acertos já feitos ({ de, para, valor } com ids de pessoa): abatem do saldo, e o que falta é recalculado.
 * Acerto guloso: quem mais deve paga a quem mais tem a receber, o que dá no máximo uma transferência a menos que o nº de grupos.
 */
export function dividir(pessoas, gastos, pagamentos = [], { acrescimo = 0, organizador } = {}) {
  const cent = v => Math.round(v * 100), n = pessoas.length;
  const total = gastos.reduce((s, g) => s + cent(g.valor), 0), pesos = pessoas.map(p => p.peso ?? 1), soma = pesos.reduce((s, p) => s + p, 0);
  // - 1e-6: o erro de ponto flutuante (3519.0000001) não sobe mais um centavo
  const cima = peso => Math.ceil(total * peso * (1 + acrescimo / 100) / soma - 1e-6), partes = pesos.map(cima);
  const unidades = new Map(), daPessoa = new Map();
  pessoas.forEach((p, i) => {
    const k = p.grupo ?? `#${p.id}`, u = unidades.get(k) ?? { id: p.id, nome: p.grupo ?? p.nome, pagou: 0, parte: 0, peso: 0, acertado: 0, extra: 0 };
    u.pagou += gastos.filter(g => g.pago_por === p.id).reduce((s, g) => s + cent(g.valor), 0);
    u.parte += partes[i];
    u.peso += pesos[i];
    unidades.set(k, u);
    daPessoa.set(p.id, u);
  });
  const org = pessoas.find(p => p.nome === organizador) ?? pessoas[0], cobrado = partes.reduce((s, x) => s + x, 0);
  if (org) daPessoa.get(org.id).extra = cobrado - total;
  for (const a of pagamentos) {
    const v = cent(a.valor), de = daPessoa.get(a.de), para = daPessoa.get(a.para);
    if (de) de.acertado += v;
    if (para) para.acertado -= v;
  }
  const saldos = [...unidades.values()].map(u => ({ ...u, saldo: u.pagou - u.parte + u.acertado + u.extra }));
  const fila = sinal => saldos.map(s => ({ id: s.id, nome: s.nome, v: s.saldo * sinal })).filter(s => s.v > 0).sort((a, b) => b.v - a.v);
  const deve = fila(-1), recebe = fila(1), acertos = [];
  for (let i = 0, j = 0; i < deve.length && j < recebe.length;) {
    const v = Math.min(deve[i].v, recebe[j].v);
    acertos.push({ de: deve[i].nome, de_id: deve[i].id, para: recebe[j].nome, para_id: recebe[j].id, valor: v / 100 });
    if (!(deve[i].v -= v)) i++;
    if (!(recebe[j].v -= v)) j++;
  }
  return {
    // parte é a parte de peso 1; `igual` diz se todos têm o mesmo peso; cobrado é a soma das partes (gasto + acréscimo + arredondamento)
    total: total / 100, cobrado: cobrado / 100, parte: n ? cima(1) / 100 : 0, igual: pesos.every(p => p === pesos[0]), acertos,
    saldos: saldos.map(s => ({ ...s, pagou: s.pagou / 100, parte: s.parte / 100, acertado: s.acertado / 100, extra: s.extra / 100, saldo: s.saldo / 100 })),
  };
}
