# Novidades

Cada versão vira um release no GitHub com estas notas e aparece em **Novidades** dentro do app.
Formato: `## [X.Y.Z] - AAAA-MM-DD`, seções `### Novo`, `### Melhorado`, `### Corrigido`. Escreva para quem usa, não para quem programa.

## [0.6.0] - 2026-10-27

### Novo
- **Assinaturas em Compromissos:** o app encontra as cobranças que se repetem todo mês com valor parecido e mostra o total
  por mês e por ano, as que subiram ou caíram de preço e as que pararam de cobrar.

### Melhorado
- **Assistente** reconhece as assinaturas pela mesma regra da tela e deixa de fora as canceladas.

## [0.5.0] - 2026-10-27

### Novo
- **Orçamento por categoria:** defina em Configurações quanto quer gastar por mês em cada categoria (com a média dos
  últimos 3 meses para ajudar). Na visão geral, com um mês escolhido, cada categoria mostra quanto falta ou quanto
  passou, e o card avisa quando alguma passa de 80% do limite.

## [0.4.0] - 2026-10-27

### Novo
- **Compromissos:** tela nova com quanto falta pagar das compras parceladas, quanto das próximas faturas já está comprometido
  mês a mês e a lista de parcelamentos em aberto, com o mês da última parcela.

### Corrigido
- **Parcelas a pagar** contava em dobro as compras cuja 1ª parcela vem com centavos diferentes das outras: o total do
  painel e o do assistente agora batem com as faturas.

## [0.3.0] - 2026-10-27

### Novo
- **Assistente:** converse sobre os seus gastos (onde cortar, por que o mês subiu, quais assinaturas paga, quanto falta de
  parcelas). Roda num modelo local pelo Ollama: nada sai da sua máquina. O `docker-compose.yml` sobe o Ollama e baixa o modelo.

## [0.2.0] - 2026-10-26

### Novo
- **Comparar:** escolha um intervalo de meses e veja o total, a média, o mês que mais e o que menos gastou, a variação de
  cada mês contra o anterior e a tabela de categorias mês a mês.
- **Novidades:** a versão aparece no menu lateral, com um ponto enquanto houver versão nova não vista; clicar mostra o que mudou.

### Melhorado
- **A fatura do cartão conta no mês do vencimento**, inteira, mesmo com compras de meses anteriores. A fatura do Itaú lê o
  vencimento do PDF; no OFX de cartão ele é estimado em 7 dias depois do fechamento. Vale para faturas importadas a partir desta versão.

### Corrigido
- **Fatura Itaú baixada do site:** agora é importada, inclusive os lançamentos internacionais e o IOF, que ficavam de fora.
- **Arquivo sem nenhum lançamento reconhecido** aparece como erro na tela de importação, em vez de importar zero sem avisar.

## [0.1.0] - 2026-10-26

### Novo
- Primeira versão: importa extratos OFX (Nubank, Itaú) e a fatura PDF do Itaú, categoriza os lançamentos e mostra para
  onde o dinheiro vai, com gastos manuais, cartões e regras de categoria.
