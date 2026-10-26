// Dados do app num único documento: no Electron, banco SQLite local (o processo principal
// converte o documento em tabelas); no navegador, localStorage
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BalanceCheckpoint, CheckIn, Contract, ExtraPayment } from '../types/finance';
import { FALLBACK_RATES, type MarketRates } from './rates';

export interface AppData {
  version: 1;
  contract: Contract | null;
  extras: ExtraPayment[];
  checkpoints: BalanceCheckpoint[];
  checkins: CheckIn[];
  rates: MarketRates;
  // Marcos (10%, 20%...) já comemorados, para a festa não repetir
  celebrated: number[];
  isDemo: boolean;
  createdAt: string;
}

export const emptyData = (): AppData => ({
  version: 1,
  contract: null,
  extras: [],
  checkpoints: [],
  checkins: [],
  rates: FALLBACK_RATES,
  celebrated: [],
  isDemo: false,
  createdAt: new Date().toISOString(),
});

const LS_KEY = 'atequitar_data_v1';

// Onde e como os dados estão guardados ('json' só se o SQLite não carregar)
export interface DataInfo {
  path: string;
  mode: 'portable' | 'system';
  engine: 'sqlite' | 'json';
}

export interface ElectronAPI {
  isElectron: boolean;
  platform?: string;
  windowControl?: (action: 'minimize' | 'toggle-maximize' | 'close') => Promise<void>;
  isWindowMaximized?: () => Promise<boolean>;
  onWindowMaximized?: (cb: (maximized: boolean) => void) => () => void;
  loadData: () => Promise<unknown>;
  saveData: (doc: AppData) => Promise<boolean>;
  dataInfo: () => Promise<DataInfo>;
  openDataFolder: () => Promise<boolean>;
  backupData: () => Promise<{ ok: boolean; path?: string }>;
  restoreData: () => Promise<{ ok: boolean; doc?: unknown; error?: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

// Aceita só o que tem o formato esperado; o resto volta para o padrão
export function normalizeData(raw: unknown): AppData {
  const base = emptyData();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<AppData>;
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    ...base,
    contract: r.contract && typeof r.contract === 'object' ? { ...r.contract } : null,
    extras: arr<ExtraPayment>(r.extras),
    checkpoints: arr<BalanceCheckpoint>(r.checkpoints),
    checkins: arr<CheckIn>(r.checkins),
    rates:
      r.rates && typeof r.rates === 'object' && r.rates.latest
        ? { ...FALLBACK_RATES, ...r.rates, latest: { ...FALLBACK_RATES.latest, ...r.rates.latest } }
        : FALLBACK_RATES,
    celebrated: arr<number>(r.celebrated),
    isDemo: Boolean(r.isDemo),
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : base.createdAt,
  };
}

async function loadRaw(): Promise<unknown> {
  if (window.electronAPI?.loadData) return window.electronAPI.loadData();
  try {
    const s = localStorage.getItem(LS_KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

async function saveRaw(doc: AppData): Promise<void> {
  if (window.electronAPI?.saveData) {
    await window.electronAPI.saveData(doc);
    return;
  }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(doc));
  } catch {
    // Sem espaço ou bloqueado: segue só em memória
  }
}

// Estado do app com gravação automática (agrupa alterações seguidas em uma gravação)
export function useAppData(): {
  data: AppData;
  loaded: boolean;
  update: (fn: (prev: AppData) => AppData) => void;
} {
  const [data, setData] = useState<AppData>(emptyData);
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(data);

  useEffect(() => {
    loadRaw().then((raw) => {
      const d = normalizeData(raw);
      latest.current = d;
      setData(d);
      setLoaded(true);
    });
    const flush = () => {
      window.clearTimeout(timer.current);
      void saveRaw(latest.current);
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, []);

  const update = useCallback((fn: (prev: AppData) => AppData) => {
    setData((prev) => {
      const next = fn(prev);
      latest.current = next;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void saveRaw(next), 400);
      return next;
    });
  }, []);

  return { data, loaded, update };
}

// Backup no navegador: o documento inteiro em JSON (no Electron, cópia do banco .sqlite)
export function exportBackup(data: AppData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `atequitar-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
