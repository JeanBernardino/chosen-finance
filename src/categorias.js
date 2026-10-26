// Categorização por regras (regex na descrição) e categoria que o banco já manda.
export const SEM_CATEGORIA = "Sem categoria";
export const PAGAMENTO_FATURA = "Pagamento de fatura";
export const FORA_DOS_GASTOS = [PAGAMENTO_FATURA, "Transferência entre contas"];

// ordem importa: a primeira regra que casar vence
export const REGRAS_PADRAO = [
  ["pagamento recebido|pagamento via conta|pagamento de fatura|pagto fatura|pag fat", PAGAMENTO_FATURA],
  ["spotify|openai|chatgpt|microsoft|youtube|crunchyroll|amazonprime|amazon ad free|netflix|disney|hbo|ifood club|nubank\\+", "Assinaturas"],
  ["\\biof\\b", "Taxas e juros"],
  ["pix no cr[ée]dito", "Pix no crédito"],
  ["shellbox|posto|ipiranga|petrobras", "Combustível"],
  ["ifd\\*|ifood|burguer|burger|hamburg|restaurante|pizza|subway|lanch", "Restaurante e delivery"],
  ["supermerc|mercado (?!livre)|atacad|paes|sorvete", "Supermercado"],
  ["mercadol|mercado\\*|amazon|shopee|aliexpress|magalu|nuv\\*|mp \\*", "Compras online"],
  ["^tim\\*|\\bvivo\\b|\\bclaro\\b", "Telefone"],
  ["academia|wellhub|gympass", "Academia"],
  ["\\buber\\b|99app|99 pop", "Transporte"],
  ["farm[aá]cia|drogaria|droga", "Saúde"],
];

const CATEGORIA_BANCO = {
  restaurante: "Restaurante e delivery", supermercado: "Supermercado", "vestuário": "Vestuário",
  eletronicos: "Eletrônicos", eletronics: "Eletrônicos", retail: "Compras online",
  "serviços": "Serviços", lazer: "Lazer", "saúde": "Saúde",
};

/** `regras` em ordem de prioridade: [[padrao, categoria], ...]. Lança se algum padrão for regex inválida. */
export function categorizar(transacoes, regras) {
  const compiladas = regras.map(([p, c]) => [new RegExp(p, "i"), c]);
  return transacoes.map(t => {
    let categoria = compiladas.find(([rx]) => rx.test(t.descricao))?.[1];
    const banco = t.categoria_banco?.toLowerCase();
    if (!categoria && banco && banco !== "outros") categoria = CATEGORIA_BANCO[banco] ?? banco[0].toUpperCase() + banco.slice(1);
    return { ...t, categoria: categoria ?? SEM_CATEGORIA };
  });
}
