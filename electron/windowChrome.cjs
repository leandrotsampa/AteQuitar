/**
 * Moldura da janela: barra de título desenhada pelo app (sem o menu nativo)
 * e os atalhos que antes vinham do menu padrão do Electron.
 * Funções puras, testadas em windowChrome.test.ts.
 */

// Windows e Linux: sem barra nem botões nativos; minimizar, maximizar e fechar são do próprio app
// (assim acompanham o tema junto com a página). macOS: os botões coloridos do sistema, embutidos
function usesCustomWindowControls(platform) {
  return platform !== 'darwin';
}

function windowChromeOptions(platform) {
  return usesCustomWindowControls(platform) ? { titleBarStyle: 'hidden' } : { titleBarStyle: 'hiddenInset' };
}

// Comandos de janela que a página pode pedir; qualquer outro valor é ignorado
const WINDOW_CONTROLS = ['minimize', 'toggle-maximize', 'close'];
function windowControlFor(action) {
  return WINDOW_CONTROLS.includes(action) ? action : null;
}

// Atalho de teclado tratado pelo app; null deixa a tecla seguir para a página
function shortcutFor(input, isPackaged) {
  const mod = input.control || input.meta;
  if (!mod) return null;
  const key = String(input.key).toLowerCase();
  if (key === '=' || key === '+') return 'zoom-in';
  if (key === '-') return 'zoom-out';
  if (key === '0') return 'zoom-reset';
  if (isPackaged) return null;
  if (key === 'r' && !input.shift) return 'reload';
  if (key === 'i' && input.shift) return 'devtools';
  return null;
}

module.exports = { usesCustomWindowControls, windowChromeOptions, windowControlFor, shortcutFor };
