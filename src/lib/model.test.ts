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

  // Fatura de novembro registrada em 27/10, antes do vencimento (emitida sem a amortização de depois)
  const november: CheckIn = {
    id: 'n', yearMonth: '2026-11', paidAmount: 4222.88, amortization: 1051.7, interest: 2974.81, scheduled: true,
    balanceAfter: 379048.98, balanceSource: 'fatura', remainingAfter: 361, createdAt: '2026-10-27T12:00:00.000Z',
  };
  const extra = { id: 'x', yearMonth: '2026-10', amount: 5000, paid: 5000, date: '2026-10-28', mode: 'prazo' as const, source: 'proprio' as const, createdAt: '2026-10-28T15:00:00.000Z' };

  it('fatura registrada antes do vencimento não define o saldo nem o prazo', () => {
    expect(realBalances(data({ checkpoints: [bank], checkins: [october, november] }), contract, trFor).map((c) => c.yearMonth)).toEqual(['2026-10']);
    // Paga adiantada ("Já paguei") também: o banco só abate a parcela no vencimento
    const paga = { ...november, scheduled: undefined };
    expect(realBalances(data({ checkpoints: [bank], checkins: [october, paga] }), contract, trFor).map((c) => c.yearMonth)).toEqual(['2026-10']);
  });

  it('fatura registrada no vencimento ou depois continua definindo o saldo', () => {
    const depois = { ...november, scheduled: undefined, createdAt: '2026-11-06T12:00:00.000Z' };
    expect(realBalances(data({ checkpoints: [bank], checkins: [october, depois] }), contract, trFor).map((c) => c.yearMonth).sort()).toEqual(['2026-10', '2026-11']);
  });

  it('com a fatura seguinte agendada, a amortização registrada abate o saldo e o prazo', () => {
    const run = (extras: (typeof extra)[]) => {
      const d = data({ checkpoints: [bank], checkins: [october, november], extras });
      return buildSchedule(contract, {
        trFor,
        extras,
        checkpoints: realBalances(d, contract, trFor),
        actuals: [october, november].map((ci) => ({ yearMonth: ci.yearMonth, amortization: ci.amortization!, interest: ci.interest! })),
      });
    };
    const sem = run([]);
    const com = run([extra]);
    const nov = (rows: ReturnType<typeof run>) => rows.find((r) => r.yearMonth === '2026-11')!;
    // Novembro é a fatura (juros e amortização dela) nos dois casos; o saldo depois cai com a amortização
    expect(nov(com).interest).toBe(2974.81);
    expect(nov(sem).closingBalance - nov(com).closingBalance).toBeGreaterThan(5000);
    // Sem amortização, o saldo calculado (saldo real de outubro + TR − amortização da fatura) fica a
    // menos de R$ 2 do que se tira da fatura pelos juros arredondados (aqui, R$ 1,58)
    const depois = { ...november, scheduled: undefined, createdAt: '2026-11-06T12:00:00.000Z' };
    const pelaFatura = realBalances(data({ checkpoints: [bank], checkins: [october, depois] }), contract, trFor).find((c) => c.yearMonth === '2026-11')!;
    expect(Math.abs(nov(sem).closingBalance - pelaFatura.balance)).toBeLessThan(2);
    expect(com.length).toBeLessThan(sem.length);
  });
});
