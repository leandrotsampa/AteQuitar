import { describe, expect, it } from 'vitest';
import type { Contract } from '../types/finance';
import { migrateCheckpoints } from './store';
import { balanceFromInvoice, buildSchedule, effectiveExtra, lastDueBefore, lastPaidMonth, summarize, simulateExtra, compareSystems } from './finance';

const base: Contract = {
  nickname: 'Teste',
  bank: 'Banco',
  propertyValue: 500000,
  financedAmount: 120000,
  annualRate: 12.6825, // 1% a.m.
  cet: 0,
  termMonths: 120,
  system: 'SAC',
  firstDueMonth: '2020-01',
  dueDay: 10,
  trIndexed: false,
};

describe('buildSchedule', () => {
  it('SAC: amortização constante e juros de 1% sobre o saldo', () => {
    const rows = buildSchedule(base);
    expect(rows).toHaveLength(120);
    expect(rows[0].amortization).toBeCloseTo(1000, 2);
    expect(rows[0].interest).toBeCloseTo(1200, 1);
    expect(rows[0].payment).toBeCloseTo(2200, 1);
    expect(rows[119].closingBalance).toBeCloseTo(0, 6);
    expect(rows[119].yearMonth).toBe('2029-12');
  });

  it('Price: parcela constante pela fórmula', () => {
    const rows = buildSchedule({ ...base, system: 'PRICE' });
    const pmt = (120000 * 0.01) / (1 - Math.pow(1.01, -120));
    expect(rows[0].payment).toBeCloseTo(pmt, 1);
    expect(rows[60].payment).toBeCloseTo(pmt, 1);
    expect(rows[119].closingBalance).toBeCloseTo(0, 6);
  });

  it('soma seguros e taxa na parcela sem mexer no saldo', () => {
    const rows = buildSchedule({ ...base, feesRef: { yearMonth: '2020-01', insurance: 50, adminFee: 25 } });
    expect(rows[0].fees).toBe(75);
    expect(rows[0].payment).toBeCloseTo(2275, 1);
    expect(rows[0].closingBalance).toBeCloseTo(119000, 2);
    expect(rows[0].feesFromInvoice).toBe(true);
    expect(rows[1].feesFromInvoice).toBe(false);
  });

  it('sem fatura informada, a parcela não tem seguros', () => {
    const rows = buildSchedule(base);
    expect(rows[5].fees).toBe(0);
  });

  it('MIP acompanha o saldo e DFI segue a TR, para frente e para trás', () => {
    const c = { ...base, trIndexed: true, feesRef: { yearMonth: '2020-03', insurance: 160, mip: 60, dfi: 100, adminFee: 25 } };
    const rows = buildSchedule(c, { trFor: () => 0.5 });
    const at = (ym: string) => rows.find((r) => r.yearMonth === ym)!;
    const corrected = (ym: string) => at(ym).openingBalance + at(ym).correction;
    expect(at('2020-03')).toMatchObject({ mip: 60, dfi: 100, insurance: 160, fees: 185 });
    expect(at('2020-04').dfi).toBeCloseTo(100.5, 2);
    expect(at('2020-04').mip).toBeCloseTo((60 * corrected('2020-04')) / corrected('2020-03'), 2);
    expect(at('2020-02').dfi).toBeCloseTo(100 / 1.005, 2);
    expect(at('2020-02').mip!).toBeGreaterThan(60);
    expect(at('2020-04').adminFee).toBe(25);
  });

  it('só com o total, ele inteiro segue a TR', () => {
    const rows = buildSchedule({ ...base, trIndexed: true, feesRef: { yearMonth: '2020-01', insurance: 171.37, adminFee: 25 } }, { trFor: () => 0.2 });
    expect(rows[1].insurance).toBeCloseTo(171.71, 2);
    expect(rows[1].mip).toBeUndefined();
  });

  it('a fatura do check-in vale a partir do seu mês e ganha da do cadastro', () => {
    const c = { ...base, feesRef: { yearMonth: '2020-01', insurance: 100, adminFee: 25 } };
    const rows = buildSchedule(c, {
      invoices: [
        { yearMonth: '2020-06', insurance: 130, mip: 50, dfi: 80, adminFee: 25 },
        { yearMonth: '2020-01', insurance: 110, adminFee: 0 },
      ],
    });
    expect(rows[0].fees).toBe(110);
    expect(rows[4].insurance).toBe(110);
    expect(rows[5]).toMatchObject({ insurance: 130, feesFromInvoice: true });
    expect(rows[6].dfi).toBe(80);
    expect(rows[6].mip!).toBeLessThan(50);
  });

  it('marca os meses sem a TR oficial', () => {
    const rows = buildSchedule({ ...base, trIndexed: true }, { trFor: () => 0.1, trOfficial: (ym) => ym !== '2020-02' });
    expect(rows.map((r) => r.trEstimated).slice(0, 3)).toEqual([false, true, false]);
    expect(buildSchedule(base, { trOfficial: () => false })[0].trEstimated).toBe(false);
  });

  it('TR corrige o saldo antes dos juros', () => {
    const rows = buildSchedule({ ...base, trIndexed: true }, { trFor: () => 0.5 });
    expect(rows[0].correction).toBeCloseTo(600, 2);
    expect(rows[0].interest).toBeCloseTo(120600 * 0.01, 1);
    expect(rows[0].amortization).toBeCloseTo(120600 / 120, 2);
  });

  it('amortização extra reduzindo o prazo encurta o financiamento', () => {
    const rows = buildSchedule(base, {
      extras: [{ id: 'x', yearMonth: '2020-01', amount: 30000, mode: 'prazo', source: 'proprio' }],
    });
    // Saldo 89.000 a 1.000 por mês: 89 parcelas restantes
    expect(rows).toHaveLength(90);
    expect(rows[1].amortization).toBeCloseTo(1000, 2);
  });

  it('amortização extra reduzindo a parcela mantém o prazo', () => {
    const rows = buildSchedule(base, {
      extras: [{ id: 'x', yearMonth: '2020-01', amount: 30000, mode: 'parcela', source: 'proprio' }],
    });
    expect(rows).toHaveLength(120);
    expect(rows[1].amortization).toBeCloseTo(89000 / 119, 2);
  });

  it('saldo real informado substitui o calculado', () => {
    const rows = buildSchedule(base, {
      checkpoints: [{ id: 'c', yearMonth: '2020-06', balance: 100000, source: 'banco' }],
    });
    const june = rows.find((r) => r.yearMonth === '2020-06')!;
    expect(june.closingBalance).toBe(100000);
    expect(june.checkpoint).toBe('banco');
    expect(rows[6].amortization).toBeCloseTo(100000 / 114, 2);
  });

  it('amortização lançada depois do saldo do mesmo mês abate em cima dele', () => {
    const cp = { id: 'c', yearMonth: '2020-06', balance: 100000, source: 'banco' as const, createdAt: '2020-06-10T00:00:00.000Z' };
    const extra = { id: 'x', yearMonth: '2020-06', amount: 10000, mode: 'prazo' as const, source: 'proprio' as const };
    const june = (createdAt?: string) =>
      buildSchedule(base, { checkpoints: [cp], extras: [{ ...extra, createdAt }] }).find((r) => r.yearMonth === '2020-06')!;
    expect(june('2020-06-20T00:00:00.000Z').closingBalance).toBe(90000);
    // Lançada antes do saldo, ou sem data (registro antigo): o saldo informado já inclui
    expect(june('2020-06-01T00:00:00.000Z').closingBalance).toBe(100000);
    expect(june(undefined).closingBalance).toBe(100000);
  });

  it('saldo do IR das versões antigas (31/12) continua incluindo as amortizações de dezembro', () => {
    const rows = buildSchedule(base, {
      checkpoints: migrateCheckpoints([{ id: 'c', yearMonth: '2020-12', balance: 95000, source: 'ir' }]),
      extras: [{ id: 'x', yearMonth: '2020-12', amount: 5000, mode: 'prazo', source: 'proprio', createdAt: '2021-03-01T00:00:00.000Z' }],
    });
    expect(rows.find((r) => r.yearMonth === '2020-12')!.closingBalance).toBe(95000);
  });
});

