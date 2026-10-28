import type { FinanceModel } from '../lib/model';
import type { AppData } from '../lib/store';

export type ScreenId = 'home' | 'history' | 'amortize' | 'invest' | 'systems' | 'rate' | 'market' | 'learn';

export interface ScreenProps {
  model: FinanceModel;
  data: AppData;
  update: (fn: (prev: AppData) => AppData) => void;
  dark: boolean;
  go: (screen: ScreenId) => void;
  // Sem mês: o modal escolhe o mês pendente
  openCheckin: (month?: string) => void;
  openContract: (step?: number) => void;
  // Importar o Documento Descritivo do Crédito do banco
  openImport: () => void;
  refreshRates: () => void;
  ratesLoading: boolean;
  // Abrir Parcelas direto em Registros (link do cadastro)
  historyTab?: 'table' | 'records';
}
