import { describe, expect, it } from 'vitest';
import type { Contract } from '../types/finance';
import { buildSchedule, summarize, simulateExtra, compareSystems } from './finance';

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
  monthlyInsurance: 0,
  monthlyAdminFee: 0,
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
    const rows = buildSchedule({ ...base, monthlyInsurance: 50, monthlyAdminFee: 25 });
    expect(rows[0].fees).toBe(75);
    expect(rows[0].payment).toBeCloseTo(2275, 1);
    expect(rows[0].closingBalance).toBeCloseTo(119000, 2);
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
    expect(june.checkpoint).toBe(true);
    expect(rows[6].amortization).toBeCloseTo(100000 / 114, 2);
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
});

describe('compareSystems', () => {
  it('SAC paga menos juros que Price no total', () => {
    const c = compareSystems(base);
    expect(c.sac.totalInterest).toBeLessThan(c.price.totalInterest);
    expect(c.sac.firstPayment).toBeGreaterThan(c.price.firstPayment);
  });
});
