# Novidades

Cada versão vira um release no GitHub com estas notas e aparece em **Novidades** dentro do app.
Formato: `## [X.Y.Z] - AAAA-MM-DD`, seções `### Novo`, `### Melhorado`, `### Corrigido`. Escreva para quem usa, não para quem programa.

## [0.40.0] - 2026-11-07

### Melhorado

- **Exportar PDF** do evento não abre mais uma guia nova: o PDF aparece numa janela dentro do app, com **Baixar** e **Compartilhar** (para mandar direto no WhatsApp).

## [0.39.2] - 2026-11-07

### Melhorado
- Nos eventos, a tela, o resumo copiado e o PDF mostram só o valor final de cada um, sem detalhar o acréscimo.

## [0.39.1] - 2026-11-07

### Corrigido
- O total do evento (na tela, na lista de eventos, no resumo copiado e no PDF) agora já inclui o acréscimo, com o detalhe de quanto é gasto e quanto é acréscimo.

## [0.39.0] - 2026-11-07

### Novo
- **Acréscimo nos eventos:** no cadastro do evento, informe um percentual para cobrar a mais em cima de tudo, pela organização. O valor extra fica com quem recebe o Pix (sem Pix, com o primeiro participante).

### Melhorado
- A parte de cada participante nos eventos agora arredonda sempre para cima: quem tem o mesmo peso paga exatamente o mesmo valor. Os centavos que sobram ficam com quem organiza.

## [0.38.0] - 2026-11-07

### Novo
- **Exportar PDF** na divisão do evento: gera um relatório com a logo, o nome da plataforma e a data de impressão, a lista do que foi gasto, a parte de cada participante e quem paga quem (com a chave Pix de quem recebe). Na janela de impressão, escolha **Salvar como PDF** e mande aos amigos.

## [0.37.0] - 2026-11-07

### Melhorado

- **Eventos:** a coluna Peso dos participantes agora também ordena pelo cabeçalho; todas as colunas das grids de eventos, gastos e participantes ordenam.
- **Eventos:** a busca das três grids procura em qualquer coluna (data, valores, situação, quem pagou, quem deve), não só no nome.






## [0.36.0] - 2026-11-07

### Novo
- Na **Divisão** do evento, cada participante tem um **Peso**. Quem tem peso 2 paga o dobro de quem tem 1: se você comeu 2 hambúrgueres e outra pessoa comeu 1, ela paga metade do que você paga. Basta mudar o número na tabela, a divisão recalcula na hora. No casal, cada um tem o seu peso e o acerto continua junto.

### Melhorado
- Com pesos diferentes, o indicador mostra o valor **Por peso 1** e o resumo copiado traz a parte de cada participante.
- O **Quem consumiu** por gasto da versão anterior saiu: o peso na divisão substitui.

## [0.35.0] - 2026-11-07

### Novo
- No gasto do evento, **Quem consumiu (opcional)** diz quanto cada participante consumiu do item. Só quem tem quantidade paga aquele item, na proporção: quem comeu 2 hambúrgueres paga o dobro de quem comeu 1, e quem não comeu não paga. Deixando tudo vazio, o gasto continua dividido igual entre todos.

### Melhorado
- A lista de gastos mostra o consumo de cada pessoa embaixo da descrição.
- Quando as partes variam, o indicador vira **Média por pessoa** e o resumo copiado traz o consumo de cada item e a parte de cada participante.

## [0.34.0] - 2026-11-07

### Novo
- Gastos do evento agora têm **Quantidade**, **Valor unitário** e **Valor total**. No cadastro do gasto você informa a quantidade e o valor unitário; o total sai da conta.

### Melhorado
- O mesmo item não se repete na lista: lançar de novo um item com a mesma descrição e o mesmo pagador soma na quantidade e no total. Vale também para os itens lidos do recibo e para os gastos repetidos que já existiam.
- O resumo copiado mostra a quantidade dos itens com mais de uma unidade.

## [0.33.0] - 2026-11-06

### Novo
- **Comparar** ganhou o seletor **Fatura | Gasto manual**: escolha se os meses e as categorias vêm das faturas importadas ou dos gastos que você anotou. As duas fontes nunca se misturam, e Fatura continua sendo o padrão.

### Melhorado
- **Gastos manuais** agora são sempre gastos em dinheiro, sem ligação com cartões: saíram o campo "Pago com", o filtro de cartão e os resumos dinheiro × cartão.

## [0.32.2] - 2026-11-06

### Corrigido
- O QR Code do Pix era recusado pelo banco quando a chave era um celular sem o `+55`. Agora a chave entra no formato certo, com ou sem pontuação: celular, CPF, CNPJ, e-mail ou chave aleatória.
## [0.32.1] - 2026-11-06

