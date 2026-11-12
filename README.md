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

## O que ele faz

**Painel** — o mês num relance: orçamento consumido, gasto por categoria, evolução por mês e os lançamentos.
A fatura do cartão conta inteira no mês do vencimento.

**Importar** — arraste o `.ofx` do Nubank ou do Itaú, ou o `.pdf` da fatura do cartão Itaú. Ou nem abra a tela:
salve o arquivo em `~/ChosenFinance/entrada` e ele é importado sozinho em segundos (o que der certo vai para
`importados/`, o que falhar vai para `erros/` com o motivo ao lado). Lançamento repetido não entra duas vezes.

**Categorias por regra** — regras de texto (regex) decidem a categoria de cada lançamento, na ordem que você define.
Pagamento de fatura e transferência entre contas ficam fora dos gastos, para nada contar duas vezes.

**Comparar** — escolha um intervalo de meses e veja total, média, o mês mais caro e o mais barato, e a variação por
categoria e por estabelecimento. A fonte pode ser a fatura importada ou os gastos que você anotou à mão.

**Compromissos** — o que o futuro já deve:
- parcelamentos em aberto e quanto das próximas faturas já está comprometido;
- assinaturas, achadas sozinhas pelas cobranças que se repetem todo mês;
- financiamentos pagos fora do cartão (carro, empréstimo);
- **Simular**: desmarque o que vai quitar ou cancelar, acrescente o que pretende assinar, e veja o novo mês.

**Gastos manuais** — o que não passa pelo cartão (dinheiro, Pix) entra à mão, com categoria e orçamento.

**Eventos** — rache o churrasco, a hamburgada ou a viagem:
- participantes com **peso** (quem comeu o dobro paga o dobro) e casais/famílias cobrados juntos (`Ana + Beto`);
- **Ler recibo**: cole o link do QR code da NFC-e (valores exatos da SEFAZ) ou mande a foto do cupom (OCR do macOS +
  modelo local), confira os itens e lance tudo de uma vez;
- quem paga quem, cobrança por **Pix** com QR Code e copia e cola, acréscimo da organização em percentual;
- **Copiar resumo** para o grupo e **Exportar PDF** pronto para compartilhar.

**Assistente** — converse sobre os seus gastos ("por que o mês subiu?", "onde dá para cortar?"). Roda no
[Ollama](https://ollama.com) local; as respostas usam os números do próprio app.

**Detalhes que fazem diferença** — *Ocultar valores* troca todo valor por `R$ •••••` para mostrar a tela a alguém;
cartões com cor própria; menu recolhível; tela **Novidades** com o que mudou em cada versão.

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
npm start                        # http://127.0.0.1:4780
npm test
```

No dia a dia ele sobe sob demanda pelo [MyHub](https://github.com/JeanBernardino/myhub), que derruba o app quando
ninguém está usando.

### Configuração (variáveis de ambiente, todas opcionais)

| Variável | Padrão |
|---|---|
| `PORT` | `4780` |
| `DATABASE_URL` | `postgres://localhost/chosen_finance` |
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
