// Dados do app num único documento: no Electron, banco SQLite local (o processo principal
// converte o documento em tabelas); no navegador, localStorage
import { useCallback, useEffect, useRef, useState } from 'react';
import type { BalanceCheckpoint, CheckIn, Contract, ExtraPayment } from '../types/finance';
import { addMonths, currentYearMonth } from './format';
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

const emptyData = (): AppData => ({
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

// Onde fica o banco SQLite: ao lado do app (portátil) ou na pasta de dados do sistema
export interface DataInfo {
  path: string;
  mode: 'portable' | 'system';
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
  exportData: () => Promise<{ ok: boolean; path?: string }>;
  importData: () => Promise<{ ok: boolean; doc?: unknown; error?: string }>;
  // Preferências da interface guardadas no banco (lidas ao abrir a janela)
  prefs?: Record<string, string>;
  writePref?: (key: string, value: string | null) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

// Até a 1.0.1 seguros e taxa ficavam no cadastro como um valor fixo por mês: viram a fatura de
// referência do mês atual (dentro do prazo), como se fosse só o total
export function migrateContract(raw: Contract & { monthlyInsurance?: number; monthlyAdminFee?: number }, today = new Date()): Contract {
  const { monthlyInsurance, monthlyAdminFee, ...contract } = raw;
  const insurance = Number(monthlyInsurance) || 0;
  const adminFee = Number(monthlyAdminFee) || 0;
  if (contract.feesRef || !(insurance > 0 || adminFee > 0)) return contract;
  const last = addMonths(contract.firstDueMonth, Math.max(1, contract.termMonths) - 1);
  const now = currentYearMonth(today);
  const yearMonth = now < contract.firstDueMonth ? contract.firstDueMonth : now > last ? last : now;
  return { ...contract, feesRef: { yearMonth, insurance, adminFee } };
}

// Até a 1.0.1 havia o saldo do extrato do IR (31/12): vira um saldo do banco que, como antes,
// já inclui todas as amortizações registradas (só as simuladas, que vêm depois, abatem em cima).
// Se o mês já tem um saldo do banco, ele fica
const IR_INCLUDES_EXTRAS = '9999-12-30T00:00:00.000Z';
export function migrateCheckpoints(list: (Omit<BalanceCheckpoint, 'source'> & { source: string })[]): BalanceCheckpoint[] {
  const bank = new Set(list.filter((c) => c.source !== 'ir').map((c) => c.yearMonth));
  return list
    .filter((c) => c.source !== 'ir' || !bank.has(c.yearMonth))
    .map((c) => (c.source === 'ir' ? { ...c, source: 'banco' as const, createdAt: IR_INCLUDES_EXTRAS } : { ...c, source: 'banco' as const }));
}

// Aceita só o que tem o formato esperado; o resto volta para o padrão
export function normalizeData(raw: unknown): AppData {
  const base = emptyData();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<AppData>;
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    ...base,
    contract: r.contract && typeof r.contract === 'object' ? migrateContract({ ...r.contract }) : null,
    extras: arr<ExtraPayment>(r.extras),
    checkpoints: migrateCheckpoints(arr<BalanceCheckpoint>(r.checkpoints)),
    checkins: arr<CheckIn>(r.checkins),
    rates:
      r.rates && typeof r.rates === 'object' && r.rates.latest
        ? { ...FALLBACK_RATES, ...r.rates, latest: { ...FALLBACK_RATES.latest, ...r.rates.latest } }
        : FALLBACK_RATES,
    celebrated: arr<number>(r.celebrated),
    // Versões antigas perdiam a marca de exemplo ao editar o contrato; as amortizações dele a recuperam
    isDemo: Boolean(r.isDemo) || arr<ExtraPayment>(r.extras).some((e) => typeof e?.id === 'string' && e.id.startsWith('demo-')),
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

// Exportar no navegador: o mesmo formato do app desktop (sem as taxas do mercado)
export function exportJson(data: AppData): void {
  const { rates: _rates, version: _version, ...rest } = data;
  const doc = { formato: 'ate-quitar', versao: 1, exportadoEm: new Date().toISOString(), ...rest };
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `atequitar-dados-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