describe('summarize', () => {
  it('conta parcelas pagas até hoje e o saldo atual', () => {
    const rows = buildSchedule(base);
    const s = summarize(base, rows, new Date(2020, 11, 15)); // dez/2020, depois do dia 10
    expect(s.paidCount).toBe(12);
    expect(s.currentBalance).toBeCloseTo(108000, 2);
    expect(s.remainingCount).toBe(108);
    expect(s.progress).toBeCloseTo(0.1, 4);
    expect(s.next?.yearMonth).toBe('2021-01');
  });

  it('antes do vencimento a parcela do mês ainda não conta como paga', () => {
    const rows = buildSchedule(base);
    const s = summarize(base, rows, new Date(2020, 11, 5));
    expect(s.paidCount).toBe(11);
  });
});

describe('simulateExtra', () => {
  it('extra único reduzindo prazo economiza juros e meses', () => {
    const r = simulateExtra(base, {}, { amount: 30000, startYm: '2020-01', frequency: 'once', mode: 'prazo' });
    expect(r.monthsSaved).toBe(30);
    expect(r.interestSaved).toBeGreaterThan(0);
  });

  it('simular no mês de um saldo informado ainda mostra a economia', () => {
    const opts = { checkpoints: [{ id: 'c', yearMonth: '2020-06', balance: 100000, source: 'banco' as const }] };
    const r = simulateExtra(base, opts, { amount: 10000, startYm: '2020-06', frequency: 'once', mode: 'prazo' });
    expect(r.totalExtra).toBe(10000);
    expect(r.interestSaved).toBeGreaterThan(0);
  });
});

