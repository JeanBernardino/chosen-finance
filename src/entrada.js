// Pasta de entrada: todo .ofx/.pdf que cair nela é importado sozinho, sem passar pela tela.
// Importado vai para importados/; o que falhar vai para erros/ com o motivo num .txt ao lado.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const PASTA = process.env.PASTA_ENTRADA || path.join(os.homedir(), "ChosenFinance", "entrada");
const INTERVALO = 5000;
const ESTAVEL = 3000; // arquivo mexido há menos que isso ainda pode estar sendo gravado (download, regra do Mail)

const semAcento = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Cartão pela origem lida ("Nubank cartão"): só com um único cartão ativo daquele banco; senão fica sem cartão. */
export function cartaoDa(origem, cartoes) {
  if (!/cart[aã]o/i.test(origem)) return null;
  const doBanco = cartoes.filter(c => c.ativo && semAcento(origem).includes(semAcento(c.banco)));
  return doBanco.length === 1 ? doBanco[0].id : null;
}

/** `importar(nome, buf)` faz a importação e devolve { lidas, novas }. */
export function vigiar(importar, pasta = PASTA) {
  for (const sub of ["importados", "erros"]) fs.mkdirSync(path.join(pasta, sub), { recursive: true });
  let rodando = false;
  const varrer = async () => {
    if (rodando) return;
    rodando = true;
    try {
      for (const nome of fs.readdirSync(pasta)) {
        const arquivo = path.join(pasta, nome);
        if (!/\.(ofx|pdf)$/i.test(nome) || !fs.statSync(arquivo).isFile() || Date.now() - fs.statSync(arquivo).mtimeMs < ESTAVEL) continue;
        try {
          const r = await importar(nome, fs.readFileSync(arquivo));
          mover(arquivo, path.join(pasta, "importados"));
          console.log(`entrada: ${nome}: ${r.novas} novos de ${r.lidas}`);
        } catch (e) {
          const destino = mover(arquivo, path.join(pasta, "erros"));
          fs.writeFileSync(`${destino}.txt`, `${e.message}\n`);
          console.error(`entrada: ${nome}: ${e.message}`);
        }
      }
    } catch (e) {
      console.error(`entrada: ${e.message}`);
    } finally {
      rodando = false;
    }
  };
  varrer();
  return setInterval(varrer, INTERVALO);
}

// mesmo nome já em importados/ (fatura reimportada): prefixa a hora para não sobrescrever
function mover(arquivo, dir) {
  const nome = path.basename(arquivo);
  const destino = fs.existsSync(path.join(dir, nome)) ? path.join(dir, `${Date.now()}-${nome}`) : path.join(dir, nome);
  fs.renameSync(arquivo, destino);
  return destino;
}
