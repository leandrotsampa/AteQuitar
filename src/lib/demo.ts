// Financiamento de exemplo para explorar o app antes de cadastrar o seu: começou há uns 11 anos
// e já teve amortização com FGTS e com o 13º. Sem saldo real informado: o selo mostra "Estimado"
import type { Contract, ExtraPayment } from '../types/finance';
import { addMonths, currentYearMonth } from './format';

export function demoContract(): Contract {
  return {
    nickname: 'Apartamento de exemplo',
    bank: 'Caixa',
    propertyValue: 450000,
    financedAmount: 360000,
    annualRate: 10.49,
    cet: 11.32,
    termMonths: 360,
    system: 'SAC',
    firstDueMonth: addMonths(currentYearMonth(), -131),
    dueDay: 10,
    trIndexed: true,
    monthlyInsurance: 98.4,
    monthlyAdminFee: 25,
  };
}

export function demoData(): { contract: Contract; extras: ExtraPayment[] } {
  const now = currentYearMonth();
  return {
    contract: demoContract(),
    extras: [
      { id: 'demo-fgts', yearMonth: addMonths(now, -30), amount: 25000, mode: 'prazo', source: 'fgts' },
      { id: 'demo-13', yearMonth: `${Number(now.slice(0, 4)) - 1}-12`, amount: 6000, mode: 'prazo', source: 'decimo' },
    ],
  };
}
