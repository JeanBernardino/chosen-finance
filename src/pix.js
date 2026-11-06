// Pix copia e cola (BR Code estático do Banco Central) com valor, para cobrar o acerto de um evento.
import QRCode from "qrcode";

// só ASCII: o tamanho de cada campo conta caracteres e os bancos recusam acento
const ascii = (s, max) => s.normalize("NFD").replace(/[^\x20-\x7E]/g, "").trim().slice(0, max);
const campo = (id, v) => id + String(v.length).padStart(2, "0") + v;

/** CRC16-CCITT (polinômio 0x1021, início 0xFFFF), como o manual do BR Code pede. */
export function crc16(s) {
  let crc = 0xffff;
  for (const b of Buffer.from(s, "utf8")) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const cpfValido = d => [9, 10].every(n => [...d.slice(0, n)].reduce((s, x, i) => s + x * (n + 1 - i), 0) * 10 % 11 % 10 === +d[n]);

/** Chave no formato do DICT, senão o banco recusa: celular +55DDDNÚMERO, CPF/CNPJ só dígitos, e-mail minúsculo, aleatória como veio. */
export function normalizarChave(chave) {
  const c = chave.trim();
  if (c.includes("@")) return c.toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c)) return c.toLowerCase();
  const d = c.replace(/\D/g, "");
  if (c.startsWith("+")) return `+${d}`;
  if (d.length === 14 || (d.length === 11 && cpfValido(d))) return d;
  if (/^[1-9]{2}9?\d{8}$/.test(d)) return `+55${d}`;           // DDD + número, sem o país
  if (/^55[1-9]{2}9?\d{8}$/.test(d)) return `+${d}`;
  return c;
}

export function copiaCola({ chave, nome, cidade = "BRASIL", valor }) {
  const corpo = campo("00", "01") + campo("26", campo("00", "br.gov.bcb.pix") + campo("01", normalizarChave(chave)))
    + campo("52", "0000") + campo("53", "986") + campo("54", valor.toFixed(2)) + campo("58", "BR")
    + campo("59", ascii(nome, 25)) + campo("60", ascii(cidade, 15)) + campo("62", campo("05", "***")) + "6304";
  return corpo + crc16(corpo);
}

/** { chave, nome } vêm do evento: o nome no BR Code é só exibição, o banco mostra o titular da chave. */
export async function cobranca(cfg, valor) {
  const texto = copiaCola({ ...cfg, valor });
  return { copiaCola: texto, svg: await QRCode.toString(texto, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) };
}
