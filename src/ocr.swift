// OCR local do macOS (Vision) para a foto do cupom: imprime o texto linha a linha.
// O cupom tem colunas que o Vision devolve como blocos separados: junta os blocos da mesma altura numa linha.
import Foundation
import Vision

let req = VNRecognizeTextRequest()
req.recognitionLevel = .accurate
req.recognitionLanguages = ["pt-BR"]
req.usesLanguageCorrection = false  // corrigir "palavras" estraga códigos e valores
try VNImageRequestHandler(url: URL(fileURLWithPath: CommandLine.arguments[1])).perform([req])
let blocos = (req.results ?? []).compactMap { o in o.topCandidates(1).first.map { (o.boundingBox, $0.string) } }
var linhas: [(y: CGFloat, h: CGFloat, partes: [(CGFloat, String)])] = []
for (b, s) in blocos.sorted(by: { $0.0.midY > $1.0.midY }) {
  if let i = linhas.firstIndex(where: { abs($0.y - b.midY) < min($0.h, b.height) * 0.5 }) { linhas[i].partes.append((b.minX, s)) }
  else { linhas.append((b.midY, b.height, [(b.minX, s)])) }
}
for l in linhas { print(l.partes.sorted { $0.0 < $1.0 }.map { $0.1 }.joined(separator: "  ")) }
