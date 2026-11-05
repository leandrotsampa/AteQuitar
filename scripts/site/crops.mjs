// Recorta as capturas de docs/screenshots nos trechos que o site mostra (rode com: npm run site:crops).
// Um recorte grande por recurso, em vez da tela inteira reduzida. Os que têm captura no tema
// escuro ganham a versão -escuro. As imagens geradas ficam em site/img e vão para o repositório.
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const shots = join(root, 'docs', 'screenshots');
const out = join(root, 'site', 'img');
mkdirSync(out, { recursive: true });

// [arquivo de saída, captura, recorte { left, top, width, height } em pixels da captura]
const CROPS = [
  ['recorte-casa', 'minha-casa', { left: 304, top: 140, width: 1108, height: 428 }],
  ['recorte-casa-escuro', 'minha-casa-escuro', { left: 304, top: 140, width: 1108, height: 428 }],
  ['recorte-amortizar', 'amortizar', { left: 304, top: 194, width: 1108, height: 554 }],
  ['recorte-amortizar-escuro', 'amortizar-escuro', { left: 304, top: 194, width: 1108, height: 554 }],
  ['recorte-check-in', 'check-in', { left: 420, top: 303, width: 600, height: 574 }],
  ['recorte-investir', 'amortizar-ou-investir', { left: 806, top: 194, width: 606, height: 676 }],
  ['recorte-taxa', 'minha-taxa', { left: 304, top: 194, width: 1116, height: 520 }],
  ['recorte-parcela', 'minha-casa-detalhes', { left: 304, top: 435, width: 1108, height: 407 }],
];

for (const [name, shot, box] of CROPS) {
  const file = join(out, `${name}.png`);
  await sharp(join(shots, `${shot}.png`)).extract(box).png({ compressionLevel: 9, palette: true, quality: 95 }).toFile(file);
  console.log(`site/img/${name}.png (${box.width} × ${box.height})`);
}
