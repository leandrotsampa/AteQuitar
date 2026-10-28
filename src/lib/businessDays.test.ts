import { describe, expect, it } from 'vitest';
import { businessDaysBetween, isBusinessDay } from './businessDays';

describe('dias úteis', () => {
  it('feriados nacionais fixos e móveis não contam', () => {
    expect(isBusinessDay(new Date(2026, 9, 12))).toBe(false); // Nossa Senhora Aparecida
    expect(isBusinessDay(new Date(2026, 10, 2))).toBe(false); // Finados
    expect(isBusinessDay(new Date(2026, 1, 16))).toBe(false); // Carnaval de 2026
    expect(isBusinessDay(new Date(2026, 3, 3))).toBe(false); // Sexta-feira Santa de 2026
    expect(isBusinessDay(new Date(2026, 5, 4))).toBe(false); // Corpus Christi de 2026
    expect(isBusinessDay(new Date(2026, 9, 26))).toBe(true);
  });
  it('de 05/10 a 05/11/2026 são 21 dias úteis', () => {
    expect(businessDaysBetween(new Date(2026, 9, 5), new Date(2026, 10, 5))).toBe(21);
    expect(businessDaysBetween(new Date(2026, 9, 5), new Date(2026, 9, 26))).toBe(14);
  });
});
