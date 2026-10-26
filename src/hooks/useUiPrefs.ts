import { useSyncExternalStore } from 'react';

// Preferências de interface (não fiscais): ficam no localStorage, como o tema
export interface UiPrefs {
  soundEnabled: boolean;
  soundVolume: number; // 0 a 1
  sidebar: 'expanded' | 'collapsed';
}

export const DEFAULT_UI_PREFS: UiPrefs = { soundEnabled: true, soundVolume: 0.4, sidebar: 'expanded' };

const UI_PREFS_STORAGE_KEY = 'atequitar_ui_v1';

// Lê o que foi salvo; campo ausente ou fora do formato usa o padrão
export function parseUiPrefs(raw: string | null): UiPrefs {
  if (!raw) return DEFAULT_UI_PREFS;
  try {
    const p = JSON.parse(raw);
    return {
      soundEnabled: typeof p.soundEnabled === 'boolean' ? p.soundEnabled : DEFAULT_UI_PREFS.soundEnabled,
      soundVolume:
        typeof p.soundVolume === 'number' && p.soundVolume >= 0 && p.soundVolume <= 1
          ? p.soundVolume
          : DEFAULT_UI_PREFS.soundVolume,
      sidebar: p.sidebar === 'collapsed' || p.sidebar === 'expanded' ? p.sidebar : DEFAULT_UI_PREFS.sidebar,
    };
  } catch {
    return DEFAULT_UI_PREFS;
  }
}

// Uma única cópia em memória para todos os componentes ficarem em sincronia
let current: UiPrefs | null = null;
const listeners = new Set<() => void>();

export function getUiPrefs(): UiPrefs {
  if (!current) {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(UI_PREFS_STORAGE_KEY);
    } catch {
      // Fallback
    }
    current = parseUiPrefs(raw);
  }
  return current;
}

export function setUiPrefs(patch: Partial<UiPrefs>): void {
  current = { ...getUiPrefs(), ...patch };
  try {
    localStorage.setItem(UI_PREFS_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Fallback
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useUiPrefs(): [UiPrefs, (patch: Partial<UiPrefs>) => void] {
  const prefs = useSyncExternalStore(subscribe, getUiPrefs);
  return [prefs, setUiPrefs];
}
