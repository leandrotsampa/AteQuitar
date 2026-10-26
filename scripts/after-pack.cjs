// Depois de empacotar (electron-builder afterPack): o better-sqlite3 traz o módulo nativo já
// compilado para 8 sistemas/arquiteturas (~2 MB cada). Fica só o do pacote que está sendo gerado.
const fs = require('fs');
const path = require('path');

// Arch do electron-builder: 0 ia32, 1 x64, 2 armv7l, 3 arm64, 4 universal
const ARCH = { 0: 'ia32', 1: 'x64', 2: 'armv7l', 3: 'arm64' };

function findPrebuilds(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    if (entry.name === 'app.asar.unpacked') {
      const prebuilds = path.join(full, 'node_modules', 'better-sqlite3', 'prebuilds');
      return fs.existsSync(prebuilds) ? prebuilds : null;
    }
    const found = findPrebuilds(full);
    if (found) return found;
  }
  return null;
}

exports.default = async function afterPack(context) {
  const arch = ARCH[context.arch];
  const prebuilds = findPrebuilds(context.appOutDir);
  // Universal (macOS com as duas arquiteturas juntas) ou estrutura diferente: não mexe
  if (!arch || !prebuilds) return;
  const keep = `${context.electronPlatformName}-${arch}.node`;
  if (!fs.existsSync(path.join(prebuilds, keep))) {
    throw new Error(`afterPack: módulo do SQLite para ${keep} não encontrado em ${prebuilds}`);
  }
  let removed = 0;
  for (const file of fs.readdirSync(prebuilds)) {
    if (file !== keep) {
      fs.rmSync(path.join(prebuilds, file), { force: true });
      removed++;
    }
  }
  console.log(`  • afterPack: SQLite só para ${keep} (${removed} versões de outros sistemas removidas)`);
};
