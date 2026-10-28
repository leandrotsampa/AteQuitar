// Versão nova no GitHub: o app só consulta e avisa; quem baixa é o usuário, pela página da versão

const LATEST_RELEASE = 'https://api.github.com/repos/leandrotsampa/AteQuitar/releases/latest';

export interface Release {
  version: string;
  url: string;
}

const parts = (v: string): number[] =>
  v
    .trim()
    .replace(/^v/i, '')
    .split(/[.-]/)
    .slice(0, 3)
    .map((p) => parseInt(p, 10) || 0);

// "v1.2.0" é mais nova que "1.1.9"; versões iguais ou mais antigas não contam
export function isNewerVersion(latest: string, current: string): boolean {
  const a = parts(latest);
  const b = parts(current);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

// A última versão publicada (o GitHub já deixa de fora rascunhos e pré-lançamentos). Sem internet: null
export async function fetchLatestRelease(): Promise<Release | null> {
  try {
    const res = await fetch(LATEST_RELEASE, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    const json = (await res.json()) as { tag_name?: string; html_url?: string };
    if (!json.tag_name || !json.html_url?.startsWith('https://github.com/')) return null;
    return { version: json.tag_name.replace(/^v/i, ''), url: json.html_url };
  } catch {
    return null;
  }
}
