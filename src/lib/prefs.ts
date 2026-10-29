// Preferências da interface (tema, sons e menu, tutoriais vistos, versão ignorada). No app ficam no
// banco SQLite, junto com os dados: copiar o arquivo leva tudo. No navegador de desenvolvimento,
// que não tem o banco, ficam no localStorage

const BROWSER_PREFIX = 'atequitar_pref:';

let cache: Map<string, string> | null = null;

function fromDatabase(): Map<string, string> {
  if (!cache) cache = new Map(Object.entries(window.electronAPI?.prefs ?? {}));
  return cache;
}

export function getPref(key: string): string | null {
  if (window.electronAPI) return fromDatabase().get(key) ?? null;
  try {
    return localStorage.getItem(BROWSER_PREFIX + key);
  } catch {
    return null;
  }
}

// Nulo apaga a preferência
export function setPref(key: string, value: string | null): void {
  if (window.electronAPI) {
    const prefs = fromDatabase();
    if (value === null) prefs.delete(key);
    else prefs.set(key, value);
    void window.electronAPI.writePref?.(key, value);
    return;
  }
  try {
    if (value === null) localStorage.removeItem(BROWSER_PREFIX + key);
    else localStorage.setItem(BROWSER_PREFIX + key, value);
  } catch {
    // Sem armazenamento: vale só até fechar
  }
}

// Até a 1.2.1 as preferências ficavam no localStorage, dividido entre todos os bancos: na primeira
// abertura elas passam para cá e saem de lá. Os tutoriais, que dependem do banco, migram ao carregar
// os dados (tourState)
const LEGACY: [string, string][] = [
  ['atequitar_theme', 'theme'],
  ['atequitar_ui_v1', 'ui'],
  ['atequitar:update-skipped', 'update-skipped'],
];

export function migrateLegacyPrefs(): void {
  try {
    for (const [old, key] of LEGACY) {
      const value = localStorage.getItem(old);
      if (value === null) continue;
      if (getPref(key) === null) setPref(key, value);
      localStorage.removeItem(old);
    }
  } catch {
    // Sem localStorage: nada a migrar
  }
}
