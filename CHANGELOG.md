# Novidades

Cada versão vira um release no GitHub com estas notas e aparece em **Novidades** dentro do app.
Formato: `## [X.Y.Z] - AAAA-MM-DD`, seções `### Novo`, `### Melhorado`, `### Corrigido`. Escreva para quem usa, não para quem programa.

## [0.22.0] - 2026-11-05

### Novo
- **Compromissos:** o gráfico de parcelas por mês agora mostra também os últimos 12 meses já pagos (em tom apagado), para ver a curva caindo.
- Cada mês do gráfico mostra quanto as parcelas subiram ou caíram em relação ao mês anterior; clicar num mês pago lista as parcelas daquele mês.
- O indicador do próximo mês diz quanto as parcelas caem (ou sobem) em relação ao mês atual.

## [0.21.0] - 2026-11-05

### Melhorado
- **Comparar:** a janela de estabelecimentos não mostra mais a coluna Categoria, que só repetia a categoria já indicada no título.

## [0.20.0] - 2026-11-05

### Melhorado

- **Comparar:** ao clicar numa categoria com mais de um mês no intervalo, os estabelecimentos aparecem mês a mês, com a variação contra o mês anterior. Fica fácil ver onde você comprou mais ou menos em cada período, e dá para ordenar por qualquer mês.

## [0.19.2] - 2026-11-05

### Corrigido
- Importar vários arquivos de bancos diferentes de uma vez não joga mais todos no mesmo cartão: cada arquivo vai para o cartão do banco que está nele.

## [0.19.1] - 2026-11-05

### Corrigido
- A **Visão geral** agora sempre abre no mês atual, mesmo depois de você ter escolhido outro mês e trocado de tela.

## [0.19.0] - 2026-10-29

### Novo

- **Pasta de entrada:** salve o `.ofx` do Nubank ou o `.pdf` da fatura do Itaú em `~/ChosenFinance/entrada` e ele é importado sozinho em alguns segundos, sem abrir a tela de importação. O cartão é escolhido pelo banco do arquivo quando há um único cartão ativo daquele banco. O arquivo importado vai para `importados/`; se não der para ler, vai para `erros/` com o motivo num `.txt` ao lado. A pasta muda com a variável `PASTA_ENTRADA`.

## [0.18.0] - 2026-10-29

### Novo

- **Parcelas abatidas no fim** no cadastro de financiamento: informe quantas parcelas você quitou de trás para frente. Elas contam como pagas (a lista mostra, por exemplo, `15/48` em vez de `12/48`) e a última parcela chega mais cedo, sem mudar o valor do mês.

## [0.17.0] - 2026-10-29

### Novo

- **Financiamentos** em **Compromissos**: o botão **+ Financiamento** cadastra um financiamento ou empréstimo pago fora do cartão, como o do carro, com o valor da parcela, o número de parcelas e o mês da primeira. Ele entra nas parcelas por mês, nos parcelamentos em aberto, no total de parcelas a pagar do Painel e nas respostas do assistente. Para corrigir ou excluir, use **editar** ao lado do nome na lista.

## [0.16.0] - 2026-10-29

### Novo

- **Ocultar valores** no menu lateral: troca todos os valores em reais da tela por `R$ •••••`, para mostrar o app a outras pessoas sem expor quanto você gasta. A escolha fica salva no navegador; clique em **Mostrar valores** para voltar.

## [0.15.0] - 2026-10-29

### Novo

- **Simular** em Parcelamentos em aberto: desmarque as compras que vai quitar e acrescente compras parceladas (valor da parcela e número de parcelas, a primeira no mês que vem). O gráfico **Parcelas por mês** mostra como ficam os próximos meses e o rodapé mostra quanto muda no total a pagar.

## [0.14.0] - 2026-10-29

### Novo

- **Simular** em Compromissos agora também acrescenta: informe nome e valor por mês de uma assinatura que pretende assinar e veja o novo total. O rodapé mostra quanto o mês fica a mais ou a menos.

## [0.13.0] - 2026-10-29

### Novo

- **Simular cancelamentos** em Compromissos: desmarque as assinaturas que você cancelou e veja quanto passa a gastar por mês e por ano, e quanto economiza. A simulação não altera nada e some ao recarregar a página.

## [0.12.0] - 2026-10-29

### Novo
- **Compromissos:** as tabelas de parcelamentos e de assinaturas ganharam uma linha de total, que acompanha a busca
  e o filtro de cartão.

## [0.11.1] - 2026-10-29

### Corrigido
- **Janelas:** a barra de rolagem não fica mais por cima da última coluna.

## [0.11.0] - 2026-10-29

### Melhorado
- **Janelas:** o título e os botões ficam sempre visíveis e só o conteúdo rola. Nas listas, o cabeçalho das colunas
  e o total também ficam fixos: dá para fechar sem rolar até o fim.

## [0.10.0] - 2026-10-29

### Melhorado
- **Janelas:** clicar fora de qualquer janela fecha, como Cancelar.

### Corrigido
- Fechar com Esc uma janela de cadastro (regra, limite, gasto, cartão) não salva mais de novo o que foi salvo antes.

## [0.9.0] - 2026-10-29

### Novo
- **Comparar por estabelecimento:** na tabela por categoria, clique numa categoria, num valor do mês ou num total para
  ver os estabelecimentos que somaram aquele valor: quantas vezes apareceram, em quantos meses e quanto deram.
  As colunas do gráfico "Mês a mês" abrem o mês inteiro. A busca soma o que ficou visível: buscar uma loja mostra
  quanto você gastou nela no período.

## [0.8.0] - 2026-10-27

### Melhorado
- **Ordenar e filtrar em todas as tabelas:** parcelamentos, assinaturas, gastos manuais, histórico de importações,
  regras de categoria, orçamento e o comparativo por categoria agora ordenam clicando no cabeçalho e têm busca.
  Onde há cartão, dá para filtrar por ele também.
- **Comparar:** a linha de total da tabela por categoria soma só as categorias visíveis na busca.

## [0.7.0] - 2026-10-27

### Novo
- **Parcelas de um mês em Compromissos:** clique numa coluna de "Parcelas por mês" para ver as compras que caem naquele
  mês, com cartão, número da parcela, valor e total. A lista ordena pelo cabeçalho e filtra por busca e por cartão.

### Melhorado
- **Assistente sempre à mão:** saiu do menu e virou um botão no canto da tela, que abre o chat por cima de qualquer
  tela. A conversa continua enquanto você navega; `Esc` ou o ✕ fecham.

### Corrigido
- **Assinaturas** que não vieram na última fatura do cartão deixam de contar como recorrentes: podem já ter sido
  canceladas.

## [0.6.1] - 2026-10-27

### Corrigido
- **Versão no menu** agora acompanha a última versão publicada, sem precisar reiniciar o app.

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
