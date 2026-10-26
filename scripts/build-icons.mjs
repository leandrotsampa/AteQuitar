// Gera os ícones do app a partir de build/icon.svg: PNG (janela e Linux/macOS) e ICO (Windows)
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const root = resolve(import.meta.dirname, '..');
const svg = readFileSync(join(root, 'build', 'icon.svg'));

const png = (size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();

writeFileSync(join(root, 'build', 'icon.png'), await png(512));
writeFileSync(join(root, 'public', 'icon.png'), await png(256));
const sizes = await Promise.all([16, 24, 32, 48, 64, 128, 256].map(png));
writeFileSync(join(root, 'build', 'icon.ico'), await pngToIco(sizes));
console.log('Ícones gerados em build/ e public/');
