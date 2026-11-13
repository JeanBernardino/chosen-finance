<p align="center">
  <img src="public/logo.png" alt="Chosen Finance" width="120">
</p>

<h1 align="center">Chosen Finance</h1>

<p align="center">
  <b>Para onde vai o seu dinheiro, sem entregar o seu banco a ninguém.</b><br>
  Controle financeiro pessoal que roda só na sua máquina: importa extratos e faturas, categoriza sozinho e mostra o que importa.
</p>

<p align="center">
  <code>Node 22+</code> · <code>PostgreSQL</code> · <code>JS puro, sem build</code> · <code>127.0.0.1:4780</code>
</p>

---

## Por que existe

Agregadores de Open Finance pedem acesso às suas contas e cobram por isso. O Chosen Finance faz o caminho oposto:
**você** baixa o extrato do banco e o app lê o arquivo. Nada sai da máquina — nem os dados, nem as perguntas que você
faz ao assistente, que roda num modelo local.

| Princípio | Na prática |
|---|---|
| **Local** | O servidor escuta só em `127.0.0.1`; o banco é um Postgres seu. |
| **Grátis** | Sem assinatura, sem agregador, sem API paga. |
| **Simples** | Node puro no servidor, HTML/CSS/JS no front, sem framework nem etapa de build. |
| **Seus arquivos** | Extratos (`.ofx`) e faturas (`.pdf`) ficam fora do git (`.gitignore`). |

## Experimente com dados de exemplo

Não tem fatura importada ou não quer mostrar os seus números? Clique em **Ver dados de exemplo**, no rodapé do menu.
O app passa a usar um banco à parte (`chosen_finance_demo`), com seis meses de faturas fictícias de dois cartões,
gastos manuais, orçamentos, financiamentos, parcelamentos e dois eventos. Todas as telas funcionam com ele.

- **Alternar à vontade:** **Voltar aos meus dados** volta para o seu banco. Os dois nunca se misturam.
- **Mexa sem medo:** tudo o que você fizer no exemplo (importar, editar, excluir) fica só no banco de exemplo e
  continua lá na próxima vez que você entrar nele.
- **Recomeçar:** **Recriar exemplo**, na faixa verde do topo, apaga o que foi feito no exemplo e gera tudo de novo,
  com as datas do mês atual.
- **Pasta de entrada:** o que cair em `~/ChosenFinance/entrada` vai sempre para o seu banco real, mesmo com o exemplo
  ligado.

O banco de exemplo é criado sozinho na primeira vez, no mesmo Postgres. Ao reiniciar o servidor, o app volta para os
seus dados.

## Telas

### Visão geral
O mês num relance. Os cartões do topo mostram o gasto do mês, a parte de cada cartão, as parcelas a pagar e os
lançamentos sem categoria. Abaixo vêm o **orçamento** consumido por categoria, o gasto **por categoria** e **por mês**
(empilhado por cartão) e a lista de **lançamentos**, com busca, filtro por cartão e ordenação. A fatura do cartão
conta inteira no mês do vencimento.

### Comparar
Escolha um intervalo de meses e veja total, média, o mês mais caro e o mais barato, a variação mês a mês e a variação
por categoria e por estabelecimento. A fonte pode ser a **fatura** importada ou os **gastos manuais**; as duas nunca se
somam.

### Compromissos
O que o futuro já deve:
- **Parcelas por mês:** quanto foi pago nos últimos meses e quanto dos próximos já está comprometido.
- **Parcelamentos em aberto:** cada compra parcelada pela última parcela vista, com quantas faltam e quanto falta pagar,
  mais os **financiamentos** pagos fora do cartão (carro, empréstimo).
- **Assinaturas:** achadas sozinhas pelas cobranças que se repetem todo mês, com aviso de aumento de preço.
- **Simular:** desmarque o que vai quitar ou cancelar, acrescente o que pretende assinar e veja como fica o mês.

### Gastos manuais
O que não passa pelo cartão (dinheiro, Pix) entra à mão, com data, categoria e valor, e aparece com os resumos do mês.

### Eventos
Rache o churrasco, a hamburgada ou a viagem:
- participantes com **peso** (quem comeu o dobro paga o dobro) e casais ou famílias cobrados juntos (`Ana + Beto`);
- **Ler recibo:** cole o link do QR code da NFC-e (valores exatos da SEFAZ) ou mande a foto do cupom (OCR do macOS +
  modelo local), confira os itens e lance tudo de uma vez;
- **Divisão:** quem paga quem, **Marcar pago** em cada acerto, cobrança por **Pix** com QR Code e copia e cola, e
  acréscimo da organização em percentual;