### Corrigido
- **Quem recebe o Pix** agora é uma lista com os participantes do evento. Antes, o nome digitado tinha que bater letra por letra, e o evento não salvava.
## [0.32.0] - 2026-11-06

### Melhorado
- **Pix por evento:** a chave Pix e quem recebe agora ficam no cadastro de cada evento (**Editar evento**), sem precisar reiniciar o app. O botão **Pix** aparece para quem deve a esse participante ou ao casal dele.
## [0.31.1] - 2026-11-06

### Corrigido
- A tela de **Eventos** voltou a abrir: na 0.31.0 ela parava com o erro "titular is not defined".
## [0.31.0] - 2026-11-06

### Novo
- **Cobrança por Pix nos eventos:** na divisão, quem deve para você ganha o botão **Pix**, que abre o QR Code com o valor já preenchido e o Pix copia e cola. Para ligar, inicie o app com `PIX_CHAVE` (sua chave) e `PIX_NOME` (titular); `PIX_CIDADE` é opcional. Você é reconhecido no evento como "Eu", pelo nome do titular ou pelo primeiro nome dele.
## [0.30.0] - 2026-11-06

### Novo

- **Eventos** abre numa grade com todos os eventos: data, participantes, total e situação, com busca e ordenação. Clique no nome para ver os gastos e a divisão, e em **← Todos os eventos** para voltar.
- Evento finalizado pode ser **inativado** na grade. A grade mostra só os ativos; marque **Mostrar inativos** para ver os demais e reativar.

### Melhorado

- Clicar no menu da tela em que você já está recarrega a tela do começo.

## [0.29.0] - 2026-11-06

### Novo

- **Eventos:** botão **Zerar**, que apaga todos os gastos e pagamentos do evento e mantém o nome, a data e os participantes. Pede confirmação antes.

### Melhorado

- Toda exclusão pede confirmação: agora também **desfazer pagamento** na divisão e **limpar a conversa** do assistente.

## [0.28.0] - 2026-11-06

### Melhorado

- **Eventos:** botão **Excluir evento** na barra, ao lado de Editar. Antes a exclusão ficava escondida dentro do diálogo de edição.

## [0.27.0] - 2026-11-06

### Melhorado

- **Eventos:** o pagamento da divisão agora é marcado direto na grade de participantes. Quem deve aparece em vermelho; um clique marca como pago e a linha fica verde. Clicar de novo desfaz.

## [0.26.0] - 2026-11-06

### Novo
- **Ler recibo** agora entende descontos: o desconto de cada produto (como o da embalagem na lanchonete) já sai abatido do item, e o desconto que vem só no total da nota (como o de cooperado) é dividido entre os itens.
- Depois de ler, a tela diz se a soma dos itens bate com o total do cupom; se não bater, avisa para conferir antes de lançar.

### Melhorado
- A foto do cupom é lida pelo reconhecimento de texto do próprio Mac, bem mais preciso nos números. Continua tudo local.
- Nota de estado cuja SEFAZ pede verificação de segurança (como SC) agora avisa para usar a foto.

 - 2026-11-06

### Novo
- **Ler recibo** nos eventos: cole o link do QR code da NFC-e ou escolha a foto do cupom, confira os itens lidos e lance todos de uma vez, cada produto como um gasto, com quem pagou o recibo.
- A foto é lida pelo modelo local do Ollama (nada sai da máquina) e pode errar: edite ou tire itens antes de lançar. O link da nota busca os valores exatos na SEFAZ.
- **Casais e famílias**: escreva `Ana + Beto` na mesma linha dos participantes. Cada um conta uma parte, mas a cobrança sai uma só, para o grupo.
- **Marcar pago** em cada acerto da divisão: o pagamento abate do saldo, a coluna **Acertado** mostra o que já foi pago ou recebido, e **desfazer** volta atrás.

 - 2026-11-06

### Corrigido
- Quando o servidor está desatualizado em relação à tela, o erro agora diz o que aconteceu em vez de "is not valid JSON". Se aparecer, reinicie o servidor.

## [0.24.0] - 2026-11-06

### Novo
- **Eventos**: nova seção no menu para rachar os gastos de um churrasco, hamburgada ou viagem. Cadastre os participantes, lance cada gasto com quem pagou e veja quanto cada um deve, quanto tem a receber e quem paga quem para acertar tudo com o mínimo de transferências.
- A divisão é em partes iguais entre todos os participantes; **Copiar resumo** copia a conta pronta para colar no grupo.
- Os eventos ficam separados das faturas e dos gastos manuais: não entram na visão geral.

## [0.23.0] - 2026-11-06

### Melhorado
- **Assistente:** as respostas ficam bem mais rápidas com o Ollama instalado direto no Mac, usando a GPU. O container Docker do Ollama saiu do projeto: instale com `brew install ollama`, inicie com `brew services start ollama` e baixe o modelo com `ollama pull gemma3:12b`.

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
