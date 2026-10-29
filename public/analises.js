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

/** Quanto as parcelas em aberto cobram em cada mês futuro: [[mes, valor], ...] em ordem. */
export function parcelasPorMes(abertas) {
  const m = new Map();
  for (const p of abertas) for (let i = 1; i <= p.faltam; i++) {
    const mes = somarMeses(p.mes, i);
    m.set(mes, (m.get(mes) ?? 0) + p.valor);
  }
  return [...m].sort((a, b) => a[0].localeCompare(b[0]));
}

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
    const e = m.get(k) ?? m.set(k, { descricao: d, origem: t.origem, cor: t.cor, categoria: t.categoria, vezes: 0, meses: new Set(), total: 0 }).get(k);
    e.vezes++;
    e.meses.add(t.mes);
    e.total -= t.valor;
  }
  return [...m.values()].map(e => ({ ...e, meses: e.meses.size })).sort((a, b) => b.vezes - a.vezes || b.total - a.total);
}
