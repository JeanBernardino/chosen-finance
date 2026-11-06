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

export function copiaCola({ chave, nome, cidade = "BRASIL", valor }) {
  const corpo = campo("00", "01") + campo("26", campo("00", "br.gov.bcb.pix") + campo("01", chave.trim()))
    + campo("52", "0000") + campo("53", "986") + campo("54", valor.toFixed(2)) + campo("58", "BR")
    + campo("59", ascii(nome, 25)) + campo("60", ascii(cidade, 15)) + campo("62", campo("05", "***")) + "6304";
  return corpo + crc16(corpo);
}

/** { chave, nome } vêm do evento: o nome no BR Code é só exibição, o banco mostra o titular da chave. */
export async function cobranca(cfg, valor) {
  const texto = copiaCola({ ...cfg, valor });
  return { copiaCola: texto, svg: await QRCode.toString(texto, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) };
}
