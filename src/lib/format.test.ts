import { describe, expect, it } from 'vitest';
import { bankPreposition, withBank } from './format';

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
