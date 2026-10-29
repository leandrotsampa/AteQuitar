import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPref, migrateLegacyPrefs, setPref } from './prefs';

describe('preferências', () => {
  const store = new Map<string, string>();
  const written: [string, string | null][] = [];
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  beforeEach(() => {
    store.clear();
    written.length = 0;
    vi.stubGlobal('localStorage', storage);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('no app, as antigas do localStorage passam para o banco e saem de lá', () => {
    store.set('atequitar_theme', 'dark');
    store.set('atequitar:update-skipped', '1.2.0');
    vi.stubGlobal('window', {
      electronAPI: { prefs: { ui: '{"sidebar":"collapsed"}' }, writePref: async (k: string, v: string | null) => void written.push([k, v]) },
    });
    store.set('atequitar_ui_v1', '{"sidebar":"expanded"}');
    migrateLegacyPrefs();
    expect(written).toEqual([
      ['theme', 'dark'],
      ['update-skipped', '1.2.0'],
    ]);
    // O que o banco já tinha vale mais que o antigo
    expect(getPref('ui')).toBe('{"sidebar":"collapsed"}');
    expect([...store.keys()]).toEqual([]);
  });

  it('no navegador de desenvolvimento, ficam no localStorage', () => {
    vi.stubGlobal('window', {});
    setPref('theme', 'dark');
    expect(store.get('atequitar_pref:theme')).toBe('dark');
    setPref('theme', null);
    expect(getPref('theme')).toBeNull();
  });
});
