import { describe, expect, it } from 'vitest';
import { compareInvestment, incomeTaxRate, netAnnual, type Product } from './invest';

const cdb: Product = { key: 'cdb', label: 'CDB', detail: '', grossAnnual: 12, taxFree: false };

describe('incomeTaxRate', () => {
  it('segue a tabela regressiva', () => {
    expect(incomeTaxRate(100)).toBe(0.225);
    expect(incomeTaxRate(300)).toBe(0.2);
    expect(incomeTaxRate(700)).toBe(0.175);
    expect(incomeTaxRate(800)).toBe(0.15);
  });
});

describe('netAnnual', () => {
  it('isento rende o bruto', () => {
    expect(netAnnual({ ...cdb, taxFree: true }, 24)).toBeCloseTo(12, 6);
  });
  it('em 1 ano o IR de 20% leva 12% para 9,6%', () => {
    expect(netAnnual(cdb, 12)).toBeCloseTo(9.6, 6);
  });
});

describe('compareInvestment', () => {
  it('dívida a 11% + TR perde para investimento a 15% isento', () => {
    const r = compareInvestment({
      amount: 10000,
      months: 60,
      contractAnnual: 11,
      trAnnual: 1,
      ipca12: 4,
      product: { ...cdb, grossAnnual: 15, taxFree: true },
    });
    expect(r.debtAnnual).toBeCloseTo(12.11, 2);
    expect(r.verdict).toBe('investir');
    expect(r.gap).toBeGreaterThan(0);
  });
  it('o seguro MIP entra no custo da dívida', () => {
    const r = compareInvestment({ amount: 10000, months: 60, contractAnnual: 11, trAnnual: 1, insuranceAnnual: 0.2, ipca12: 4, product: cdb });
    expect(r.debtAnnual).toBeCloseTo((1.11 * 1.01 * 1.002 - 1) * 100, 6);
  });
  it('dívida cara pede amortização', () => {
    const r = compareInvestment({ amount: 10000, months: 120, contractAnnual: 14, trAnnual: 2, ipca12: 4, product: cdb });
    expect(r.verdict).toBe('amortizar');
  });
});
