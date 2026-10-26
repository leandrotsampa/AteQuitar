/**
 * Onde o banco fica. Função pura, testada em dataDirectory.test.ts.
 *
 * Devolve a pasta "ao lado do app" (modo portátil) ou null para usar a pasta de dados do usuário
 * (userData), que sobrevive a atualizações e à desinstalação.
 */
const path = require('path');

function portableDirectoryFor({ env, platform, isPackaged, exePath, cwd }) {
  // Windows portátil (electron-builder portable): pasta real do .exe, não a cópia extraída em temp
  if (env.PORTABLE_EXECUTABLE_DIR) return env.PORTABLE_EXECUTABLE_DIR;
  // Linux AppImage: pasta do arquivo .AppImage (o app em si roda de uma montagem somente leitura)
  if (env.APPIMAGE) return path.posix.dirname(env.APPIMAGE);
  // Em desenvolvimento: a pasta do projeto
  if (!isPackaged) return cwd;
  // Windows instalado e macOS: a pasta do programa é trocada a cada atualização
  if (platform === 'win32' || platform === 'darwin') return null;
  // Outros pacotes Linux: ao lado do executável (se não der para gravar, cai para userData)
  return path.dirname(exePath);
}

module.exports = { portableDirectoryFor };
