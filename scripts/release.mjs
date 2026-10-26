// Publica uma versão: confere o git e as notas, testa, sobe a versão, cria a tag, faz o push e publica o release no
// GitHub com as notas do CHANGELOG.md (a mesma fonte da tela Novidades).
//   npm run release -- <patch|minor|major|X.Y.Z> [--dry-run]
// Antes: o trabalho commitado e a seção "## [X.Y.Z] - AAAA-MM-DD" escrita no CHANGELOG.md (pode estar sem commit).
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2), bump = args.find(a => !a.startsWith("--"));
const run = (cmd, a) => execFileSync(cmd, a, { stdio: "inherit" });
const out = (cmd, a) => execFileSync(cmd, a, { encoding: "utf8" }).trim();
const fail = msg => { console.error(`✗ ${msg}`); process.exit(1); };

const { version } = JSON.parse(fs.readFileSync("package.json"));
const [ma, mi, pa] = version.split(".").map(Number);
const next = /^\d+\.\d+\.\d+$/.test(bump ?? "") ? bump
  : { patch: `${ma}.${mi}.${pa + 1}`, minor: `${ma}.${mi + 1}.0`, major: `${ma + 1}.0.0` }[bump]
  ?? fail("diga o tipo: npm run release -- patch|minor|major|X.Y.Z");

// 1. git: sai da main, em dia com a origin, sem trabalho solto (só o CHANGELOG pode estar pendente)
if (out("git", ["branch", "--show-current"]) !== "main") fail("o release sai da main");
run("git", ["fetch", "-q", "origin"]);
if (out("git", ["rev-list", "--count", "HEAD..origin/main"]) !== "0") fail("a main local está atrás da origin: git pull");
const loose = out("git", ["status", "--porcelain"]).split("\n").filter(l => l && !l.endsWith(" CHANGELOG.md"));
if (loose.length) fail(`commite o trabalho antes do release:\n${loose.join("\n")}`);
if (out("git", ["tag", "-l", `v${next}`])) fail(`a tag v${next} já existe`);

// 2. notas: a mesma seção vira o release no GitHub e a tela Novidades
const section = fs.readFileSync("CHANGELOG.md", "utf8").split(/^## /m).find(s => s.startsWith(`[${next}]`));
if (!section) fail(`falta a seção "## [${next}] - AAAA-MM-DD" no CHANGELOG.md`);
const notes = section.split("\n").slice(1).join("\n").trim();
if (!notes) fail(`a seção ${next} do CHANGELOG.md está vazia`);

// 3. testes: nada sai com teste vermelho
run("npm", ["test"]);
if (args.includes("--dry-run")) { console.log(`\n✓ pronto para v${next} (dry-run, nada publicado):\n\n${notes}`); process.exit(0); }

// 4. versão, commit, tag e push
run("npm", ["version", next, "--no-git-tag-version"]);
const trailer = process.env.RELEASE_TRAILER ? ["--trailer", process.env.RELEASE_TRAILER] : [];
run("git", ["add", "package.json", "package-lock.json", "CHANGELOG.md"]);
run("git", ["commit", "-q", "-m", `Release v${next}`, ...trailer]);
run("git", ["tag", "-a", `v${next}`, "-m", `v${next}`]);
run("git", ["push", "-q", "origin", "main", `v${next}`]);

// 5. release no GitHub
run("gh", ["release", "create", `v${next}`, "--title", `v${next}`, "--notes", notes, "--verify-tag"]);
console.log(`\n✓ v${next} publicada: ${out("gh", ["release", "view", `v${next}`, "--json", "url", "--jq", ".url"])}`);