- **Copiar resumo** para o grupo e **Exportar PDF** pronto para compartilhar;
- evento encerrado pode ser **inativado** e sai da lista (marque **Mostrar inativos** para ver).

### Importar faturas
Arraste o `.ofx` do Nubank ou do Itaú, ou o `.pdf` da fatura do cartão Itaú. Ou nem abra a tela: salve o arquivo em
`~/ChosenFinance/entrada` e ele é importado sozinho em segundos (o que der certo vai para `importados/`, o que falhar
vai para `erros/` com o motivo ao lado). Lançamento repetido não entra duas vezes. O **histórico de importações** mostra
cada arquivo e permite excluir os lançamentos dele para importar de novo.

### Cartões
Cadastro dos cartões com banco e cor própria, usada em todo o app. Cartão com lançamentos não é excluído, só
desativado.

### Configurações
- **Regras de categoria:** regex na descrição decide a categoria de cada lançamento; a primeira que casar vence, e a
  ordem é sua. Pagamento de fatura e transferência entre contas ficam fora dos gastos, para nada contar duas vezes.
- **Orçamento:** um limite por categoria, por mês.

### Novidades
O que mudou em cada versão, lido do [`CHANGELOG.md`](CHANGELOG.md). A versão atual aparece no rodapé do menu.

### Assistente
O botão redondo no canto abre a conversa sobre os seus gastos ("por que o mês subiu?", "onde dá para cortar?"). Roda no
[Ollama](https://ollama.com) local, e as respostas usam os números do próprio app (os de exemplo, se o exemplo estiver
ligado).

### No rodapé do menu
**Ver dados de exemplo** liga e desliga o exemplo. **Ocultar valores** troca todo valor por `R$ •••••` para mostrar a
tela a alguém. **Tema claro/escuro** e **Recolher menu** (ao lado da logo) ficam salvos no navegador.

## Como funciona

```
 extrato .ofx / fatura .pdf ──▶ ~/ChosenFinance/entrada (vigiada) ─┐
                                tela Importar ─────────────────────┤
                                                                   ▼
 navegador ◀── JSON ── servidor Node (127.0.0.1:4780) ──▶ importadores ──▶ PostgreSQL
                              │                                          (transações, regras,
                              ├──▶ Ollama local   (assistente, recibo)    cartões, eventos…)
                              └──▶ Vision do macOS (OCR do cupom)
```

| Arquivo | Papel |
|---|---|
| `src/server.js` | API JSON e arquivos estáticos; só em `127.0.0.1` |
| `src/db.js` | conexão e migrações do Postgres (`create table if not exists`) |
| `src/importadores.js` | leitura de OFX e da fatura PDF do Itaú (`pdfjs-dist`) |
| `src/categorias.js` | regras padrão e categorização |
| `src/demo.js` | dados de exemplo e o banco à parte que os guarda |
| `src/entrada.js` | pasta de entrada vigiada |
| `src/assistente.js` | contexto dos gastos + conversa com o Ollama |
| `src/recibo.js`, `src/ocr.swift` | NFC-e pela SEFAZ e foto do cupom (Vision + Ollama) |
| `src/pix.js` | BR Code do Pix (copia e cola + QR) |
| `public/` | a tela: `index.html`, `app.js`, `analises.js`, `app.css` |

## Rodar

Requisitos: Node 22+, PostgreSQL local e, para assistente e foto de cupom, o Ollama com um modelo baixado.

```sh
createdb chosen_finance          # as tabelas nascem sozinhas na primeira subida
npm install
npm start                        # http://127.0.0.1:4780 · sem dados? clique em "Ver dados de exemplo"
npm test
```

No dia a dia ele sobe sob demanda pelo [MyHub](https://github.com/JeanBernardino/myhub), que derruba o app quando
ninguém está usando.

### Configuração (variáveis de ambiente, todas opcionais)

| Variável | Padrão |
|---|---|
| `PORT` | `4780` |
| `DATABASE_URL` | `postgres://localhost/chosen_finance` |
| `DEMO_DATABASE_URL` | `postgres://localhost/chosen_finance_demo` (dados de exemplo) |
| `PASTA_ENTRADA` | `~/ChosenFinance/entrada` |
| `OLLAMA_URL` | `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | `gemma3:12b` |

## Versões

Cada entrega vira versão: notas em [`CHANGELOG.md`](CHANGELOG.md) (escritas para quem usa), tag `vX.Y.Z`, release
no GitHub e a tela **Novidades** do app.

```sh
npm run release -- minor         # patch | minor | major   (--dry-run confere sem publicar)
```

O passo a passo está na skill [`.claude/skills/release`](.claude/skills/release/SKILL.md). As notas nunca levam
valores ou lançamentos reais: elas vão para o GitHub.
