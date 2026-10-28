import { describe, expect, it } from 'vitest';
import type { CheckIn, Contract } from '../types/finance';
import { buildSchedule } from './finance';
import { realBalances } from './model';
import { FALLBACK_RATES } from './rates';
import type { AppData } from './store';

// Os dados do financiamento das faturas: 9,3764% nominal (9,79% efetiva), vencimento dia 5
const contract: Contract = {
  nickname: 'Casa', bank: 'Caixa', propertyValue: 450000, financedAmount: 400000, annualRate: 9.79, cet: 0,
  termMonths: 420, system: 'SAC', firstDueMonth: '2026-03', dueDay: 5, trIndexed: true,
};
// TR das parcelas de outubro e novembro (período até o vencimento)
const trFor = (ym: string) => (ym === '2026-10' ? 0.115 : ym === '2026-11' ? 0.163 : 0.17);
// Saldo que o app do banco mostrava em 26/10: já com a TR de 05/10 até ali
const bank = { id: 'b', yearMonth: '2026-10', balance: 380511.89, source: 'banco' as const, createdAt: '2026-10-26T12:00:00.000Z' };
const october: CheckIn = {
  id: 'o', yearMonth: '2026-10', paidAmount: 4224.38, amortization: 1049.99, interest: 2978.16,
  fees: { insurance: 171.23, mip: 54.6, dfi: 116.63, adminFee: 25 },
  balanceAfter: 380098.85, balanceSource: 'fatura', remainingAfter: 362, createdAt: '2026-10-26T12:00:00.000Z',
};
const data = (over: Partial<AppData>): AppData => ({
  version: 1, contract, extras: [], checkpoints: [], checkins: [], rates: FALLBACK_RATES, celebrated: [], isDemo: false, createdAt: '', ...over,
});

describe('saldos reais', () => {
  it('no mesmo mês, o saldo do banco vale mais que o calculado pela fatura', () => {
    const cps = realBalances(data({ checkpoints: [bank], checkins: [october] }), contract, trFor);
    expect(cps).toHaveLength(1);
    // O prazo vem da fatura quando o saldo não trouxe o seu
    expect(cps[0]).toMatchObject({ source: 'banco', balance: 380098.96, remaining: 362 });
  });

  it('sem saldo do banco no mês, vale o calculado pela fatura', () => {
    const [cp] = realBalances(data({ checkins: [october] }), contract, trFor);
    expect(cp.source).toBe('fatura');
    // Juros arredondados: a fatura só fecha o saldo dentro de alguns centavos de real
    expect(Math.abs(cp.balance - 380098.96)).toBeLessThan(0.7);
  });

  it('o saldo do banco visto depois do vencimento perde a TR dos dias úteis, ao centavo', () => {
    const [cp] = realBalances(data({ checkpoints: [bank] }), contract, trFor);
    // Documento Descritivo do Crédito da Caixa: saldo logo depois da parcela de outubro
    expect(cp.balance).toBe(380098.96);
  });

  it('com a fatura de outubro, novembro bate com a fatura do banco', () => {
    const d = data({ checkpoints: [bank], checkins: [october] });
    const rows = buildSchedule(contract, {
      trFor,
      checkpoints: realBalances(d, contract, trFor),
      actuals: [{ yearMonth: '2026-10', amortization: 1049.99, interest: 2978.16 }],
    });
    const nov = rows.find((r) => r.yearMonth === '2026-11')!;
    // Fatura de novembro: amortização 1.051,70 e juros 2.974,81
    expect(Math.abs(nov.amortization - 1051.7)).toBeLessThan(0.02);
    expect(Math.abs(nov.interest - 2974.81)).toBeLessThan(0.02);
  });
});
