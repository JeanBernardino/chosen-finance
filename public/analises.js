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
