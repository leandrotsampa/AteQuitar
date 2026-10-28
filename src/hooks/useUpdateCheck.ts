import { useCallback, useEffect, useState } from 'react';
import { fetchLatestRelease, isNewerVersion, type Release } from '../lib/updates';

// Consulta ao abrir e a cada 6 horas com o app aberto. "Mais tarde" esconde até a próxima abertura;
// "Ignorar esta versão" fica no localStorage e só volta a avisar quando sair outra mais nova
const INTERVAL = 6 * 60 * 60 * 1000;
const SKIPPED_KEY = 'atequitar:update-skipped';

const readSkipped = (): string => {
  try {
    return localStorage.getItem(SKIPPED_KEY) ?? '';
  } catch {
    return '';
  }
};

export function useUpdateCheck(): { update: Release | null; later: () => void; skip: () => void } {
  const [latest, setLatest] = useState<Release | null>(null);
  const [skipped, setSkipped] = useState(readSkipped);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = () =>
      void fetchLatestRelease().then((r) => {
        if (alive && r) setLatest(r);
      });
    check();
    const id = window.setInterval(check, INTERVAL);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const later = useCallback(() => setHidden(true), []);
  const skip = useCallback(() => {
    if (!latest) return;
    try {
      localStorage.setItem(SKIPPED_KEY, latest.version);
    } catch {
      // sem localStorage: vale só até fechar o app
    }
    setSkipped(latest.version);
  }, [latest]);

  const update =
    latest && !hidden && isNewerVersion(latest.version, __APP_VERSION__) && latest.version !== skipped ? latest : null;
  return { update, later, skip };
}
