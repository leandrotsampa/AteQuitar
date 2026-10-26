// Gera as notas da release a partir dos commits desde a última tag (padrão "tipo: descrição")
// e atualiza o CHANGELOG.md. Uso: node scripts/release-notes.mjs <versão> <arquivo-de-notas>
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const [version, notesFile] = process.argv.slice(2);
if (!version || !notesFile) {
  console.error('Uso: node scripts/release-notes.mjs <versão> <arquivo-de-notas>');
  process.exit(1);
}

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

let previousTag = '';
try {
  previousTag = git('describe', '--tags', '--abbrev=0', '--match', 'v*');
} catch {
  // primeira release: considera todo o histórico
}

const range = previousTag ? `${previousTag}..HEAD` : 'HEAD';
const log = git('log', range, '--no-merges', '--pretty=format:%h%x1f%s');
const commits = log ? log.split('\n').map((line) => line.split('\x1f')) : [];

const SECTIONS = [
  ['feat', '✨ Novidades'],
  ['fix', '🐛 Correções'],
  ['perf', '⚡ Desempenho'],
  ['refactor', '♻️ Melhorias internas'],
  ['docs', '📝 Documentação'],
  ['build', '📦 Build e distribuição'],
  ['ci', '📦 Build e distribuição'],
  ['chore', '🔧 Manutenção'],
];

const groups = new Map();
for (const [hash, subject] of commits) {
  if (/^chore\(release\)/.test(subject)) continue;
  const match = subject.match(/^(\w+)(?:\([^)]*\))?!?:\s*(.+)$/);
  const type = match?.[1] ?? 'outros';
  const text = match?.[2] ?? subject;
  const title = SECTIONS.find(([t]) => t === type)?.[1] ?? '📌 Outras mudanças';
  if (!groups.has(title)) groups.set(title, []);
  groups.get(title).push(`- ${text.charAt(0).toUpperCase()}${text.slice(1)} (${hash})`);
}

const order = [...new Set(SECTIONS.map(([, title]) => title)), '📌 Outras mudanças'];
const body = order
  .filter((title) => groups.has(title))
  .map((title) => `### ${title}\n\n${groups.get(title).join('\n')}`)
  .join('\n\n');

const date = new Date().toISOString().slice(0, 10);
const section = `## v${version} (${date})\n\n${body || '- Sem mudanças registradas nos commits.'}\n`;
writeFileSync(notesFile, `${body || '- Sem mudanças registradas nos commits.'}\n`);

// CHANGELOG.md: a versão nova entra no topo, logo abaixo do título
const header = '# Changelog\n\nTodas as versões do Até Quitar e o que mudou em cada uma.\n\n';
const current = existsSync('CHANGELOG.md') ? readFileSync('CHANGELOG.md', 'utf8') : header;
const rest = current.startsWith(header) ? current.slice(header.length) : current;
writeFileSync('CHANGELOG.md', `${header}${section}\n${rest}`.replace(/\n{3,}/g, '\n\n'));

console.log(`Notas de v${version} geradas (${commits.length} commits desde ${previousTag || 'o início'})`);
