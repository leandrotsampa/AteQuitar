// Financiamento de exemplo para explorar o app antes de cadastrar o seu
import type { Contract } from '../types/finance';
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
    // Começou há 4 anos e 3 meses
    firstDueMonth: addMonths(currentYearMonth(), -51),
    dueDay: 10,
    trIndexed: true,
    monthlyInsurance: 98.4,
    monthlyAdminFee: 25,
  };
}
