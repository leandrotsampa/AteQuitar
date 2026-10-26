import { describe, expect, it } from 'vitest';
import { annualToMonthly, bankPreposition, effectiveToNominal, nominalToEffective, withBank } from './format';

describe('bankPreposition', () => {
  it('bancos levam "no"', () => {
    for (const b of ['Banco do Brasil', 'Itaú', 'Bradesco', 'Santander', 'Inter', 'BRB', 'Nubank']) {
      expect(bankPreposition(b)).toBe('no');
    }
  });

  it('caixa, cooperativas e financeiras levam "na"', () => {
    for (const b of ['Caixa', 'Caixa Econômica Federal', 'Cooperativa', 'Cooperativa Sicoob Credicitrus', 'Cresol', 'Sicredi', 'Unicred', 'Poupex', 'Financeira XYZ', 'CEF']) {
      expect(bankPreposition(b)).toBe('na');
    }
  });

  it('ignora artigo e espaços digitados', () => {
    expect(bankPreposition('  a Caixa ')).toBe('na');
    expect(withBank(' Itaú ')).toBe('no Itaú');
    expect(withBank('')).toBe('');
  });
});

describe('taxa nominal e efetiva', () => {
  it('9,3764% nominal da Caixa é 9,79% efetiva e 0,7814% ao mês', () => {
    expect(nominalToEffective(9.3764)).toBeCloseTo(9.79, 2);
    expect(annualToMonthly(nominalToEffective(9.3764))).toBeCloseTo(0.7814, 4);
  });

  it('ida e volta entre nominal e efetiva', () => {
    expect(effectiveToNominal(nominalToEffective(10.5))).toBeCloseTo(10.5, 8);
    expect(effectiveToNominal(9.79)).toBeCloseTo(9.3764, 3);
  });
});
