---
name: release
description: Entrega uma versão do Chosen Finance — versão nova (semver), notas no CHANGELOG.md, tag, release no GitHub e tela Novidades. Use quando falarem em release, nova versão, publicar, lançar ou subir versão, ou ao fim de uma mudança pronta para entregar.
---

# release — entregar uma versão

Toda versão vira tag `vX.Y.Z`, release no GitHub com as notas e a tela **Novidades** do app. A fonte única das notas é o
`CHANGELOG.md`; o trabalho mecânico é do `scripts/release.mjs`.

1. **Conferir:** o trabalho está commitado na `main`, separado por responsabilidade, com teste para o que mudou.
2. **Versão:** correção = `patch`; algo novo ou visivelmente diferente = `minor`; exige ação de quem usa = `major`.
   Antes da 1.0, novidade é `minor`. Escolha pela regra; na dúvida, o maior.
3. **Notas:** seção nova no topo do `CHANGELOG.md`, `## [X.Y.Z] - AAAA-MM-DD`, com `### Novo`, `### Melhorado`,
   `### Corrigido` (só as que tiverem itens). Em pt-BR, para quem usa: o que muda na tela, não o nome da função.
   Nunca valores, descrições de lançamentos ou outro dado financeiro real: as notas vão para o GitHub.
   A tela Novidades renderiza `###`, listas `-`, `**negrito**` e `` `código` ``.
4. **Publicar:** `RELEASE_TRAILER="<trailer de coautoria da sessão>" npm run release -- <patch|minor|major>`.
   O script exige `main` em dia com a `origin` e nada pendente além do `CHANGELOG.md`, roda `npm test`, sobe a versão no
   `package.json`, commita `Release vX.Y.Z`, cria a tag, faz o push e publica o release. `--dry-run` confere sem publicar.
5. **Reportar:** versão e link do release (`gh release view vX.Y.Z`).

Falhou depois do push: não apague nem recrie a tag publicada.
