import type { FinanceModel } from '../lib/model';
import type { AppData } from '../lib/store';

export type ScreenId = 'home' | 'history' | 'amortize' | 'invest' | 'systems' | 'rate' | 'market' | 'learn';

export interface ScreenProps {
  model: FinanceModel;
  data: AppData;
  update: (fn: (prev: AppData) => AppData) => void;
  dark: boolean;
  go: (screen: ScreenId) => void;
  openCheckin: () => void;
  openContract: (step?: number) => void;
  refreshRates: () => void;
  ratesLoading: boolean;
}
