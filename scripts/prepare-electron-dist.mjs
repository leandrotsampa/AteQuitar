// Prepara uma cópia extraída do Electron em .electron-dist para o electron-builder usar via electronDist.
// Evita o erro EPERM ao renomear release\win-unpacked.tmp (arquivos recém-extraídos travados pelo antivírus):
// com electronDist o builder apenas copia esta pasta, sem extrair nem renomear.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { downloadArtifact } from '@electron/get';

const root = resolve(import.meta.dirname, '..');
const outDir = join(root, '.electron-dist');
const versionFile = join(outDir, '.version');
const { version } = JSON.parse(readFileSync(join(root, 'node_modules', 'electron', 'package.json'), 'utf8'));
const platform = 'win32';
const arch = 'x64';
const stamp = `${version}-${platform}-${arch}`;

if (existsSync(join(outDir, 'electron.exe')) && existsSync(versionFile) && readFileSync(versionFile, 'utf8') === stamp) {
  console.log(`Electron ${stamp} já preparado em .electron-dist`);
  process.exit(0);
}

// Usa o cache local do Electron; baixa apenas se o zip ainda não estiver lá
const zipPath = await downloadArtifact({ version, platform, arch, artifactName: 'electron' });

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

// tar.exe do Windows (bsdtar) extrai .zip; PowerShell como alternativa
const systemTar = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
if (existsSync(systemTar)) {
  execFileSync(systemTar, ['-xf', zipPath, '-C', outDir], { stdio: 'inherit' });
} else {
  execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${outDir}' -Force`], { stdio: 'inherit' });
}

if (!existsSync(join(outDir, 'electron.exe'))) {
  console.error('Falha ao extrair o Electron: electron.exe não encontrado em .electron-dist');
  process.exit(1);
}

writeFileSync(versionFile, stamp);
console.log(`Electron ${stamp} preparado em .electron-dist`);
