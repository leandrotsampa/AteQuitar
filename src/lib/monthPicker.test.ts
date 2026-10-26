import { describe, expect, it } from 'vitest';
import { clampMonth, isOutside, navigateMonth } from './monthPicker';

describe('navigateMonth', () => {
  it('anda pela grade de 3 colunas', () => {
    expect(navigateMonth('2026-05', 'ArrowRight')).toBe('2026-06');
    expect(navigateMonth('2026-05', 'ArrowUp')).toBe('2026-02');
    expect(navigateMonth('2026-01', 'ArrowLeft')).toBe('2025-12');
    expect(navigateMonth('2026-05', 'Home')).toBe('2026-01');
    expect(navigateMonth('2026-05', 'PageDown')).toBe('2027-05');
    expect(navigateMonth('2026-05', 'Enter')).toBeNull();
  });

  it('para nos limites', () => {
    expect(navigateMonth('2026-10', 'ArrowRight', undefined, '2026-10')).toBeNull();
    expect(navigateMonth('2026-09', 'ArrowDown', undefined, '2026-10')).toBe('2026-10');
    expect(navigateMonth('2022-07', 'ArrowLeft', '2022-07')).toBeNull();
  });
});

describe('clampMonth / isOutside', () => {
  it('respeita mínimo e máximo', () => {
    expect(clampMonth('2020-01', '2022-07', '2026-10')).toBe('2022-07');
    expect(clampMonth('2030-01', '2022-07', '2026-10')).toBe('2026-10');
    expect(isOutside('2026-11', undefined, '2026-10')).toBe(true);
    expect(isOutside('2026-10', undefined, '2026-10')).toBe(false);
  });
});