describe('compareSystems', () => {
  it('SAC paga menos juros que Price no total', () => {
    const c = compareSystems(base);
    expect(c.sac.totalInterest).toBeLessThan(c.price.totalInterest);
    expect(c.sac.firstPayment).toBeGreaterThan(c.price.firstPayment);
  });
});

// Contrato como o das faturas reais: 9,79% ao ano, vencimento dia 5
const caixa: Contract = { ...base, financedAmount: 388000, annualRate: 9.79, termMonths: 420, firstDueMonth: '2026-03', dueDay: 5, trIndexed: true };

describe('fatura do check-in', () => {
  it('calcula o saldo depois da parcela pelos juros e pela amortização', () => {
    // Agosto: juros 2.985,98 e amortização 1.046,98; o banco mostrou 381.102,47
    expect(balanceFromInvoice(caixa, 2985.98, 1046.98)!).toBeCloseTo(381102.47, -1);
    // Setembro: o banco mostrou 380.711,09 (juros arredondados: poucos reais de diferença)
    expect(Math.abs(balanceFromInvoice(caixa, 2982.93, 1048.79)! - 380711.09)).toBeLessThan(10);
  });

  it('amortização e juros da fatura valem no lugar dos calculados', () => {
    const rows = buildSchedule(base, { actuals: [{ yearMonth: '2020-02', amortization: 1500, interest: 1100 }] });
    expect(rows[1]).toMatchObject({ amortization: 1500, interest: 1100, fromInvoice: true });
    expect(rows[1].closingBalance).toBeCloseTo(rows[0].closingBalance - 1500, 2);
    expect(rows[2].fromInvoice).toBe(false);
  });

  it('o saldo calculado pela fatura vira ponto real, e a amortização extra do mês abate em cima', () => {
    const rows = buildSchedule(base, {
      checkpoints: [{ id: 'c', yearMonth: '2020-03', balance: 100000, source: 'fatura', createdAt: '' }],
      extras: [{ id: 'e', yearMonth: '2020-03', amount: 5000, mode: 'parcela', source: 'proprio', createdAt: '2020-03-20T00:00:00.000Z' }],
    });
    expect(rows[2].closingBalance).toBeCloseTo(95000, 2);
    expect(rows[2].checkpoint).toBe('fatura');
  });
});

describe('parcela paga', () => {
  it('o check-in de parcela já paga conta antes do vencimento', () => {
    const rows = buildSchedule(caixa);
    const day2 = new Date(2026, 10, 2); // 02/11, antes do vencimento do dia 5
    expect(summarize(caixa, rows, day2).paidCount).toBe(8); // até outubro
    expect(summarize(caixa, rows, day2, new Set(['2026-11'])).paidCount).toBe(9);
  });

  it('o saldo de hoje é o de depois da última parcela paga', () => {
    expect(lastPaidMonth(caixa, new Set(), new Date(2026, 9, 26))).toBe('2026-10');
    expect(lastPaidMonth(caixa, new Set(), new Date(2026, 10, 2))).toBe('2026-10');
    expect(lastPaidMonth(caixa, new Set(['2026-11']), new Date(2026, 10, 2))).toBe('2026-11');
    expect(lastPaidMonth(caixa, new Set(), new Date(2026, 1, 10))).toBeNull();
  });
});

describe('amortização extra', () => {
  it('desconta os juros pro rata desde o último vencimento', () => {
    // App da Caixa em 26/10: R$ 2.000 pagos, R$ 1.989,07 de amortização efetiva
    expect(effectiveExtra(caixa, 2000, '2026-10-26')).toBeCloseTo(1989.07, 0);
    expect(effectiveExtra(caixa, 2000, '2026-10-05')).toBe(2000);
  });

  it('o último vencimento antes da data respeita meses curtos', () => {
    expect(lastDueBefore(caixa, '2026-11-02').yearMonth).toBe('2026-10');
    expect(lastDueBefore({ ...caixa, dueDay: 31 }, '2026-03-01').date.getDate()).toBe(28);
  });
});
