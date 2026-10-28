// Texto de um PDF em linhas, como aparecem na página: os pedaços de uma mesma altura viram uma
// linha, da esquerda para a direita, separados por "|". O leitor (pdf.js) só carrega quando usado

import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

export async function pdfLines(data: ArrayBuffer): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  const doc = await task.promise;
  const lines: string[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const rows: { y: number; parts: { x: number; s: string }[] }[] = [];
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        const x = item.transform[4];
        const y = item.transform[5];
        // Mesma linha: alturas a até 2 pontos uma da outra
        let row = rows.find((r) => Math.abs(r.y - y) <= 2);
        if (!row) rows.push((row = { y, parts: [] }));
        row.parts.push({ x, s: item.str.trim() });
      }
      rows.sort((a, b) => b.y - a.y);
      for (const r of rows) lines.push(r.parts.sort((a, b) => a.x - b.x).map((part) => part.s).join(' | '));
    }
  } finally {
    void task.destroy();
  }
  return lines;
}
