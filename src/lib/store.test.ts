import { describe, expect, it } from 'vitest';
import type { Contract } from '../types/finance';
import { migrateContract } from './store';

const contract: Contract = {
  nickname: 'Casa',
  bank: 'Caixa',
  propertyValue: 0,
  financedAmount: 400000,
  annualRate: 10,
  cet: 0,
  termMonths: 420,
  system: 'SAC',
  firstDueMonth: '2026-03',
  dueDay: 5,
  trIndexed: true,
};

describe('migrateContract', () => {
  it('o valor fixo do cadastro vira a fatura de referência do mês atual', () => {
    const migrated = migrateContract({ ...contract, monthlyInsurance: 171.23, monthlyAdminFee: 25 }, new Date(2026, 9, 26));
    expect(migrated.feesRef).toEqual({ yearMonth: '2026-10', insurance: 171.23, adminFee: 25 });
    expect(migrated).not.toHaveProperty('monthlyInsurance');
    expect(migrated).not.toHaveProperty('monthlyAdminFee');
  });

  it('antes da primeira parcela, a referência é a primeira parcela', () => {
    const migrated = migrateContract({ ...contract, monthlyInsurance: 100, monthlyAdminFee: 0 }, new Date(2025, 0, 1));
    expect(migrated.feesRef?.yearMonth).toBe('2026-03');
  });

  it('sem valor antigo, ou já migrado, não muda nada', () => {
    expect(migrateContract({ ...contract, monthlyInsurance: 0, monthlyAdminFee: 0 }).feesRef).toBeUndefined();
    const ref = { yearMonth: '2026-09', insurance: 171.18, mip: 54.68, dfi: 116.5, adminFee: 25 };
    expect(migrateContract({ ...contract, feesRef: ref, monthlyInsurance: 99 }).feesRef).toBe(ref);
  });
});
