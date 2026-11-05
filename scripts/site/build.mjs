// Monta o site estático em _site/ (rode com: npm run site:build).
// Junta as páginas de site/ com as capturas de docs/ e o ícone do app, sem duplicar imagens no repositório.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, '_site');

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'img'), { recursive: true });
cpSync(join(root, 'site'), out, { recursive: true });
cpSync(join(root, 'docs', 'screenshots'), join(out, 'img'), { recursive: true });
cpSync(join(root, 'docs', 'demo.webp'), join(out, 'img', 'demo.webp'));
cpSync(join(root, 'build', 'icon.png'), join(out, 'icon.png'));

console.log('Site montado em _site/');
